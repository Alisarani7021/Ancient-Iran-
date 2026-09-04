"use client";

import React, { useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { ERAS, ERA_BY_ID, HISTORICAL_EVENTS, PLAYABLE_ERA_PATH, formatYear } from "@/game/data/eras";
import { CITIES } from "@/game/data/cities";
import { LEADERS } from "@/game/data/units";
import { TECHNOLOGIES } from "@/game/data/technologies";
import { ARTIFACTS } from "@/game/data/artifacts";
import { BUILDINGS } from "@/game/data/buildings";
import { currentYear, eraIndex, eraProgress } from "@/game/engine";
import { ConfidenceBadge, EmptyState, Progress, SectionTitle, Stat, Tabs, fmt } from "./ui";

const KIND_ICON: Record<string, string> = {
  founded: "🏕",
  building: "🏗",
  landmark: "🏛",
  population: "👥",
  technology: "📜",
  era: "⏳",
  discovery: "🧭",
  trade: "🐫",
  capital: "👑",
  event: "⚖️",
  divergence: "🌀",
  achievement: "🏆",
  artifact: "🏺",
  heritage: "🏛",
  specialization: "🎯",
};

export default function HistoryPanel() {
  const { state, derived, dispatch, setTab } = useGame();
  const [sub, setSub] = useState<"timeline" | "chronicle" | "encyclopedia" | "summary">("timeline");
  const year = currentYear(state);
  const prog = eraProgress(state);
  const era = ERA_BY_ID[state.eraId];
  const eraIdx = eraIndex(state.eraId);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 pb-32 pt-4 no-scrollbar">
      <SectionTitle sub={`${formatYear(year)} · ${era.dynasty} · ${state.mode === "alternate" ? "ALTERNATE HISTORY" : "Historical mode"}`}>History</SectionTitle>
      <Tabs items={[{ id: "timeline" as const, label: "Timeline" }, { id: "chronicle" as const, label: "City chronicle" }, { id: "encyclopedia" as const, label: "Encyclopedia" }, { id: "summary" as const, label: "Your history" }]} value={sub} onChange={setSub} />

      {sub === "timeline" && (
        <div className="mt-3">
          <div className="card mb-3" style={{ borderColor: `${era.visual.accent}66` }}>
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-wider era-accent">Current era</div><div className="font-display text-3xl">{era.name}</div><div className="text-xs text-white/50">{formatYear(era.startYear)} – {formatYear(era.endYear)} · {era.dynasty}</div></div>
              <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-white/40">Year</div><div className="font-display text-3xl">{formatYear(year)}</div></div>
            </div>
            {prog.next ? (
              <>
                <div className="mt-3 flex justify-between text-xs"><span className="text-white/60">Progress to the {ERA_BY_ID[prog.next].name}</span><span>{Math.round(prog.ratio * 100)}%</span></div>
                <Progress value={prog.ratio} className="mt-1" />
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {prog.items.map((i) => (
                    <div key={i.label} className="flex justify-between text-[11px]"><span className={i.done ? "text-emerald-300" : "text-white/60"}>{i.done ? "✓" : "○"} {i.label}</span><span className="text-white/40">{fmt(Math.min(i.current, i.target))}/{fmt(i.target)}</span></div>
                  ))}
                </div>
                {prog.canAdvance && (
                  <button className="btn btn-primary pulse-glow mt-3 w-full" onClick={() => dispatch({ type: "advance_era" })}>
                    ⏳ The age changes — enter the {ERA_BY_ID[prog.next].name}
                  </button>
                )}
              </>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/4 p-3 text-xs text-white/60">You have reached the last era of the current prototype. Later eras are defined in the timeline and will open in future updates.</div>
            )}
          </div>

          <div className="relative ml-3 border-l border-white/10 pl-5">
            {ERAS.map((e) => {
              const isCurrent = e.id === state.eraId;
              const done = state.erasCompleted.includes(e.id);
              const future = !e.playable || eraIndex(e.id) > eraIdx;
              const evs = HISTORICAL_EVENTS.filter((h) => h.era === e.id);
              return (
                <div key={e.id} className="relative mb-4">
                  <span className="absolute -left-[27px] top-1.5 grid h-4 w-4 place-items-center rounded-full border" style={{ background: isCurrent ? e.visual.accent : done ? e.visual.primary : "#111", borderColor: e.visual.accent }} />
                  <div className={`card ${future && !isCurrent ? "opacity-60" : ""}`} style={{ borderColor: isCurrent ? `${e.visual.accent}88` : undefined }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><div className="font-display text-xl" style={{ color: e.visual.accent }}>{e.name}</div><div className="text-[11px] text-white/50">{formatYear(e.startYear)} – {formatYear(e.endYear)} · {e.dynasty}</div></div>
                      <span className="chip">{isCurrent ? "Now" : done ? "Completed" : e.playable ? "Playable" : "Future update"}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/60">{e.description}</p>
                    {evs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {evs.map((h) => (
                          <div key={h.id} className="flex items-start gap-2 rounded-xl bg-white/3 px-2 py-1.5 text-[11px]">
                            <span className="w-16 shrink-0 font-semibold text-white/70">{formatYear(h.year)}</span>
                            <span className="flex-1"><b>{h.title}</b> — <span className="text-white/60">{h.description}</span></span>
                            <ConfidenceBadge source={h.source} className="shrink-0 scale-90" />
                          </div>
                        ))}
                      </div>
                    )}
                    {e.id === "seleucid" && <div className="mt-2 text-[11px] text-amber-200/80">In this prototype the playable path moves from the Achaemenid directly to the Parthian era; the Hellenistic interval is summarised here.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub === "chronicle" && (
        <div className="mt-3">
          <div className="mb-2 text-xs text-white/50">The city remembers. Every entry below was generated by your actual play.</div>
          {state.mode === "alternate" && state.divergedAt && <div className="mb-2 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100"><b>ALTERNATE HISTORY</b> from {formatYear(state.divergedAt.year)} — entries marked 🌀 are fictional divergences.</div>}
          {state.chronicle.length === 0 && <EmptyState icon="📜" title="An empty chronicle" text="Build, research and explore — the scribes will record it." />}
          <div className="relative ml-3 border-l border-white/10 pl-5">
            {[...state.chronicle].reverse().map((c, i) => (
              <div key={i} className="relative mb-3">
                <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full bg-[#111] text-[9px]" style={{ border: `1px solid ${ERA_BY_ID[c.eraId].visual.accent}` }}>{KIND_ICON[c.kind] ?? "•"}</span>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ERA_BY_ID[c.eraId].visual.accent }}>{formatYear(c.year)} · {ERA_BY_ID[c.eraId].name}{c.alternate && " · alternate"}</div>
                <div className="text-sm font-semibold">{c.title}</div>
                {c.detail && <div className="text-xs text-white/55">{c.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "encyclopedia" && <Encyclopedia />}

      {sub === "summary" && (
        <div className="mt-3 space-y-3">
          <div className="card text-center" style={{ borderColor: `${era.visual.accent}66` }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">Your history</div>
            <div className="font-display mt-1 text-3xl">{state.cityName}</div>
            <div className="text-xs text-white/50">{state.mode === "alternate" ? "An alternate history" : "A historical path"} · founded {formatYear(state.chronicle[0]?.year ?? -678)} · now {formatYear(year)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Cities discovered" value={state.discoveredCities.length} />
            <Stat label="Artifacts" value={state.artifacts.length} />
            <Stat label="Technologies" value={state.technologies.length} />
            <Stat label="Landmarks" value={derived.landmarks} />
            <Stat label="Trade routes" value={state.tradeRoutes.length} />
            <Stat label="Eras completed" value={state.erasCompleted.length} />
            <Stat label="Cultural prestige" value={fmt(state.resources.prestige)} hint="Farah" />
            <Stat label="Population" value={fmt(state.population)} />
            <Stat label="Buildings built" value={state.stats.buildingsBuilt} />
            <Stat label="Upgrades" value={state.stats.upgrades} />
            <Stat label="Heritage sites" value={derived.heritage} />
            <Stat label="Decisions" value={state.decisions.length} />
          </div>
          <div className="card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Eras travelled</div>
            <div className="mt-2 flex gap-2">
              {PLAYABLE_ERA_PATH.map((e) => (
                <div key={e} className="flex-1 rounded-xl p-2 text-center text-[11px]" style={{ background: eraIndex(e) <= eraIdx ? `${ERA_BY_ID[e].visual.primary}77` : "rgba(255,255,255,0.04)", opacity: eraIndex(e) <= eraIdx ? 1 : 0.4 }}>{ERA_BY_ID[e].name.replace(" Era", "")}</div>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost w-full" onClick={() => setTab("museum")}>Visit the museum</button>
          <details className="card">
            <summary className="cursor-pointer text-sm text-white/60">Danger zone</summary>
            <p className="mt-2 text-xs text-white/50">Start a completely new history. Your current city, chronicle and collections will be erased on the server.</p>
            <button className="btn btn-danger mt-2" onClick={() => { if (confirm("Erase this history and begin again in the Median era?")) dispatch({ type: "reset" }); }}>Begin a new history</button>
          </details>
        </div>
      )}
    </div>
  );
}

function Encyclopedia() {
  const { state } = useGame();
  const [section, setSection] = useState<"eras" | "dynasties" | "cities" | "leaders" | "architecture" | "technology" | "artifacts" | "culture">("eras");
  const eraIdx = eraIndex(state.eraId);
  const entries = useMemo(() => {
    switch (section) {
      case "eras":
        return ERAS.map((e) => ({ id: e.id, title: e.name, period: `${formatYear(e.startYear)} – ${formatYear(e.endYear)}`, text: e.description, game: e.playable ? "Playable era with its own buildings, units and technologies." : "Defined in the data model; not yet playable.", source: e.source }));
      case "dynasties":
        return ERAS.map((e) => ({ id: e.id, title: e.dynasty, period: e.name, text: e.historicalChanges.length ? e.historicalChanges.join(". ") + "." : e.subtitle, game: `Era accent: ${e.visual.motif}.`, source: e.source }));
      case "cities":
        return CITIES.map((c) => ({ id: c.id, title: c.name + (c.historicalNames ? ` (${c.historicalNames.join(", ")})` : ""), period: c.region, text: c.notes, game: `${c.specialization} city · ${state.discoveredCities.includes(c.id) ? "discovered" : "undiscovered"}`, source: c.source }));
      case "leaders":
        return LEADERS.map((l) => ({ id: l.id, title: l.name, period: ERA_BY_ID[l.era].name, text: l.biography, game: `Adviser bonus: ${l.bonus.label}`, source: l.source }));
      case "architecture":
        return BUILDINGS.filter((b) => b.history).map((b) => ({ id: b.id, title: b.name, period: ERA_BY_ID[b.era].name, text: b.history!, game: b.description, source: b.source }));
      case "technology":
        return TECHNOLOGIES.filter((t) => t.history).map((t) => ({ id: t.id, title: t.name, period: ERA_BY_ID[t.era].name, text: t.history!, game: t.description, source: t.source }));
      case "artifacts":
        return ARTIFACTS.map((a) => ({ id: a.id, title: a.name, period: ERA_BY_ID[a.era].name, text: state.artifacts.includes(a.id) ? a.description : "Catalogue this artifact in play to read its full entry.", game: a.fictional ? "Fictional game item" : `+${a.value} Farah on discovery`, source: a.source }));
      case "culture":
        return [
          { id: "farah", title: "Farah / Prestige (game resource)", period: "All eras", text: "In ERĀN, 'Farah' is a gameplay progression resource representing your city's cultural standing. The Iranian concept of royal glory (Avestan xᵛarənah, Middle Persian xwarrah/farr) is a complex religious and political idea; the game does not claim a literal mapping.", game: "Unlocks landmarks, specialisation and era milestones.", source: { confidence: "game" as const, note: "Name inspired by a historical concept; mechanics are fictional." } },
          { id: "paradise", title: "Pairidaeza — the walled garden", period: "Achaemenid onward", text: "The Old Persian term for an enclosed park or garden, borrowed into Greek as paradeisos and ultimately English 'paradise'. Archaeological garden remains survive at Pasargadae.", game: "Paradise Garden building: prestige and stability.", source: { confidence: "documented" as const } },
          { id: "iwan", title: "The iwan", period: "Parthian & Sasanian", text: "A vaulted hall open on one side, facing a courtyard. It developed in the Parthian period and became central to Sasanian and later Iranian architecture.", game: "Great Iwan and Taq landmarks.", source: { confidence: "documented" as const } },
          { id: "seasons", title: "Seasons & weather (game system)", period: "Gameplay", text: "A lightweight seasonal cycle with rain, drought, heat and cold applies visual changes and small production modifiers.", game: "Cosmetic and light modifiers; not a climate model.", source: { confidence: "game" as const } },
        ];
    }
  }, [section, state.artifacts, state.discoveredCities]);
  return (
    <div className="mt-3">
      <Tabs items={(["eras", "dynasties", "cities", "leaders", "architecture", "technology", "artifacts", "culture"] as const).map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1) }))} value={section} onChange={setSection} />
      <div className="mt-1 text-[11px] text-white/40">Legend: ● documented · ◐ interpretation/uncertain · ◆ game content. {eraIdx >= 0 && ""}</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {entries.map((e) => (
          <div key={e.id} className="card p-3">
            <div className="flex items-start justify-between gap-2"><div><div className="font-semibold leading-tight">{e.title}</div><div className="text-[11px] text-white/45">{e.period}</div></div><ConfidenceBadge source={e.source} className="shrink-0" /></div>
            <p className="mt-2 text-xs text-white/65">{e.text}</p>
            <div className="mt-2 rounded-xl bg-white/4 px-2 py-1 text-[11px] text-white/50"><span className="era-accent">Gameplay:</span> {e.game}</div>
            {e.source.note && <div className="mt-1 text-[10px] italic text-white/35">{e.source.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
