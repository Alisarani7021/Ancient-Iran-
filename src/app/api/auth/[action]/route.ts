import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === "me") {
    const user = await getCurrentUser();
    return Response.json({ user });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  try {
    if (action === "logout") {
      await destroySession();
      return Response.json({ ok: true });
    }
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; displayName?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !email.includes("@")) return Response.json({ error: "Enter a valid email." }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });

    if (action === "signup") {
      const displayName = (body.displayName ?? "").trim().slice(0, 40) || email.split("@")[0];
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) return Response.json({ error: "An account with this email already exists." }, { status: 409 });
      const [user] = await db.insert(users).values({ email, displayName, passwordHash: hashPassword(password) }).returning({ id: users.id, email: users.email, displayName: users.displayName });
      await createSession(user.id);
      return Response.json({ user });
    }

    if (action === "login") {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) return Response.json({ error: "Incorrect email or password." }, { status: 401 });
      await createSession(user.id);
      return Response.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
