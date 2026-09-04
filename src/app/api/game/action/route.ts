import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadOrCreateSave, persistState } from "@/lib/game-store";
import { applyAction } from "@/game/engine";
import type { GameAction } from "@/game/types";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<GameAction["type"]>([
  "collect", "build", "move", "upgrade", "demolish", "preserve", "research", "train",
  "discover_city", "trade_route", "set_capital", "specialize", "resolve_event",
  "claim_quest", "advance_era", "set_leader", "tutorial", "exchange", "rename", "reset",
]);

/** Server-authoritative action dispatcher. Validates costs & requirements, then persists. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let action: GameAction;
  try {
    action = (await req.json()) as GameAction;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!action || !ALLOWED.has(action.type)) return Response.json({ error: "Unknown action" }, { status: 400 });
  try {
    const save = await loadOrCreateSave(user.id, user.displayName);
    const now = Date.now();
    const result = applyAction(save.state, action, now);
    // Even rejected actions tick time forward, so persist the ticked state.
    await persistState(user.id, save.state, result.state, save.version);
    return Response.json({ ...result, version: save.version + 1, serverTime: now }, { status: result.ok ? 200 : 422 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Action failed on the server." }, { status: 500 });
  }
}
