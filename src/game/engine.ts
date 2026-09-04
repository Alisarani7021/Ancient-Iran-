import type {
  GameState,
  GameAction,
  ActionResult,
  Resources,
  ResourceId,
  PlacedBuilding,
  OfflineSummary,
  EraId,
  QuestMetric,
  CityDNA,
  PopulationBreakdown,
  CitySpecialization,
  BuildingDef,
} from "./types";
import { ERA_BY_ID, PLAYABLE_ERA_PATH } from "./data/eras";
import { BUILDINGS, BUILDING_BY_ID } from "./data/buildings";
import { TECHNOLOGIES, TECH_BY_ID } from "./data/technologies";
import { UNITS, UNIT_BY_ID, LEADERS, LEADER_BY_ID } from "./data/units";
import { CITIES, CITY_BY_ID } from "./data/cities";
import { ARTIFACTS } from "./data/artifacts";
import { EVENTS, EVENT_BY_ID, QUESTS, ACHIEVEMENTS } from "./data/events";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const SCHEMA_VERSION = 3;
export const MS_PER_YEAR = 60_000; // one game year per real minute of accumulated time
export const OFFLINE_CAP_MS = 8 * 3600_000;
export const OFFLINE_THRESHOLD_MS = 3 * 60_000;
export const BUILDING_STORE_HOURS = 2; // uncollected production cap (hours)
export const EVENT_INTERVAL_MS = 4 * 60_000;
export const CAPITAL_COOLDOWN_MS = 10 * 60_000;

export const ALL_RESOURCES: ResourceId[] = [
  "food",
  "materials",
  "coins",
  "metal",
  "water",
  "knowledge",
  "prestige",
  "influence",
  "horses",
];

export const RESOURCE_META: Record<ResourceId, { name: string; icon: string; color: string }> = {
  food: { name: "Food", icon: "🌾", color: "#d9a441" },
  materials: { name: "Materials", icon: "🧱", color: "#c47a4a" },
  coins: { name: "Coins", icon: "🪙", color: "#f0c860" },
  metal: { name: "Metal", icon: "⛏", color: "#9aa5b1" },
  water: { name: "Water", icon: "💧", color: "#5cb3e6" },
  knowledge: { name: "Knowledge", icon: "📜", color: "#b58cff" },
  prestige: { name: "Farah", icon: "✨", color: "#ffd166" },
  influence: { name: "Influence", icon: "🪶", color: "#7fd1b9" },
  horses: { name: "Horses", icon: "🐎", color: "#d08c60" },
};

const BASE_CAP: Resources = {
  food: 600,
  materials: 600,
  coins: 600,
  metal: 400,
  water: 300,
  knowledge: 1500,
  prestige: 1e12,
  influence: 1e12,
  horses: 120,
};

export const POP_MILESTONES = [100, 250, 500, 1000, 2000, 5000, 10000];

const SPEC_BONUS: Record<CitySpecialization, Partial<Record<ResourceId, number>>> = {
  trade: { coins: 0.2 },
  cultural: { prestige: 0.2 },
  agricultural: { food: 0.25, water: 0.1 },
  knowledge: { knowledge: 0.25 },
  resource: { materials: 0.2, metal: 0.2 },
  government: { influence: 0.25, coins: 0.05 },
  frontier: { horses: 0.2, materials: 0.05 },
};

export const SPEC_DNA: Record<CitySpecialization, keyof CityDNA> = {
  trade: "trade",
  cultural: "culture",
  agricultural: "agriculture",
  knowledge: "knowledge",
  resource: "production",
  government: "prestige",
  frontier: "stability",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function emptyResources(): Resources {
  return { food: 0, materials: 0, coins: 0, metal: 0, water: 0, knowledge: 0, prestige: 0, influence: 0, horses: 0 };
}

export function eraIndex(eraId: EraId): number {
  return PLAYABLE_ERA_PATH.indexOf(eraId);
}

export function unlockedResources(state: GameState): ResourceId[] {
  const idx = eraIndex(state.eraId);
  const set = new Set<ResourceId>();
  PLAYABLE_ERA_PATH.slice(0, idx + 1).forEach((e) => ERA_BY_ID[e].resourcesUnlocked.forEach((r) => set.add(r)));
  return ALL_RESOURCES.filter((r) => set.has(r));
}

export function currentYear(state: GameState): number {
  const era = ERA_BY_ID[state.eraId];
  const years = Math.floor((state.playMs - state.eraEnteredAt) / MS_PER_YEAR);
  return Math.min(era.endYear - 1, era.startYear + years);
}

export function gridSizeFor(state: GameState): number {
  return Math.min(20, 12 + eraIndex(state.eraId) * 2 + Math.floor(state.cityLevel / 3));
}

export function isRoad(x: number, y: number, size: number): boolean {
  const mid = Math.floor(size / 2);
  return x === mid || y === mid;
}

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function canAfford(res: Resources, cost: Partial<Resources>): boolean {
  return Object.entries(cost).every(([k, v]) => res[k as ResourceId] >= (v ?? 0));
}

function pay(res: Resources, cost: Partial<Resources>) {
  Object.entries(cost).forEach(([k, v]) => {
    res[k as ResourceId] -= v ?? 0;
  });
}

function occupiedTiles(b: PlacedBuilding, def: BuildingDef): [number, number][] {
  const tiles: [number, number][] = [];
  for (let dx = 0; dx < def.size; dx++) for (let dy = 0; dy < def.size; dy++) tiles.push([b.x + dx, b.y + dy]);
  return tiles;
}

export function canPlace(state: GameState, def: BuildingDef, x: number, y: number, ignoreId?: string): boolean {
  const size = gridSizeFor(state);
  const occ = new Set<string>();
  state.buildings.forEach((b) => {
    if (b.id === ignoreId) return;
    occupiedTiles(b, BUILDING_BY_ID[b.defId]).forEach(([tx, ty]) => occ.add(`${tx},${ty}`));
  });
  for (let dx = 0; dx < def.size; dx++)
    for (let dy = 0; dy < def.size; dy++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= size || ty >= size) return false;
      if (isRoad(tx, ty, size)) return false;
      if (occ.has(`${tx},${ty}`)) return false;
    }
  return true;
}

export function buildingEfficiency(state: GameState, b: PlacedBuilding): number {
  if (b.layer !== "active") return 0;
  if (b.completesAt && b.completesAt > state.lastTickAt) return 0;
  const age = eraIndex(state.eraId) - eraIndex(b.builtEra);
  if (age <= 0) return 1;
  if (age === 1) return 0.7;
  return 0.4;
}

/* ------------------------------------------------------------------ */
/*  Derived stats                                                      */
/* ------------------------------------------------------------------ */

export interface Derived {
  rates: Resources; // net per hour
  gross: Resources;
  storageCap: Resources;
  housing: number;
  workersNeeded: number;
  workersAvailable: number;
  workerEfficiency: number;
  stability: number;
  stabilityMult: number;
  foodConsumption: number;
  productionMult: Partial<Record<ResourceId, number>>;
  tradeMult: number;
  tradeIncome: { coins: number; prestige: number; byRoute: Record<string, number> };
  population: PopulationBreakdown;
  maxRoutes: number;
  landmarks: number;
  heritage: number;
  militaryStrength: number;
  armySize: number;
}

export function techMultipliers(state: GameState) {
  const productionMult: Partial<Record<ResourceId, number>> = {};
  let storageMult = 0;
  let housingMult = 0;
  let stability = 0;
  let tradeMult = 0;
  const apply = (eff: { productionMult?: Partial<Record<ResourceId, number>>; storageMult?: number; housingMult?: number; stability?: number; tradeMult?: number }) => {
    Object.entries(eff.productionMult ?? {}).forEach(([k, v]) => {
      productionMult[k as ResourceId] = (productionMult[k as ResourceId] ?? 0) + (v ?? 0);
    });
    storageMult += eff.storageMult ?? 0;
    housingMult += eff.housingMult ?? 0;
    stability += eff.stability ?? 0;
    tradeMult += eff.tradeMult ?? 0;
  };
  state.technologies.forEach((t) => TECH_BY_ID[t] && apply(TECH_BY_ID[t].effect));
  if (state.activeLeader && LEADER_BY_ID[state.activeLeader]) apply(LEADER_BY_ID[state.activeLeader].bonus);
  if (state.specialization) apply({ productionMult: SPEC_BONUS[state.specialization] });
  const capital = CITY_BY_ID[state.capitalCityId];
  if (capital) {
    Object.entries(capital.bonuses).forEach(([k, v]) => {
      productionMult[k as ResourceId] = (productionMult[k as ResourceId] ?? 0) + ((v ?? 1) - 1) * 0.5;
    });
  }
  return { productionMult, storageMult, housingMult, stability, tradeMult };
}

export function computeDerived(state: GameState): Derived {
  const mult = techMultipliers(state);
  const gross = emptyResources();
  const storageCap = { ...BASE_CAP };
  let housing = 0;
  let workersNeeded = 0;
  let buildingStability = 0;
  let landmarks = 0;
  let heritage = 0;
  const popBreak: PopulationBreakdown = { farmers: 0, artisans: 0, merchants: 0, administrators: 0, scholars: 0, builders: 0, residents: 0 };

  state.buildings.forEach((b) => {
    const def = BUILDING_BY_ID[b.defId];
    if (!def) return;
    const lvl = def.levels[b.level - 1];
    const eff = buildingEfficiency(state, b);
    if (b.layer === "heritage") {
      heritage++;
      gross.prestige += 2 * b.level;
      return;
    }
    if (eff === 0) return;
    if (def.landmark) landmarks++;
    housing += (lvl.housing ?? 0) * (1 + mult.housingMult);
    workersNeeded += lvl.workers ?? 0;
    buildingStability += lvl.stability ?? 0;
    Object.entries(lvl.storage ?? {}).forEach(([k, v]) => {
      storageCap[k as ResourceId] += (v ?? 0) * (1 + mult.storageMult);
    });
    const w = lvl.workers ?? 0;
    switch (def.district) {
      case "agricultural":
        popBreak.farmers += w;
        break;
      case "production":
        popBreak.artisans += w;
        break;
      case "market":
        popBreak.merchants += w;
        break;
      case "knowledge":
        popBreak.scholars += w;
        break;
      default:
        popBreak.builders += w;
    }
  });

  const workersAvailable = Math.floor(state.population * 0.6);
  const workerEfficiency = workersNeeded === 0 ? 1 : Math.min(1, workersAvailable / workersNeeded);

  // Stability
  const overcrowd = Math.max(0, state.population - housing);
  const hunger = state.resources.food <= 0 ? 15 : 0;
  const militaryStrength = state.units.reduce((s, u) => s + (UNIT_BY_ID[u.defId]?.defense ?? 0) * u.count, 0);
  const stability = Math.max(
    0,
    Math.min(100, 45 + buildingStability + mult.stability + Math.min(10, militaryStrength / 20) - overcrowd / 10 - hunger),
  );
  const stabilityMult = 0.7 + stability * 0.003;

  // Production
  state.buildings.forEach((b) => {
    const def = BUILDING_BY_ID[b.defId];
    if (!def) return;
    const eff = buildingEfficiency(state, b);
    if (eff === 0 || b.layer !== "active") return;
    const lvl = def.levels[b.level - 1];
    const needsWorkers = (lvl.workers ?? 0) > 0;
    Object.entries(lvl.production ?? {}).forEach(([k, v]) => {
      const r = k as ResourceId;
      const m = 1 + (mult.productionMult[r] ?? 0);
      gross[r] += (v ?? 0) * m * eff * (needsWorkers ? workerEfficiency : 1) * stabilityMult;
    });
  });

  // Trade
  const eraMult = [1, 2.2, 4.5, 9][eraIndex(state.eraId)] ?? 1;
  const capital = CITY_BY_ID[state.capitalCityId];
  const byRoute: Record<string, number> = {};
  let tradeCoins = 0;
  let tradePrestige = 0;
  state.tradeRoutes.forEach((r) => {
    const city = CITY_BY_ID[r.toCity];
    if (!city || !capital) return;
    const dist = Math.hypot(city.x - capital.x, city.y - capital.y);
    const distFactor = Math.max(0.5, 1 - dist / 200);
    const base = 45 * eraMult * (city.bonuses.coins ?? 1) * distFactor * (1 + mult.tradeMult) * stabilityMult;
    byRoute[r.id] = base;
    tradeCoins += base;
    tradePrestige += 1.5 * eraMult * (city.bonuses.prestige ?? 1);
  });
  gross.coins += tradeCoins;
  gross.prestige += tradePrestige;

  const foodConsumption = state.population * 0.4;
  const rates = { ...gross, food: gross.food - foodConsumption };

  const marketBuildings = state.buildings.filter((b) => {
    const d = BUILDING_BY_ID[b.defId];
    return d && (d.district === "market" || d.district === "infrastructure") && buildingEfficiency(state, b) > 0;
  }).length;
  const maxRoutes = 1 + marketBuildings;

  // Population breakdown remainder
  const assigned = popBreak.farmers + popBreak.artisans + popBreak.merchants + popBreak.scholars + popBreak.builders;
  const scale = assigned > 0 ? Math.min(1, workersAvailable / assigned) : 1;
  (Object.keys(popBreak) as (keyof PopulationBreakdown)[]).forEach((k) => (popBreak[k] = Math.round(popBreak[k] * scale)));
  popBreak.administrators = Math.round(state.population * 0.05);
  popBreak.residents = Math.max(
    0,
    Math.round(state.population - popBreak.farmers - popBreak.artisans - popBreak.merchants - popBreak.scholars - popBreak.builders - popBreak.administrators),
  );

  const armySize = state.units.reduce((s, u) => s + u.count, 0);

  return {
    rates,
    gross,
    storageCap,
    housing: Math.round(housing),
    workersNeeded,
    workersAvailable,
    workerEfficiency,
    stability: Math.round(stability),
    stabilityMult,
    foodConsumption,
    productionMult: mult.productionMult,
    tradeMult: mult.tradeMult,
    tradeIncome: { coins: tradeCoins, prestige: tradePrestige, byRoute },
    population: popBreak,
    maxRoutes,
    landmarks,
    heritage,
    militaryStrength,
    armySize,
  };
}

export function computeCityLevel(state: GameState): number {
  const score = state.population + state.buildings.filter((b) => b.layer === "active").length * 15 + state.technologies.length * 40 + eraIndex(state.eraId) * 300;
  const thresholds = [0, 120, 300, 600, 1000, 1600, 2500, 3800, 5500, 8000, 12000];
  let lvl = 1;
  thresholds.forEach((t, i) => {
    if (score >= t) lvl = i + 1;
  });
  return lvl;
}

/* ------------------------------------------------------------------ */
/*  Metrics (quests / achievements)                                    */
/* ------------------------------------------------------------------ */

export function evaluateMetric(state: GameState, m: QuestMetric): [number, number] {
  const active = state.buildings.filter((b) => b.layer === "active" && !(b.completesAt && b.completesAt > state.lastTickAt));
  switch (m.kind) {
    case "population":
      return [Math.floor(state.population), m.target];
    case "building_count":
      return [active.filter((b) => b.defId === m.building).length, m.target];
    case "category_count":
      return [active.filter((b) => BUILDING_BY_ID[b.defId]?.category === m.category).length, m.target];
    case "tech_count":
      return [state.technologies.length, m.target];
    case "cities_discovered":
      return [state.discoveredCities.length, m.target];
    case "trade_routes":
      return [state.tradeRoutes.length, m.target];
    case "artifacts":
      return [state.artifacts.length, m.target];
    case "landmarks":
      return [active.filter((b) => BUILDING_BY_ID[b.defId]?.landmark).length, m.target];
    case "prestige":
      return [Math.floor(state.resources.prestige), m.target];
    case "era_index":
      return [eraIndex(state.eraId), m.target];
    case "units":
      return [state.units.reduce((s, u) => s + u.count, 0), m.target];
    case "collections":
      return [state.artifacts.length, m.target];
    case "city_level":
      return [state.cityLevel, m.target];
  }
}

export function availableQuests(state: GameState) {
  const idx = eraIndex(state.eraId);
  return QUESTS.filter((q) => !state.completedQuests.includes(q.id) && (!q.era || eraIndex(q.era) <= idx)).slice(0, 4);
}

/* ------------------------------------------------------------------ */
/*  Era progress                                                       */
/* ------------------------------------------------------------------ */

export function eraProgress(state: GameState) {
  const era = ERA_BY_ID[state.eraId];
  const req = era.requirement;
  const items: { label: string; current: number; target: number; done: boolean }[] = [];
  if (!req || !era.transitionTo) return { items, ratio: 1, canAdvance: false, next: undefined };
  if (req.population) items.push({ label: "Population", current: Math.floor(state.population), target: req.population, done: state.population >= req.population });
  if (req.prestige) items.push({ label: "Farah (prestige)", current: Math.floor(state.resources.prestige), target: req.prestige, done: state.resources.prestige >= req.prestige });
  (req.technologies ?? []).forEach((t) => {
    const done = state.technologies.includes(t);
    items.push({ label: `Research ${TECH_BY_ID[t]?.name ?? t}`, current: done ? 1 : 0, target: 1, done });
  });
  (req.landmarks ?? []).forEach((l) => {
    const done = state.buildings.some((b) => b.defId === l && b.layer === "active" && !(b.completesAt && b.completesAt > state.lastTickAt));
    items.push({ label: `Build ${BUILDING_BY_ID[l]?.name ?? l}`, current: done ? 1 : 0, target: 1, done });
  });
  const ratio = items.reduce((s, i) => s + Math.min(1, i.current / i.target), 0) / items.length;
  return { items, ratio, canAdvance: items.every((i) => i.done), next: era.transitionTo };
}

/* ------------------------------------------------------------------ */
/*  New game                                                           */
/* ------------------------------------------------------------------ */

export function newGameState(now: number, cityName = "New Settlement"): GameState {
  const res = emptyResources();
  res.food = 320;
  res.materials = 420;
  res.coins = 160;
  res.water = 120;
  res.knowledge = 28;
  res.prestige = 6;
  const mk = (id: number, defId: string, x: number, y: number, level = 1): PlacedBuilding => ({
    id: `b${id}`,
    defId,
    x,
    y,
    level,
    builtEra: "medes",
    layer: "active",
    stored: 0.35,
    lastCollectedAt: now,
  });
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    lastTickAt: now,
    playMs: 0,
    eraId: "medes",
    eraEnteredAt: 0,
    yearOffset: 0,
    mode: "historical",
    cityName,
    capitalCityId: "hamadan",
    cityLevel: 1,
    gridSize: 12,
    resources: res,
    population: 38,
    stability: 55,
    buildings: [
      mk(1, "med_settlement", 3, 3),
      mk(2, "med_house", 8, 3),
      mk(3, "med_house", 9, 4),
      mk(4, "med_farm", 3, 8),
      mk(5, "med_farm", 4, 8),
      mk(6, "med_spring", 8, 8),
      mk(7, "med_workshop", 9, 9),
    ],
    technologies: [],
    units: [],
    discoveredCities: ["hamadan", "ray"],
    tradeRoutes: [{ id: "r1", fromCity: "hamadan", toCity: "ray", establishedYear: -678, eraId: "medes" }],
    artifacts: ["art_godin_pottery"],
    leaders: ["deioces"],
    activeLeader: "deioces",
    completedQuests: [],
    achievements: [],
    chronicle: [
      { year: -678, eraId: "medes", kind: "founded", title: "Settlement founded", detail: "A small highland community gathers around a shared hall near Ecbatana.", at: now },
      { year: -678, eraId: "medes", kind: "trade", title: "Trade path to Ray", detail: "Herders and potters begin exchanging goods with the settlement at Ragā.", at: now },
    ],
    decisions: [],
    lastEventAtPlayMs: -EVENT_INTERVAL_MS + 90_000,
    seenEvents: [],
    tutorialStep: 0,
    erasCompleted: [],
    dna: { trade: 25, culture: 20, knowledge: 15, agriculture: 40, production: 25, urbanism: 15, prestige: 20, stability: 50 },
    nextBuildingId: 8,
    stats: { collected: {}, buildingsBuilt: 7, upgrades: 0 },
  };
  return state;
}

/* ------------------------------------------------------------------ */
/*  Chronicle / DNA                                                     */
/* ------------------------------------------------------------------ */

function chronicle(state: GameState, kind: string, title: string, detail?: string) {
  state.chronicle.push({ year: currentYear(state), eraId: state.eraId, kind, title, detail, alternate: state.mode === "alternate", at: Date.now() });
  if (state.chronicle.length > 300) state.chronicle.splice(0, state.chronicle.length - 300);
}

function nudgeDNA(state: GameState, key: keyof CityDNA, amount: number) {
  state.dna[key] = Math.max(0, Math.min(100, state.dna[key] + amount));
}

/* ------------------------------------------------------------------ */
/*  Unlock checks                                                      */
/* ------------------------------------------------------------------ */

function checkUnlocks(state: GameState): { achievements: string[]; artifacts: string[]; leaders: string[] } {
  const achievements: string[] = [];
  const artifacts: string[] = [];
  const leaders: string[] = [];
  ACHIEVEMENTS.forEach((a) => {
    if (state.achievements.includes(a.id)) return;
    const [c, t] = evaluateMetric(state, a.metric);
    if (c >= t) {
      state.achievements.push(a.id);
      achievements.push(a.id);
      chronicle(state, "achievement", `Achievement: ${a.title}`);
    }
  });
  const built = new Set(state.buildings.filter((b) => b.layer === "active" && !(b.completesAt && b.completesAt > state.lastTickAt)).map((b) => b.defId));
  const idx = eraIndex(state.eraId);
  ARTIFACTS.forEach((a) => {
    if (state.artifacts.includes(a.id)) return;
    if (eraIndex(a.era) > idx) return;
    const u = a.unlock;
    let ok = false;
    if (u.era && eraIndex(u.era) <= idx) ok = true;
    if (u.city && state.discoveredCities.includes(u.city)) ok = true;
    if (u.tech && state.technologies.includes(u.tech)) ok = true;
    if (u.building && built.has(u.building)) ok = true;
    if (u.achievement && state.achievements.includes(u.achievement)) ok = true;
    if (ok) {
      state.artifacts.push(a.id);
      state.resources.prestige += a.value;
      artifacts.push(a.id);
      chronicle(state, "artifact", `Artifact catalogued: ${a.name}`, a.fictional ? "Fictional game item." : undefined);
    }
  });
  LEADERS.forEach((l) => {
    if (state.leaders.includes(l.id)) return;
    if (eraIndex(l.era) > idx) return;
    const u = l.unlock;
    let ok = true;
    if (u.era && eraIndex(u.era) > idx) ok = false;
    if (u.prestige && state.resources.prestige < u.prestige) ok = false;
    if (u.tech && !state.technologies.includes(u.tech)) ok = false;
    if (ok) {
      state.leaders.push(l.id);
      leaders.push(l.id);
    }
  });
  return { achievements, artifacts, leaders };
}

/* ------------------------------------------------------------------ */
/*  Tick                                                               */
/* ------------------------------------------------------------------ */

export interface TickResult {
  state: GameState;
  offline?: OfflineSummary;
  unlockedAchievements: string[];
  newArtifacts: string[];
  completed: string[];
}

export function tick(input: GameState, now: number, authoritative = false): TickResult {
  const state: GameState = JSON.parse(JSON.stringify(input));
  const completed: string[] = [];
  const rawElapsed = Math.max(0, now - state.lastTickAt);
  const elapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);
  const hours = elapsed / 3600_000;

  // finish timed jobs
  state.buildings.forEach((b) => {
    if (b.completesAt && b.completesAt <= now) {
      b.completesAt = undefined;
      completed.push(b.defId);
      const def = BUILDING_BY_ID[b.defId];
      if (def?.landmark) chronicle(state, "landmark", `${def.name} completed`, def.description);
    }
  });
  if (state.research && state.research.completesAt <= now) {
    const t = TECH_BY_ID[state.research.techId];
    state.technologies.push(state.research.techId);
    state.research = undefined;
    if (t) {
      chronicle(state, "technology", `${t.name} mastered`, t.description);
      nudgeDNA(state, "knowledge", 2);
    }
  }
  if (state.training && state.training.completesAt <= now) {
    const existing = state.units.find((u) => u.defId === state.training!.unitId);
    if (existing) existing.count += 1;
    else state.units.push({ defId: state.training.unitId, count: 1 });
    state.training = undefined;
  }

  const derived = computeDerived(state);

  // production accrues on buildings
  state.buildings.forEach((b) => {
    if (buildingEfficiency(state, b) === 0) return;
    const def = BUILDING_BY_ID[b.defId];
    const lvl = def.levels[b.level - 1];
    if (!lvl.production) return;
    b.stored = Math.min(BUILDING_STORE_HOURS, b.stored + hours);
  });

  // passive: trade income, heritage prestige, food consumption go straight to treasury
  const passiveCoins = derived.tradeIncome.coins * hours;
  const passivePrestige = (derived.tradeIncome.prestige + 2 * derived.heritage) * hours;
  state.resources.coins = Math.min(derived.storageCap.coins, state.resources.coins + passiveCoins);
  state.resources.prestige += passivePrestige;
  state.resources.food = Math.max(0, state.resources.food - derived.foodConsumption * hours);

  // population
  const target = derived.housing;
  if (state.resources.food > 0 || derived.rates.food > 0) {
    const growth = (target - state.population) * Math.min(1, hours * 0.6);
    state.population = Math.max(10, state.population + growth);
    if (state.population > target) state.population = Math.max(target, state.population - hours * 5);
  } else {
    state.population = Math.max(10, state.population * (1 - Math.min(0.3, hours * 0.03)));
  }

  state.playMs += elapsed;
  state.lastTickAt = now;

  // offline auto-collect
  let offline: OfflineSummary | undefined;
  if (rawElapsed > OFFLINE_THRESHOLD_MS) {
    const gained: Partial<Resources> = {};
    state.buildings.forEach((b) => {
      if (b.stored <= 0) return;
      const def = BUILDING_BY_ID[b.defId];
      const lvl = def.levels[b.level - 1];
      if (!lvl.production) return;
      Object.entries(lvl.production).forEach(([k, v]) => {
        const r = k as ResourceId;
        const eff = buildingEfficiency(state, b);
        const m = 1 + (derived.productionMult[r] ?? 0);
        const amt = (v ?? 0) * m * eff * ((lvl.workers ?? 0) > 0 ? derived.workerEfficiency : 1) * derived.stabilityMult * b.stored;
        const before = state.resources[r];
        state.resources[r] = Math.min(derived.storageCap[r], state.resources[r] + amt);
        gained[r] = (gained[r] ?? 0) + (state.resources[r] - before);
      });
      b.stored = 0;
      b.lastCollectedAt = now;
    });
    if (passiveCoins > 0) gained.coins = (gained.coins ?? 0) + passiveCoins;
    if (passivePrestige > 0) gained.prestige = (gained.prestige ?? 0) + passivePrestige;
    offline = { elapsedMs: rawElapsed, gained, capped: rawElapsed > OFFLINE_CAP_MS };
  }

  // population milestones
  POP_MILESTONES.forEach((m) => {
    if (input.population < m && state.population >= m) chronicle(state, "population", `Population reaches ${m.toLocaleString()}`);
  });

  state.cityLevel = computeCityLevel(state);
  state.gridSize = gridSizeFor(state);
  state.stability = derived.stability;

  let unlockedAchievements: string[] = [];
  let newArtifacts: string[] = [];
  if (authoritative) {
    const u = checkUnlocks(state);
    unlockedAchievements = u.achievements;
    newArtifacts = u.artifacts;
    // events
    if (!state.pendingEvent && state.tutorialStep >= 6 && state.playMs - state.lastEventAtPlayMs >= EVENT_INTERVAL_MS) {
      const pool = EVENTS.filter((e) => (e.era === "any" || e.era === state.eraId) && !state.seenEvents.includes(e.id));
      const fallback = EVENTS.filter((e) => e.era === "any");
      const candidates = pool.length ? pool : fallback;
      const pick = candidates[Math.floor(rng(Math.floor(state.playMs / 1000))() * candidates.length)];
      if (pick) {
        state.pendingEvent = { eventId: pick.id, triggeredAt: now };
        state.lastEventAtPlayMs = state.playMs;
      }
    }
  }

  return { state, offline, unlockedAchievements, newArtifacts, completed };
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

function fail(state: GameState, error: string): ActionResult {
  return { ok: false, state, error };
}

export function collectBuilding(state: GameState, b: PlacedBuilding, derived: Derived): Partial<Resources> {
  const gained: Partial<Resources> = {};
  const def = BUILDING_BY_ID[b.defId];
  const lvl = def.levels[b.level - 1];
  if (!lvl.production || b.stored <= 0) return gained;
  const eff = buildingEfficiency(state, b);
  Object.entries(lvl.production).forEach(([k, v]) => {
    const r = k as ResourceId;
    const m = 1 + (derived.productionMult[r] ?? 0);
    const amt = (v ?? 0) * m * eff * ((lvl.workers ?? 0) > 0 ? derived.workerEfficiency : 1) * derived.stabilityMult * b.stored;
    const before = state.resources[r];
    state.resources[r] = Math.min(derived.storageCap[r], state.resources[r] + amt);
    gained[r] = (gained[r] ?? 0) + (state.resources[r] - before);
    state.stats.collected[r] = (state.stats.collected[r] ?? 0) + (state.resources[r] - before);
  });
  b.stored = 0;
  b.lastCollectedAt = state.lastTickAt;
  return gained;
}

export function applyAction(input: GameState, action: GameAction, now: number, authoritative = true): ActionResult {
  const ticked = tick(input, now, authoritative);
  const state = ticked.state;
  const toasts: string[] = [];
  const derived = computeDerived(state);
  const idx = eraIndex(state.eraId);

  switch (action.type) {
    case "collect": {
      const targets = action.buildingId ? state.buildings.filter((b) => b.id === action.buildingId) : state.buildings;
      const total: Partial<Resources> = {};
      targets.forEach((b) => {
        const g = collectBuilding(state, b, derived);
        Object.entries(g).forEach(([k, v]) => (total[k as ResourceId] = (total[k as ResourceId] ?? 0) + (v ?? 0)));
      });
      break;
    }
    case "build": {
      const def = BUILDING_BY_ID[action.defId];
      if (!def) return fail(state, "Unknown building");
      if (eraIndex(def.era) > idx) return fail(state, "Not available in this era");
      if (eraIndex(def.era) < idx - 0 && def.era !== state.eraId && eraIndex(def.era) < idx) return fail(state, "This building belongs to a past era");
      if (def.requiresTech && !state.technologies.includes(def.requiresTech)) return fail(state, `Requires ${TECH_BY_ID[def.requiresTech]?.name}`);
      if (def.requiresPopulation && state.population < def.requiresPopulation) return fail(state, `Requires ${def.requiresPopulation} population`);
      if (def.unique && state.buildings.some((b) => b.defId === def.id)) return fail(state, "Already built");
      if (!canPlace(state, def, action.x, action.y)) return fail(state, "Cannot place here");
      const cost = def.levels[0].cost;
      if (!canAfford(state.resources, cost)) return fail(state, "Not enough resources");
      pay(state.resources, cost);
      const b: PlacedBuilding = {
        id: `b${state.nextBuildingId++}`,
        defId: def.id,
        x: action.x,
        y: action.y,
        level: 1,
        builtEra: state.eraId,
        layer: "active",
        completesAt: def.buildSeconds > 0 ? now + def.buildSeconds * 1000 : undefined,
        stored: 0,
        lastCollectedAt: now,
      };
      state.buildings.push(b);
      state.stats.buildingsBuilt++;
      const firstOfKind = state.buildings.filter((x) => x.defId === def.id).length === 1;
      if (def.landmark) chronicle(state, "landmark", `Construction of ${def.name} begins`);
      else if (firstOfKind && def.category !== "residence") chronicle(state, "building", `First ${def.name} built`);
      const dnaMap: Partial<Record<string, keyof CityDNA>> = { agricultural: "agriculture", production: "production", market: "trade", knowledge: "knowledge", cultural: "culture", royal: "prestige", residential: "urbanism", defensive: "stability", garden: "culture", infrastructure: "urbanism" };
      const key = dnaMap[def.district];
      if (key) nudgeDNA(state, key, def.landmark ? 4 : 1);
      break;
    }
    case "move": {
      const b = state.buildings.find((x) => x.id === action.buildingId);
      if (!b) return fail(state, "Building not found");
      const def = BUILDING_BY_ID[b.defId];
      if (!canPlace(state, def, action.x, action.y, b.id)) return fail(state, "Cannot place here");
      b.x = action.x;
      b.y = action.y;
      break;
    }
    case "upgrade": {
      const b = state.buildings.find((x) => x.id === action.buildingId);
      if (!b) return fail(state, "Building not found");
      if (b.layer !== "active") return fail(state, "Only active buildings can be upgraded");
      if (b.completesAt && b.completesAt > now) return fail(state, "Still under construction");
      const def = BUILDING_BY_ID[b.defId];
      if (b.level >= def.levels.length) return fail(state, "Max level");
      const cost = def.levels[b.level].cost;
      if (!canAfford(state.resources, cost)) return fail(state, "Not enough resources");
      collectBuilding(state, b, derived);
      pay(state.resources, cost);
      b.level++;
      b.completesAt = now + Math.max(5, def.buildSeconds * 0.8 * b.level) * 1000;
      state.stats.upgrades++;
      if (def.landmark) chronicle(state, "landmark", `${def.name} expanded to level ${b.level}`);
      break;
    }
    case "demolish": {
      const i = state.buildings.findIndex((x) => x.id === action.buildingId);
      if (i < 0) return fail(state, "Building not found");
      const def = BUILDING_BY_ID[state.buildings[i].defId];
      if (def.category === "government" && def.era === state.eraId) return fail(state, "Cannot demolish your government seat");
      const refund = def.levels[0].cost;
      Object.entries(refund).forEach(([k, v]) => (state.resources[k as ResourceId] += Math.floor((v ?? 0) * 0.4)));
      state.buildings.splice(i, 1);
      break;
    }
    case "preserve": {
      const b = state.buildings.find((x) => x.id === action.buildingId);
      if (!b) return fail(state, "Building not found");
      if (b.layer === "heritage") return fail(state, "Already preserved");
      const def = BUILDING_BY_ID[b.defId];
      const cost = { coins: Math.round((def.levels[0].cost.materials ?? 100) * 0.8), materials: Math.round((def.levels[0].cost.materials ?? 100) * 0.3) };
      if (!canAfford(state.resources, cost)) return fail(state, "Not enough resources to preserve");
      pay(state.resources, cost);
      b.layer = "heritage";
      chronicle(state, "heritage", `${def.name} preserved as heritage`, `A ${ERA_BY_ID[b.builtEra].name} structure protected for future generations.`);
      nudgeDNA(state, "culture", 2);
      nudgeDNA(state, "prestige", 1);
      break;
    }
    case "research": {
      const t = TECH_BY_ID[action.techId];
      if (!t) return fail(state, "Unknown technology");
      if (state.research) return fail(state, "Already researching");
      if (state.technologies.includes(t.id)) return fail(state, "Already researched");
      if (eraIndex(t.era) > idx) return fail(state, "Not available in this era");
      if (!t.prereqs.every((p) => state.technologies.includes(p))) return fail(state, "Prerequisites missing");
      if (!canAfford(state.resources, t.cost)) return fail(state, "Not enough resources");
      pay(state.resources, t.cost);
      state.research = { techId: t.id, completesAt: now + t.seconds * 1000 };
      break;
    }
    case "train": {
      const u = UNIT_BY_ID[action.unitId];
      if (!u) return fail(state, "Unknown unit");
      if (state.training) return fail(state, "Already training");
      if (eraIndex(u.era) > idx) return fail(state, "Not available in this era");
      if (u.requiresTech && !state.technologies.includes(u.requiresTech)) return fail(state, `Requires ${TECH_BY_ID[u.requiresTech]?.name}`);
      const hasBarracks = state.buildings.some((b) => BUILDING_BY_ID[b.defId]?.category === "military" && buildingEfficiency(state, b) > 0);
      if (!hasBarracks) return fail(state, "Build a military building first");
      if (derived.armySize + u.capacity > Math.floor(state.population / 10) + 5) return fail(state, "Army capacity reached (grow population)");
      if (!canAfford(state.resources, u.cost)) return fail(state, "Not enough resources");
      pay(state.resources, u.cost);
      state.training = { unitId: u.id, completesAt: now + u.trainSeconds * 1000 };
      break;
    }
    case "discover_city": {
      const c = CITY_BY_ID[action.cityId];
      if (!c) return fail(state, "Unknown city");
      if (state.discoveredCities.includes(c.id)) return fail(state, "Already discovered");
      if (!c.eras[state.eraId]) return fail(state, "Not significant in this era");
      if (!canAfford(state.resources, c.discoverCost)) return fail(state, "Not enough resources");
      pay(state.resources, c.discoverCost);
      state.discoveredCities.push(c.id);
      state.resources.knowledge += 20 * (idx + 1);
      chronicle(state, "discovery", `Envoys reach ${c.name}`, c.eras[state.eraId]?.role);
      nudgeDNA(state, "knowledge", 1);
      break;
    }
    case "trade_route": {
      const c = CITY_BY_ID[action.toCity];
      if (!c) return fail(state, "Unknown city");
      if (!state.discoveredCities.includes(c.id)) return fail(state, "Discover the city first");
      if (c.id === state.capitalCityId) return fail(state, "Cannot trade with your own capital");
      if (state.tradeRoutes.some((r) => r.toCity === c.id)) return fail(state, "Route exists");
      if (state.tradeRoutes.length >= derived.maxRoutes) return fail(state, "Route limit reached (build markets or roads)");
      const capital = CITY_BY_ID[state.capitalCityId];
      const dist = Math.hypot(c.x - capital.x, c.y - capital.y);
      const cost = { coins: Math.round((80 + dist * 6) * (idx + 1)), influence: idx > 0 ? Math.round(10 * idx) : 0 };
      if (!canAfford(state.resources, cost)) return fail(state, `Needs ${cost.coins} coins${cost.influence ? ` and ${cost.influence} influence` : ""}`);
      pay(state.resources, cost);
      state.tradeRoutes.push({ id: `r${Date.now().toString(36)}`, fromCity: state.capitalCityId, toCity: c.id, establishedYear: currentYear(state), eraId: state.eraId });
      chronicle(state, "trade", `Trade route to ${c.name} established`);
      nudgeDNA(state, "trade", 3);
      break;
    }
    case "set_capital": {
      const c = CITY_BY_ID[action.cityId];
      if (!c) return fail(state, "Unknown city");
      if (!state.discoveredCities.includes(c.id)) return fail(state, "Discover the city first");
      if (c.id === state.capitalCityId) return fail(state, "Already your political centre");
      const imp = c.eras[state.eraId]?.importance ?? 0;
      if (imp < 3) return fail(state, "This city lacks the standing to be a political centre in this era");
      if (state.capitalChangedAtPlayMs !== undefined && state.playMs - state.capitalChangedAtPlayMs < CAPITAL_COOLDOWN_MS) return fail(state, "Court is still relocating (cooldown)");
      const cost = { influence: 60 * (idx + 1), coins: 400 * (idx + 1) };
      if (!canAfford(state.resources, cost)) return fail(state, `Needs ${cost.influence} influence and ${cost.coins} coins`);
      pay(state.resources, cost);
      const prev = CITY_BY_ID[state.capitalCityId];
      state.tradeRoutes = state.tradeRoutes.filter((r) => r.toCity !== c.id);
      state.capitalCityId = c.id;
      state.capitalChangedAtPlayMs = state.playMs;
      chronicle(state, "capital", `Political centre moved to ${c.name}`, `${prev?.name ?? "The old seat"} retains its history as a former centre.`);
      nudgeDNA(state, "prestige", 3);
      break;
    }
    case "specialize": {
      const cost = { prestige: 40 * (idx + 1) * (state.specialization ? 2 : 1) };
      if (!canAfford(state.resources, cost)) return fail(state, `Needs ${cost.prestige} Farah`);
      pay(state.resources, cost);
      state.specialization = action.specialization;
      nudgeDNA(state, SPEC_DNA[action.specialization], 6);
      chronicle(state, "specialization", `City specialised as ${action.specialization} centre`);
      break;
    }
    case "resolve_event": {
      if (!state.pendingEvent) return fail(state, "No event pending");
      const ev = EVENT_BY_ID[state.pendingEvent.eventId];
      const choice = ev?.choices.find((c) => c.id === action.choiceId);
      if (!ev || !choice) return fail(state, "Invalid choice");
      Object.entries(choice.effects).forEach(([k, v]) => {
        if (k === "population") state.population = Math.max(10, state.population + (v ?? 0));
        else if (k === "stability") state.dna.stability = Math.max(0, Math.min(100, state.dna.stability + (v ?? 0) * 2));
        else state.resources[k as ResourceId] = Math.max(0, state.resources[k as ResourceId] + (v ?? 0));
      });
      const divergence = !!(ev.divergence && choice.alternate);
      if (divergence && state.mode === "historical") {
        state.mode = "alternate";
        state.divergedAt = { year: currentYear(state), eraId: state.eraId, eventId: ev.id };
      }
      state.decisions.push({ eventId: ev.id, choiceId: choice.id, year: currentYear(state), eraId: state.eraId, divergence });
      state.seenEvents.push(ev.id);
      state.pendingEvent = undefined;
      chronicle(state, divergence ? "divergence" : "event", `${ev.title}: ${choice.label}`, choice.outcome);
      toasts.push(choice.outcome);
      break;
    }
    case "claim_quest": {
      const q = QUESTS.find((x) => x.id === action.questId);
      if (!q) return fail(state, "Unknown quest");
      if (state.completedQuests.includes(q.id)) return fail(state, "Already claimed");
      const [c, t] = evaluateMetric(state, q.metric);
      if (c < t) return fail(state, "Quest not complete");
      Object.entries(q.reward).forEach(([k, v]) => (state.resources[k as ResourceId] += v ?? 0));
      state.completedQuests.push(q.id);
      toasts.push(`Quest complete: ${q.title}`);
      break;
    }
    case "advance_era": {
      const prog = eraProgress(state);
      if (!prog.canAdvance || !prog.next) return fail(state, "Era requirements not met");
      const from = state.eraId;
      const to = prog.next;
      state.erasCompleted.push(from);
      chronicle(state, "era", `The ${ERA_BY_ID[from].name} draws to a close`);
      state.eraId = to;
      state.eraEnteredAt = state.playMs;
      // building layers: aging
      state.buildings.forEach((b) => {
        const age = eraIndex(to) - eraIndex(b.builtEra);
        if (b.layer === "heritage") return;
        if (age >= 3) b.layer = "ruin";
        else if (age >= 2) b.layer = "abandoned";
      });
      // kick-start resources for the new age
      const k = eraIndex(to);
      state.resources.materials += 600 * k * k;
      state.resources.coins += 400 * k * k;
      state.resources.food += 400 * k * k;
      state.gridSize = gridSizeFor(state);
      chronicle(state, "era", `The ${ERA_BY_ID[to].name} begins`, ERA_BY_ID[to].historicalChanges.join(" · "));
      nudgeDNA(state, "urbanism", 5);
      nudgeDNA(state, "prestige", 5);
      const u = checkUnlocks(state);
      return { ok: true, state, toasts, eraTransition: { from, to }, unlockedAchievements: u.achievements, newArtifacts: u.artifacts };
    }
    case "set_leader": {
      if (!state.leaders.includes(action.leaderId)) return fail(state, "Leader not unlocked");
      state.activeLeader = action.leaderId;
      break;
    }
    case "tutorial": {
      state.tutorialStep = Math.max(state.tutorialStep, action.step);
      break;
    }
    case "exchange": {
      const VALUE: Record<ResourceId, number> = { food: 1, materials: 1.5, coins: 1, metal: 4, water: 1, knowledge: 3, horses: 6, prestige: 0, influence: 0 };
      if (!VALUE[action.give] || !VALUE[action.get] || action.give === action.get) return fail(state, "Cannot exchange these");
      if (!unlockedResources(state).includes(action.get)) return fail(state, "Resource not yet unlocked");
      const amount = Math.floor(action.amount);
      if (amount <= 0 || state.resources[action.give] < amount) return fail(state, "Not enough to exchange");
      const received = Math.floor((amount * VALUE[action.give] * 0.8) / VALUE[action.get]);
      if (received <= 0) return fail(state, "Amount too small");
      state.resources[action.give] -= amount;
      state.resources[action.get] = Math.min(derived.storageCap[action.get], state.resources[action.get] + received);
      nudgeDNA(state, "trade", 0.5);
      break;
    }
    case "rename": {
      const name = action.name.trim().slice(0, 32);
      if (name.length < 2) return fail(state, "Name too short");
      state.cityName = name;
      break;
    }
    case "reset": {
      return { ok: true, state: newGameState(now, state.cityName), toasts: ["A new history begins."] };
    }
  }

  const u = checkUnlocks(state);
  state.cityLevel = computeCityLevel(state);
  state.gridSize = gridSizeFor(state);
  return {
    ok: true,
    state,
    toasts,
    unlockedAchievements: [...ticked.unlockedAchievements, ...u.achievements],
    newArtifacts: [...ticked.newArtifacts, ...u.artifacts],
  };
}

/* ------------------------------------------------------------------ */
/*  Catalogue helpers for UI                                           */
/* ------------------------------------------------------------------ */

export function buildableBuildings(state: GameState) {
  return BUILDINGS.filter((b) => b.era === state.eraId);
}

export function techsForEra(eraId: EraId) {
  return TECHNOLOGIES.filter((t) => t.era === eraId);
}

export function unitsForEra(eraId: EraId) {
  return UNITS.filter((u) => u.era === eraId);
}

export function citiesForEra(eraId: EraId) {
  return CITIES.filter((c) => c.eras[eraId]);
}

export function seasonFor(playMs: number): "spring" | "summer" | "autumn" | "winter" {
  const seasons = ["spring", "summer", "autumn", "winter"] as const;
  return seasons[Math.floor(playMs / (MS_PER_YEAR / 4)) % 4];
}

export function weatherFor(playMs: number): "clear" | "rain" | "drought" | "cold" | "heat" {
  const s = seasonFor(playMs);
  const r = rng(Math.floor(playMs / 30_000))();
  if (s === "spring") return r < 0.4 ? "rain" : "clear";
  if (s === "summer") return r < 0.3 ? "heat" : r < 0.4 ? "drought" : "clear";
  if (s === "autumn") return r < 0.3 ? "rain" : "clear";
  return r < 0.5 ? "cold" : "clear";
}
