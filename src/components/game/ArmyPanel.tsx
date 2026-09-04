"use client";

import React, { useState } from "react";
import { useGame } from "./GameProvider";
import { UNITS, UNIT_BY_ID } from "@/game/data/units";
import { TECH_BY_ID, TECHNOLOGIES } from "@/game/data/technologies";
import { ERA_BY_ID, PLAYABLE_ERA_PATH } from "@/game/data/eras";
import { BUILDING_BY_ID } from "@/game/data/buildings";
import { buildingEfficiency, canAfford, eraIndex } from "@/game/engine";
import type { UnitRole, UnitDef } from "@/game/types";
import { ConfidenceBadge, CostList, EmptyState, Progress, SectionTitle, Sheet, Stat, fmtDuration } from "./ui";

const ROLE_LABEL: Record<UnitRole, string> = {
  infantry: "Infantry",
  ranged: "Ranged",
  light_cavalry: "Light cavalry",
  heavy_cavalry: "Heavy cavalry",
  special: "Special",
  support: "Support",
};

export default function ArmyPanel() {
  const { state, derived, now, dispatch, pushToast } = useGame();
  const [open, setOpen] = useState<UnitDef | null>(null);
  const eraIdx = eraIndex(state.eraId);
  const hasBarracks = state.buildings.some((b) => BUILDING_BY_ID[b.defId]?.category === "military" && buildingEfficiency(state, b) > 0);
  const capacity = Math.floor(state.population / 10) + 5;
  const current = UNITS.filter((u) => u.era === state.eraId);
  const legacy = state.units.filter((u) => UNIT_BY_ID[u.defId]?.era !== state.eraId);
  const training = state.training ? UNIT_BY_ID[state.training.unitId] : null;
  const milTechs = TECHNOLOGIES.filter((t) => t.branch === "military" && eraIndex(t.era) <= eraIdx);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 pb-32 pt-4 no-scrollbar">
      <SectionTitle sub="Abstract garrison strength: improves stability and route safety. No graphic combat.">Army</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Garrison" value={`${derived.armySize}/${capacity}`} hint="capacity grows with population" />
        <Stat label="Strength" value={derived.militaryStrength} hint="defence total" />
        <Stat label="Stability" value={`${derived.stability}%`} hint={`+${Math.min(10, Math.round(derived.militaryStrength / 20))} from garrison`} />
      </div>

      {training && state.training && (
        <div className="card mt-3 border-[var(--era-accent)]/50">
          <div className="flex items-center justify-between">
            <div><div className="text-[10px] font-semibold uppercase tracking-wider era-accent">Training</div><div className="font-semibold">{training.glyph} {training.name}</div></div>
            <div className="text-sm text-white/70">{fmtDuration(state.training.completesAt - now)}</div>
          </div>
          <Progress value={1 - (state.training.completesAt - now) / (training.trainSeconds * 1000)} className="mt-2" />
        </div>
      )}

      {!hasBarracks && (
        <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          Build a military building ({current.length ? BUILDING_BY_ID[Object.values(BUILDING_BY_ID).find((b) => b.era === state.eraId && b.category === "military")?.id ?? ""]?.name : ""}) in the Defensive district to train units.
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Military tradition → {ERA_BY_ID[state.eraId].dynasty} organisation</div>
        <div className="flex flex-wrap gap-1.5">
          {milTechs.map((t) => (
            <span key={t.id} className={`chip ${state.technologies.includes(t.id) ? "border-emerald-400/40 text-emerald-200" : ""}`}>
              {state.technologies.includes(t.id) ? "✓" : "○"} {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">{ERA_BY_ID[state.eraId].name} roster</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {current.map((u) => {
            const owned = state.units.find((x) => x.defId === u.id)?.count ?? 0;
            const techOk = !u.requiresTech || state.technologies.includes(u.requiresTech);
            return (
              <button key={u.id} onClick={() => setOpen(u)} className={`card flex items-center gap-3 p-3 text-left ${techOk ? "" : "opacity-60"}`}>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `${ERA_BY_ID[u.era].visual.primary}66` }}>{u.glyph}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{u.name}</span>{owned > 0 && <span className="chip era-accent">×{owned}</span>}</div>
                  <div className="text-[11px] text-white/55">{ROLE_LABEL[u.role]} · ⚔{u.attack} 🛡{u.defense} ❤{u.health} {u.range ? `🎯${u.range}` : ""}</div>
                  <div className="mt-1"><CostList cost={u.cost} have={state.resources} /></div>
                  {!techOk && <div className="mt-1 text-[11px] text-amber-300">Requires {TECH_BY_ID[u.requiresTech!]?.name}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Collection · units from earlier eras</div>
        {legacy.length === 0 ? (
          <EmptyState icon="🏺" title="No legacy formations" text="Units trained in earlier eras remain in your collection after the age changes." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {legacy.map((u) => {
              const d = UNIT_BY_ID[u.defId];
              return (
                <button key={u.defId} onClick={() => setOpen(d)} className="card flex items-center gap-2 p-2 pr-3 text-left">
                  <span className="text-2xl">{d.glyph}</span>
                  <div><div className="text-sm font-semibold">{d.name} ×{u.count}</div><div className="text-[10px] text-white/50">{ERA_BY_ID[d.era].name}</div></div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Roster evolution</div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PLAYABLE_ERA_PATH.map((e) => (
            <div key={e} className={`card min-w-[160px] p-3 ${eraIndex(e) > eraIdx ? "opacity-50" : ""}`} style={{ borderColor: `${ERA_BY_ID[e].visual.accent}44` }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ERA_BY_ID[e].visual.accent }}>{ERA_BY_ID[e].name}</div>
              <div className="mt-1 text-2xl">{UNITS.filter((u) => u.era === e).map((u) => u.glyph).join(" ")}</div>
              <div className="text-[11px] text-white/50">{UNITS.filter((u) => u.era === e).length} unit types</div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <Sheet open onClose={() => setOpen(null)} title={<span>{open.glyph} {open.name}</span>}>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{ROLE_LABEL[open.role]}</span>
            <span className="chip" style={{ color: ERA_BY_ID[open.era].visual.accent }}>{ERA_BY_ID[open.era].name}</span>
            <ConfidenceBadge source={open.source} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Attack" value={open.attack} />
            <Stat label="Defence" value={open.defense} />
            <Stat label="Health" value={open.health} />
            <Stat label="Movement" value={open.movement} />
            <Stat label="Range" value={open.range ?? "—"} />
            <Stat label="Capacity" value={open.capacity} />
          </div>
          <div className="mt-3 rounded-2xl bg-white/4 p-3 text-sm text-white/70"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Historical note</div>{open.history}{open.source.note && <div className="mt-1 text-xs italic text-white/40">{open.source.note}</div>}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-white/60"><span>Training time</span><span>{fmtDuration(open.trainSeconds * 1000)}</span></div>
          <div className="mt-2"><CostList cost={open.cost} have={state.resources} /></div>
          <button
            className="btn btn-primary mt-4 w-full"
            disabled={open.era !== state.eraId || !!state.training || !hasBarracks || !canAfford(state.resources, open.cost) || (open.requiresTech ? !state.technologies.includes(open.requiresTech) : false)}
            onClick={async () => {
              const ok = await dispatch({ type: "train", unitId: open.id });
              if (ok) { pushToast(`Training ${open.name}`, "success"); setOpen(null); }
            }}
          >
            {open.era !== state.eraId ? "Legacy unit — no longer trained" : state.training ? "Training in progress" : "Train"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
