"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGame } from "./GameProvider";
import { BUILDING_BY_ID } from "@/game/data/buildings";
import { TECH_BY_ID } from "@/game/data/technologies";
import { ERA_BY_ID } from "@/game/data/eras";
import { QUESTS } from "@/game/data/events";
import { buildableBuildings, buildingEfficiency, canAfford, evaluateMetric, availableQuests, eraProgress, SPEC_DNA } from "@/game/engine";
import type { BuildingCategory, CitySpecialization, DistrictId, ResourceId } from "@/game/types";
import { ConfidenceBadge, CostList, EmptyState, RateList, Sheet, Stat, Progress, fmt, fmtDuration, Tabs } from "./ui";

const CityView = dynamic(() => import("./CityView"), { ssr: false, loading: () => <div className="h-full w-full shimmer" /> });

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  government: "Government",
  residence: "Residences",
  production: "Production",
  storage: "Storage",
  knowledge: "Knowledge",
  culture: "Culture",
  infrastructure: "Infrastructure",
  defense: "Defence",
  landmark: "Landmarks",
  military: "Military",
};

const DISTRICT_LABEL: Record<DistrictId, string> = {
  royal: "Royal / Government",
  residential: "Residential",
  market: "Market / Bazaar",
  agricultural: "Agricultural",
  production: "Production",
  knowledge: "Knowledge",
  cultural: "Cultural",
  garden: "Garden",
  infrastructure: "Infrastructure",
  defensive: "Defensive",
};

const SPECS: { id: CitySpecialization; label: string; desc: string }[] = [
  { id: "trade", label: "Trade Hub", desc: "+20% coins" },
  { id: "cultural", label: "Cultural Center", desc: "+20% Farah" },
  { id: "knowledge", label: "Knowledge Center", desc: "+25% knowledge" },
  { id: "agricultural", label: "Agricultural Center", desc: "+25% food, +10% water" },
  { id: "resource", label: "Production Center", desc: "+20% materials & metal" },
  { id: "government", label: "Government Center", desc: "+25% influence" },
];

export function BuildMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setPlacing } = useGame();
  const [cat, setCat] = useState<BuildingCategory | "all">("all");
  const list = buildableBuildings(state);
  const cats = Array.from(new Set(list.map((b) => b.category)));
  const filtered = cat === "all" ? list : list.filter((b) => b.category === cat);
  return (
    <Sheet open={open} onClose={onClose} title="Construct" wide>
      <Tabs items={[{ id: "all" as const, label: "All" }, ...cats.map((c) => ({ id: c, label: CATEGORY_LABEL[c] }))]} value={cat} onChange={setCat} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {filtered.map((b) => {
          const lvl = b.levels[0];
          const techOk = !b.requiresTech || state.technologies.includes(b.requiresTech);
          const uniqueBlocked = b.unique && state.buildings.some((x) => x.defId === b.id);
          const afford = canAfford(state.resources, lvl.cost);
          const disabled = !techOk || uniqueBlocked || !afford;
          return (
            <button
              key={b.id}
              disabled={disabled}
              onClick={() => {
                setPlacing(b.id);
                onClose();
              }}
              className={`card text-left transition active:scale-[0.98] ${disabled ? "opacity-60" : "hover:bg-white/8"}`}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${ERA_BY_ID[b.era].visual.primary}55` }}>
                  {b.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold">{b.name}</div>
                    {b.landmark && <span className="chip era-accent">Landmark</span>}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-white/55">{b.description}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <CostList cost={lvl.cost} have={state.resources} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {lvl.production && <RateList rates={lvl.production} />}
                    {lvl.housing && <span className="chip">🏠 +{lvl.housing} housing</span>}
                    {lvl.storage && <span className="chip">📦 storage</span>}
                    {lvl.workers && <span className="chip">👷 {lvl.workers}</span>}
                    {lvl.stability && <span className="chip">🕊 +{lvl.stability}</span>}
                  </div>
                  {!techOk && <div className="mt-1.5 text-[11px] text-amber-300">Requires research: {TECH_BY_ID[b.requiresTech!]?.name}</div>}
                  {uniqueBlocked && <div className="mt-1.5 text-[11px] text-white/50">Already built (unique)</div>}
                  <div className="mt-1 text-[10px] text-white/35">{DISTRICT_LABEL[b.district]} district · {b.buildSeconds}s build</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function BuildingSheet() {
  const { state, derived, now, selectedBuilding, setSelectedBuilding, dispatch, setMoving, pushToast } = useGame();
  const b = state.buildings.find((x) => x.id === selectedBuilding);
  if (!b) return null;
  const def = BUILDING_BY_ID[b.defId];
  const lvl = def.levels[b.level - 1];
  const next = def.levels[b.level];
  const eff = buildingEfficiency(state, b);
  const constructing = !!b.completesAt && b.completesAt > now;
  const builtEra = ERA_BY_ID[b.builtEra];
  const aging = b.builtEra !== state.eraId && b.layer === "active";
  const canPreserve = b.builtEra !== state.eraId && b.layer !== "heritage";
  const workerFactor = (lvl.workers ?? 0) > 0 ? derived.workerEfficiency : 1;
  const liveRates: Partial<Record<ResourceId, number>> = {};
  Object.entries(lvl.production ?? {}).forEach(([k, v]) => {
    liveRates[k as ResourceId] = (v ?? 0) * (1 + (derived.productionMult[k as ResourceId] ?? 0)) * eff * workerFactor * derived.stabilityMult;
  });
  const storedPct = b.stored / 2;

  return (
    <Sheet open onClose={() => setSelectedBuilding(null)} title={<span>{def.glyph} {def.name}</span>}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip">Level {b.level}/{def.levels.length}</span>
        <span className="chip" style={{ color: builtEra.visual.accent }}>{builtEra.name}</span>
        <span className="chip">{DISTRICT_LABEL[def.district]}</span>
        <span className={`chip ${b.layer !== "active" ? "text-amber-300" : ""}`}>
          {b.layer === "active" ? (aging ? "Active · aging" : "Active") : b.layer === "abandoned" ? "Abandoned" : b.layer === "ruin" ? "Ruin" : "Heritage"}
        </span>
        <ConfidenceBadge source={def.source} />
      </div>
      <p className="mt-3 text-sm text-white/70">{def.description}</p>
      {def.history && (
        <div className="mt-2 rounded-2xl border border-white/8 bg-white/3 p-3 text-xs text-white/60">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Historical context</div>
          {def.history}
          {def.source.note && <div className="mt-1 italic text-white/40">{def.source.note}</div>}
        </div>
      )}

      {b.layer === "active" && !constructing && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {lvl.production && (
            <div className="col-span-2 rounded-2xl bg-white/4 p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Production</div>
              <RateList rates={liveRates} />
              <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                <span>Stored: {Math.round(storedPct * 100)}% of {2}h capacity</span>
                <span>{b.stored >= 2 ? "Full — collect!" : `Full in ${fmtDuration((2 - b.stored) * 3600_000)}`}</span>
              </div>
              <Progress value={storedPct} className="mt-1" />
              {eff < 1 && <div className="mt-1 text-[11px] text-amber-300">Older-era building: {Math.round(eff * 100)}% efficiency</div>}
              {workerFactor < 1 && <div className="mt-1 text-[11px] text-amber-300">Short of workers ({Math.round(workerFactor * 100)}%) — build homes</div>}
            </div>
          )}
          {lvl.housing && <Stat label="Housing" value={`+${lvl.housing}`} />}
          {lvl.workers && <Stat label="Workers" value={lvl.workers} />}
          {lvl.stability && <Stat label="Stability" value={`+${lvl.stability}`} />}
          {lvl.storage && (
            <div className="col-span-2 rounded-2xl bg-white/4 p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Storage capacity</div>
              <RateList rates={lvl.storage} suffix="" />
            </div>
          )}
        </div>
      )}
      {constructing && (
        <div className="mt-3 rounded-2xl bg-white/4 p-3">
          <div className="flex justify-between text-xs">
            <span>Under construction</span>
            <span>{fmtDuration(b.completesAt! - now)}</span>
          </div>
          <Progress value={1 - (b.completesAt! - now) / (def.buildSeconds * 1000 * (b.level > 1 ? 0.8 * b.level : 1))} className="mt-2" />
        </div>
      )}
      {b.layer === "heritage" && <div className="mt-3 rounded-2xl bg-amber-400/10 p-3 text-xs text-amber-100">Preserved heritage site: yields +{2 * b.level} Farah/h and keeps this era visible in your city.</div>}
      {(b.layer === "abandoned" || b.layer === "ruin") && <div className="mt-3 rounded-2xl bg-white/4 p-3 text-xs text-white/60">This {builtEra.name} structure no longer functions. Preserve it as heritage, or clear it to make room.</div>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {b.layer === "active" && !constructing && lvl.production && (
          <button className="btn btn-primary col-span-2" disabled={b.stored < 0.05} onClick={() => dispatch({ type: "collect", buildingId: b.id })}>
            Collect production
          </button>
        )}
        {b.layer === "active" && !constructing && next && (
          <button
            className="btn btn-ghost col-span-2 flex-col items-start gap-1 py-2"
            disabled={!canAfford(state.resources, next.cost)}
            onClick={async () => {
              const ok = await dispatch({ type: "upgrade", buildingId: b.id });
              if (ok) pushToast(`Upgrading ${def.name} to level ${b.level + 1}`, "success");
            }}
          >
            <span className="text-sm">⬆ Upgrade to level {b.level + 1}</span>
            <CostList cost={next.cost} have={state.resources} />
            {next.production && <span className="text-[11px] text-white/50">→ {Object.entries(next.production).map(([k, v]) => `${fmt(v ?? 0)} ${k}`).join(", ")}/h</span>}
            {next.housing && <span className="text-[11px] text-white/50">→ +{next.housing} housing</span>}
          </button>
        )}
        {b.layer === "active" && !constructing && !next && <div className="col-span-2 text-center text-xs text-white/40">Maximum level reached</div>}
        <button
          className="btn btn-ghost"
          onClick={() => {
            setMoving(b.id);
            setSelectedBuilding(null);
          }}
        >
          ↔ Move
        </button>
        {canPreserve ? (
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "preserve", buildingId: b.id })}>
            🏛 Preserve
          </button>
        ) : (
          <button
            className="btn btn-danger"
            onClick={async () => {
              const ok = await dispatch({ type: "demolish", buildingId: b.id });
              if (ok) setSelectedBuilding(null);
            }}
          >
            Clear
          </button>
        )}
        {canPreserve && (
          <button
            className="btn btn-danger col-span-2"
            onClick={async () => {
              const ok = await dispatch({ type: "demolish", buildingId: b.id });
              if (ok) setSelectedBuilding(null);
            }}
          >
            Clear site (40% refund)
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function QuestsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const quests = availableQuests(state);
  const done = QUESTS.filter((q) => state.completedQuests.includes(q.id));
  return (
    <Sheet open={open} onClose={onClose} title="Quests">
      {quests.length === 0 && <EmptyState icon="🏆" title="All quests complete" text="New objectives arrive with the next era." />}
      <div className="space-y-2">
        {quests.map((q) => {
          const [c, t] = evaluateMetric(state, q.metric);
          const complete = c >= t;
          return (
            <div key={q.id} className={`card ${complete ? "border-[var(--era-accent)]/50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{q.category}</div>
                  <div className="font-semibold">{q.title}</div>
                  <div className="text-xs text-white/55">{q.description}</div>
                </div>
                <div className="text-right text-xs text-white/60">
                  {fmt(Math.min(c, t))}/{fmt(t)}
                </div>
              </div>
              <Progress value={c / t} className="mt-2" />
              <div className="mt-2 flex items-center justify-between">
                <CostList cost={q.reward} />
                <button className="btn btn-primary min-h-9 px-3 py-1.5 text-xs" disabled={!complete} onClick={() => dispatch({ type: "claim_quest", questId: q.id })}>
                  {complete ? "Claim" : "In progress"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {done.length > 0 && <div className="mt-4 text-xs text-white/40">{done.length} quest{done.length > 1 ? "s" : ""} completed</div>}
    </Sheet>
  );
}

export function CityStatsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, derived, dispatch } = useGame();
  const [name, setName] = useState(state.cityName);
  const prog = eraProgress(state);
  const pop = derived.population;
  const dnaEntries = Object.entries(state.dna) as [keyof typeof state.dna, number][];
  const districts = useMemo(() => {
    const m: Partial<Record<DistrictId, number>> = {};
    state.buildings.forEach((b) => {
      const d = BUILDING_BY_ID[b.defId].district;
      m[d] = (m[d] ?? 0) + 1;
    });
    return m;
  }, [state.buildings]);
  return (
    <Sheet open={open} onClose={onClose} title="City" wide>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none" maxLength={32} />
        <button className="btn btn-ghost" disabled={name.trim() === state.cityName || name.trim().length < 2} onClick={() => dispatch({ type: "rename", name })}>
          Rename
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Population" value={fmt(state.population)} hint={`housing ${fmt(derived.housing)}`} />
        <Stat label="City level" value={state.cityLevel} hint={`grid ${state.gridSize}×${state.gridSize}`} />
        <Stat label="Stability" value={`${derived.stability}%`} hint={`×${derived.stabilityMult.toFixed(2)} output`} />
        <Stat label="Workers" value={`${fmt(derived.workersAvailable)}/${fmt(derived.workersNeeded)}`} hint={`${Math.round(derived.workerEfficiency * 100)}% staffed`} />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Population (statistical simulation)</div>
        <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
          {(Object.keys(pop) as (keyof typeof pop)[]).map((k) => (
            <div key={k} className="flex justify-between rounded-xl bg-white/4 px-3 py-1.5">
              <span className="capitalize text-white/60">{k}</span>
              <span className="font-semibold">{fmt(pop[k])}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-white/40">Food consumption {fmt(derived.foodConsumption)}/h · net food {derived.rates.food >= 0 ? "+" : ""}{fmt(derived.rates.food)}/h</div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Districts</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DISTRICT_LABEL) as DistrictId[]).map((d) => (
            <span key={d} className={`chip ${districts[d] ? "" : "opacity-40"}`}>
              {DISTRICT_LABEL[d]} · {districts[d] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">City DNA (gameplay profile)</div>
          <span className="text-[10px] text-white/35">Not historical statistics</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {dnaEntries.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[11px]">
                <span className="capitalize text-white/60">{k}</span>
                <span>{Math.round(v)}</span>
              </div>
              <Progress value={v / 100} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Specialisation {state.specialization && `· current: ${state.specialization}`}</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {SPECS.map((s) => (
            <button
              key={s.id}
              disabled={state.specialization === s.id}
              onClick={() => dispatch({ type: "specialize", specialization: s.id })}
              className={`card p-3 text-left text-xs transition ${state.specialization === s.id ? "border-[var(--era-accent)]" : "hover:bg-white/8"}`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-white/50">{s.desc}</div>
              <div className="mt-1 text-[10px] text-white/40">boosts {SPEC_DNA[s.id]} DNA</div>
            </button>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-white/40">Cost: {40 * (["medes", "achaemenid", "parthian", "sasanian"].indexOf(state.eraId) + 1) * (state.specialization ? 2 : 1)} Farah</div>
      </div>

      {prog.items.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Next era milestone</div>
          {prog.items.map((i) => (
            <div key={i.label} className="mb-1.5">
              <div className="flex justify-between text-xs">
                <span className={i.done ? "text-emerald-300" : "text-white/70"}>{i.done ? "✓ " : ""}{i.label}</span>
                <span className="text-white/50">{fmt(Math.min(i.current, i.target))}/{fmt(i.target)}</span>
              </div>
              <Progress value={i.current / i.target} />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export default function CityScreen() {
  const { state, derived, setSelectedBuilding, dispatch } = useGame();
  const [build, setBuild] = useState(false);
  const [quests, setQuests] = useState(false);
  const [stats, setStats] = useState(false);
  const ready = state.buildings.filter((b) => b.stored >= 0.2 && buildingEfficiency(state, b) > 0 && BUILDING_BY_ID[b.defId].levels[b.level - 1].production).length;
  const claimable = availableQuests(state).filter((q) => {
    const [c, t] = evaluateMetric(state, q.metric);
    return c >= t;
  }).length;

  return (
    <div className="relative flex h-full w-full">
      <div className="relative h-full min-w-0 flex-1">
      <CityView />
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between px-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <button onClick={() => setQuests(true)} className={`glass relative flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-semibold ${claimable ? "pulse-glow" : ""}`} data-tour="quests">
            📜 Quests
            {claimable > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--era-accent)] px-1 text-[10px] font-bold text-black">{claimable}</span>}
          </button>
          <button onClick={() => setStats(true)} className="glass flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-semibold">
            🏙 City
            <span className="text-xs text-white/50">L{state.cityLevel}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {ready > 1 && (
            <button onClick={() => dispatch({ type: "collect" })} className="glass flex h-11 items-center gap-2 rounded-2xl px-3 text-xs font-semibold">
              ✨ Collect all ({ready})
            </button>
          )}
          <button
            onClick={() => {
              setSelectedBuilding(null);
              setBuild(true);
            }}
            data-tour="build"
            className="btn btn-primary h-14 rounded-2xl px-5 text-base shadow-xl"
          >
            🔨 Build
          </button>
        </div>
      </div>
      <BuildMenu open={build} onClose={() => setBuild(false)} />
      <BuildingSheet />
      <QuestsSheet open={quests} onClose={() => setQuests(false)} />
      <CityStatsSheet open={stats} onClose={() => setStats(false)} />
      {derived.workerEfficiency < 0.6 && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
          <span className="chip bg-amber-500/20 text-amber-200">👷 Workshops short of workers — build homes</span>
        </div>
      )}
      </div>
      <DesktopSidebar onQuests={() => setQuests(true)} onStats={() => setStats(true)} />
    </div>
  );
}

function DesktopSidebar({ onQuests, onStats }: { onQuests: () => void; onStats: () => void }) {
  const { state, derived, dispatch, setTab, now } = useGame();
  const prog = eraProgress(state);
  const quests = availableQuests(state).slice(0, 3);
  const constructing = state.buildings.filter((b) => b.completesAt && b.completesAt > now);
  const era = ERA_BY_ID[state.eraId];
  return (
    <aside className="glass-strong hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-y-0 border-r-0 p-4 no-scrollbar lg:flex">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Era milestone</div>
        <div className="font-display text-xl" style={{ color: era.visual.accent }}>{prog.next ? `→ ${ERA_BY_ID[prog.next].name}` : era.name}</div>
        <Progress value={prog.ratio} className="mt-2" />
        <div className="mt-2 space-y-1">
          {prog.items.map((i) => (
            <div key={i.label} className="flex justify-between text-[11px]"><span className={i.done ? "text-emerald-300" : "text-white/60"}>{i.done ? "✓" : "○"} {i.label}</span><span className="text-white/40">{fmt(Math.min(i.current, i.target))}/{fmt(i.target)}</span></div>
          ))}
        </div>
        {prog.canAdvance && <button className="btn btn-primary pulse-glow mt-2 w-full" onClick={() => dispatch({ type: "advance_era" })}>⏳ The age changes</button>}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Quests</span><button onClick={onQuests} className="text-[11px] era-accent">All</button></div>
        <div className="space-y-1.5">
          {quests.map((q) => {
            const [c, t] = evaluateMetric(state, q.metric);
            return (
              <div key={q.id} className="rounded-2xl bg-white/4 p-2.5">
                <div className="flex items-center justify-between text-xs"><span className="font-semibold">{q.title}</span><span className="text-white/40">{fmt(Math.min(c, t))}/{fmt(t)}</span></div>
                <Progress value={c / t} className="mt-1" />
                {c >= t && <button className="btn btn-primary mt-2 min-h-8 w-full py-1 text-xs" onClick={() => dispatch({ type: "claim_quest", questId: q.id })}>Claim reward</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Economy / hour</div>
        <div className="mt-1"><RateList rates={derived.rates} /></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-xl bg-white/4 px-2 py-1.5">👥 {fmt(state.population)} / {fmt(derived.housing)}</div>
          <div className="rounded-xl bg-white/4 px-2 py-1.5">👷 {Math.round(derived.workerEfficiency * 100)}% staffed</div>
          <div className="rounded-xl bg-white/4 px-2 py-1.5">🕊 {derived.stability}% stability</div>
          <div className="rounded-xl bg-white/4 px-2 py-1.5">🐫 {state.tradeRoutes.length} routes</div>
        </div>
      </div>
      {constructing.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Under construction</div>
          <div className="mt-1 space-y-1">
            {constructing.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-white/4 px-2 py-1.5 text-xs"><span>{BUILDING_BY_ID[b.defId].glyph} {BUILDING_BY_ID[b.defId].name} L{b.level}</span><span className="text-white/50">{fmtDuration(b.completesAt! - now)}</span></div>
            ))}
          </div>
        </div>
      )}
      {state.research && (
        <div className="rounded-2xl bg-white/4 p-2.5 text-xs"><div className="flex justify-between"><span>📜 {TECH_BY_ID[state.research.techId]?.name}</span><span className="text-white/50">{fmtDuration(state.research.completesAt - now)}</span></div><Progress value={1 - (state.research.completesAt - now) / ((TECH_BY_ID[state.research.techId]?.seconds ?? 1) * 1000)} className="mt-1" /></div>
      )}
      <div className="mt-auto grid grid-cols-2 gap-1.5">
        <button className="btn btn-ghost text-xs" onClick={onStats}>🏙 City profile</button>
        <button className="btn btn-ghost text-xs" onClick={() => setTab("history")}>⏳ Timeline</button>
      </div>
    </aside>
  );
}
