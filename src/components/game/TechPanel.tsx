"use client";

import React, { useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { TECHNOLOGIES, TECH_BY_ID } from "@/game/data/technologies";
import { ERA_BY_ID, PLAYABLE_ERA_PATH } from "@/game/data/eras";
import { LEADER_BY_ID } from "@/game/data/units";
import { canAfford, eraIndex } from "@/game/engine";
import type { TechBranch, TechDef, EraId } from "@/game/types";
import { ConfidenceBadge, CostList, Progress, SectionTitle, Sheet, Tabs, fmtDuration } from "./ui";

const BRANCHES: { id: TechBranch; label: string; icon: string }[] = [
  { id: "agriculture", label: "Agriculture", icon: "🌾" },
  { id: "administration", label: "Administration", icon: "📜" },
  { id: "architecture", label: "Architecture", icon: "🏛" },
  { id: "trade", label: "Trade", icon: "🪙" },
  { id: "infrastructure", label: "Infrastructure", icon: "🛣" },
  { id: "knowledge", label: "Knowledge", icon: "📚" },
  { id: "craft", label: "Craft", icon: "⚒" },
  { id: "culture", label: "Culture", icon: "🎭" },
  { id: "urban", label: "Urban", icon: "🏘" },
  { id: "military", label: "Military", icon: "🛡" },
];

type Status = "locked" | "available" | "researching" | "completed";

function statusOf(t: TechDef, techs: string[], researching: string | undefined, eraIdx: number): Status {
  if (techs.includes(t.id)) return "completed";
  if (researching === t.id) return "researching";
  if (eraIndex(t.era) > eraIdx) return "locked";
  if (!t.prereqs.every((p) => techs.includes(p))) return "locked";
  return "available";
}

const STATUS_STYLE: Record<Status, string> = {
  locked: "opacity-50",
  available: "border-[var(--era-accent)]/60",
  researching: "border-[var(--era-accent)] pulse-glow",
  completed: "border-emerald-400/40 bg-emerald-500/8",
};

export default function TechPanel() {
  const { state, now, dispatch, pushToast } = useGame();
  const [era, setEra] = useState<EraId>(state.eraId);
  const [open, setOpen] = useState<TechDef | null>(null);
  const eraIdx = eraIndex(state.eraId);
  const list = useMemo(() => TECHNOLOGIES.filter((t) => t.era === era), [era]);
  const byBranch = useMemo(() => {
    const m = new Map<TechBranch, TechDef[]>();
    list.forEach((t) => m.set(t.branch, [...(m.get(t.branch) ?? []), t]));
    return m;
  }, [list]);
  const research = state.research;
  const rt = research ? TECH_BY_ID[research.techId] : null;
  const completedInEra = list.filter((t) => state.technologies.includes(t.id)).length;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 pb-32 pt-4 no-scrollbar">
      <SectionTitle sub={`${state.technologies.length} technologies mastered · ${state.resources.knowledge.toFixed(0)} knowledge available`}>Technology</SectionTitle>

      {rt && research && (
        <div className="card mb-3 border-[var(--era-accent)]/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider era-accent">Researching</div>
              <div className="font-semibold">{rt.name}</div>
            </div>
            <div className="text-sm text-white/70">{fmtDuration(research.completesAt - now)}</div>
          </div>
          <Progress value={1 - (research.completesAt - now) / (rt.seconds * 1000)} className="mt-2" />
        </div>
      )}

      <Tabs
        items={PLAYABLE_ERA_PATH.map((e) => ({ id: e, label: `${ERA_BY_ID[e].name.replace(" Era", "")}${eraIndex(e) > eraIdx ? " 🔒" : ""}` }))}
        value={era}
        onChange={setEra}
      />
      <div className="mt-1 text-xs text-white/45">{completedInEra}/{list.length} researched in this era{eraIndex(era) > eraIdx && " · unlocks when the era begins"}</div>

      <div className="mt-3 space-y-3">
        {BRANCHES.filter((b) => byBranch.has(b.id)).map((b) => (
          <div key={b.id}>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <span>{b.icon}</span> {b.label}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {byBranch.get(b.id)!.map((t, i) => {
                const s = statusOf(t, state.technologies, research?.techId, eraIdx);
                return (
                  <React.Fragment key={t.id}>
                    {i > 0 && <div className="mt-8 h-px w-4 shrink-0 bg-white/15" />}
                    <button onClick={() => setOpen(t)} className={`card min-w-[200px] max-w-[220px] shrink-0 p-3 text-left transition active:scale-[0.98] ${STATUS_STYLE[s]}`}>
                      <div className="flex items-center justify-between">
                        <span className="chip text-[10px]">
                          {s === "completed" ? "✓ Completed" : s === "researching" ? "⏳ Researching" : s === "available" ? "Available" : "🔒 Locked"}
                        </span>
                        <span className="text-[10px] text-white/40">{t.seconds}s</span>
                      </div>
                      <div className="mt-2 font-semibold leading-tight">{t.name}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] text-white/55">{t.description}</div>
                      <div className="mt-2"><CostList cost={t.cost} have={state.resources} /></div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <LeadersSection />

      {open && (
        <Sheet open onClose={() => setOpen(null)} title={open.name}>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip capitalize">{open.branch}</span>
            <span className="chip" style={{ color: ERA_BY_ID[open.era].visual.accent }}>{ERA_BY_ID[open.era].name}</span>
            <ConfidenceBadge source={open.source} />
          </div>
          <p className="mt-3 text-sm text-white/75">{open.description}</p>
          {open.history && <div className="mt-2 rounded-2xl bg-white/4 p-3 text-xs text-white/60"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Historical note</div>{open.history}{open.source.note && <div className="mt-1 italic text-white/40">{open.source.note}</div>}</div>}
          {open.prereqs.length > 0 && <div className="mt-3 text-xs text-white/60">Requires: {open.prereqs.map((p) => TECH_BY_ID[p]?.name).join(", ")}</div>}
          <div className="mt-3 flex items-center justify-between text-xs text-white/60"><span>Research time</span><span>{fmtDuration(open.seconds * 1000)}</span></div>
          <div className="mt-2"><CostList cost={open.cost} have={state.resources} /></div>
          {(() => {
            const s = statusOf(open, state.technologies, research?.techId, eraIdx);
            return (
              <button
                className="btn btn-primary mt-4 w-full"
                disabled={s !== "available" || !!research || !canAfford(state.resources, open.cost)}
                onClick={async () => {
                  const ok = await dispatch({ type: "research", techId: open.id });
                  if (ok) {
                    pushToast(`Research begun: ${open.name}`, "success");
                    if (state.tutorialStep < 6) dispatch({ type: "tutorial", step: 6 });
                    setOpen(null);
                  }
                }}
              >
                {s === "completed" ? "Completed" : s === "researching" ? "In progress" : research ? "Another research in progress" : s === "locked" ? "Locked" : "Begin research"}
              </button>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}

function LeadersSection() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const leader = open ? LEADER_BY_ID[open] : null;
  const all = Object.values(LEADER_BY_ID).filter((l) => eraIndex(l.era) <= eraIndex(state.eraId));
  return (
    <div className="mt-6">
      <SectionTitle sub="Historical figures grant gameplay bonuses. Biography and bonus are kept separate.">Court advisers</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {all.map((l) => {
          const unlocked = state.leaders.includes(l.id);
          const active = state.activeLeader === l.id;
          return (
            <button key={l.id} onClick={() => setOpen(l.id)} className={`card flex items-center gap-3 p-3 text-left ${active ? "border-[var(--era-accent)]" : ""} ${unlocked ? "" : "opacity-55"}`}>
              <div className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-semibold" style={{ background: `${ERA_BY_ID[l.era].visual.primary}77`, border: `1px solid ${ERA_BY_ID[l.era].visual.accent}66` }}>
                {l.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate font-semibold">{l.name}</span>{active && <span className="chip era-accent">Active</span>}</div>
                <div className="truncate text-xs text-white/55">{l.role}</div>
                <div className="mt-0.5 text-[11px] era-accent">{unlocked ? l.bonus.label : l.unlock.prestige ? `Unlock at ${l.unlock.prestige} Farah` : l.unlock.tech ? `Unlock via ${TECH_BY_ID[l.unlock.tech]?.name}` : "Locked"}</div>
              </div>
            </button>
          );
        })}
      </div>
      {leader && (
        <Sheet open onClose={() => setOpen(null)} title={leader.name}>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip" style={{ color: ERA_BY_ID[leader.era].visual.accent }}>{ERA_BY_ID[leader.era].name}</span>
            <span className="chip capitalize">{leader.rarity}</span>
            <ConfidenceBadge source={leader.source} />
          </div>
          <div className="mt-3 text-sm font-semibold">{leader.role}</div>
          <div className="mt-2 rounded-2xl bg-white/4 p-3 text-sm text-white/70"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">Historical biography</div>{leader.biography}{leader.source.note && <div className="mt-1 text-xs italic text-white/40">{leader.source.note}</div>}</div>
          <div className="mt-2 rounded-2xl border border-[var(--era-accent)]/30 bg-[var(--era-primary)]/20 p-3 text-sm"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider era-accent">Gameplay bonus (abstraction)</div>{leader.bonus.label}</div>
          <button className="btn btn-primary mt-4 w-full" disabled={!state.leaders.includes(leader.id) || state.activeLeader === leader.id} onClick={() => { dispatch({ type: "set_leader", leaderId: leader.id }); setOpen(null); }}>
            {state.activeLeader === leader.id ? "Currently advising" : state.leaders.includes(leader.id) ? "Appoint as adviser" : "Not yet unlocked"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
