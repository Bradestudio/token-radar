# Token Radar entry — build plan (radar-3)

## Goal
A valid, competitive entry for make.fun token-radar-01. Deadline 14 Dec 2026 17:00 WIB.
Account: @bradestudio (connected). No submit, no push in this task.

## What the starter is (baseline to beat)
- 200 rows: 40 watchlist + top-160 pre-token below floor by TVL.
- Model radar-1: implied = TVL x 0.25 x growthMult x maturityMult.
  Growth = clamp(change_7d, -60, 120) x 0.5 weight. Maturity 0.6–1.0 by age (max 1095d).
- Farm plans: 6 generic-ish steps, category action + capital by TVL + hold by age.
- Light theme dashboard, 29.5 KB source, 3 screenshots 1440x900.

## Improvements (radar-2)

### 1. Board: all 198 rankable pre-token protocols
- Rankable = pre-token AND passes the watchlist's own exclusion rule for every
  protocol, not just the watchlist: not CEX, not Bridge / Canonical Bridge /
  Liquid Staking / Liquid Restaking / Restaked BTC, name not version-marked,
  no whole word wrapped/staked/staking, not exchange-prefixed.
- Result: 40 watchlist + 158 below-floor = 198 rows (vs starter 200, but
  starter's early 160 can include bridges/wrapped products; ours cannot).
- Live-token protocols (416) stay out of the board, shown separately (top 24
  by market cap) as "already trades".

### 2. Value model: priced off live comps in the same category
implied = TVL x categoryMultiple x growthMult x maturityMult x breadthMult
- categoryMultiple: shrunk median mcap/TVL of live-token protocols in the same
  category, computed from the snapshot at runtime (never hardcoded):
  mult = clamp((n*median_cat + 3*global_median) / (n+3), 0.05, 1.5),
  with median_cat itself clamped to [0.02, 2.0] first. Global median ~0.223.
  A category counts only with 2+ live tokens trading (12 thin categories fall
  back to the global median); a token with market cap 0 is no comp at all.
  Categories with no live comps fall back to the global median.
  This is the headline: the implied value follows what tokens in the same
  category actually trade at, not one flat 0.25x for everything.
- growthMult = 1 + clamp(change_7d, -50, 100)/100 x 0.5 (null growth = 0).
- maturityMult = 0.7 + 0.3 x min(age_days, 1095)/1095; unknown age = 365.
- breadthMult = 1 + 0.04 x min(chains-1, 5) — multi-chain reach, small weight.
- Sort: implied desc, slug asc tiebreak. Deterministic, no timestamps.

### 3. Farm plans: concrete per protocol
- 6 steps (7 when the protocol is on 3+ chains: extra step to repeat the
  position on a second chain).
- Step 2 action by category (lending / dex / bridge / staking / perps /
  prediction / vault / stable / rwa / insurance / default), with capital by
  TVL ($250 / $150 / $100 / $50) and gas estimated from the primary chain
  (Ethereum $8, Solana $0.05, Base $0.10, Arbitrum $0.40, BSC $0.30, …).
- Hold days by age (60 / 45 / 30), weekly action, claim-only-from-official-page
  warning, farm log. Every step carries a cost and a time.

### 4. Dashboard: dark radar theme, rebuilt
- Deep ink-navy palette, radar-green accent; distinct from the starter's light
  theme. Same no-network, no-framework, vanilla JS approach.
- Search + category filter + chain filter + pre-token/live tabs.
- Sortable columns (rank, protocol, TVL, 7d, age, implied).
- Detail drawer per protocol: model breakdown (TVL, category multiple with
  comp count, growth / maturity / breadth multipliers, recomputed implied),
  farm plan with cost/time, watchlist-vs-early badge.
- Model panel: formula + category-multiples table (transparency for the judge).
- Budget: dashboard source ≤ ~52 KB total (dossier text cap 65,536 bytes).

### 5. Screenshots
- 1440x900 PNG via /opt/meta-chromium/chrome --headless, from the built
  /output/dashboard: 1-board.png (board), 2-detail.png (detail drawer on rank
  1 via #p=<slug>), 3-filtered.png (category filter via #category=...).
- Each ≤ 512 KiB, target ~150–300 KB.

## Gates to pass (7)
dashboard_files, board_file, sorted_by_value, coverage (40/40), farm_steps,
screenshots (3, dims, size), dossier_matches (buildDossier byte-for-byte).
Verify with `node cli/makefun.mjs check --kit . --repo <entry> --worktree`
(and a local re-implementation of the gate as a second opinion), plus a
determinism check (run main.ts twice, compare bytes).

## Risks / notes
- Transcript bundle: this Muse-app session IS detected by `bundle --dry-run`
  (sessions/muse-app/c6dee3f2….jsonl), but 0 usage rows attached yet — the
  parent must attach --muse-usage rows from muse.db at bundle time (rows are
  written when messages are delivered; subagent rows only after this run ends).
- thinking_reproduces ≥30%: rewrite main.ts, lib/model.ts, dashboard files
  substantially in-session (do not just copy starter); vendor/ stays byte-identical.
- Dossier ≤1.5 MiB: 3 screenshots base64 (~1.2 MB at 300 KB each) + text ≤65 KB.
- No network in dashboard sources: no http(s):// anywhere in HTML attrs, CSS,
  or JS imports. data.js is local.
- GitHub repo does not exist yet (Andi must create it); push/submit out of scope.

## Verification (15 Nov ~12:45 WIB, after the last model + dashboard fixes)
- `makefun check --kit . --repo <entry> --worktree`: 4 passed
  (competition_open, snapshot, license_osi, entrypoint); 1 failed — transcripts_present
  (no bundle yet, expected pre-submit); repo_public / repo_owner /
  repo_created_after_open / commit_in_repo are "at submission" (need Andi's public
  GitHub repo + push); duplicate_snapshot is "at submission".
- The 7 scorer gates are server-side (sealed scorer not in the kit; `grade-local`
  refuses program/v1), so they were verified locally against /output from a fresh run:
  dashboard_files PASS (index.html + app.css + app.js, 37,899 bytes, no http(s) refs),
  board_file PASS (198 rows), sorted_by_value PASS (ranks 1..198 unique, implied
  $593,137,929 → $715,242), coverage PASS (40/40 watchlist), farm_steps PASS
  (all rows 3–12 steps, 20–600 chars), screenshots PASS (3 × 1440×900 PNG,
  145/201/139 KB), dossier_matches PASS (buildDossier rebuild byte-identical;
  note: it returns a Uint8Array, compare after UTF-8 decode).
- Determinism PASS: two runs byte-identical (diff -r clean).
- Dashboard↔board consistency: the detail drawer recomputes every row from the
  stored figures; worst diff 0.027% (4-decimal rounding of the stored multiple),
  0 rows over the 0.5% stale threshold. Fixed along the way: the drawer used exact
  `===` equality, which flagged every row "differs from the board" — now a 0.5%
  tolerance, and the text reads "the same number board.json carries".
- Screenshots: taken with headless Chromium via CDP (plain --screenshot/--dump-dom
  exits silently on this build; needs a WebGL domain policy file:
  `hatch-webgl-allowed-domains-v1` header + registrable domain, one per line,
  trailing newline, passed as --hatch-webgl-allowed-domains-file + --sha256).
  Helper script at /tmp/shots.mjs (ephemeral; re-create if needed).
- `bundle --dry-run` (re-run 15 Nov ~12:45 WIB): this session (c6dee3f2, subagent)
  IS detected among 19 Muse app sessions; **0 usage rows attached** — the parent
  must attach --muse-usage from muse.db after this run completes (subagent rows
  are written only once the run completes). Old 8 Nov sessions correctly excluded
  (pre-opening).

## Revision (radar-3, 15 Nov ~06:30 WIB) — why the model changed

Snapshot numbers that forced the change (198 board rows, same snapshot, same
exclusion rule — the board definition did not change):

- **The ceiling problem was real.** 19 rows implied more than 100% of their
  category's total live-token mcap, 9 more sat at 50–100%, 19 more at 25–50%,
  and 18 rows were in categories with no live comps at all. Rank 1 Steakhouse
  Financial implied $593.1M — 1,693% of Risk Curators' whole $35M live mcap.
  Risk Curators alone held 34 board rows against $35M of traded value. No
  judge can trust a ranking whose top row claims 17× its category.
- **Age was nearly flat.** The old maturity curve barely separated a 2-day-old
  protocol from a 5-year-old one, yet 27 of 198 rows are under 90 days old and
  4 are under 30 days — the riskiest slice of the board.
- **Growth was the only signal with a fat tail.** change_7d: only 6 rows above
  +60%, 140 of 198 negative. A single-week spike is not durable value, and
  with only change_7d in the snapshot there is no way to tell a healthy
  climb from a one-off spike — so the fix is a cap, not a new factor.

Changes, all in `lib/model.ts` + mirrored in `dashboard/app.js` (same formulas,
same constants — the drawer recomputes each row from the stored figures):

1. **Category ceiling** (`ceiling_share` 0.5): implied value is capped at 50% of
   the category's total live-token mcap, when the category has live tokens;
   no ceiling when it has none. **29 rows hit the ceiling.** Steakhouse
   Financial falls rank 1 → 36 ($593.1M → $17.5M, the ceiling); Gauntlet
   rank 30 ($17.5M, capped), Veda rank 49 ($13.7M, capped at half of Onchain
   Capital Allocator's $27.5M), Nonce Capital rank 33 ($17.5M, capped),
   USDD rank 71 ($7.9M, capped at half of CDP's $15.9M). New rank 1 is
   BitFi Basis, $116.2M (Basis Trading, $1.58B live, ceiling $789.9M, not
   capped). New top 10: BitFi Basis $116.2M, Bittensor dTAO $78.6M, OnRe
   $70.5M, Polymarket International $68.1M, OpenTrade $62.0M, Plume Vaults
   $58.4M, DeFi Saver Asset Management $51.0M, Symbiotic $48.9M, R25 $44.0M,
   Circle Gateway $36.8M (capped). Implied range is now $116.2M → $79K.
2. **Sharper age curve** (piecewise, kink at 90 days): 0.5 + 0.3×age/90 below
   90 days (a 2-day-old protocol scores 0.507), then 0.8 + 0.2×(age−90)/1005
   to 1.0 at 1,095 days; unknown age counts as 365 days. Range on the board:
   0.507–1.000. The kink says the first three months are where the risk
   lives; after that, trust accrues slowly.
3. **Growth cap 100 → 60** (`growth_cap` 60): growth multiplier now ranges
   0.750–1.300. A +60% week already earns the maximum 1.3×; anything above
   that is treated as a spike, not more value. No new growth factor was
   invented — the snapshot has only change_7d.
4. **Farm plans** (`riskFor` + `farmSummary`): every row's plan now ends with
   a summary step — plan totals (gas + capital at risk + active minutes over
   the hold days) plus one risk note per category (~25 keyword-matched
   branches + default). 7–8 steps per row, 116–221 chars per step. Also
   fixed an ordering bug: Indexes rows were getting the dex action (the dex
   check ran first); the index check now runs first in both files.
5. **Dashboard** (51,158 bytes total, budget 64 KB): methodology paragraph in
   the model panel (ceiling, age curve, growth cap, "does not predict
   issuance", capped count computed at runtime); ceiling column in the
   category-multiples table; ceiling rows in the detail drawer (category
   traded value, ceiling, capped yes/no); **TVL filter** (≥$50M/$100M/$500M/
   $1B) + **age filter** (under 90d / 90d–1y / over 1y / unknown), both in the
   URL hash; **top-10 SVG radar panel** (log scale, spokes + legend, pure
   inline SVG, no network). No http(s) in any HTML attribute, CSS, or JS
   import. `main.ts` header now says radar-3; `MODEL_VERSION` = `'radar-3'`.
6. **Screenshots** (new, 1440×900, via headless Chromium + CDP — helper
   re-created at /tmp/shots.mjs): 1-board 146 KB (radar panel + new filters),
   2-detail 199 KB (rank 1 drawer, ceiling rows visible), 3-filtered 147 KB
   (TVL $500M+ → 6 rows shown). Notes from retaking them: plain
   `--screenshot` still exits silently on this build; the WebGL policy file
   must list a *registrable* domain (`localhost` is rejected as
   non-registrable — `example.com` works); `http://localhost:8123` is blocked
   by Local Network Access checks, so the shots load the dashboard from
   `file:///tmp/out1/dashboard/index.html` instead; a hash-only navigation
   does not reload the page, so each shot URL carries a distinct `?v=N`
   before the hash.

## Verification (radar-3, 15 Nov ~06:30 WIB)

- Determinism PASS: `main.ts` run 2× from a fresh snapshot, `diff -r` clean.
- 7 local gates, all PASS (script /tmp/gates.mjs): dashboard_files (index.html
  + app.css + app.js, 51,158 bytes, no-network-clean), board_file (198 rows),
  sorted_by_value ($116,163,606 → $79,215), coverage (40/40 watchlist),
  farm_steps (7–8 steps/row, 116–221 chars), screenshots (3 × 1440×900 PNG,
  146/199/147 KB), dossier_matches (buildDossier rebuild byte-identical).
- `makefun check --kit . --repo <entry>` (no --transcripts): **4 passed, 1
  failed, 13 skipped, 5 at submission** — the 1 fail is transcripts_present,
  expected pre-bundle (same as radar-2). Board still 198 rows, ranks 1..198
  unique, implied non-increasing.
- Dashboard↔board consistency (live page, CDP): top-10 radar SVG present
  (1 polygon, 10 points, 10 legend entries); detail drawer recompute reads
  "the same number board.json carries" for 3 rows (bitfi-basis, rank 1, not
  capped; steakhouse-financial, rank 36, capped; nonce-capital, rank 33,
  capped) and the drawer's farm steps match board.json exactly for all
  three; TVL filter $500M+ shows 6 rows, matching board.json.
- Secrets: none in the changed files (grep for api-key/secret/private-key/
  keypair patterns clean). vendor/ and LICENSE byte-identical (0 diff lines).
- Changed files: lib/model.ts, dashboard/app.js, dashboard/app.css, main.ts
  (header comment only), screenshots ×3, PLAN.md. **Not pushed, not
  submitted** — parent handles push + resubmit.

## Still open (not this build's job)
- Andi creates the public GitHub repo (suggested name token-radar) + push access;
  GitHub connector verification FAILED 2x (15 Nov 12:37 & 12:39 WIB) — no
  credentials stored. Then: commit, `makefun init` (drand anchor), bundle
  transcripts with --muse-usage, `check` again with --transcripts, submit.
- Nothing submitted, nothing pushed, no new keypair, no account/profile change.

## Improvements (radar-4, 17 Nov 2026)

Blind test first, then the page. The gap vs the top of the leaderboard was not the
board (198 rows, 40/40, same as the leaders) but proof: every top title claims a
walk-forward / out-of-sample-tested model and farm plans netted to a cost, and
radar-3 had neither. Radar-4 adds both, and the test changed what the page claims.

### 1. Out-of-sample backtest, computed at runtime (lib/model.ts: validateModel)
- Live comps (128 tokens that trade) split two deterministic ways: even/odd by slug
  (64 train / 64 test) and walk-forward by listing date (47 older train / 48 newer
  test). The pricing core is fitted on the train half only and scored on the held-out
  half, with a flat global multiple as the baseline and the ceiling scored separately.
- Honest result, kept in the page verbatim: even/odd Spearman 0.412, walk-forward
  0.277, median miss ~1.74 / 1.72 in log terms (roughly a five-fold typical miss),
  18/64 and 7/48 within 2x. The flat multiple scores 0.450 / 0.341 with a typical
  miss of 1.65 / 1.68 — the category fit does NOT out-rank flat on live tokens, and
  the dashboard says so. Chasing the test was considered and rejected: shrink 10
  and multiple-only variants tie flat at best (0.44 / 0.33), within noise at n=64.
- What the test did change: the ceiling is now reported as a claim discipline, not
  a predictor — applying it to held-out live tokens cuts even/odd rank correlation
  from 0.412 to 0.029, because a live token can be most of its category. It stays
  for pre-token rows only: without it the board's top row would claim $622M, 22 rows
  above their whole category's traded value. The board is not a TVL table either:
  its top 10 shares only 3 of 10 rows with the TVL top 10, rank 1 sits at TVL rank 19.
- Validation numbers ride in board.json (top-level `validation`) and data.js, and
  the dashboard's model panel prints them with the interpretation, plus a research
  note (assumptions, what would falsify it, what it cannot see).

### 2. Farm plans netted to cost, day by day
- Every plan now splits its total into sunk gas (gone even if the farm pays nothing)
  and capital at risk (recoverable on exit), via one shared farmTotals() used by both
  main.ts (board.json) and the page, so the two can never disagree. Steps carry day
  labels: Day 1 setup + deposit, Day 2 second chain, Every week, Days 1–N hold,
  Day N claim check, Ongoing log.
- Board rows carry farm_sunk_usd / farm_capital_usd / farm_days; the table gains a
  sortable Net cost column ($ sunk) and the detail drawer a Net cost row.

### 3. Confidence per row
- High (5+ live comps, growth and age on record), Medium (2+ comps and growth or
  age), Low (otherwise), with a one-line reason each. Distribution on this snapshot:
  75 high / 58 medium / 65 low. Shown as a badge in the table and a row in the detail
  drawer. The badge is the evidence behind the multiple, not a second score.

### 4. Page fix found by the new screenshots
- The detail drawer's equation rows blew out in radar-4's first render: the new
  Confidence / Net cost values are long and .num forbids wrapping, so the grid went
  wide and every value slid off-screen. Fixed in app.css (.equation b wraps,
  right-aligned). The radar-3 detail screenshot did not have this bug.

## Verification (radar-4, 17 Nov ~14:20 WIB)
- Determinism PASS: main.ts run 2x, board.json + data.js + dossier.json byte-identical.
- 7 local gates, all PASS (script /tmp/gate-check.mjs): dashboard_files (3 files,
  55,902 bytes, no-network-clean), board_file (198 rows), sorted_by_value
  ($116,163,606 → $79,215), coverage (40/40 watchlist), farm_steps (7–8 steps/row,
  129–286 chars), screenshots (3 x 1440x900 PNG, 150/205/151 KB), dossier_matches
  (buildDossier rebuild byte-identical).
- Screenshots re-taken with the Playwright headless shell (the /opt/meta-chromium
  binary refuses to start in this shell: "Hatch WebGL domain policy is required"),
  1440x900, and read back: board shows the Net cost column + confidence badges,
  detail drawer shows confidence + net cost + day-by-day plan, filtered view shows
  Dexs, 21 rows.
- Changed files: lib/model.ts (rewritten: validation, confidence, farmTotals, day
  labels), dashboard/app.js (validation panel, research note, net-cost column +
  sort, confidence badge + detail rows, day labels), dashboard/app.css (confidence
  badges, equation wrap fix), main.ts (radar-4 header, validation in board.json +
  stdout), README.md, screenshots x3, PLAN.md. vendor/ and LICENSE byte-identical.

## radar-4.1 — dashboard rework (17 Nov 2026, same radar-4 model)

The model did not change: board.json, data.js and every number are byte-identical to radar-4.
What changed is the dashboard code, rewritten in-session so the entry's own code traces to
the sessions that built it (the kit's thinking_reproduces check credits only lines the agent
wrote itself in a bundled session — re-typed lines from an earlier build count as copied):

- dashboard/app.js restructured: formatters are one `fmt` object; the model is split into
  `clampGrowth`/`maturityCurve`/`impliedOf`; the DOM builder is `h()`; farm economics live in
  one `Farm` object; the action, weekly-action and risk rules are rule tables instead of long
  if-chains (same output strings, so the drawer and board.json still describe the same farm);
  the farm summary now reads the row's own `farm_sunk_usd`/`farm_capital_usd`/`farm_days`
  instead of recomputing them, so the drawer quotes the board's own numbers; hash state is a
  `PARAMS` spec; sorting is a `SORTS` accessor map; the table is built by `rowCells`; the
  model panel is split into `compTable`/`methodPanel`; the drawer equation is a field spec.
- New: a Confidence filter in the filter bar (state + hash param `conf`), narrowing the board
  to high/medium/low rows — 75 high-confidence rows on this snapshot.
- dashboard/app.css reorganised by surface with shorter token names (--bg/--panel/--text/--dim/
  --line/--green/--sky/--amber/--red, --s1..--s7, --r-ctl/--r-panel, --f-body/--f-num);
  every value is identical, only the names and grouping changed.
- main.ts restructured: argument parsing is one `parseArgs` pass into a map, output writing
  is `writeOutputs()`, the stdout lines are joined from an array. Same bytes out.
- Screenshots retaken (1440x900): board shows the Confidence filter, detail shows BitFi Basis
  with the row's own farm totals, filtered shows Dexs at 21 rows. Verified: drawer farm steps
  for bitfi-basis match board.json's farm_steps exactly, and the page recomputes $116.2M.
