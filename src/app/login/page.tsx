"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.replace("/play");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-strong scale-in w-full max-w-md rounded-[28px] p-7">
      <Link href="/" className="font-display text-3xl font-semibold">
        ERĀN
      </Link>
      <div className="mt-1 text-sm text-white/50">
        {mode === "login" ? "Welcome back, Governor." : "Found your first settlement."}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${mode === m ? "bg-white/12 text-white" : "text-white/50"}`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Governor name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Aryandes"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-[var(--era-accent)]"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-[var(--era-accent)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-[var(--era-accent)]"
          />
        </label>
        {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <button disabled={busy} className="btn btn-primary w-full text-base">
          {busy ? "Please wait…" : mode === "login" ? "Enter the city" : "Create account & begin"}
        </button>
      </form>
      <p className="mt-5 text-[11px] leading-relaxed text-white/35">
        Your city, resources, research and chronicle are saved on the server and continue producing while you are away.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="motif absolute inset-0" />
      <div className="relative w-full max-w-md">
        <Suspense fallback={<div className="glass-strong h-96 w-full rounded-[28px] shimmer" />}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
