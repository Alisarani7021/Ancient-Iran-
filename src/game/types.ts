/* ------------------------------------------------------------------ */
/*  ERĀN — core data model                                             */
/*  All content is data-driven; adding an era = adding data entries.   */
/* ------------------------------------------------------------------ */

export type ResourceId =
  | "food"
  | "materials"
  | "coins"
  | "metal"
  | "water"
  | "knowledge"
  | "prestige"
  | "influence"
  | "horses";

export type Resources = Record<ResourceId, number>;

/** Historical confidence for any statement shown to the player. */
export type Confidence =
  | "documented" // broadly attested in scholarship
  | "interpreted" // scholarly interpretation / reconstruction
  | "uncertain" // debated or poorly attested
  | "game"; // pure gameplay abstraction / fiction

export interface SourceMeta {
  confidence: Confidence;
  note?: string;
}

export type EraId =
  | "medes"
  | "achaemenid"
  | "seleucid"
  | "parthian"
  | "sasanian"
  | "medieval"
  | "seljuk"
  | "ilkhanid"
  | "timurid"
  | "safavid"
  | "afsharid"
  | "zand"
  | "qajar"
  | "pahlavi"
  | "contemporary";

export interface EraVisual {
  primary: string;
  secondary: string;
  accent: string;
  ground: string;
  roof: string;
  wall: string;
  sky: string;
  motif: string; // short label for the geometric motif used in UI
}

export interface EraTransitionRequirement {
  population?: number;
  prestige?: number;
  technologies?: string[];
  landmarks?: string[];
  cityLevel?: number;
}

export interface Era {
  id: EraId;
  name: string;
  subtitle: string;
  startYear: number; // negative = BCE
  endYear: number;
  playable: boolean;
  order: number;
  dynasty: string;
  visual: EraVisual;
  description: string;
  historicalChanges: string[]; // shown at transition
  resourcesUnlocked: ResourceId[];
  transitionTo?: EraId;
  requirement?: EraTransitionRequirement;
  musicPlaceholder: string;
  source: SourceMeta;
}

export type DistrictId =
  | "royal"
  | "residential"
  | "market"
  | "agricultural"
  | "production"
  | "knowledge"
  | "cultural"
  | "garden"
  | "infrastructure"
  | "defensive";

export interface BuildingLevel {
  cost: Partial<Resources>;
  production?: Partial<Resources>; // per hour
  storage?: Partial<Resources>;
  housing?: number;
  workers?: number;
  prestige?: number; // flat prestige bonus (cultural buildings)
  stability?: number;
}

export type BuildingCategory =
  | "government"
  | "residence"
  | "production"
  | "storage"
  | "knowledge"
  | "culture"
  | "infrastructure"
  | "defense"
  | "landmark"
  | "military";

export interface BuildingDef {
  id: string;
  name: string;
  era: EraId; // first era where buildable
  category: BuildingCategory;
  district: DistrictId;
  glyph: string; // emoji/symbol used on the iso block
  shape: "block" | "tower" | "dome" | "hall" | "field" | "wall" | "garden";
  size: 1 | 2;
  levels: BuildingLevel[];
  requiresTech?: string;
  requiresPopulation?: number;
  requiresCityLevel?: number;
  unique?: boolean; // only one instance
  landmark?: boolean;
  buildSeconds: number;
  description: string;
  history?: string;
  source: SourceMeta;
}

export type TechBranch =
  | "agriculture"
  | "administration"
  | "architecture"
  | "trade"
  | "infrastructure"
  | "knowledge"
  | "craft"
  | "culture"
  | "urban"
  | "military";

export interface TechEffect {
  productionMult?: Partial<Record<ResourceId, number>>; // e.g. food: 0.15 => +15%
  storageMult?: number;
  housingMult?: number;
  stability?: number;
  unlocksBuilding?: string[];
  unlocksUnit?: string[];
  tradeMult?: number;
}

export interface TechDef {
  id: string;
  name: string;
  era: EraId;
  branch: TechBranch;
  cost: Partial<Resources>;
  seconds: number;
  prereqs: string[];
  effect: TechEffect;
  description: string;
  history?: string;
  source: SourceMeta;
}

export type UnitRole = "infantry" | "ranged" | "light_cavalry" | "heavy_cavalry" | "special" | "support";

export interface UnitDef {
  id: string;
  name: string;
  era: EraId;
  role: UnitRole;
  cost: Partial<Resources>;
  trainSeconds: number;
  movement: number;
  health: number;
  defense: number;
  attack: number;
  range?: number;
  capacity: number;
  requiresTech?: string;
  glyph: string;
  history: string;
  source: SourceMeta;
}

export interface LeaderDef {
  id: string;
  name: string;
  era: EraId;
  role: string;
  biography: string;
  bonus: TechEffect & { label: string };
  unlock: { prestige?: number; era?: EraId; tech?: string };
  rarity: "notable" | "renowned" | "legendary";
  source: SourceMeta;
}

export type ArtifactCategory =
  | "coin"
  | "inscription"
  | "seal"
  | "pottery"
  | "textile"
  | "architecture"
  | "tool"
  | "ceremonial";

export interface ArtifactDef {
  id: string;
  name: string;
  era: EraId;
  cityId?: string;
  category: ArtifactCategory;
  rarity: "common" | "rare" | "epic";
  description: string;
  fictional: boolean;
  value: number; // prestige on discovery
  unlock: { city?: string; tech?: string; building?: string; achievement?: string; era?: EraId };
  source: SourceMeta;
}

export type CitySpecialization =
  | "trade"
  | "cultural"
  | "agricultural"
  | "knowledge"
  | "resource"
  | "government"
  | "frontier";

export interface CityDNA {
  trade: number;
  culture: number;
  knowledge: number;
  agriculture: number;
  production: number;
  urbanism: number;
  prestige: number;
  stability: number;
}

export interface CityDef {
  id: string;
  name: string;
  historicalNames?: string[];
  region: string;
  province: string;
  x: number; // 0..100 map coordinates (schematic, not GIS)
  y: number;
  eras: Partial<Record<EraId, { importance: 1 | 2 | 3 | 4 | 5; role?: string; note?: string }>>;
  specialization: CitySpecialization;
  economic: string;
  cultural: string;
  bonuses: Partial<Record<ResourceId, number>>; // trade route yield modifiers
  baseDNA: CityDNA;
  notes: string;
  discoverCost: Partial<Resources>;
  source: SourceMeta;
}

export type EventCategory =
  | "economic"
  | "cultural"
  | "environmental"
  | "political"
  | "urban"
  | "trade"
  | "knowledge"
  | "historical";

export interface EventChoice {
  id: string;
  label: string;
  effects: Partial<Resources> & { population?: number; stability?: number };
  alternate?: boolean; // choosing this branches to alternate history
  outcome: string;
}

export interface EventDef {
  id: string;
  title: string;
  era: EraId | "any";
  category: EventCategory;
  text: string;
  choices: EventChoice[];
  divergence?: boolean;
  historical?: boolean;
  source: SourceMeta;
}

export type QuestCategory =
  | "city"
  | "era"
  | "building"
  | "trade"
  | "knowledge"
  | "culture"
  | "exploration"
  | "collection";

export interface QuestDef {
  id: string;
  title: string;
  category: QuestCategory;
  era?: EraId;
  description: string;
  reward: Partial<Resources>;
  /** evaluated against state -> [current, target] */
  metric: QuestMetric;
}

export type QuestMetric =
  | { kind: "population"; target: number }
  | { kind: "building_count"; building: string; target: number }
  | { kind: "category_count"; category: BuildingCategory; target: number }
  | { kind: "tech_count"; target: number }
  | { kind: "cities_discovered"; target: number }
  | { kind: "trade_routes"; target: number }
  | { kind: "artifacts"; target: number }
  | { kind: "landmarks"; target: number }
  | { kind: "prestige"; target: number }
  | { kind: "era_index"; target: number }
  | { kind: "units"; target: number }
  | { kind: "collections"; target: number }
  | { kind: "city_level"; target: number };

export interface AchievementDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  metric: QuestMetric;
}

export interface HistoricalEventDef {
  id: string;
  year: number;
  era: EraId;
  title: string;
  description: string;
  source: SourceMeta;
}

/* ------------------------------ state ------------------------------ */

export type LayerState = "active" | "abandoned" | "ruin" | "heritage";

export interface PlacedBuilding {
  id: string;
  defId: string;
  x: number;
  y: number;
  level: number;
  builtEra: EraId;
  layer: LayerState;
  completesAt?: number; // ms timestamp while constructing/upgrading
  stored: number; // uncollected production units (abstract) for its primary resource
  lastCollectedAt: number;
}

export interface ResearchState {
  techId: string;
  completesAt: number;
}

export interface UnitInstance {
  defId: string;
  count: number;
}

export interface TrainingState {
  unitId: string;
  completesAt: number;
}

export interface TradeRouteState {
  id: string;
  fromCity: string;
  toCity: string;
  establishedYear: number;
  eraId: EraId;
}

export interface ChronicleEntry {
  year: number;
  eraId: EraId;
  kind: string;
  title: string;
  detail?: string;
  alternate?: boolean;
  at: number;
}

export interface PendingEvent {
  eventId: string;
  triggeredAt: number;
}

export interface DecisionRecord {
  eventId: string;
  choiceId: string;
  year: number;
  eraId: EraId;
  divergence: boolean;
}

export interface PopulationBreakdown {
  farmers: number;
  artisans: number;
  merchants: number;
  administrators: number;
  scholars: number;
  builders: number;
  residents: number;
}

export interface GameState {
  schemaVersion: number;
  createdAt: number;
  lastTickAt: number;
  playMs: number; // total simulated ms (drives year)
  eraId: EraId;
  eraEnteredAt: number; // playMs when era entered
  yearOffset: number; // years accumulated within era
  mode: "historical" | "alternate";
  divergedAt?: { year: number; eraId: EraId; eventId: string };
  cityName: string;
  capitalCityId: string;
  capitalChangedAtPlayMs?: number;
  specialization?: CitySpecialization;
  cityLevel: number;
  gridSize: number;
  resources: Resources;
  population: number;
  stability: number;
  buildings: PlacedBuilding[];
  technologies: string[];
  research?: ResearchState;
  units: UnitInstance[];
  training?: TrainingState;
  discoveredCities: string[];
  tradeRoutes: TradeRouteState[];
  artifacts: string[];
  leaders: string[];
  activeLeader?: string;
  completedQuests: string[];
  achievements: string[];
  chronicle: ChronicleEntry[];
  decisions: DecisionRecord[];
  pendingEvent?: PendingEvent;
  lastEventAtPlayMs: number;
  seenEvents: string[];
  tutorialStep: number;
  erasCompleted: EraId[];
  dna: CityDNA;
  nextBuildingId: number;
  stats: {
    collected: Partial<Resources>;
    buildingsBuilt: number;
    upgrades: number;
  };
}

export interface OfflineSummary {
  elapsedMs: number;
  gained: Partial<Resources>;
  capped: boolean;
}

/** All server-authoritative actions. */
export type GameAction =
  | { type: "collect"; buildingId?: string }
  | { type: "build"; defId: string; x: number; y: number }
  | { type: "move"; buildingId: string; x: number; y: number }
  | { type: "upgrade"; buildingId: string }
  | { type: "demolish"; buildingId: string }
  | { type: "preserve"; buildingId: string }
  | { type: "research"; techId: string }
  | { type: "train"; unitId: string }
  | { type: "discover_city"; cityId: string }
  | { type: "trade_route"; toCity: string }
  | { type: "set_capital"; cityId: string }
  | { type: "specialize"; specialization: CitySpecialization }
  | { type: "resolve_event"; choiceId: string }
  | { type: "claim_quest"; questId: string }
  | { type: "advance_era" }
  | { type: "set_leader"; leaderId: string }
  | { type: "tutorial"; step: number }
  | { type: "exchange"; give: ResourceId; get: ResourceId; amount: number }
  | { type: "rename"; name: string }
  | { type: "reset" };

export interface ActionResult {
  ok: boolean;
  state: GameState;
  error?: string;
  toasts?: string[];
  unlockedAchievements?: string[];
  eraTransition?: { from: EraId; to: EraId };
  newArtifacts?: string[];
}
