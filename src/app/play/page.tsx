import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GameProvider } from "@/components/game/GameProvider";
import GameShell from "@/components/game/GameShell";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
