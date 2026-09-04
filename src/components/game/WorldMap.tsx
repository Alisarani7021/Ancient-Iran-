"use client";

import React, { useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { CITIES, CITY_BY_ID, SPECIALIZATION_LABEL } from "@/game/data/cities";
import { ERA_BY_ID, formatYear } from "@/game/data/eras";
import { canAfford, eraIndex, CAPITAL_COOLDOWN_MS } from "@/game/engine";
import type { CityDef } from "@/game/types";
import { ConfidenceBadge, CostList, Progress, Sheet, fmt, fmtDuration } from "./ui";

type Level = "world" | "region" | "province";

const ll = (lon: number, lat: number) => [((lon - 42) / 26) * 100, ((41 - lat) / 17) * 100] as const;
const IRAN: [number, number][] = [
  [44.8, 39.7], [48.0, 39.5], [48.9, 38.4], [49.5, 37.6], [51.0, 36.8], [53.9, 37.3], [55.5, 38.0], [57.3, 38.0], [58.6, 37.6], [59.5, 37.5],
  [61.2, 36.6], [61.2, 35.6], [60.9, 34.3], [60.5, 33.5], [61.7, 31.4], [61.8, 30.8], [61.0, 29.8], [62.7, 28.3], [63.3, 27.1], [61.6, 25.2],
  [59.0, 25.4], [57.3, 25.7], [56.4, 27.1], [55.0, 26.5], [53.5, 26.7], [51.5, 27.9], [50.2, 29.5], [48.9, 30.0], [48.0, 30.0], [47.7, 31.0],
  [46.1, 32.9], [45.4, 33.9], [46.1, 35.0], [45.4, 35.9], [44.8, 37.1], [44.3, 37.9], [44.0, 39.4],
];
const GULF: [number, number][] = [[48.0, 29.9], [50.0, 29.4], [51.5, 27.8], [53.5, 26.6], [55.0, 26.4], [56.4, 27.0], [57.0, 25.6], [59.0, 25.2], [61.6, 25.0], [61.6, 22.5], [46.0, 22.5], [46.0, 29.0]];
const poly = (pts: [number, number][]) => pts.map(([lo, la]) => ll(lo, la).join(",")).join(" ");

const VIEWS: Record<Level, string> = {
  world: "-60 -45 220 190",
  region: "-4 -4 108 108",
  province: "0 0 100 100",
};

export function CityDetail({ city, onClose }: { city: CityDef; onClose: () => void }) {
  const { state, derived, dispatch, setTab, pushToast } = useGame();
  const eraInfo = city.eras[state.eraId];
  const discovered = state.discoveredCities.includes(city.id);
  const isCapital = state.capitalCityId === city.id;
  const hasRoute = state.tradeRoutes.some((r) => r.toCity === city.id);
  const idx = eraIndex(state.eraId);
  const capital = CITY_BY_ID[state.capitalCityId];
  const dist = Math.hypot(city.x - capital.x, city.y - capital.y);
  const routeCost = { coins: Math.round((80 + dist * 6) * (idx + 1)), influence: idx > 0 ? Math.round(10 * idx) : 0 };
  const capitalCost = { influence: 60 * (idx + 1), coins: 400 * (idx + 1) };
  const cooldownLeft = state.capitalChangedAtPlayMs !== undefined ? Math.max(0, CAPITAL_COOLDOWN_MS - (state.playMs - state.capitalChangedAtPlayMs)) : 0;
  const eraChips = (Object.keys(city.eras) as (keyof typeof city.eras)[]).filter((e) => ERA_BY_ID[e]);

  return (
    <Sheet open onClose={onClose} title={city.name} wide>
      <div className="flex flex-wrap items-center gap-1.5">
        {city.historicalNames?.map((n) => (
          <span key={n} className="chip font-display text-sm italic">{n}</span>
        ))}
        <span className="chip">{city.region} · {city.province}</span>
        <span className="chip era-accent">{SPECIALIZATION_LABEL[city.specialization]}</span>
        <ConfidenceBadge source={city.source} />
      </div>
      {eraInfo ? (
        <div className="mt-3 rounded-2xl bg-white/4 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">In the {ERA_BY_ID[state.eraId].name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold">{eraInfo.role}</span>
            <span className="chip">Importance {"★".repeat(eraInfo.importance)}</span>
          </div>
          {eraInfo.note && <div className="mt-1 text-xs text-amber-200/80">{eraInfo.note}</div>}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-white/4 p-3 text-xs text-white/60">
          This place is not a significant settlement in the {ERA_BY_ID[state.eraId].name}. It becomes available in later eras.
        </div>
      )}
      <p className="mt-3 text-sm text-white/70">{city.notes}</p>
      {city.source.note && <p className="mt-1 text-xs italic text-white/40">{city.source.note}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-white/4 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Economy</div>
          {city.economic}
        </div>
        <div className="rounded-2xl bg-white/4 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Culture</div>
          {city.cultural}
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Presence across eras</div>
        <div className="flex flex-wrap gap-1">
          {eraChips.length === 0 && <span className="text-xs text-white/40">No presence in currently playable eras</span>}
          {eraChips.map((e) => (
            <span key={e} className="chip" style={{ color: ERA_BY_ID[e].visual.accent }}>
              {ERA_BY_ID[e].name.replace(" Era", "")} {"★".repeat(city.eras[e]!.importance)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
          <span>City DNA (gameplay)</span>
          <span className="normal-case tracking-normal text-white/30">not historical statistics</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {(Object.entries(city.baseDNA) as [string, number][]).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[11px]"><span className="capitalize text-white/60">{k}</span><span>{v}</span></div>
              <Progress value={v / 100} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {!discovered && eraInfo && (
          <button className="btn btn-primary flex-col gap-1 py-2" disabled={!canAfford(state.resources, city.discoverCost)} onClick={async () => { const ok = await dispatch({ type: "discover_city", cityId: city.id }); if (ok) { pushToast(`Envoys reach ${city.name}`, "success"); if (state.tutorialStep < 12) dispatch({ type: "tutorial", step: 12 }); } }}>
            <span>🧭 Send envoys (discover)</span>
            <CostList cost={city.discoverCost} have={state.resources} />
          </button>
        )}
        {discovered && !isCapital && eraInfo && !hasRoute && (
          <button className="btn btn-ghost flex-col gap-1 py-2" disabled={!canAfford(state.resources, routeCost) || state.tradeRoutes.length >= derived.maxRoutes} onClick={() => dispatch({ type: "trade_route", toCity: city.id })}>
            <span>🐫 Establish trade route ({state.tradeRoutes.length}/{derived.maxRoutes} routes)</span>
            <CostList cost={routeCost} have={state.resources} />
          </button>
        )}
        {hasRoute && <div className="rounded-2xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">Trade route active · +{fmt(derived.tradeIncome.byRoute[state.tradeRoutes.find((r) => r.toCity === city.id)!.id] ?? 0)} coins/h</div>}
        {discovered && !isCapital && (eraInfo?.importance ?? 0) >= 3 && (
          <button className="btn btn-ghost flex-col gap-1 py-2" disabled={!canAfford(state.resources, capitalCost) || cooldownLeft > 0} onClick={async () => { const ok = await dispatch({ type: "set_capital", cityId: city.id }); if (ok) pushToast(`The court relocates to ${city.name}`, "success"); }}>
            <span>👑 Make political centre {cooldownLeft > 0 && `(${fmtDuration(cooldownLeft)})`}</span>
            <CostList cost={capitalCost} have={state.resources} />
          </button>
        )}
        {discovered && !isCapital && eraInfo && eraInfo.importance < 3 && <div className="text-center text-[11px] text-white/40">Lacks the standing to be a political centre in this era.</div>}
        {isCapital && (
          <button className="btn btn-primary" onClick={() => { setTab("city"); onClose(); }}>
            🏙 Enter city districts
          </button>
        )}
      </div>
    </Sheet>
  );
}

export default function WorldMap() {
  const { state, derived, focusCity, setFocusCity, now } = useGame();
  const [level, setLevel] = useState<Level>("region");
  const era = ERA_BY_ID[state.eraId];
  const capital = CITY_BY_ID[state.capitalCityId];
  const focused = focusCity ? CITY_BY_ID[focusCity] : null;

  const viewBox = useMemo(() => {
    if (level === "province") {
      const c = focused ?? capital;
      return `${c.x - 18} ${c.y - 18} 36 36`;
    }
    return VIEWS[level];
  }, [level, focused, capital]);

  const available = CITIES.filter((c) => c.eras[state.eraId]);
  const discoveredCount = state.discoveredCities.length;
  const scale = level === "world" ? 2.2 : level === "province" ? 0.4 : 1;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 40%, ${era.visual.sky} 0%, #070a10 80%)` }}>
      <svg viewBox={viewBox} className="h-full w-full" style={{ transition: "all 0.7s cubic-bezier(0.2,0.8,0.2,1)" }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0 L0 0 0 5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.2} />
          </pattern>
          <radialGradient id="landg" cx="50%" cy="50%">
            <stop offset="0%" stopColor={era.visual.ground} stopOpacity={0.55} />
            <stop offset="100%" stopColor={era.visual.ground} stopOpacity={0.25} />
          </radialGradient>
        </defs>
        <rect x={-200} y={-200} width={600} height={600} fill="url(#grid)" />
        {/* neighbouring regions (world level context) */}
        {level === "world" && (
          <g fill="rgba(255,255,255,0.35)" fontSize={4} fontFamily="var(--font-ui)" fontWeight={600} letterSpacing={0.4}>
            <text x={-40} y={20}>ANATOLIA</text>
            <text x={-30} y={60}>MESOPOTAMIA</text>
            <text x={-30} y={120}>ARABIA</text>
            <text x={70} y={-20}>CENTRAL ASIA</text>
            <text x={115} y={80}>INDUS</text>
            <text x={30} y={-30}>CAUCASUS</text>
          </g>
        )}
        {/* seas */}
        <ellipse cx={34} cy={6} rx={12} ry={16} fill="#1c3d5a" opacity={0.85} />
        <polygon points={poly(GULF)} fill="#1c3d5a" opacity={0.85} />
        {/* plateau */}
        <polygon points={poly(IRAN)} fill="url(#landg)" stroke={era.visual.accent} strokeWidth={0.4} strokeOpacity={0.6} />
        {/* mountains hint */}
        <g stroke="rgba(255,255,255,0.12)" strokeWidth={0.4} fill="none">
          <path d="M8,10 L14,20 L20,30 L24,44 L30,56 L36,64 L44,70" />
          <path d="M20,14 L34,18 L46,20 L58,22 L66,20" />
        </g>
        <text x={40} y={90} fontSize={3.5} fill="rgba(255,255,255,0.25)" fontFamily="var(--font-display)" fontStyle="italic">Iranian Plateau</text>
        <text x={30} y={22} fontSize={2.6} fill="rgba(255,255,255,0.35)" fontFamily="var(--font-display)" fontStyle="italic">Caspian</text>
        <text x={52} y={82} fontSize={2.6} fill="rgba(255,255,255,0.35)" fontFamily="var(--font-display)" fontStyle="italic">Persian Gulf</text>

        {/* trade routes */}
        {state.tradeRoutes.map((r, i) => {
          const to = CITY_BY_ID[r.toCity];
          const from = CITY_BY_ID[r.fromCity] ?? capital;
          if (!to || !from) return null;
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2 - 4;
          const d = `M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`;
          return (
            <g key={r.id}>
              <path d={d} fill="none" stroke={era.visual.accent} strokeWidth={0.5 * scale} strokeDasharray="1.5 1.2" opacity={0.7} />
              <circle r={0.9 * scale} fill="#fff">
                <animateMotion dur={`${6 + i}s`} repeatCount="indefinite" path={d} />
              </circle>
              <circle r={0.6 * scale} fill={era.visual.accent}>
                <animateMotion dur={`${6 + i}s`} begin={`${-(3 + i)}s`} repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" />
              </circle>
            </g>
          );
        })}

        {/* cities */}
        {CITIES.map((c) => {
          const info = c.eras[state.eraId];
          const discovered = state.discoveredCities.includes(c.id);
          const isCapital = c.id === state.capitalCityId;
          const r = info ? (1 + info.importance * 0.45) * scale : 0.9 * scale;
          const isFocus = focusCity === c.id;
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y})`} onClick={() => { setFocusCity(c.id); if (level === "world") setLevel("region"); }} style={{ cursor: "pointer" }} opacity={info ? 1 : 0.35}>
              {isCapital && <circle r={r * 2.2} fill="none" stroke={era.visual.accent} strokeWidth={0.4 * scale} className="spin-slow" strokeDasharray="1 1" style={{ transformOrigin: "0 0" }} />}
              {!discovered && info && <circle r={r * 1.8} fill={era.visual.accent} opacity={0.15} className="twinkle" />}
              <circle r={r} fill={discovered ? (isCapital ? era.visual.accent : era.visual.secondary) : info ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.25)"} stroke={isFocus ? "#fff" : discovered ? "#000" : era.visual.secondary} strokeWidth={isFocus ? 0.6 * scale : 0.3 * scale} strokeDasharray={discovered || !info ? undefined : "0.8 0.6"} />
              {isCapital && <text y={-r - 1.5 * scale} textAnchor="middle" fontSize={3 * scale}>👑</text>}
              {(level !== "world" || info?.importance === 5 || isCapital) && (
                <text y={r + 3 * scale} textAnchor="middle" fontSize={2.6 * scale} fill={discovered ? "#fff" : "rgba(255,255,255,0.55)"} fontFamily="var(--font-ui)" fontWeight={600} style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: 0.6 * scale }}>
                  {c.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
        <div className="pointer-events-auto glass flex gap-1 rounded-full p-1">
          {(["world", "region", "province"] as Level[]).map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${level === l ? "bg-white/15" : "text-white/55"}`}>
              {l === "region" ? "Iranian region" : l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="chip">👑 {capital.name}</span>
          <span className="chip">🧭 {discoveredCount}/{available.length} cities in era</span>
          <span className="chip">🐫 {state.tradeRoutes.length}/{derived.maxRoutes} routes · +{fmt(derived.tradeIncome.coins)}/h</span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-between">
        <div className="glass pointer-events-auto max-w-[60%] rounded-2xl px-3 py-2 text-[11px] leading-snug text-white/70">
          <b>{era.name}</b> · {formatYear(era.startYear)} – {formatYear(era.endYear)}
          <div className="text-white/45">City status reflects each era. Faded markers are not significant settlements yet.</div>
        </div>
        <div className="pointer-events-auto flex flex-col gap-1 text-[10px] text-white/60">
          <span><span className="inline-block h-2 w-2 rounded-full" style={{ background: era.visual.accent }} /> capital</span>
          <span><span className="inline-block h-2 w-2 rounded-full" style={{ background: era.visual.secondary }} /> discovered</span>
          <span><span className="inline-block h-2 w-2 rounded-full border border-white/50" /> undiscovered</span>
        </div>
      </div>
      {focused && <CityDetail city={focused} onClose={() => setFocusCity(null)} />}
      <span className="hidden">{now}</span>
    </div>
  );
}
