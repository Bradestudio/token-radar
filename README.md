# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Bradestudio/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Bradestudio/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 198 pre-token protocols by implied launch value, scored from the DeFiLlama snapshot's own numbers — TVL, 7-day growth and age without a token — against the multiples that live tokens in the same category actually trade at. Radar-4 tests that pricing core blind before the board is built: fitted on half the live tokens and scored on the half it never saw (rank correlation 0.41 even/odd, 0.28 walk-forward, against a flat multiple's 0.45 and 0.34 — the category fit does not out-rank flat on live tokens, and the page says so), so the model ranks roughly rather than pricing to the dollar. It ships a sortable dashboard with a detail view, a confidence badge per row, and a concrete day-by-day farm plan for every protocol, netted into sunk gas versus capital at risk.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qjs4e9sj&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
