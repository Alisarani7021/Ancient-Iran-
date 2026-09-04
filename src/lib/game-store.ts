import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chronicleEntries, decisions, gameSaves } from "@/db/schema";
import type { GameState } from "@/game/types";
import { newGameState, SCHEMA_VERSION } from "@/game/engine";

export async function loadOrCreateSave(userId: number, displayName: string) {
  const [row] = await db.select().from(gameSaves).where(eq(gameSaves.userId, userId)).limit(1);
  if (row) return row;
  const now = Date.now();
  const state = newGameState(now, `${displayName}'s Settlement`);
  const [created] = await db
    .insert(gameSaves)
    .values({ userId, state, version: 1, lastTickAt: new Date(now) })
    .returning();
  await db.insert(chronicleEntries).values(
    state.chronicle.map((c) => ({ userId, year: c.year, eraId: c.eraId, kind: c.kind, title: c.title, detail: c.detail ?? null, alternate: 0 })),
  );
  return created;
}

/** Persist the new authoritative state, appending any new chronicle entries and decisions to their tables. */
export async function persistState(userId: number, prev: GameState, next: GameState, version: number) {
  if (next.schemaVersion !== SCHEMA_VERSION) next.schemaVersion = SCHEMA_VERSION;
  const newChron = next.chronicle.slice(Math.max(0, next.chronicle.length - Math.max(0, next.chronicle.length - prev.chronicle.length)));
  const reset = next.createdAt !== prev.createdAt;
  await db.transaction(async (tx) => {
    await tx
      .update(gameSaves)
      .set({ state: next, version: version + 1, lastTickAt: new Date(next.lastTickAt), updatedAt: new Date() })
      .where(eq(gameSaves.userId, userId));
    if (reset) {
      await tx.delete(chronicleEntries).where(eq(chronicleEntries.userId, userId));
      await tx.delete(decisions).where(eq(decisions.userId, userId));
      await tx.insert(chronicleEntries).values(
        next.chronicle.map((c) => ({ userId, year: c.year, eraId: c.eraId, kind: c.kind, title: c.title, detail: c.detail ?? null, alternate: c.alternate ? 1 : 0 })),
      );
      return;
    }
    if (next.chronicle.length > prev.chronicle.length && newChron.length) {
      await tx.insert(chronicleEntries).values(
        newChron.map((c) => ({ userId, year: c.year, eraId: c.eraId, kind: c.kind, title: c.title, detail: c.detail ?? null, alternate: c.alternate ? 1 : 0 })),
      );
    }
    if (next.decisions.length > prev.decisions.length) {
      const fresh = next.decisions.slice(prev.decisions.length);
      await tx.insert(decisions).values(
        fresh.map((d) => ({ userId, eventId: d.eventId, choiceId: d.choiceId, year: d.year, eraId: d.eraId, divergence: d.divergence ? 1 : 0 })),
      );
    }
  });
}
