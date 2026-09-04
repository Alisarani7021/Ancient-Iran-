import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ERAS, formatYear } from "@/game/data/eras";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/play");
  const playable = ERAS.filter((e) => e.playable);
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="motif absolute inset-0" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-20 text-center md:pt-28">
        <span className="chip fade-in">Historical strategy · City builder · Living timeline</span>
        <h1 className="font-display slide-up mt-6 text-6xl font-semibold tracking-tight md:text-8xl">
          ERĀN
        </h1>
        <p className="font-display slide-up mt-2 text-2xl italic text-white/70 md:text-3xl">The Living History of Iran</p>
        <p className="slide-up mt-6 max-w-xl text-base leading-relaxed text-white/60">
          Found a highland settlement in the Median era. Grow it into a city, then a civilization — and watch it move
          through the Achaemenid, Parthian and Sasanian ages. Your city remembers everything you build.
        </p>
        <div className="slide-up mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login?mode=signup" className="btn btn-primary px-8 text-base">
            Begin your history
          </Link>
          <Link href="/login" className="btn btn-ghost px-8 text-base">
            Continue as Governor
          </Link>
        </div>

        <div className="mt-16 w-full">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Playable timeline</div>
          <div className="relative flex w-full items-stretch gap-2 overflow-x-auto pb-2 no-scrollbar">
            {playable.map((e, i) => (
              <div key={e.id} className="card min-w-[200px] flex-1 text-left" style={{ borderColor: `${e.visual.accent}40` }}>
                <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: e.visual.accent }}>
                  Era {i + 1}
                </div>
                <div className="font-display mt-1 text-2xl">{e.name}</div>
                <div className="text-xs text-white/50">
                  {formatYear(e.startYear)} – {formatYear(e.endYear)}
                </div>
                <div className="mt-3 text-xs leading-relaxed text-white/60">{e.subtitle}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/40">
            Further eras — Seleucid through Contemporary Iran — are already in the data model and will open in later updates.
          </p>
        </div>

        <div className="mt-14 grid w-full gap-3 text-left sm:grid-cols-3">
          {[
            ["Base builder", "Place, upgrade and collect. Production continues while you are away."],
            ["Living city", "Districts, population, economy, seasons and day/night — simulated efficiently."],
            ["Historical sandbox", "Timeline, events, artifacts and an optional alternate-history branch, clearly labelled."],
          ].map(([t, d]) => (
            <div key={t} className="card">
              <div className="font-display text-xl">{t}</div>
              <div className="mt-1 text-sm text-white/55">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-lg text-[11px] leading-relaxed text-white/35">
          ERĀN distinguishes documented history from game interpretation. Every historical entry carries a confidence
          label; fictional items are marked as game content.
        </p>
      </div>
    </main>
  );
}
