"use client";

import React from "react";
import type { Confidence, ResourceId, Resources, SourceMeta } from "@/game/types";
import { RESOURCE_META } from "@/game/engine";

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (a < 10 && n % 1 !== 0) return n.toFixed(1);
  return Math.floor(n).toLocaleString();
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function ResIcon({ id, className = "" }: { id: ResourceId; className?: string }) {
  return (
    <span className={className} title={RESOURCE_META[id].name} aria-label={RESOURCE_META[id].name}>
      {RESOURCE_META[id].icon}
    </span>
  );
}

export function CostList({ cost, have, className = "" }: { cost: Partial<Resources>; have?: Resources; className?: string }) {
  const entries = Object.entries(cost).filter(([, v]) => (v ?? 0) > 0) as [ResourceId, number][];
  if (!entries.length) return <span className={`text-xs text-white/50 ${className}`}>Free</span>;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {entries.map(([k, v]) => {
        const ok = have ? have[k] >= v : true;
        return (
          <span key={k} className={`chip ${ok ? "" : "text-red-300 border-red-400/40"}`}>
            <ResIcon id={k} /> {fmt(v)}
          </span>
        );
      })}
    </div>
  );
}

export function RateList({ rates, suffix = "/h" }: { rates: Partial<Resources>; suffix?: string }) {
  const entries = Object.entries(rates).filter(([, v]) => (v ?? 0) !== 0) as [ResourceId, number][];
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="chip" style={{ color: RESOURCE_META[k].color }}>
          <ResIcon id={k} /> +{fmt(v)}
          {suffix}
        </span>
      ))}
    </div>
  );
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`progress ${className}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

const CONF_LABEL: Record<Confidence, string> = {
  documented: "Documented",
  interpreted: "Interpretation",
  uncertain: "Uncertain",
  game: "Game content",
};

export function ConfidenceBadge({ source, className = "" }: { source: SourceMeta; className?: string }) {
  return (
    <span className={`chip confidence-${source.confidence} ${className}`} title={source.note}>
      {source.confidence === "documented" ? "●" : source.confidence === "game" ? "◆" : "◐"} {CONF_LABEL[source.confidence]}
    </span>
  );
}

export function SectionTitle({ children, sub, right }: { children: React.ReactNode; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold leading-tight">{children}</h2>
        {sub && <div className="text-xs text-white/50">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-display mt-3 text-xl">{title}</div>
      <div className="mt-1 max-w-xs text-sm text-white/50">{text}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" onClick={onClose}>
      <div className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong slide-up relative flex max-h-[88vh] w-full flex-col rounded-t-[28px] md:rounded-[28px] ${wide ? "md:max-w-3xl" : "md:max-w-lg"}`}
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="font-display text-2xl font-semibold">{title}</div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/70 hover:bg-white/15" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/4 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className="font-display text-xl leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-white/5 p-1">
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onChange(i.id)}
          className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${value === i.id ? "bg-white/12 text-white" : "text-white/50 hover:text-white/80"}`}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
