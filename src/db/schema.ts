import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { GameState } from "@/game/types";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.token)],
);

/**
 * Authoritative save-game. The full simulation state lives in `state` (jsonb)
 * and is only ever mutated by the server-side engine. `version` is bumped on
 * every accepted action so stale optimistic clients can reconcile.
 */
export const gameSaves = pgTable(
  "game_saves",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: jsonb("state").$type<GameState>().notNull(),
    version: integer("version").default(1).notNull(),
    lastTickAt: timestamp("last_tick_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("game_saves_user_idx").on(t.userId)],
);

/** "The City Remembers" – append-only chronicle generated from real game actions. */
export const chronicleEntries = pgTable(
  "chronicle_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    eraId: text("era_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    alternate: integer("alternate").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("chronicle_user_idx").on(t.userId)],
);

/** Player decisions on events – persisted separately so history can be audited. */
export const decisions = pgTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    choiceId: text("choice_id").notNull(),
    year: integer("year").notNull(),
    eraId: text("era_id").notNull(),
    divergence: integer("divergence").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("decisions_user_idx").on(t.userId)],
);
