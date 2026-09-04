"use client";

import React, { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { ERA_BY_ID, formatYear } from "@/game/data/eras";
import { EVENT_BY_ID, ACHIEVEMENTS } from "@/game/data/events";
import { RESOURCE_META, currentYear } from "@/game/engine";
import type { ResourceId } from "@/game/types";
import { ConfidenceBadge, fmt, fmtDuration } from "./ui";

/* ------------------------- Welcome back ------------------------- */
export function WelcomeBack() {
  const { offline, dismissOffline, user } = useGame();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!offline) return;
    setShown(0);
    const n = Object.keys(offline.gained).length;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setShown(i);
      if (i >= n) clearInterval(t);
    }, 260);
    return () => clearInterval(t);
  }, [offline]);
  if (!offline) return null;
  const entries = (Object.entries(offline.gained) as [ResourceId, number][]).filter(([, v]) => v >= 1);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5 backdrop-blur-md fade-in" onClick={dismissOffline}>
      <div className="glass-strong scale-in w-full max-w-sm rounded-[28px] p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">While you were away</div>
        <div className="font-display mt-1 text-3xl">Welcome back, Governor{user ? ` ${user.displayName}` : ""}.</div>
        <div className="mt-1 text-xs text-white/50">{fmtDuration(offline.elapsedMs)} passed{offline.capped ? " (production capped at 8 hours)" : ""}.</div>
        <div className="mt-5 space-y-2">
          {entries.map(([k, v], i) => (
            <div key={k} className={`flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2.5 transition-all duration-300 ${i < shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
              <span className="flex items-center gap-2 text-sm"><span className="text-xl">{RESOURCE_META[k].icon}</span> {RESOURCE_META[k].name}</span>
              <span className="font-display text-2xl" style={{ color: RESOURCE_META[k].color }}>+{fmt(v)}</span>
            </div>
          ))}
          {entries.length === 0 && <div className="text-sm text-white/50">Your storehouses were already full.</div>}
        </div>
        <button className="btn btn-primary mt-5 w-full" onClick={dismissOffline}>Return to the city</button>
      </div>
    </div>
  );
}

/* ------------------------- Era transition ------------------------- */
export function EraTransition() {
  const { eraTransition } = useGame();
  if (!eraTransition) return null;
  return <EraTransitionInner key={`${eraTransition.from}-${eraTransition.to}`} />;
}

function EraTransitionInner() {
  const { eraTransition, dismissEraTransition, state } = useGame();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const times = [1200, 2600, 4200, 5800, 7400];
    const timers = times.map((t, i) => setTimeout(() => setStage(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, []);
  if (!eraTransition) return null;
  const from = ERA_BY_ID[eraTransition.from];
  const to = ERA_BY_ID[eraTransition.to];
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden text-center" style={{ background: `radial-gradient(ellipse at 50% 40%, ${stage >= 3 ? to.visual.primary : from.visual.primary} 0%, #05070b 75%)`, transition: "background 1.5s ease" }}>
      <div className="motif absolute inset-0" />
      {stage >= 2 && stage < 4 && <div className="era-sweep absolute inset-y-0 w-1/2" style={{ background: `linear-gradient(90deg, transparent, ${to.visual.accent}55, transparent)` }} />}
      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <div className={`transition-all duration-700 ${stage >= 0 && stage < 3 ? "opacity-100" : "opacity-0 -translate-y-6"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/50">{formatYear(from.endYear)}</div>
          <div className="font-display mt-2 text-5xl md:text-7xl" style={{ color: from.visual.accent }}>{from.name}</div>
          <div className="mt-2 text-sm text-white/50">{from.dynasty} · draws to a close</div>
        </div>
        <div className={`absolute transition-all duration-700 ${stage >= 2 && stage < 3 ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <div className="font-display text-6xl italic text-white/90 md:text-8xl">The age changes</div>
        </div>
        <div className={`absolute px-6 transition-all duration-700 ${stage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/50">{formatYear(to.startYear)}</div>
          <div className="font-display mt-2 text-5xl md:text-7xl" style={{ color: to.visual.accent }}>The {to.name} begins</div>
          <div className="mt-2 text-sm text-white/60">{to.dynasty} · {to.subtitle}</div>
          <div className={`mx-auto mt-6 max-w-md space-y-1.5 text-left transition-all duration-700 ${stage >= 4 ? "opacity-100" : "opacity-0"}`}>
            {to.historicalChanges.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl bg-white/6 px-3 py-2 text-sm text-white/80" style={{ transitionDelay: `${i * 150}ms` }}><span style={{ color: to.visual.accent }}>◆</span>{c}</div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-white/55">
              <span>🏛 New architecture & buildings</span><span>⚔ New unit roster</span><span>📜 New technology branches</span><span>🗺 New cities on the map</span>
              <span>🧱 Older buildings age — preserve them as heritage</span><span>🎵 {to.musicPlaceholder}</span>
            </div>
            <div className="mt-1 flex justify-center"><ConfidenceBadge source={to.source} /></div>
          </div>
          {stage >= 5 && (
            <button className="btn btn-primary scale-in mt-6 px-8 text-base" onClick={dismissEraTransition}>
              Return to {state.cityName}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Event modal ------------------------- */
export function EventModal() {
  const { state } = useGame();
  if (!state.pendingEvent) return null;
  return <EventModalInner key={state.pendingEvent.eventId} />;
}

function EventModalInner() {
  const { state, dispatch, pending } = useGame();
  const [minimized, setMinimized] = useState(false);
  const ev = state.pendingEvent ? EVENT_BY_ID[state.pendingEvent.eventId] : null;
  if (!ev) return null;
  if (minimized)
    return (
      <button onClick={() => setMinimized(false)} className="glass pulse-glow fixed right-3 top-28 z-40 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold md:top-24">
        ⚖️ Decision pending
      </button>
    );
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm fade-in md:items-center">
      <div className="glass-strong slide-up w-full max-w-md rounded-[28px] p-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            <span className="chip capitalize">{ev.category}</span>
            {ev.historical && <span className="chip era-accent">Historical context</span>}
            {ev.divergence && <span className="chip text-fuchsia-200">Divergence point</span>}
            <ConfidenceBadge source={ev.source} />
          </div>
          <button onClick={() => setMinimized(true)} className="text-xs text-white/50">Later</button>
        </div>
        <div className="font-display mt-3 text-3xl">{ev.title}</div>
        <div className="text-xs text-white/45">{formatYear(currentYear(state))} · {ERA_BY_ID[state.eraId].name}</div>
        <p className="mt-3 text-sm leading-relaxed text-white/75">{ev.text}</p>
        {ev.source.note && <p className="mt-1 text-[11px] italic text-white/40">{ev.source.note}</p>}
        <div className="mt-4 space-y-2">
          {ev.choices.map((c) => (
            <button key={c.id} disabled={pending} onClick={() => dispatch({ type: "resolve_event", choiceId: c.id })} className={`card w-full p-3 text-left transition hover:bg-white/8 active:scale-[0.98] ${c.alternate ? "border-fuchsia-400/40" : ""}`}>
              <div className="flex items-center justify-between"><span className="font-semibold">{c.label}</span>{c.alternate && <span className="chip text-fuchsia-200">Alternate history</span>}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(Object.entries(c.effects) as [string, number][]).map(([k, v]) => (
                  <span key={k} className={`chip ${v >= 0 ? "text-emerald-200" : "text-red-200"}`}>{k in RESOURCE_META ? RESOURCE_META[k as ResourceId].icon : k === "population" ? "👥" : "🕊"} {v >= 0 ? "+" : ""}{v}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Toasts & floats ------------------------- */
export function Toasts() {
  const { toasts, floats } = useGame();
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-[104px] z-[90] flex flex-col items-center gap-1.5 px-4 md:top-20">
        {toasts.map((t) => (
          <div key={t.id} className={`glass-strong slide-up rounded-2xl px-4 py-2 text-sm ${t.kind === "error" ? "border-red-400/40 text-red-100" : t.kind === "success" ? "border-emerald-400/30 text-emerald-50" : ""}`}>{t.text}</div>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-0 z-[85]">
        {floats.map((f) => (
          <span key={f.id} className="float-up absolute text-base font-bold drop-shadow-lg" style={{ left: f.x, top: f.y, color: f.color }}>{f.text}</span>
        ))}
      </div>
    </>
  );
}

export function AchievementPopup() {
  const { achievementQueue, popAchievement } = useGame();
  const id = achievementQueue[0];
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(popAchievement, 4200);
    return () => clearTimeout(t);
  }, [id, popAchievement]);
  if (!id) return null;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/3 z-[95] flex justify-center px-6">
      <div className="glass-strong scale-in flex items-center gap-4 rounded-3xl border-[var(--era-accent)]/50 px-6 py-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--era-accent)]/20 text-3xl">{a.icon}</div>
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.3em] era-accent">Achievement unlocked</div><div className="font-display text-2xl">{a.title}</div><div className="text-xs text-white/55">{a.description}</div></div>
      </div>
    </div>
  );
}

/* ------------------------- Tutorial ------------------------- */
const STEPS: { title: string; text: string; tab?: "city" | "world" | "tech" | "history"; cta?: string }[] = [
  { title: "Welcome to ERĀN", text: "You govern a small highland settlement in the Median era. Over time it will become a city — and then history. The timeline is on the History tab; for now, let's learn the essentials.", cta: "Begin" },
  { title: "Collect production", text: "Buildings fill up over time. Tap the glowing bubble above a field or workshop to collect its production.", tab: "city" },
  { title: "Build a production building", text: "Tap Build and place a Barley Field or Potter's Yard on a highlighted tile. Production continues even while you are away.", tab: "city" },
  { title: "Build a residence", text: "Homes raise housing. Population grows toward housing when food is positive — and workers staff your production.", tab: "city" },
  { title: "Grow the population", text: "Watch the population counter in the top bar. Quests reward you for milestones. Open Quests (bottom-left) to claim rewards.", tab: "city", cta: "Got it" },
  { title: "Research a technology", text: "Knowledge from the Elders' Council powers research. Open the Tech tab and begin Terrace Farming or Stone Masonry.", tab: "tech" },
  { title: "Build a landmark", text: "Stone Masonry unlocks the Highland Citadel — your first landmark and a requirement for the next era.", tab: "city", cta: "Understood" },
  { title: "Events & decisions", text: "From now on, events will arrive with choices that shape your resources, stability and chronicle. Some are divergence points into alternate history — always labelled.", cta: "Continue" },
  { title: "The world map", text: "The World tab shows historically significant cities for the current era. Send envoys to discover them, trade with them, and later move your political centre.", tab: "world", cta: "Show me" },
  { title: "The next era", text: "Your era progress ring sits in the top bar. Meet its milestones and the age will change — new architecture, units, technologies and cities. Your old buildings remain as living history.", tab: "history", cta: "Start building" },
];

export function Tutorial() {
  const { state, dispatch, setTab, tab } = useGame();
  const step = state.tutorialStep;
  const [hidden, setHidden] = useState(false);
  if (step >= STEPS.length || hidden) return null;
  // progress-driven steps (1..3, 5) auto-advance via actions; others via CTA
  const s = STEPS[step];
  const mapped = step >= 7 ? step : step; // sequential
  const next = () => {
    const target = mapped + 1;
    dispatch({ type: "tutorial", step: target });
    if (STEPS[target]?.tab) setTab(STEPS[target].tab!);
  };
  const isWaiting = !s.cta;
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 ${step === 0 ? "inset-y-0 items-center bg-black/60 backdrop-blur-sm" : "bottom-[150px] md:bottom-6"}`}>
      <div className={`glass-strong pointer-events-auto slide-up w-full max-w-sm rounded-3xl p-4 ${step === 0 ? "text-center" : ""}`} style={{ borderColor: "color-mix(in srgb, var(--era-accent) 50%, transparent)" }}>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40"><span>Guide · {step + 1}/{STEPS.length}</span><button onClick={() => setHidden(true)} className="normal-case tracking-normal text-white/40">skip</button></div>
        <div className="font-display mt-1 text-2xl">{s.title}</div>
        <p className="mt-1 text-sm text-white/70">{s.text}</p>
        <div className="mt-3 flex gap-2">
          {s.tab && s.tab !== tab && <button className="btn btn-ghost flex-1" onClick={() => setTab(s.tab!)}>Go to {s.tab}</button>}
          {isWaiting ? <span className="chip self-center">Waiting for you…</span> : <button className="btn btn-primary flex-1" onClick={next}>{s.cta}</button>}
          {isWaiting && <button className="btn btn-ghost" onClick={next}>Skip step</button>}
        </div>
      </div>
    </div>
  );
}

export function CinematicBar() {
  const { cinematic, setCinematic, state } = useGame();
  const [filter, setFilter] = useState<"none" | "sepia" | "cool" | "warm">("none");
  useEffect(() => {
    const el = document.getElementById("city-stage");
    if (!el) return;
    el.style.filter = filter === "sepia" ? "sepia(0.6) contrast(1.05)" : filter === "cool" ? "hue-rotate(-15deg) saturate(1.1)" : filter === "warm" ? "hue-rotate(10deg) saturate(1.2) brightness(1.05)" : "";
  }, [filter, cinematic]);
  if (!cinematic) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-2">
        <span className="font-display px-2 text-lg italic">{state.cityName} · {ERA_BY_ID[state.eraId].name}</span>
        {(["none", "sepia", "cool", "warm"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-2.5 py-1 text-xs capitalize ${filter === f ? "bg-white/15" : "text-white/50"}`}>{f === "none" ? "Natural" : f}</button>
        ))}
        <button className="btn btn-ghost min-h-9 px-3 py-1 text-xs" onClick={() => setCinematic(false)}>Exit</button>
      </div>
    </div>
  );
}
