"use client";

import React, { useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { ARTIFACTS, ARTIFACT_BY_ID } from "@/game/data/artifacts";
import { ERA_BY_ID, PLAYABLE_ERA_PATH } from "@/game/data/eras";
import { CITY_BY_ID } from "@/game/data/cities";
import { LEADERS } from "@/game/data/units";
import { BUILDINGS } from "@/game/data/buildings";
import { ACHIEVEMENTS } from "@/game/data/events";
import { eraIndex, evaluateMetric } from "@/game/engine";
import type { ArtifactDef, ArtifactCategory, EraId } from "@/game/types";
import { ConfidenceBadge, Progress, SectionTitle, Sheet, Tabs, fmt } from "./ui";

const CAT_ICON: Record<ArtifactCategory, string> = {
  coin: "🪙",
  inscription: "𓂀",
  seal: "🔏",
  pottery: "🏺",
  textile: "🧵",
  architecture: "🏛",
  tool: "⚒",
  ceremonial: "🏆",
};

const RARITY: Record<ArtifactDef["rarity"], string> = { common: "text-white/60", rare: "text-sky-300", epic: "text-amber-300" };

export default function MuseumPanel() {
  const { state } = useGame();
  const [hall, setHall] = useState<"artifacts" | "eras" | "leaders" | "architecture" | "achievements">("artifacts");
  const [open, setOpen] = useState<ArtifactDef | null>(null);
  const eraIdx = eraIndex(state.eraId);
  const byEra = useMemo(() => {
    const m: Partial<Record<EraId, ArtifactDef[]>> = {};
    ARTIFACTS.forEach((a) => (m[a.era] = [...(m[a.era] ?? []), a]));
    return m;
  }, []);
  const total = ARTIFACTS.filter((a) => eraIndex(a.era) <= eraIdx).length;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 pb-32 pt-4 no-scrollbar">
      <SectionTitle sub={`${state.artifacts.length}/${ARTIFACTS.length} artifacts catalogued · ${total} available so far`}>Museum</SectionTitle>
      <Tabs items={[{ id: "artifacts" as const, label: "Artifact halls" }, { id: "eras" as const, label: "Era rooms" }, { id: "leaders" as const, label: "Leader gallery" }, { id: "architecture" as const, label: "Architecture" }, { id: "achievements" as const, label: "Achievements" }]} value={hall} onChange={setHall} />

      {hall === "artifacts" && (
        <div className="mt-3 space-y-5">
          {PLAYABLE_ERA_PATH.map((e) => {
            const list = byEra[e] ?? [];
            const era = ERA_BY_ID[e];
            const locked = eraIndex(e) > eraIdx;
            return (
              <div key={e}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-display text-xl" style={{ color: era.visual.accent }}>{era.name} hall</div>
                  <span className="text-xs text-white/45">{list.filter((a) => state.artifacts.includes(a.id)).length}/{list.length}</span>
                </div>
                <div className="relative rounded-3xl p-3" style={{ background: `linear-gradient(180deg, ${era.visual.primary}33, transparent)`, border: `1px solid ${era.visual.accent}33` }}>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {list.map((a) => {
                      const owned = state.artifacts.includes(a.id);
                      return (
                        <button key={a.id} onClick={() => owned && setOpen(a)} className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 text-center transition ${owned ? "border-white/15 bg-white/6 hover:bg-white/10" : "border-dashed border-white/10 opacity-50"}`}>
                          <div className="text-3xl" style={{ filter: owned ? "none" : "grayscale(1) blur(1px)" }}>{owned ? CAT_ICON[a.category] : "❔"}</div>
                          <div className={`mt-1 line-clamp-2 text-[10px] leading-tight ${owned ? "" : "text-white/40"}`}>{owned ? a.name : locked ? "Future era" : "Undiscovered"}</div>
                          {a.fictional && owned && <span className="absolute right-1 top-1 rounded-full bg-fuchsia-500/30 px-1 text-[8px] text-fuchsia-100">GAME</span>}
                          <span className={`absolute left-1 top-1 text-[8px] uppercase ${RARITY[a.rarity]}`}>{owned ? a.rarity : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${era.visual.secondary}, transparent)` }} />
                </div>
              </div>
            );
          })}
          <div className="text-[11px] text-white/40">Real artifacts are described from published scholarship with a confidence label. Items marked GAME are fictional collection pieces.</div>
        </div>
      )}

      {hall === "eras" && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {PLAYABLE_ERA_PATH.map((e) => {
            const era = ERA_BY_ID[e];
            const visited = eraIndex(e) <= eraIdx;
            const completed = state.erasCompleted.includes(e);
            return (
              <div key={e} className={`card ${visited ? "" : "opacity-50"}`} style={{ borderColor: `${era.visual.accent}44` }}>
                <div className="flex items-center justify-between"><div className="font-display text-2xl" style={{ color: era.visual.accent }}>{era.name}</div><span className="chip">{completed ? "Completed" : visited ? "Current" : "Locked"}</span></div>
                <div className="text-xs text-white/50">{era.dynasty} · {era.subtitle}</div>
                <p className="mt-2 text-sm text-white/70">{era.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="chip">Motif: {era.visual.motif}</span>
                  <span className="chip">🎵 {era.musicPlaceholder}</span>
                  <ConfidenceBadge source={era.source} />
                </div>
                <div className="mt-2 text-[11px] text-white/45">Buildings from this era in your city: {state.buildings.filter((b) => b.builtEra === e).length} · preserved heritage: {state.buildings.filter((b) => b.builtEra === e && b.layer === "heritage").length}</div>
              </div>
            );
          })}
        </div>
      )}

      {hall === "leaders" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEADERS.map((l) => {
            const unlocked = state.leaders.includes(l.id);
            return (
              <div key={l.id} className={`card ${unlocked ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <div className="font-display grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: `${ERA_BY_ID[l.era].visual.primary}77`, border: `1px solid ${ERA_BY_ID[l.era].visual.accent}66` }}>{unlocked ? l.name[0] : "?"}</div>
                  <div><div className="font-semibold">{unlocked ? l.name : "Unknown figure"}</div><div className="text-xs text-white/50">{ERA_BY_ID[l.era].name} · {l.role}</div></div>
                </div>
                {unlocked && <p className="mt-2 text-xs text-white/65">{l.biography}</p>}
                <div className="mt-2"><ConfidenceBadge source={l.source} /></div>
              </div>
            );
          })}
        </div>
      )}

      {hall === "architecture" && (
        <div className="mt-3 space-y-4">
          {PLAYABLE_ERA_PATH.map((e) => (
            <div key={e}>
              <div className="font-display mb-2 text-xl" style={{ color: ERA_BY_ID[e].visual.accent }}>{ERA_BY_ID[e].name}</div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {BUILDINGS.filter((b) => b.era === e).map((b) => {
                  const built = state.buildings.some((x) => x.defId === b.id);
                  return (
                    <div key={b.id} className={`card min-w-[150px] p-3 ${built ? "" : "opacity-50"}`}>
                      <div className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ background: ERA_BY_ID[e].visual.roof }}>{b.glyph}</div>
                      <div className="mt-2 text-sm font-semibold leading-tight">{b.name}</div>
                      <div className="text-[10px] text-white/45">{built ? "In your city" : "Not yet built"}</div>
                      <div className="mt-1"><ConfidenceBadge source={b.source} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="text-[11px] text-white/40">Buildings are stylised, era-inspired designs — not archaeological reconstructions.</div>
        </div>
      )}

      {hall === "achievements" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const [c, t] = evaluateMetric(state, a.metric);
            const done = state.achievements.includes(a.id);
            return (
              <div key={a.id} className={`card flex items-center gap-3 p-3 ${done ? "border-[var(--era-accent)]/50" : ""}`}>
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${done ? "bg-[var(--era-accent)]/20" : "bg-white/5 grayscale"}`}>{a.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-white/55">{a.description}</div>
                  <div className="mt-1 flex items-center gap-2"><Progress value={c / t} /><span className="shrink-0 text-[10px] text-white/50">{fmt(Math.min(c, t))}/{fmt(t)}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Sheet open onClose={() => setOpen(null)} title={open.name}>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{CAT_ICON[open.category]} {open.category}</span>
            <span className={`chip ${RARITY[open.rarity]}`}>{open.rarity}</span>
            <span className="chip" style={{ color: ERA_BY_ID[open.era].visual.accent }}>{ERA_BY_ID[open.era].name}</span>
            {open.cityId && <span className="chip">📍 {CITY_BY_ID[open.cityId]?.name}</span>}
            <ConfidenceBadge source={open.source} />
          </div>
          {open.fictional && <div className="mt-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100">FICTIONAL GAME ITEM — not a real archaeological object.</div>}
          <div className="my-5 flex justify-center"><div className="grid h-32 w-32 place-items-center rounded-3xl text-6xl" style={{ background: `radial-gradient(circle, ${ERA_BY_ID[open.era].visual.primary}88, transparent 70%)` }}>{CAT_ICON[open.category]}</div></div>
          <p className="text-sm text-white/75">{open.description}</p>
          {open.source.note && <p className="mt-2 text-xs italic text-white/45">{open.source.note}</p>}
          <div className="mt-3 text-xs text-white/50">Collection value: +{open.value} Farah (awarded on discovery)</div>
        </Sheet>
      )}
      <span className="hidden">{Object.keys(ARTIFACT_BY_ID).length}</span>
    </div>
  );
}
