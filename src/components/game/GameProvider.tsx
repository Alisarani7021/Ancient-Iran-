"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, GameAction, OfflineSummary, EraId } from "@/game/types";
import { applyAction, computeDerived, tick, type Derived } from "@/game/engine";
import { ERA_BY_ID } from "@/game/data/eras";

export type Tab = "city" | "world" | "army" | "tech" | "history" | "market" | "museum";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error" | "achievement";
}

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface GameCtx {
  state: GameState; // predicted display state
  derived: Derived;
  now: number;
  user: { id: number; email: string; displayName: string } | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  dispatch: (a: GameAction) => Promise<boolean>;
  reload: () => Promise<void>;
  toasts: Toast[];
  pushToast: (text: string, kind?: Toast["kind"]) => void;
  floats: FloatText[];
  pushFloat: (f: Omit<FloatText, "id">) => void;
  offline: OfflineSummary | null;
  dismissOffline: () => void;
  eraTransition: { from: EraId; to: EraId } | null;
  dismissEraTransition: () => void;
  achievementQueue: string[];
  popAchievement: () => void;
  cinematic: boolean;
  setCinematic: (v: boolean) => void;
  selectedBuilding: string | null;
  setSelectedBuilding: (id: string | null) => void;
  placing: string | null; // building def id being placed
  setPlacing: (id: string | null) => void;
  moving: string | null; // building id being moved
  setMoving: (id: string | null) => void;
  focusCity: string | null;
  setFocusCity: (id: string | null) => void;
}

const Ctx = createContext<GameCtx | null>(null);

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}

let idSeq = 1;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [server, setServer] = useState<GameState | null>(null);
  const [user, setUser] = useState<GameCtx["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("city");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [offline, setOffline] = useState<OfflineSummary | null>(null);
  const [eraTransition, setEraTransition] = useState<{ from: EraId; to: EraId } | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<string[]>([]);
  const [cinematic, setCinematic] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [focusCity, setFocusCity] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const clockOffset = useRef(0);

  const pushToast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = idSeq++;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "achievement" ? 4500 : 2800);
  }, []);

  const pushFloat = useCallback((f: Omit<FloatText, "id">) => {
    const id = idSeq++;
    setFloats((l) => [...l.slice(-12), { ...f, id }]);
    setTimeout(() => setFloats((l) => l.filter((x) => x.id !== id)), 1300);
  }, []);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/game", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      clockOffset.current = data.serverTime - Date.now();
      setServer(data.state);
      setUser(data.user);
      if (data.offline) setOffline(data.offline);
      if (data.unlockedAchievements?.length) setAchievementQueue((q) => [...q, ...data.unlockedAchievements]);
      if (data.newArtifacts?.length) pushToast(`New artifact catalogued in the Museum`, "success");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  // local clock for prediction
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => clearInterval(t);
  }, []);

  // periodic authoritative sync (also catches server-triggered events)
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 45_000);
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  const state = useMemo(() => {
    if (!server) return null;
    return tick(server, Math.max(now, server.lastTickAt), false).state;
  }, [server, now]);

  const derived = useMemo(() => (state ? computeDerived(state) : null), [state]);

  // era CSS variables
  useEffect(() => {
    if (!state) return;
    const v = ERA_BY_ID[state.eraId].visual;
    const root = document.documentElement;
    root.style.setProperty("--era-primary", v.primary);
    root.style.setProperty("--era-secondary", v.secondary);
    root.style.setProperty("--era-accent", v.accent);
    root.style.setProperty("--era-sky", v.sky);
  }, [state?.eraId, state]);

  const dispatch = useCallback(
    async (action: GameAction): Promise<boolean> => {
      if (!server) return false;
      const t = Date.now() + clockOffset.current;
      // optimistic local validation + application
      const local = applyAction(server, action, t, false);
      if (!local.ok) {
        pushToast(local.error ?? "Not possible", "error");
        return false;
      }
      setServer(local.state);
      local.toasts?.forEach((m) => pushToast(m, "success"));
      setPending(true);
      const run = queue.current.then(async () => {
        try {
          const res = await fetch("/api/game/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          });
          if (res.status === 401) {
            window.location.href = "/login";
            return false;
          }
          const data = await res.json();
          if (data.state) setServer(data.state);
          if (!res.ok || !data.ok) {
            pushToast(data.error ?? "The server rejected that action", "error");
            return false;
          }
          if (data.eraTransition) setEraTransition(data.eraTransition);
          if (data.unlockedAchievements?.length) setAchievementQueue((q) => [...q, ...data.unlockedAchievements]);
          if (data.newArtifacts?.length) pushToast("New artifact catalogued in the Museum", "success");
          return true;
        } catch {
          pushToast("Connection lost — reloading city", "error");
          await reload();
          return false;
        } finally {
          setPending(false);
        }
      });
      queue.current = run;
      return run as Promise<boolean>;
    },
    [server, pushToast, reload],
  );

  const value: GameCtx | null =
    state && derived
      ? {
          state,
          derived,
          now,
          user,
          loading,
          error,
          pending,
          tab,
          setTab,
          dispatch,
          reload,
          toasts,
          pushToast,
          floats,
          pushFloat,
          offline,
          dismissOffline: () => setOffline(null),
          eraTransition,
          dismissEraTransition: () => setEraTransition(null),
          achievementQueue,
          popAchievement: () => setAchievementQueue((q) => q.slice(1)),
          cinematic,
          setCinematic,
          selectedBuilding,
          setSelectedBuilding,
          placing,
          setPlacing,
          moving,
          setMoving,
          focusCity,
          setFocusCity,
        }
      : null;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="font-display text-5xl font-semibold">ERĀN</div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="shimmer h-full w-full" />
        </div>
        <div className="text-sm text-white/50">Waking the city…</div>
      </div>
    );
  }
  if (error || !value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl">🏚</div>
        <div className="font-display text-2xl">The archives could not be opened</div>
        <div className="max-w-sm text-sm text-white/50">{error ?? "Unknown error"}</div>
        <button className="btn btn-primary" onClick={() => { setLoading(true); reload(); }}>
          Try again
        </button>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
