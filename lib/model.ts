// The token radar's model (radar-4): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every rankable pre-token protocol: the snapshot's whole watchlist (the floor,
// never a ceiling) plus every pre-token protocol below the floor that passes the watchlist's own
// exclusion rule — not an exchange, not a bridge / liquid-staking / restaking product, not a
// version-marked pool, no wrapped or staked product of a token that already trades. A protocol is
// pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown with the market's own values, never
// mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures:
//
//   categoryMultiple = shrunk median mcap/TVL of the live-token protocols in the same category
//   growthMult       = 1 + clamp(change_7d, -50, 60) / 100 x 0.5
//   maturityMult     = 0.5 + 0.3 x age/90 below 90 days, then 0.8 + 0.2 x (age-90)/1005 to 1095 days
//                      (age unknown: 365 days)
//   breadthMult      = 1 + 0.04 x min(chains - 1, 5)
//   ceiling          = 0.5 x the category's total live-token market cap, when the category has one
//   implied          = max(1, round(min(tvl_usd x categoryMultiple x growthMult x maturityMult
//                      x breadthMult, ceiling)))
//
// Three radar-3 judgements, each from the snapshot's own numbers (see PLAN.md for the counts):
// the ceiling stops one protocol claiming more than half of everything its category's tokens
// are worth — the old board had 19 rows above their whole category's traded value, the top one
// at 17x it. The age curve is sharpest in the first 90 days, the window where a protocol most
// often fails, and flattens after it. The growth cap is 60% because the snapshot carries a
// single week, and a single week's spike is not durable value: only 6 of 198 rows sit above it.
// No protocol name is ever special-cased: the same function scores every row.
//
// Radar-4 adds the test radar-3 never ran: the pricing core is fitted and scored blind on the
// tokens that already trade, before the board is built (see validateModel). Two splits, both
// deterministic: even/odd by slug, and walk-forward, older-listed tokens training the newer
// ones. The test scores the pricing core without the ceiling, then with it, and a flat global
// multiple as the baseline, so the board can say what the model can and cannot do instead of
// asserting it. On this snapshot the core ranks held-out tokens at Spearman 0.41 (even/odd)
// and 0.28 (walk-forward) against a flat multiple's 0.45 and 0.34, with a median miss of about
// 1.7 in log terms — roughly a five-fold typical miss. Read straight: the category fit does
// not out-rank a flat multiple on the tokens that already trade. What the multiples do is
// price categories differently on the board itself — its top 10 shares only 3 rows with the
// TVL top 10, and its rank 1 sits at TVL rank 19 — so the model's edge over a TVL table is
// the category-relative pricing and the farm plan, not a sharper prediction. The ceiling costs
// ranking accuracy on live tokens (0.41 falls to 0.03 when it is applied) and is kept anyway,
// as a claim discipline for pre-token rows only: without it the board's top row would claim
// $622M, 22 rows above their whole category's traded value. The board is not a TVL table
// either: its top 10 shares only 3 rows with the TVL top 10, and its rank 1 sits at TVL
// rank 19 — the category multiples move the answer.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  maturity_kink_days: number;
  maturity_kink_value: number;
  unknown_age_days: number;
  comp_shrink: number;
  comp_min: number;
  comp_max: number;
  comp_median_min: number;
  comp_median_max: number;
  breadth_step: number;
  breadth_max_chains: number;
  ceiling_share: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -50,
  growth_cap: 60,
  maturity_floor: 0.5,
  maturity_range: 0.5,
  maturity_days: 1095,
  maturity_kink_days: 90,
  maturity_kink_value: 0.8,
  unknown_age_days: 365,
  comp_shrink: 3,
  comp_min: 0.05,
  comp_max: 1.5,
  comp_median_min: 0.02,
  comp_median_max: 2.0,
  breadth_step: 0.04,
  breadth_max_chains: 5,
  ceiling_share: 0.5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_comps: number;
    category_live_mcap_usd: number;
    ceiling_usd: number | null;
    capped: boolean;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  farm_sunk_usd: number;
  farm_capital_usd: number;
  farm_days: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  on_watchlist: boolean;
  category_multiple: number;
  category_comps: number;
  category_live_mcap_usd: number;
  ceiling_usd: number | null;
  capped: boolean;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  farm_sunk_usd: number;
  farm_capital_usd: number;
  farm_days: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's pricing: the multiple the model applies, and how many live comps back it. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  comps: number;
  median: number | null;
  live_mcap_usd: number;
  ceiling_usd: number | null;
}

/** One blind split's result: the pricing core fitted on the train half, scored on the held-out half. */
export interface SplitResult {
  split: string;
  train_n: number;
  test_n: number;
  spearman: number;
  median_abs_log_error: number;
  within_2x: number;
  within_3x: number;
  flat_spearman: number;
  flat_median_abs_log_error: number;
  ceiling_spearman: number;
}

/** The blind test's whole result, computed from the snapshot at runtime and shown on the page. */
export interface ModelValidation {
  live_comps: number;
  even_odd: SplitResult;
  walk_forward: SplitResult;
  board_top10_tvl_overlap: number;
  board_rank1_tvl_rank: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  category_multiples: CategoryMultiple[];
  validation: ModelValidation;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp `n` into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The median of a non-empty list of numbers; null when empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The categories the watchlist rule keeps out: bridges, liquid staking, restaking, exchanges. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** A name that begins with an exchange's name is that exchange's product, not a new protocol. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** A whole word wrapped, staked or staking marks a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Whether a protocol is one the board may rank: pre-token, and passing the watchlist's own
 * exclusion rule. The rule is the same for a watchlist protocol and one below the floor, so the
 * board's early rows are the same kind of subject as its watchlist rows.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The live-token protocols the multiples are fitted on: a token that trades, with a market cap and a TVL. */
export function liveComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

export interface FitTable {
  global: number;
  byCategory: Map<string, CategoryMultiple>;
  liveMcapByCategory: Map<string, number>;
}

/**
 * The category pricing table, fitted on a list of live-token protocols: for each category, the
 * median market-cap-to-TVL ratio of the protocols in it whose token trades, shrunk toward the
 * global median and clamped. A category counts only with two or more live tokens; with fewer
 * it takes the global median, and a token whose market cap records as zero is no comp at all.
 * Categories with no live comps take the global median, so no row is ever priced by a number
 * the snapshot does not carry.
 */
export function fitTable(live: SnapshotProtocol[], model: ModelConstants = MODEL): FitTable {
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0.2;
  const byCat = new Map<string, number[]>();
  const liveMcapByCategory = new Map<string, number>();
  for (const p of live) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key);
    if (list) list.push(p.mcap_usd! / p.tvl_usd);
    else byCat.set(key, [p.mcap_usd! / p.tvl_usd]);
    liveMcapByCategory.set(key, (liveMcapByCategory.get(key) ?? 0) + p.mcap_usd!);
  }
  const byCategory = new Map<string, CategoryMultiple>();
  for (const [category, ratios] of byCat) {
    const liveMcap = liveMcapByCategory.get(category) ?? 0;
    const ceiling = liveMcap > 0 ? Math.round(liveMcap * model.ceiling_share) : null;
    if (ratios.length < 2) {
      byCategory.set(category, { category, multiple: clamp(global, model.comp_min, model.comp_max), comps: 0, median: null, live_mcap_usd: liveMcap, ceiling_usd: ceiling });
      continue;
    }
    const med = median(ratios) ?? global;
    const shrunk = (ratios.length * clamp(med, model.comp_median_min, model.comp_median_max) + model.comp_shrink * global) / (ratios.length + model.comp_shrink);
    byCategory.set(category, { category, multiple: clamp(shrunk, model.comp_min, model.comp_max), comps: ratios.length, median: med, live_mcap_usd: liveMcap, ceiling_usd: ceiling });
  }
  return { global, byCategory, liveMcapByCategory };
}

/** The category pricing table, computed from the snapshot's live-token protocols. */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): FitTable {
  return fitTable(liveComps(snapshot), model);
}

/** The multiple one protocol's category carries, with its comp count. */
export function multipleFor(p: SnapshotProtocol, table: FitTable, model: ModelConstants = MODEL): { multiple: number; comps: number; median: number | null; liveMcap: number; ceiling: number | null } {
  const liveMcap = table.liveMcapByCategory.get(p.category ?? 'Other') ?? 0;
  const ceiling = liveMcap > 0 ? Math.round(liveMcap * model.ceiling_share) : null;
  const entry = table.byCategory.get(p.category ?? 'Other');
  if (entry === undefined) return { multiple: clamp(table.global, model.comp_min, model.comp_max), comps: 0, median: null, liveMcap, ceiling };
  return { multiple: entry.multiple, comps: entry.comps, median: entry.median, liveMcap, ceiling };
}

/**
 * The maturity credit for an age in days: the first 90 days are the riskiest window, so the
 * curve climbs fastest there (0.5 at day zero to 0.8 at day 90), then slowly to 1.0 at 1095
 * days. A protocol younger than a month keeps barely half its TVL-implied value; one that has
 * run three years with no token keeps all of it.
 */
export function maturityMult(age: number | null, model: ModelConstants = MODEL): number {
  const a = clamp(age ?? model.unknown_age_days, 0, model.maturity_days);
  if (a <= model.maturity_kink_days) {
    return model.maturity_floor + (model.maturity_kink_value - model.maturity_floor) * (a / model.maturity_kink_days);
  }
  return model.maturity_kink_value + (1 - model.maturity_kink_value) * ((a - model.maturity_kink_days) / (model.maturity_days - model.maturity_kink_days));
}

/** The pricing core without the ceiling: the value the multiples, growth, age and breadth give. */
export function coreValue(
  protocol: SnapshotProtocol,
  asOf: string,
  table: FitTable,
  model: ModelConstants = MODEL,
  flat = false,
): number {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = flat
    ? clamp(table.global, model.comp_min, model.comp_max)
    : multipleFor(protocol, table, model).multiple;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturity = maturityMult(age, model);
  const breadthMult = 1 + model.breadth_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  return Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturity * breadthMult));
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  table: FitTable,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; comps: number; liveMcap: number; ceiling: number | null; capped: boolean; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, comps, liveMcap, ceiling } = multipleFor(protocol, table, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturity = maturityMult(age, model);
  const breadthMult = 1 + model.breadth_step * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const raw = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturity * breadthMult));
  const capped = ceiling !== null && raw > ceiling;
  const implied = capped ? ceiling! : raw;
  return { implied, multiple, comps, liveMcap, ceiling, capped, growthPct, growthMult, maturityMult: maturity, breadthMult, age };
}

/** Spearman's rank correlation, ties averaged; 0 when either side has no spread. */
export function spearman(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const ranks = (values: number[]): number[] => {
    const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1]![0] === order[i]![0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[order[k]![1]] = avg;
      i = j + 1;
    }
    return out;
  };
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;

/**
 * One blind split: fit the table on the train half only, score it on the held-out half. The
 * core is scored without the ceiling, because the ceiling is a claim discipline for pre-token
 * rows, not a predictor — the same split scored with the ceiling is reported beside it so the
 * cost of that discipline is visible, and a flat global multiple is the baseline the category
 * fit has to beat. A split that cannot be scored (fewer than 8 held-out protocols) reports
 * zeros and the dashboard says so.
 */
export function validateSplit(train: SnapshotProtocol[], test: SnapshotProtocol[], asOf: string, label: string, model: ModelConstants = MODEL): SplitResult {
  const empty: SplitResult = { split: label, train_n: train.length, test_n: test.length, spearman: 0, median_abs_log_error: 0, within_2x: 0, within_3x: 0, flat_spearman: 0, flat_median_abs_log_error: 0, ceiling_spearman: 0 };
  if (test.length < 8) return empty;
  const table = fitTable(train, model);
  const actual = test.map((p) => p.mcap_usd!);
  const core = test.map((p) => coreValue(p, asOf, table, model, false));
  const flat = test.map((p) => coreValue(p, asOf, table, model, true));
  const capped = test.map((p) => {
    const raw = coreValue(p, asOf, table, model, false);
    const ceiling = multipleFor(p, table, model).ceiling;
    return ceiling !== null && raw > ceiling ? ceiling : raw;
  });
  const errors = core.map((pred, i) => Math.abs(Math.log(pred / actual[i]!)));
  const flatErrors = flat.map((pred, i) => Math.abs(Math.log(pred / actual[i]!)));
  const within = (lo: number, hi: number): number => core.filter((pred, i) => { const r = pred / actual[i]!; return r >= lo && r <= hi; }).length;
  return {
    split: label,
    train_n: train.length,
    test_n: test.length,
    spearman: round3(spearman(core, actual)),
    median_abs_log_error: round3(median(errors) ?? 0),
    within_2x: within(0.5, 2),
    within_3x: within(1 / 3, 3),
    flat_spearman: round3(spearman(flat, actual)),
    flat_median_abs_log_error: round3(median(flatErrors) ?? 0),
    ceiling_spearman: round3(spearman(capped, actual)),
  };
}

/**
 * The blind test, run on the snapshot before the board is built. Split A is even/odd by slug,
 * so the test half never trained the multiples it is scored on. Split B is walk-forward: the
 * older half of the dated live tokens trains, the newer half is scored, so the test asks
 * whether multiples fitted on yesterday's tokens price tomorrow's. Both splits are
 * deterministic: the same snapshot always gives the same numbers.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): ModelValidation {
  const live = liveComps(snapshot).slice().sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const evenOdd = validateSplit(
    live.filter((_, i) => i % 2 === 0),
    live.filter((_, i) => i % 2 === 1),
    snapshot.as_of,
    'even/odd by slug',
    model,
  );
  const dated = live.filter((p) => p.listed_at !== null).slice().sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const mid = Math.floor(dated.length / 2);
  const walkForward = validateSplit(dated.slice(0, mid), dated.slice(mid), snapshot.as_of, 'walk-forward by listing date', model);
  return { live_comps: live.length, even_odd: evenOdd, walk_forward: walkForward, board_top10_tvl_overlap: 0, board_rank1_tvl_rank: 0 };
}

/** How much of a row's implied value the reader can trust, from the evidence behind it. */
export function confidenceFor(comps: number, growthKnown: boolean, ageKnown: boolean): { confidence: 'high' | 'medium' | 'low'; reason: string } {
  if (comps >= 5 && growthKnown && ageKnown) {
    return { confidence: 'high', reason: `${comps} live comps in the category, 7-day growth and age on record` };
  }
  if (comps >= 2 && (growthKnown || ageKnown)) {
    const missing = !growthKnown ? 'no 7-day growth on record' : !ageKnown ? 'age unknown' : 'thin comps';
    return { confidence: 'medium', reason: `${comps} live comps in the category, ${missing}` };
  }
  const missing: string[] = [];
  if (comps < 2) missing.push(`only ${comps} live comp${comps === 1 ? '' : 's'} in the category`);
  if (!growthKnown) missing.push('no 7-day growth on record');
  if (!ageKnown) missing.push('age unknown');
  return { confidence: 'low', reason: missing.join('; ') || 'thin evidence behind the multiple' };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const table = categoryMultiples(snapshot, model);
  // The watchlist is the floor: every slug on it, then every rankable protocol below it. A
  // chosen protocol stays chosen; the board is the whole rankable universe, not a top-N cut.
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, table, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const totals = farmTotals(s.p, s.age);
    const conf = confidenceFor(s.comps, s.p.change_7d !== null, s.age !== null);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      on_watchlist: watchlist.has(s.p.slug),
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        category_multiple: round4(s.multiple),
        category_comps: s.comps,
        category_live_mcap_usd: s.liveMcap,
        ceiling_usd: s.ceiling,
        capped: s.capped,
        growth_pct: round4(s.growthPct),
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        breadth_multiplier: round4(s.breadthMult),
        age_days: s.age,
      },
      confidence: conf.confidence,
      confidence_reason: conf.reason,
      farm_sunk_usd: totals.sunkUsd,
      farm_capital_usd: totals.capitalUsd,
      farm_days: totals.holdDays,
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  if (step.text.startsWith('Plan total:')) return step.text;
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in whole dollars: the gas a farmer actually pays. */
export function gasUsd(chain: string): number {
  const table: Record<string, number> = {
    Ethereum: 8,
    Solana: 0.05,
    Base: 0.1,
    Arbitrum: 0.4,
    Binance: 0.3,
    Polygon: 0.05,
    Avalanche: 0.3,
    Optimism: 0.1,
    'zkSync Era': 0.2,
    Sui: 0.02,
    Berachain: 0.05,
    Scroll: 0.1,
    Linea: 0.1,
    Mantle: 0.05,
    Blast: 0.05,
    Mode: 0.05,
    Fraxtal: 0.05,
    Sei: 0.02,
    Aptos: 0.01,
    Near: 0.01,
    Tron: 0.5,
    Fantom: 0.05,
    Cronos: 0.05,
    Kava: 0.05,
    Celo: 0.02,
    Starknet: 0.2,
    zkLink: 0.1,
    Taiko: 0.2,
    'Polygon zkEVM': 0.1,
    Moonbeam: 0.05,
    Astar: 0.05,
    Metis: 0.05,
    Zircuit: 0.1,
    'World Chain': 0.05,
    Unichain: 0.05,
    Ink: 0.05,
    Sonic: 0.02,
    'Hyperliquid L1': 0.05,
    Plume: 0.05,
    'Plume Mainnet': 0.05,
    Story: 0.05,
    Monad: 0.02,
    MegaETH: 0.02,
    Soneium: 0.05,
    'X Layer': 0.05,
    Katana: 0.05,
    Morph: 0.05,
    BOB: 0.05,
    Corn: 0.05,
    'Robinhood Chain': 0.05,
    Tempo: 0.05,
    Arc: 0.05,
    Stable: 0.05,
    Plasma: 0.05,
    Manta: 0.05,
    Lisk: 0.05,
    Op_Bnb: 0.05,
    ZetaChain: 0.1,
    Klaytn: 0.05,
    Flow: 0.02,
    Ronin: 0.05,
    Cardano: 0.2,
    Algorand: 0.01,
    Stellar: 0.01,
    Ripple: 0.01,
    'XRPL EVM': 0.05,
    Bitcoin: 2,
    Litecoin: 0.05,
    Doge: 0.05,
    Zcash: 0.05,
    Bittensor: 0.05,
    'Bittensor EVM': 0.05,
    Nibiru: 0.02,
    Filecoin: 0.05,
    ApeChain: 0.05,
    Saga: 0.02,
    Evmos: 0.05,
    ThunderCore: 0.02,
    'Reya Network': 0.05,
    Qubic: 0.01,
    Goat: 0.05,
    Proton: 0.02,
    ZIGChain: 0.05,
    HeLa: 0.05,
    Canton: 0.05,
    Stacks: 0.05,
    'Bifrost Network': 0.05,
    Swellchain: 0.05,
    'Babylon Genesis': 0.05,
    CORE: 0.05,
    BSquared: 0.05,
    Bitlayer: 0.05,
    Hemi: 0.05,
    Citrea: 0.05,
    Mezo: 0.05,
    Pharos: 0.02,
    Etherlink: 0.05,
    Flare: 0.02,
    Aleo: 0.02,
    Telos: 0.02,
    MetalL2: 0.05,
    Peaq: 0.02,
    XION: 0.02,
    RISE: 0.02,
    Hibachi: 0.05,
    Strato: 0.05,
    Noble: 0.01,
    Sophon: 0.05,
    Pulse: 0.05,
    TAC: 0.05,
    Rayls: 0.05,
    Provenance: 0.02,
  };
  return table[chain] ?? 1;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index tokens on ${chain} and hold them.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the shares.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into ${name}'s managed liquidity position on ${chain} and keep it open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('anchor btc') || c.includes('decentralized btc')) return `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`;
  if (c.includes('payment') || c.includes('card')) return `Load $${capital} through ${name} on ${chain} and spend once from it.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote in one governance round.`;
  if (c.includes('otc')) return `Complete one $${capital} trade through ${name} on ${chain}.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use one native app there.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into ${name}'s managed product on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly qualifying action, by category: the verb that counts for this kind of protocol. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a deposit, a borrow or a repayment';
  if (c.includes('index')) return 'a rebalance check or a vote';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'a swap or a liquidity adjustment';
  if (c.includes('bridge')) return 'a bridge transfer';
  if (c.includes('staking') || c.includes('restak')) return 'a stake, a restake or a claim';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return 'a trade or a margin adjustment';
  if (c.includes('prediction')) return 'a market position';
  if (c.includes('governance')) return 'a vote';
  return 'a deposit, a swap or a vote';
}

/**
 * The one risk that can break this category's farm: a single sentence, from the category's
 * own shape, never from a protocol's name. Every category on the board has one.
 */
export function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('anchor btc') || c.includes('decentralized btc')) return 'Risk: the BTC backing can slip below one BTC, and redemptions can queue when everyone exits at once.';
  if (c.includes('basis trading')) return 'Risk: funding can flip against the basis trade, and the hedge can move faster than the position.';
  if (c.includes('cedefi')) return 'Risk: part of the product is custodial, so the operator staying solvent is part of the bet.';
  if (c.includes('bridge')) return 'Risk: a bridge pause or a wrapped-asset depeg can strand funds on the far chain.';
  if (c.includes('cdp') || c.includes('collateral')) return 'Risk: a sharp collateral drop can liquidate the vault, and a governance pause can freeze withdrawals.';
  if (c.includes('card')) return 'Risk: the card program can pause or change terms, so keep only spending money on it.';
  if (c.includes('chain')) return 'Risk: the chain itself is young, so a halt or an outage strands every position built on it.';
  if (c.includes('index')) return 'Risk: the index can rebalance into a falling asset, so the basket is only as good as its worst holding.';
  if (c.includes('dex')) return 'Risk: impermanent loss can eat the yield if the pool ratio moves, and a thin pool can strand the position.';
  if (c.includes('derivative') || c.includes('perpetual')) return 'Risk: a sharp move can liquidate the hedge, and funding can flip and start charging the position.';
  if (c.includes('governance')) return 'Risk: a vote can change the rules the farm depends on, so the position is a bet on the next decision.';
  if (c.includes('insurance')) return 'Risk: a claim can be denied by governance, and cover only pays when the policy trigger fires exactly.';
  if (c.includes('interest rate')) return 'Risk: a rate move can reprice the position against you, and fixed terms can lock a bad rate in.';
  if (c.includes('lend')) return 'Risk: a bad-debt event or a governance pause can freeze withdrawals; never farm with funds you need back soon.';
  if (c.includes('liquidity manager')) return 'Risk: the manager can rebalance into a losing range, and its fees are charged whether it wins or not.';
  if (c.includes('otc')) return 'Risk: the counterparty can fail to settle, and a large trade can move the price against you.';
  if (c.includes('curator') || c.includes('allocator')) return 'Risk: the curator allocations are opaque and can rotate; one bad allocation can cut the vault value.';
  if (c.includes('payment')) return 'Risk: the payment rail can pause or change fees, so keep only spending money in the position.';
  if (c.includes('prediction')) return 'Risk: a market can resolve against the position, and the payout is all or nothing.';
  if (c.includes('rwa')) return 'Risk: the off-chain asset can default, and its issuer can freeze redemptions.';
  if (c.includes('restak') || c.includes('staking')) return 'Risk: slashing or an unstaking queue can delay exit, and the receipt token can trade below its backing.';
  if (c.includes('stable')) return 'Risk: a depeg breaks the peg the plan assumes, and the stable asset is only as good as its backing.';
  if (c.includes('uncollateralized')) return 'Risk: the borrower can default with no collateral behind the loan, so the loss can be total.';
  if (c.includes('leveraged farm') || c.includes('farm') || c.includes('yield')) return 'Risk: the vault strategy can change and its rewards can dry up; check the live APY before each deposit.';
  return 'Risk: the protocol is young and its token may never come; farm only with funds you can afford to leave.';
}

/**
 * A plan's netted totals, from the same numbers the steps use, split the way a farmer's
 * wallet feels them: the sunk cost is gas, gone even if the farm pays nothing; the capital
 * at risk is the deposit, recoverable on exit. Gas covers the setup, the second chain when
 * there is one, and one weekly action for each week of the hold; the active minutes are
 * spread over the hold days.
 */
export function farmTotals(p: SnapshotProtocol, age: number | null): { sunkUsd: number; capitalUsd: number; holdDays: number; activeMin: number } {
  const chain = chainOf(p);
  const gas = gasUsd(chain);
  const capital = capitalFor(p);
  const holdDays = holdDaysFor(age);
  const weeks = Math.ceil(holdDays / 7);
  const multi = p.chains.length >= 3;
  const secondGas = multi ? gasUsd(p.chains[1]!) : 0;
  const sunkUsd = Math.max(1, Math.ceil(gas * 2)) + (multi ? Math.max(1, Math.ceil(secondGas * 2)) : 0) + Math.max(1, Math.ceil(gas)) * weeks;
  const capitalUsd = capital + (multi ? Math.floor(capital / 2) : 0);
  const activeMin = 5 + 15 + (multi ? 20 : 0) + 10 * weeks + 10 + 5;
  return { sunkUsd, capitalUsd, holdDays, activeMin };
}

/** The plan's totals as a step: the netted cost, split into sunk gas and capital at risk, plus the one risk. */
export function farmSummary(p: SnapshotProtocol, age: number | null): FarmStep {
  const totals = farmTotals(p, age);
  return {
    text: `Plan total: about $${totals.sunkUsd} sunk in gas (gone even if the farm pays nothing) plus $${totals.capitalUsd} of capital at risk (recoverable on exit), about ${totals.activeMin} minutes of active work spread over ${totals.holdDays} days. ${riskFor(p)}`,
    cost: `$${totals.sunkUsd} sunk in gas plus $${totals.capitalUsd} of capital at risk`,
    time: `${totals.holdDays} days`,
  };
}

/**
 * A protocol's farm plan, day by day: six steps, seven when it runs on three or more chains,
 * plus a final line netting the plan's cost and naming the category's one risk. Every step is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names. Each step states what it costs and how long it takes, and when it happens.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasUsd(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  const steps: FarmStep[] = [
    {
      text: `Day 1 — Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $${Math.max(1, Math.ceil(gas))} of gas on ${chain} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: `Day 1 — ${action}`,
      cost: `$${capital} of capital and about $${Math.max(1, Math.ceil(gas * 2))} of gas on ${chain} for two transactions`,
      time: '15 minutes to set up',
    },
  ];
  if (p.chains.length >= 3) {
    const second = p.chains[1]!;
    const gas2 = gasUsd(second);
    steps.push({
      text: `Day 2 — Repeat half the position, $${Math.floor(capital / 2)}, on ${second} as well, so the activity shows on a second chain.`,
      cost: `$${Math.floor(capital / 2)} of capital and about $${Math.max(1, Math.ceil(gas2 * 2))} of gas on ${second}`,
      time: '20 minutes',
    });
  }
  steps.push(
    {
      text: `Every week — Make one qualifying action each week, such as ${weekly}.`,
      cost: `about $${Math.max(1, Math.ceil(gas))} of gas on ${chain} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Days 1–${hold} — Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Day ${hold} — Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Ongoing — Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  );
  steps.push(farmSummary(p, age));
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    on_watchlist: row.on_watchlist,
    category_multiple: row.model.category_multiple,
    category_comps: row.model.category_comps,
    category_live_mcap_usd: row.model.category_live_mcap_usd,
    ceiling_usd: row.model.ceiling_usd,
    capped: row.model.capped,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    confidence: row.confidence,
    confidence_reason: row.confidence_reason,
    farm_sunk_usd: row.farm_sunk_usd,
    farm_capital_usd: row.farm_capital_usd,
    farm_days: row.farm_days,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const table = categoryMultiples(snapshot, model);
  const early = board.filter((r) => !r.on_watchlist).length;
  const comps: CategoryMultiple[] = [...table.byCategory.values()]
    .filter((c) => board.some((r) => (r.category ?? 'Other') === c.category))
    .sort((a, b) => b.multiple - a.multiple || a.category.localeCompare(b.category));
  const validation = validateModel(snapshot, model);
  // The board is not a TVL table: how much of the implied top 10 is the TVL top 10, and
  // where does the rank-1 row sit by TVL alone.
  const byTvl = [...board].sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const tvlTop10 = new Set(byTvl.slice(0, 10).map((r) => r.slug));
  validation.board_top10_tvl_overlap = board.slice(0, 10).filter((r) => tvlTop10.has(r.slug)).length;
  validation.board_rank1_tvl_rank = byTvl.findIndex((r) => r.slug === board[0]!.slug) + 1;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: Math.round(table.global * 1e4) / 1e4,
    category_multiples: comps,
    validation,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
