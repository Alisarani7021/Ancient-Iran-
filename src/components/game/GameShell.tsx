"use client";

import React, { useState } from "react";
import { useGame, type Tab } from "./GameProvider";
import { ERA_BY_ID, formatYear } from "@/game/data/eras";
import { currentYear, eraProgress, unlockedResources, RESOURCE_META } from "@/game/engine";
import CityScreen from "./CityScreen";
import WorldMap from "./WorldMap";
import ArmyPanel from "./ArmyPanel";
import TechPanel from "./TechPanel";
import HistoryPanel from "./HistoryPanel";
import MarketPanel from "./MarketPanel";
import MuseumPanel from "./MuseumPanel";
import { WelcomeBack, EraTransition, EventModal, Toasts, AchievementPopup, Tutorial, CinematicBar } from "./Overlays";
import { Sheet, fmt } from "./ui";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "city", label: "City", icon: "🏙" },
  { id: "world", label: "World", icon: "🗺" },
  { id: "army", label: "Army", icon: "🛡" },
  { id: "tech", label: "Tech", icon: "📜" },
  { id: "history", label: "History", icon: "⏳" },
  { id: "market", label: "Market", icon: "🪙" },
  { id: "museum", label: "Museum", icon: "🏺" },
];

function ResourceBar() {
  const { state, derived } = useGame();
  const [open, setOpen] = useState(false);
  const res = unlockedResources(state);
  return (
    <>
      <button onClick={() => setOpen(true)} className="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto px-2 py-1.5" data-tour="resources">
        {res.map((r) => {
          const rate = derived.rates[r];
          const full = state.resources[r] >= derived.storageCap[r] - 1;
          return (
            <span key={r} className={`chip shrink-0 ${full ? "border-amber-400/50" : ""}`} style={{ color: RESOURCE_META[r].color }}>
              <span>{RESOURCE_META[r].icon}</span>
              <span className="text-white">{fmt(state.resources[r])}</span>
              {Math.abs(rate) >= 0.5 && <span className={`text-[9px] ${rate >= 0 ? "text-emerald-300" : "text-red-300"}`}>{rate >= 0 ? "+" : ""}{fmt(rate)}/h</span>}
            </span>
          );
        })}
        <span className="chip shrink-0"><span>👥</span><span className="text-white">{fmt(state.population)}</span><span className="text-[9px] text-white/50">/{fmt(derived.housing)}</span></span>
        <span className="chip shrink-0"><span>🕊</span><span className="text-white">{derived.stability}%</span></span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Resources">
        <div className="space-y-2">
          {res.map((r) => (
            <div key={r} className="rounded-2xl bg-white/4 p-3">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><span className="text-xl">{RESOURCE_META[r].icon}</span>{RESOURCE_META[r].name}</span><span className="font-display text-xl">{fmt(state.resources[r])}{derived.storageCap[r] < 1e9 && <span className="text-xs text-white/40"> / {fmt(derived.storageCap[r])}</span>}</span></div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/50"><span>Net {derived.rates[r] >= 0 ? "+" : ""}{fmt(derived.rates[r])}/h{r === "food" && ` (consumption ${fmt(derived.foodConsumption)}/h)`}</span>{derived.productionMult[r] ? <span className="text-emerald-300">+{Math.round((derived.productionMult[r] ?? 0) * 100)}% bonuses</span> : null}</div>
              {derived.storageCap[r] < 1e9 && <div className="progress mt-1"><span style={{ width: `${Math.min(100, (state.resources[r] / derived.storageCap[r]) * 100)}%` }} /></div>}
            </div>
          ))}
          <div className="text-[11px] text-white/40">Farah (prestige) and Influence are uncapped. Build storage to raise other caps. Bonuses come from technologies, adviser, specialisation and your political centre.</div>
        </div>
      </Sheet>
    </>
  );
}

function TopBar() {
  const { state, setTab, tab, setCinematic, user } = useGame();
  const era = ERA_BY_ID[state.eraId];
  const prog = eraProgress(state);
  const [menu, setMenu] = useState(false);
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="glass-strong relative z-40 rounded-b-3xl md:rounded-none md:border-x-0 md:border-t-0">
      <div className="flex items-center gap-3 px-3 pt-2 md:px-5">
        <button onClick={() => setTab("history")} className="relative grid h-11 w-11 shrink-0 place-items-center" aria-label="Era progress">
          <svg width={44} height={44} className="-rotate-90"><circle cx={22} cy={22} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={3} fill="none" /><circle cx={22} cy={22} r={r} stroke="var(--era-accent)" strokeWidth={3} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - prog.ratio)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s" }} /></svg>
          <span className="absolute text-base">{prog.canAdvance ? "⏳" : "◆"}</span>
          {prog.canAdvance && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--era-accent)] pulse-glow" />}
        </button>
        <button onClick={() => setTab("history")} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2"><span className="font-display truncate text-xl leading-none" style={{ color: era.visual.accent }}>{era.name}</span>{state.mode === "alternate" && <span className="chip text-fuchsia-200">ALT</span>}</div>
          <div className="truncate text-[11px] text-white/55">{formatYear(currentYear(state))} · {era.dynasty} · {state.cityName}</div>
        </button>
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${tab === n.id ? "bg-white/12 text-white" : "text-white/55 hover:text-white"}`}>{n.icon} {n.label}</button>
          ))}
        </div>
        <button onClick={() => setMenu(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/6 text-sm" aria-label="Menu">☰</button>
      </div>
      <ResourceBar />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Governor">
        <div className="card flex items-center gap-3"><div className="font-display grid h-12 w-12 place-items-center rounded-full bg-[var(--era-primary)] text-xl">{user?.displayName?.[0]?.toUpperCase() ?? "G"}</div><div><div className="font-semibold">{user?.displayName}</div><div className="text-xs text-white/50">{user?.email}</div></div></div>
        <div className="mt-3 grid gap-2">
          <button className="btn btn-ghost justify-start" onClick={() => { setCinematic(true); setTab("city"); setMenu(false); }}>🎬 Cinematic / photo mode</button>
          <button className="btn btn-ghost justify-start" onClick={() => { setTab("history"); setMenu(false); }}>📖 Your civilization summary</button>
          <button className="btn btn-ghost justify-start" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>↩ Log out</button>
        </div>
        <div className="mt-4 text-[11px] leading-relaxed text-white/40">Progress is saved on the server after every action. Production continues offline for up to 8 hours per visit. Game year advances one year per minute of accumulated time.</div>
      </Sheet>
    </div>
  );
}

function BottomNav() {
  const { tab, setTab, state } = useGame();
  const prog = eraProgress(state);
  return (
    <nav className="glass-strong fixed inset-x-0 bottom-0 z-40 rounded-t-3xl md:hidden" style={{ paddingBottom: "var(--safe-bottom)" }}>
      <div className="grid grid-cols-7">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${tab === n.id ? "text-white" : "text-white/45"}`}>
            <span className={`text-xl transition ${tab === n.id ? "-translate-y-0.5 scale-110" : ""}`}>{n.icon}</span>
            {n.label}
            {tab === n.id && <span className="absolute bottom-1 h-1 w-6 rounded-full bg-[var(--era-accent)]" />}
            {n.id === "history" && prog.canAdvance && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-[var(--era-accent)]" />}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function GameShell() {
  const { tab, cinematic } = useGame();
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {!cinematic && <TopBar />}
      <main id="city-stage" className={`relative flex-1 overflow-hidden ${cinematic ? "" : "pb-[76px] md:pb-0"}`}>
        {tab === "city" && <CityScreen />}
        {tab === "world" && <WorldMap />}
        {tab === "army" && <ArmyPanel />}
        {tab === "tech" && <TechPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "market" && <MarketPanel />}
        {tab === "museum" && <MuseumPanel />}
      </main>
      {!cinematic && <BottomNav />}
      <CinematicBar />
      <Toasts />
      <AchievementPopup />
      {!cinematic && <EventModal />}
      {!cinematic && <Tutorial />}
      <WelcomeBack />
      <EraTransition />
    </div>
  );
}
