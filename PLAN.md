# Token Radar entry — build plan (radar-2)

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

## Still open (not this build's job)
- Andi creates the public GitHub repo (suggested name token-radar) + push access;
  GitHub connector verification FAILED 2x (15 Nov 12:37 & 12:39 WIB) — no
  credentials stored. Then: commit, `makefun init` (drand anchor), bundle
  transcripts with --muse-usage, `check` again with --transcripts, submit.
- Nothing submitted, nothing pushed, no new keypair, no account/profile change.
