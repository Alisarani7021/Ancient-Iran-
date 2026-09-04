import { getCurrentUser } from "@/lib/auth";
import { loadOrCreateSave, persistState } from "@/lib/game-store";
import { tick } from "@/game/engine";

export const dynamic = "force-dynamic";

/** Load the player's save, apply elapsed time (offline production) and persist. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const save = await loadOrCreateSave(user.id, user.displayName);
    const now = Date.now();
    const result = tick(save.state, now, true);
    await persistState(user.id, save.state, result.state, save.version);
    return Response.json({
      state: result.state,
      version: save.version + 1,
      offline: result.offline && Object.keys(result.offline.gained).length ? result.offline : undefined,
      unlockedAchievements: result.unlockedAchievements,
      newArtifacts: result.newArtifacts,
      user,
      serverTime: now,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to load your city." }, { status: 500 });
  }
}
