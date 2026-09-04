"use client";

import React, { useState } from "react";
import { useGame } from "./GameProvider";
import { CITY_BY_ID } from "@/game/data/cities";
import { EVENT_BY_ID } from "@/game/data/events";
import { ERA_BY_ID, formatYear } from "@/game/data/eras";
import { RESOURCE_META, unlockedResources } from "@/game/engine";
import type { ResourceId } from "@/game/types";
import { EmptyState, ResIcon, SectionTitle, Stat, Tabs, fmt } from "./ui";

const VALUE: Record<ResourceId, number> = { food: 1, materials: 1.5, coins: 1, metal: 4, water: 1, knowledge: 3, horses: 6, prestige: 0, influence: 0 };

export default function MarketPanel() {
  const { state, derived, dispatch, setTab, setFocusCity, pushToast } = useGame();
  const [sub, setSub] = useState<"exchange" | "routes" | "decisions">("exchange");
  const unlocked = unlockedResources(state).filter((r) => VALUE[r] > 0);
  const [give, setGive] = useState<ResourceId>("food");
  const [get, setGet] = useState<ResourceId>("coins");
  const [amount, setAmount] = useState(100);
  const received = Math.floor((amount * VALUE[give] * 0.8) / VALUE[get]);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 pb-32 pt-4 no-scrollbar">
      <SectionTitle sub="Bazaar exchange, caravan routes and the record of your decisions.">Market</SectionTitle>
      <Tabs items={[{ id: "exchange" as const, label: "Bazaar exchange" }, { id: "routes" as const, label: `Trade network (${state.tradeRoutes.length})` }, { id: "decisions" as const, label: "Decisions" }]} value={sub} onChange={setSub} />

      {sub === "exchange" && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {unlocked.map((r) => (
              <Stat key={r} label={RESOURCE_META[r].name} value={<span><ResIcon id={r} /> {fmt(state.resources[r])}</span>} hint={`cap ${fmt(derived.storageCap[r])}`} />
            ))}
          </div>
          <div className="card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Exchange (20% bazaar fee)</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-xs text-white/50">You give</div>
                <div className="flex flex-wrap gap-1">
                  {unlocked.map((r) => (
                    <button key={r} onClick={() => setGive(r)} className={`chip ${give === r ? "border-[var(--era-accent)] text-white" : "text-white/60"}`}><ResIcon id={r} /> {RESOURCE_META[r].name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-white/50">You receive</div>
                <div className="flex flex-wrap gap-1">
                  {unlocked.map((r) => (
                    <button key={r} onClick={() => setGet(r)} className={`chip ${get === r ? "border-[var(--era-accent)] text-white" : "text-white/60"}`}><ResIcon id={r} /> {RESOURCE_META[r].name}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input type="range" min={10} max={Math.max(10, Math.floor(state.resources[give]))} step={10} value={Math.min(amount, Math.max(10, Math.floor(state.resources[give])))} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 accent-[var(--era-accent)]" />
              <div className="w-24 text-right text-sm">{fmt(Math.min(amount, state.resources[give]))} <ResIcon id={give} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/4 px-4 py-3">
              <span className="text-sm text-white/70">→ receive</span>
              <span className="font-display text-2xl">{fmt(Math.floor((Math.min(amount, state.resources[give]) * VALUE[give] * 0.8) / VALUE[get]))} <ResIcon id={get} /></span>
            </div>
            <button className="btn btn-primary mt-3 w-full" disabled={give === get || received <= 0 || state.resources[give] < 10} onClick={async () => { const ok = await dispatch({ type: "exchange", give, get, amount: Math.min(amount, Math.floor(state.resources[give])) }); if (ok) pushToast("Exchange complete", "success"); }}>
              Exchange
            </button>
          </div>
          <div className="card text-xs text-white/60">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Production chains</div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span>🌾 Farm → 🛖 Granary → 🪙 Market → urban economy</span>
              <span>⛏ Mine → 🧱 materials → ⚒ Workshop → advanced building</span>
              <span>🌾 Food surplus → 🏠 housing → 👥 population growth</span>
              <span>📜 Knowledge building → knowledge → technology</span>
              <span>🐫 Trade route → coins + Farah</span>
              <span>🕊 Stability → production multiplier ×{derived.stabilityMult.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {sub === "routes" && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Routes" value={`${state.tradeRoutes.length}/${derived.maxRoutes}`} hint="markets & roads add slots" />
            <Stat label="Trade income" value={`+${fmt(derived.tradeIncome.coins)}`} hint="coins / hour" />
            <Stat label="Farah" value={`+${derived.tradeIncome.prestige.toFixed(1)}`} hint="per hour" />
          </div>
          {state.tradeRoutes.length === 0 && <EmptyState icon="🐫" title="No caravans yet" text="Discover a city on the world map and establish a route." action={<button className="btn btn-primary" onClick={() => setTab("world")}>Open world map</button>} />}
          {state.tradeRoutes.map((r) => {
            const to = CITY_BY_ID[r.toCity];
            const from = CITY_BY_ID[r.fromCity];
            return (
              <button key={r.id} onClick={() => { setFocusCity(r.toCity); setTab("world"); }} className="card flex w-full items-center gap-3 p-3 text-left">
                <div className="text-2xl">🐫</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{from?.name ?? "Capital"} → {to.name}</div>
                  <div className="text-[11px] text-white/50">Established {formatYear(r.establishedYear)} · {ERA_BY_ID[r.eraId].name} · {to.specialization} city</div>
                </div>
                <div className="text-right text-sm era-accent">+{fmt(derived.tradeIncome.byRoute[r.id] ?? 0)}/h</div>
              </button>
            );
          })}
          <div className="text-[11px] text-white/40">Yield depends on distance from your political centre, the partner&apos;s specialisation, infrastructure technologies, stability and era.</div>
        </div>
      )}

      {sub === "decisions" && (
        <div className="mt-3 space-y-2">
          {state.mode === "alternate" && state.divergedAt && (
            <div className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100">
              <b>ALTERNATE HISTORY</b> — your timeline diverged in {formatYear(state.divergedAt.year)} ({ERA_BY_ID[state.divergedAt.eraId].name}). Outcomes after this point are fictional.
            </div>
          )}
          {state.decisions.length === 0 && <EmptyState icon="⚖️" title="No decisions yet" text="Events arrive as your city grows. Each offers choices that shape your resources, stability and history." />}
          {[...state.decisions].reverse().map((d, i) => {
            const ev = EVENT_BY_ID[d.eventId];
            const ch = ev?.choices.find((c) => c.id === d.choiceId);
            return (
              <div key={i} className={`card p-3 ${d.divergence ? "border-fuchsia-400/40" : ""}`}>
                <div className="flex items-center justify-between text-[11px] text-white/50"><span>{formatYear(d.year)} · {ERA_BY_ID[d.eraId].name}</span>{d.divergence && <span className="chip text-fuchsia-200">Divergence</span>}</div>
                <div className="mt-1 font-semibold">{ev?.title}</div>
                <div className="text-xs text-white/60">You chose: <b>{ch?.label}</b> — {ch?.outcome}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
