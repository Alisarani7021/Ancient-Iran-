"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { BUILDING_BY_ID } from "@/game/data/buildings";
import { ERA_BY_ID } from "@/game/data/eras";
import { canPlace, isRoad, buildingEfficiency, seasonFor, weatherFor, RESOURCE_META } from "@/game/engine";
import type { PlacedBuilding, BuildingDef, ResourceId } from "@/game/types";
import { fmt } from "./ui";

const TW = 64;
const TH = 32;

function iso(x: number, y: number) {
  return { sx: ((x - y) * TW) / 2, sy: ((x + y) * TH) / 2 };
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const SEASON_TINT: Record<string, { ground: number; overlay: string }> = {
  spring: { ground: 6, overlay: "rgba(120,200,120,0.08)" },
  summer: { ground: 12, overlay: "rgba(240,200,90,0.08)" },
  autumn: { ground: -4, overlay: "rgba(220,140,60,0.10)" },
  winter: { ground: 30, overlay: "rgba(200,220,255,0.14)" },
};

export function isNightNow(now: number) {
  const h = new Date(now).getHours();
  return h >= 19 || h < 6;
}

/* ------------------------------------------------------------------ */

function Building({
  b,
  def,
  eraColors,
  selected,
  night,
  now,
  onTap,
  onCollect,
}: {
  b: PlacedBuilding;
  def: BuildingDef;
  eraColors: { roof: string; wall: string; accent: string };
  selected: boolean;
  night: boolean;
  now: number;
  onTap: () => void;
  onCollect: (e: React.MouseEvent) => void;
}) {
  const size = def.size;
  const { sx, sy } = iso(b.x + (size - 1) / 2, b.y + (size - 1) / 2);
  const w = (TW / 2) * size;
  const hh = (TH / 2) * size;
  const constructing = !!b.completesAt && b.completesAt > now;
  const level = b.level;
  const isRuin = b.layer === "ruin";
  const isAbandoned = b.layer === "abandoned";
  const isHeritage = b.layer === "heritage";
  let height = def.shape === "field" || def.shape === "garden" ? 4 : def.shape === "wall" ? 14 : def.shape === "tower" ? 36 + level * 8 : 18 + level * 7;
  if (size === 2) height += 10;
  if (isRuin) height = Math.max(6, height * 0.35);
  if (constructing) height = Math.max(8, height * 0.5);

  const wall = isRuin || isAbandoned ? "#6b6862" : eraColors.wall;
  const roof = isRuin || isAbandoned ? "#57544e" : eraColors.roof;
  const roofFill = def.shape === "field" ? (isAbandoned || isRuin ? "#7a7563" : "#a9b25a") : def.shape === "garden" ? "#5e9a5a" : roof;

  const top = `M0,${-height} L${w},${-height + hh} L0,${-height + 2 * hh} L${-w},${-height + hh} Z`;
  const left = `M${-w},${-height + hh} L0,${-height + 2 * hh} L0,${2 * hh} L${-w},${hh} Z`;
  const right = `M${w},${-height + hh} L0,${-height + 2 * hh} L0,${2 * hh} L${w},${hh} Z`;
  const opacity = isAbandoned ? 0.75 : 1;
  const ready = b.stored >= 0.2 && !constructing && b.layer === "active" && def.levels[b.level - 1].production;
  const prodKeys = Object.keys(def.levels[b.level - 1].production ?? {}) as ResourceId[];
  const windows = night && !constructing && b.layer === "active" && !["field", "garden", "wall"].includes(def.shape);

  return (
    <g
      className={`iso-building ${selected ? "selected" : ""}`}
      transform={`translate(${sx},${sy})`}
      opacity={opacity}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      style={{ cursor: "pointer" }}
    >
      {/* shadow */}
      <ellipse cx={0} cy={hh + 2} rx={w * 0.9} ry={hh * 0.7} fill="rgba(0,0,0,0.25)" />
      {height > 6 && (
        <>
          <path d={left} fill={shade(wall, -30)} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
          <path d={right} fill={shade(wall, -60)} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
        </>
      )}
      <path d={top} fill={roofFill} stroke={isHeritage ? "#ffd166" : "rgba(0,0,0,0.3)"} strokeWidth={isHeritage ? 1.5 : 0.6} />
      {/* shape details */}
      {def.shape === "dome" && !constructing && !isRuin && (
        <ellipse cx={0} cy={-height + hh} rx={w * 0.45} ry={hh * 0.9} fill={shade(roof, 25)} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
      )}
      {def.shape === "hall" && !constructing && !isRuin && (
        <g stroke={shade(wall, 40)} strokeWidth={2} opacity={0.8}>
          {[-0.6, -0.2, 0.2, 0.6].map((f) => (
            <line key={f} x1={f * w * 0.8} y1={-height + hh + Math.abs(f) * hh * 0.4 + 2} x2={f * w * 0.8} y2={hh + Math.abs(f) * hh * 0.4 - 2} />
          ))}
        </g>
      )}
      {def.shape === "field" && (
        <g stroke={isAbandoned || isRuin ? "#5f5b4c" : "#8a9a3a"} strokeWidth={1.5} opacity={0.8}>
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <line key={t} x1={-w + t * w} y1={-height + hh + t * hh} x2={t * w} y2={-height + t * hh} />
          ))}
        </g>
      )}
      {def.shape === "garden" && (
        <g>
          {[[-0.4, -0.1], [0.3, -0.3], [0.1, 0.35], [-0.2, 0.15]].map(([fx, fy], i) => (
            <g key={i} transform={`translate(${fx * w},${-height + hh + fy * hh})`}>
              <ellipse cx={0} cy={-6} rx={5} ry={7} fill="#2f7a4a" />
              <rect x={-1} y={-2} width={2} height={5} fill="#5a3b1e" />
            </g>
          ))}
        </g>
      )}
      {windows && (
        <g fill="#ffd27a" opacity={0.95}>
          {[-0.55, -0.25, 0.25, 0.55].map((f, i) => (
            <rect key={i} x={f * w * 0.8 - 1.5} y={-height * 0.55 + hh + Math.abs(f) * hh * 0.5} width={3} height={4} rx={0.5} className="twinkle" style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
        </g>
      )}
      {constructing && (
        <g>
          <rect x={-w * 0.7} y={-height - 14} width={w * 1.4} height={5} rx={2.5} fill="rgba(0,0,0,0.5)" />
          <rect x={-w * 0.7} y={-height - 14} width={w * 1.4 * Math.max(0.03, 1 - (b.completesAt! - now) / (def.buildSeconds * 1000 * (b.level > 1 ? 0.8 * b.level : 1)))} height={5} rx={2.5} fill={eraColors.accent} />
          <text x={0} y={-height - 18} textAnchor="middle" fontSize={9} fill="#fff" opacity={0.9}>
            🔨 {Math.max(0, Math.ceil((b.completesAt! - now) / 1000))}s
          </text>
        </g>
      )}
      {!constructing && (
        <text x={0} y={-height + hh + 5} textAnchor="middle" fontSize={size === 2 ? 20 : 14} style={{ pointerEvents: "none" }} opacity={isRuin ? 0.4 : 1}>
          {isRuin ? "🪨" : def.glyph}
        </text>
      )}
      {isHeritage && (
        <text x={w * 0.6} y={-height + hh - 4} fontSize={10} textAnchor="middle">
          🏛️
        </text>
      )}
      {level > 1 && !constructing && b.layer === "active" && (
        <g transform={`translate(${-w * 0.6},${-height + 4})`}>
          <rect x={-7} y={-7} width={14} height={11} rx={3} fill="rgba(0,0,0,0.55)" />
          <text x={0} y={2} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={700}>
            L{level}
          </text>
        </g>
      )}
      {ready && (
        <g className="bob" transform={`translate(0,${-height - 12})`} onClick={onCollect} style={{ cursor: "pointer" }}>
          <circle r={13} fill="rgba(10,12,18,0.85)" stroke={eraColors.accent} strokeWidth={1.5} className={b.stored >= 1.9 ? "pulse-glow" : ""} />
          <text y={5} textAnchor="middle" fontSize={14}>
            {RESOURCE_META[prodKeys[0]]?.icon}
          </text>
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */

export default function CityView() {
  const { state, now, dispatch, selectedBuilding, setSelectedBuilding, placing, setPlacing, moving, setMoving, pushFloat, pushToast, cinematic, derived } = useGame();
  const size = state.gridSize;
  const era = ERA_BY_ID[state.eraId];
  const night = isNightNow(now);
  const season = seasonFor(state.playMs);
  const weather = weatherFor(state.playMs);
  const tint = SEASON_TINT[season];

  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; scale: number } | null>(null);

  // initial fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const mapW = size * TW;
    const s = Math.min(1.4, Math.max(0.5, Math.min((w * 0.98) / mapW, (h * 0.9) / (size * TH + 120))));
    setView({ x: w / 2, y: h / 2 - (size * TH * s) / 2 - 10, scale: s });
  }, [size]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || pinch.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current!.vx + dx, y: drag.current!.vy + dy }));
  };
  const onPointerUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };
  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setView((v) => ({ ...v, scale: Math.max(0.35, Math.min(2.5, v.scale * factor)) }));
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinch.current = { d, scale: view.scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const s = Math.max(0.35, Math.min(2.5, (pinch.current.scale * d) / pinch.current.d));
      setView((v) => ({ ...v, scale: s }));
    }
  };
  const onTouchEnd = () => {
    pinch.current = null;
  };

  const placingDef = placing ? BUILDING_BY_ID[placing] : moving ? BUILDING_BY_ID[state.buildings.find((b) => b.id === moving)?.defId ?? ""] : null;

  const tiles = useMemo(() => {
    const out: { x: number; y: number; road: boolean; deco: number }[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const h = (x * 7 + y * 13 + x * y * 3) % 17;
        out.push({ x, y, road: isRoad(x, y, size), deco: h });
      }
    return out;
  }, [size]);

  const occupied = useMemo(() => {
    const s = new Set<string>();
    state.buildings.forEach((b) => {
      const d = BUILDING_BY_ID[b.defId];
      for (let dx = 0; dx < d.size; dx++) for (let dy = 0; dy < d.size; dy++) s.add(`${b.x + dx},${b.y + dy}`);
    });
    return s;
  }, [state.buildings]);

  const handleTile = useCallback(
    async (x: number, y: number) => {
      if (drag.current?.moved) return;
      if (placing && placingDef) {
        if (!canPlace(state, placingDef, x, y)) {
          pushToast("Cannot place here", "error");
          return;
        }
        const ok = await dispatch({ type: "build", defId: placing, x, y });
        if (ok) {
          pushToast(`${placingDef.name} under construction`, "success");
          if (state.tutorialStep < 3 && placingDef.category === "production") dispatch({ type: "tutorial", step: 3 });
          if (state.tutorialStep < 4 && placingDef.category === "residence" && state.tutorialStep >= 3) dispatch({ type: "tutorial", step: 4 });
        }
        setPlacing(null);
        return;
      }
      if (moving && placingDef) {
        const ok = await dispatch({ type: "move", buildingId: moving, x, y });
        if (ok) pushToast("Building moved", "success");
        setMoving(null);
        return;
      }
      setSelectedBuilding(null);
    },
    [placing, moving, placingDef, state, dispatch, pushToast, setPlacing, setMoving, setSelectedBuilding],
  );

  const collect = useCallback(
    (b: PlacedBuilding, e: React.MouseEvent) => {
      e.stopPropagation();
      if (drag.current?.moved) return;
      const def = BUILDING_BY_ID[b.defId];
      const lvl = def.levels[b.level - 1];
      const eff = buildingEfficiency(state, b);
      const entries = Object.entries(lvl.production ?? {}) as [ResourceId, number][];
      entries.forEach(([k, v], i) => {
        const amt = v * (1 + (derived.productionMult[k] ?? 0)) * eff * ((lvl.workers ?? 0) > 0 ? derived.workerEfficiency : 1) * derived.stabilityMult * b.stored;
        pushFloat({ x: e.clientX, y: e.clientY - 20 - i * 18, text: `+${fmt(amt)} ${RESOURCE_META[k].icon}`, color: RESOURCE_META[k].color });
      });
      dispatch({ type: "collect", buildingId: b.id });
      if (state.tutorialStep < 2) dispatch({ type: "tutorial", step: 2 });
    },
    [state, derived, dispatch, pushFloat],
  );

  const sorted = useMemo(() => [...state.buildings].sort((a, b) => a.x + a.y + BUILDING_BY_ID[a.defId].size - (b.x + b.y + BUILDING_BY_ID[b.defId].size)), [state.buildings]);
  const groundBase = shade(era.visual.ground, tint.ground + (night ? -50 : 0));
  const roadColor = shade(era.visual.ground, -35 + (night ? -40 : 0));
  const mid = Math.floor(size / 2);
  const roadA = `M${iso(0, mid).sx},${iso(0, mid).sy + TH / 2} L${iso(size, mid).sx},${iso(size, mid).sy + TH / 2}`;
  const roadB = `M${iso(mid, 0).sx},${iso(mid, 0).sy + TH / 2} L${iso(mid, size).sx},${iso(mid, size).sy + TH / 2}`;
  const walkers = night ? 2 : Math.min(8, 2 + Math.floor(state.population / 150));

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 30%, ${night ? "#0c1220" : shade(era.visual.sky, 40)} 0%, ${era.visual.sky} 70%)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* stars at night */}
      {night && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className="twinkle absolute h-[2px] w-[2px] rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 45}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
          ))}
        </div>
      )}
      <svg className="absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {/* ground tiles */}
          {tiles.map((t) => {
            const { sx, sy } = iso(t.x, t.y);
            const occ = occupied.has(`${t.x},${t.y}`);
            let fill = t.road ? roadColor : (t.x + t.y) % 2 === 0 ? groundBase : shade(groundBase, -6);
            let stroke = "rgba(0,0,0,0.12)";
            if (placingDef && !t.road) {
              const ok = canPlace(state, placingDef, t.x, t.y, moving ?? undefined);
              if (ok) {
                fill = shade(groundBase, 25);
                stroke = era.visual.accent;
              } else if (!occ) fill = shade(groundBase, -25);
            }
            return (
              <g key={`${t.x}-${t.y}`} transform={`translate(${sx},${sy})`} onClick={() => handleTile(t.x, t.y)}>
                <path className="iso-tile" d={`M0,0 L${TW / 2},${TH / 2} L0,${TH} L${-TW / 2},${TH / 2} Z`} fill={fill} stroke={stroke} strokeWidth={placingDef ? 1 : 0.5} />
                {!occ && !t.road && t.deco === 0 && !placingDef && (
                  <g transform={`translate(0,${TH / 2})`} style={{ pointerEvents: "none" }}>
                    {state.eraId === "medes" ? (
                      <circle r={4} cy={-3} fill={season === "winter" ? "#8fa08a" : "#4d7a3c"} />
                    ) : state.eraId === "achaemenid" ? (
                      <path d="M0,-16 L4,-2 L-4,-2 Z" fill={season === "winter" ? "#6f8a6a" : "#2f6b3f"} />
                    ) : state.eraId === "parthian" ? (
                      <ellipse rx={5} ry={3} cy={-3} fill="#7f8f4a" />
                    ) : (
                      <path d="M0,-18 L5,-3 L-5,-3 Z" fill="#245a3a" />
                    )}
                  </g>
                )}
                {!occ && !t.road && t.deco === 9 && !placingDef && <circle cx={0} cy={TH / 2} r={2} fill="rgba(0,0,0,0.15)" style={{ pointerEvents: "none" }} />}
              </g>
            );
          })}
          {/* road centre line */}
          <path d={roadA} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="6 8" fill="none" />
          <path d={roadB} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="6 8" fill="none" />
          {/* walkers */}
          {Array.from({ length: walkers }).map((_, i) => (
            <circle key={i} r={2.2} fill={i % 2 ? era.visual.secondary : "#e9dcc4"} opacity={0.9}>
              <animateMotion dur={`${14 + (i % 4) * 4}s`} repeatCount="indefinite" path={i % 2 ? roadA : roadB} begin={`${-i * 3.7}s`} keyPoints={i % 3 === 0 ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear" />
            </circle>
          ))}
          {/* buildings */}
          {sorted.map((b) => (
            <Building
              key={b.id}
              b={b}
              def={BUILDING_BY_ID[b.defId]}
              eraColors={{ roof: ERA_BY_ID[b.builtEra].visual.roof, wall: ERA_BY_ID[b.builtEra].visual.wall, accent: era.visual.accent }}
              selected={selectedBuilding === b.id || moving === b.id}
              night={night}
              now={now}
              onTap={() => {
                if (drag.current?.moved) return;
                if (placingDef) return;
                setSelectedBuilding(b.id);
              }}
              onCollect={(e) => collect(b, e)}
            />
          ))}
        </g>
      </svg>
      {/* season / weather overlays */}
      <div className="pointer-events-none absolute inset-0" style={{ background: tint.overlay }} />
      {night && <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,12,28,0.35), rgba(8,12,28,0.55))" }} />}
      {weather === "rain" && (
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 6px, rgba(180,200,255,0.25) 6px 7px)" }} />
      )}
      {weather === "heat" && <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(255,180,80,0.08)" }} />}
      {weather === "cold" && <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(180,210,255,0.10)" }} />}

      {!cinematic && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          <span className="chip">
            {season === "spring" ? "🌱" : season === "summer" ? "☀️" : season === "autumn" ? "🍂" : "❄️"} {season[0].toUpperCase() + season.slice(1)}
            {weather !== "clear" && ` · ${weather}`}
          </span>
          <span className="chip">{night ? "🌙 Night" : "🌤 Day"}</span>
        </div>
      )}

      {(placing || moving) && !cinematic && (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <div className="glass-strong scale-in flex items-center gap-3 rounded-full px-4 py-2 text-sm">
            <span>
              {placing ? `Tap a highlighted tile to place ${placingDef?.name}` : "Tap a tile to move the building"}
            </span>
            <button
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold"
              onClick={() => {
                setPlacing(null);
                setMoving(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!cinematic && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          <button className="glass grid h-10 w-10 place-items-center rounded-full text-lg" onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.2) }))} aria-label="Zoom in">
            +
          </button>
          <button className="glass grid h-10 w-10 place-items-center rounded-full text-lg" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.35, v.scale / 1.2) }))} aria-label="Zoom out">
            −
          </button>
        </div>
      )}
    </div>
  );
}
