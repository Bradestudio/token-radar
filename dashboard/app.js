// Token Radar's dark dashboard (radar-4). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the
// model's own inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tvl: 'all', age: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // The ceiling is the category's own traded value: no protocol is worth more than half of
  // everything its category's tokens are worth today.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var a = Math.min(Math.max(age, 0), model.maturity_days);
    var maturity;
    if (a <= model.maturity_kink_days) maturity = model.maturity_floor + (model.maturity_kink_value - model.maturity_floor) * (a / model.maturity_kink_days);
    else maturity = model.maturity_kink_value + (1 - model.maturity_kink_value) * ((a - model.maturity_kink_days) / (model.maturity_days - model.maturity_kink_days));
    var breadth = 1 + model.breadth_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_chains);
    var raw = Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * breadth));
    if (row.ceiling_usd !== null && row.ceiling_usd !== undefined && raw > row.ceiling_usd) return row.ceiling_usd;
    return raw;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  var GAS = { 'Ethereum': 8, 'Solana': 0.05, 'Base': 0.1, 'Arbitrum': 0.4, 'Binance': 0.3, 'Polygon': 0.05, 'Avalanche': 0.3, 'Optimism': 0.1, 'zkSync Era': 0.2, 'Sui': 0.02, 'Berachain': 0.05, 'Scroll': 0.1, 'Linea': 0.1, 'Mantle': 0.05, 'Blast': 0.05, 'Mode': 0.05, 'Fraxtal': 0.05, 'Sei': 0.02, 'Aptos': 0.01, 'Near': 0.01, 'Tron': 0.5, 'Fantom': 0.05, 'Cronos': 0.05, 'Kava': 0.05, 'Celo': 0.02, 'Starknet': 0.2, 'zkLink': 0.1, 'Taiko': 0.2, 'Polygon zkEVM': 0.1, 'Moonbeam': 0.05, 'Astar': 0.05, 'Metis': 0.05, 'Zircuit': 0.1, 'World Chain': 0.05, 'Unichain': 0.05, 'Ink': 0.05, 'Sonic': 0.02, 'Hyperliquid L1': 0.05, 'Plume': 0.05, 'Plume Mainnet': 0.05, 'Story': 0.05, 'Monad': 0.02, 'MegaETH': 0.02, 'Soneium': 0.05, 'X Layer': 0.05, 'Katana': 0.05, 'Morph': 0.05, 'BOB': 0.05, 'Corn': 0.05, 'Robinhood Chain': 0.05, 'Tempo': 0.05, 'Arc': 0.05, 'Stable': 0.05, 'Plasma': 0.05, 'Manta': 0.05, 'Lisk': 0.05, 'Op_Bnb': 0.05, 'ZetaChain': 0.1, 'Klaytn': 0.05, 'Flow': 0.02, 'Ronin': 0.05, 'Cardano': 0.2, 'Algorand': 0.01, 'Stellar': 0.01, 'Ripple': 0.01, 'XRPL EVM': 0.05, 'Bitcoin': 2, 'Litecoin': 0.05, 'Doge': 0.05, 'Zcash': 0.05, 'Bittensor': 0.05, 'Bittensor EVM': 0.05, 'Nibiru': 0.02, 'Filecoin': 0.05, 'ApeChain': 0.05, 'Saga': 0.02, 'Evmos': 0.05, 'ThunderCore': 0.02, 'Reya Network': 0.05, 'Qubic': 0.01, 'Goat': 0.05, 'Proton': 0.02, 'ZIGChain': 0.05, 'HeLa': 0.05, 'Canton': 0.05, 'Stacks': 0.05, 'Bifrost Network': 0.05, 'Swellchain': 0.05, 'Babylon Genesis': 0.05, 'CORE': 0.05, 'BSquared': 0.05, 'Bitlayer': 0.05, 'Hemi': 0.05, 'Citrea': 0.05, 'Mezo': 0.05, 'Pharos': 0.02, 'Etherlink': 0.05, 'Flare': 0.02, 'Aleo': 0.02, 'Telos': 0.02, 'MetalL2': 0.05, 'Peaq': 0.02, 'XION': 0.02, 'RISE': 0.02, 'Hibachi': 0.05, 'Strato': 0.05, 'Noble': 0.01, 'Sophon': 0.05, 'Pulse': 0.05, 'TAC': 0.05, 'Rayls': 0.05, 'Provenance': 0.02 };
  function gasUsd(chain) { return GAS[chain] === undefined ? 1 : GAS[chain]; }
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + " of " + name + "'s index tokens on " + chain + ' and hold them.';
    if (c.indexOf('dex') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s main yield vault on " + chain + ' and keep the shares.';
    if (c.indexOf('risk curator') >= 0 || c.indexOf('capital allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s managed liquidity position on " + chain + ' and keep it open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0) return 'Mint $' + capital + ' of the BTC-backed asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Load $' + capital + ' through ' + name + ' on ' + chain + ' and spend once from it.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and vote in one governance round.';
    if (c.indexOf('otc') >= 0) return 'Complete one $' + capital + ' trade through ' + name + ' on ' + chain + '.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + name + "'s chain and use one native app there.";
    if (c.indexOf('cedefi') >= 0) return 'Deposit $' + capital + ' into ' + name + "'s managed product on " + chain + ' and keep the position open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'a deposit, a borrow or a repayment';
    if (c.indexOf('index') >= 0) return 'a rebalance check or a vote';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'a swap or a liquidity adjustment';
    if (c.indexOf('bridge') >= 0) return 'a bridge transfer';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'a stake, a restake or a claim';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return 'a trade or a margin adjustment';
    if (c.indexOf('prediction') >= 0) return 'a market position';
    if (c.indexOf('governance') >= 0) return 'a vote';
    return 'a deposit, a swap or a vote';
  }
  // The one risk that can break this category's farm, in one sentence, from the category's shape.
  function riskFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0) return 'Risk: the BTC backing can slip below one BTC, and redemptions can queue when everyone exits at once.';
    if (c.indexOf('basis trading') >= 0) return 'Risk: funding can flip against the basis trade, and the hedge can move faster than the position.';
    if (c.indexOf('cedefi') >= 0) return 'Risk: part of the product is custodial, so the operator staying solvent is part of the bet.';
    if (c.indexOf('bridge') >= 0) return 'Risk: a bridge pause or a wrapped-asset depeg can strand funds on the far chain.';
    if (c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Risk: a sharp collateral drop can liquidate the vault, and a governance pause can freeze withdrawals.';
    if (c.indexOf('card') >= 0) return 'Risk: the card program can pause or change terms, so keep only spending money on it.';
    if (c.indexOf('chain') >= 0) return 'Risk: the chain itself is young, so a halt or an outage strands every position built on it.';
    if (c.indexOf('index') >= 0) return 'Risk: the index can rebalance into a falling asset, so the basket is only as good as its worst holding.';
    if (c.indexOf('dex') >= 0) return 'Risk: impermanent loss can eat the yield if the pool ratio moves, and a thin pool can strand the position.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return 'Risk: a sharp move can liquidate the hedge, and funding can flip and start charging the position.';
    if (c.indexOf('governance') >= 0) return 'Risk: a vote can change the rules the farm depends on, so the position is a bet on the next decision.';
    if (c.indexOf('insurance') >= 0) return 'Risk: a claim can be denied by governance, and cover only pays when the policy trigger fires exactly.';
    if (c.indexOf('interest rate') >= 0) return 'Risk: a rate move can reprice the position against you, and fixed terms can lock a bad rate in.';
    if (c.indexOf('lend') >= 0) return 'Risk: a bad-debt event or a governance pause can freeze withdrawals; never farm with funds you need back soon.';
    if (c.indexOf('liquidity manager') >= 0) return 'Risk: the manager can rebalance into a losing range, and its fees are charged whether it wins or not.';
    if (c.indexOf('otc') >= 0) return 'Risk: the counterparty can fail to settle, and a large trade can move the price against you.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Risk: the curator allocations are opaque and can rotate; one bad allocation can cut the vault value.';
    if (c.indexOf('payment') >= 0) return 'Risk: the payment rail can pause or change fees, so keep only spending money in the position.';
    if (c.indexOf('prediction') >= 0) return 'Risk: a market can resolve against the position, and the payout is all or nothing.';
    if (c.indexOf('rwa') >= 0) return 'Risk: the off-chain asset can default, and its issuer can freeze redemptions.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 'Risk: slashing or an unstaking queue can delay exit, and the receipt token can trade below its backing.';
    if (c.indexOf('stable') >= 0) return 'Risk: a depeg breaks the peg the plan assumes, and the stable asset is only as good as its backing.';
    if (c.indexOf('uncollateralized') >= 0) return 'Risk: the borrower can default with no collateral behind the loan, so the loss can be total.';
    if (c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('yield') >= 0) return 'Risk: the vault strategy can change and its rewards can dry up; check the live APY before each deposit.';
    return 'Risk: the protocol is young and its token may never come; farm only with funds you can afford to leave.';
  }
  // The plan's totals, summed from the same numbers the steps use and split the way a farmer's
  // wallet feels them: the sunk cost is gas, gone even if the farm pays nothing; the capital at
  // risk is the deposit, recoverable on exit.
  function farmTotals(p) {
    var chain = chainOf(p);
    var gas = gasUsd(chain);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weeks = Math.ceil(hold / 7);
    var multi = p.chains && p.chains.length >= 3;
    var secondGas = multi ? gasUsd(p.chains[1]) : 0;
    var sunk = Math.max(1, Math.ceil(gas * 2)) + (multi ? Math.max(1, Math.ceil(secondGas * 2)) : 0) + Math.max(1, Math.ceil(gas)) * weeks;
    var capitalTotal = capital + (multi ? Math.floor(capital / 2) : 0);
    var activeMin = 5 + 15 + (multi ? 20 : 0) + 10 * weeks + 10 + 5;
    return { sunk: sunk, capital: capitalTotal, hold: hold, activeMin: activeMin };
  }
  function farmSummary(p) {
    var t = farmTotals(p);
    return { text: 'Plan total: about $' + t.sunk + ' sunk in gas (gone even if the farm pays nothing) plus $' + t.capital + ' of capital at risk (recoverable on exit), about ' + t.activeMin + ' minutes of active work spread over ' + t.hold + ' days. ' + riskFor(p), cost: '$' + t.sunk + ' sunk in gas plus $' + t.capital + ' of capital at risk', time: t.hold + ' days' };
  }
  function stepText(step) {
    if (step.text.indexOf('Plan total:') === 0) return step.text;
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var gas = gasUsd(chain);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var steps = [
      { text: 'Day 1 — Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $' + Math.max(1, Math.ceil(gas)) + ' of gas on ' + chain + ' for the first transaction', time: '5 minutes' },
      { text: 'Day 1 — ' + actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + Math.max(1, Math.ceil(gas * 2)) + ' of gas on ' + chain + ' for two transactions', time: '15 minutes to set up' }
    ];
    if (p.chains && p.chains.length >= 3) {
      var second = p.chains[1];
      var gas2 = gasUsd(second);
      steps.push({ text: 'Day 2 — Repeat half the position, $' + Math.floor(capital / 2) + ', on ' + second + ' as well, so the activity shows on a second chain.', cost: '$' + Math.floor(capital / 2) + ' of capital and about $' + Math.max(1, Math.ceil(gas2 * 2)) + ' of gas on ' + second, time: '20 minutes' });
    }
    steps.push(
      { text: 'Every week — Make one qualifying action each week, such as ' + weeklyActionFor(p) + '.', cost: 'about $' + Math.max(1, Math.ceil(gas)) + ' of gas on ' + chain + ' a week', time: '10 minutes a week' },
      { text: 'Days 1–' + hold + ' — Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Day ' + hold + ' — Before you withdraw, open the protocol\'s own points or rewards page and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Ongoing — Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    );
    steps.push(farmSummary(p));
    return steps.map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tvl')) state.tvl = params.get('tvl');
    if (params.get('age')) state.age = params.get('age');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tvl !== 'all') params.set('tvl', state.tvl);
    if (state.age !== 'all') params.set('age', state.age);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.tvl !== 'all' && r.tvl_usd < Number(state.tvl)) return false;
      if (state.age === 'young' && !(r.age_days !== null && r.age_days < 90)) return false;
      if (state.age === 'mid' && !(r.age_days !== null && r.age_days >= 90 && r.age_days <= 365)) return false;
      if (state.age === 'mature' && !(r.age_days !== null && r.age_days > 365)) return false;
      if (state.age === 'unknown' && r.age_days !== null) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'cost') { av = a.farm_sunk_usd; bv = b.farm_sunk_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, every one of them passing the same exclusion rule. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var tvlSelect = el('select', { id: 'tvl', 'aria-label': 'Filter by TVL' },
      el('option', { value: 'all', text: 'Any TVL' }),
      [['50000000', 'TVL $50M+'], ['100000000', 'TVL $100M+'], ['500000000', 'TVL $500M+'], ['1000000000', 'TVL $1B+']].map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === state.tvl ? 'selected' : null }); })
    );
    tvlSelect.addEventListener('change', function () { state.tvl = tvlSelect.value; writeHash(); render(); });
    var ageSelect = el('select', { id: 'age', 'aria-label': 'Filter by age' },
      el('option', { value: 'all', text: 'Any age' }),
      [['young', 'Under 90 days'], ['mid', '90 days to 1 year'], ['mature', 'Over 1 year'], ['unknown', 'Age unknown']].map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === state.age ? 'selected' : null }); })
    );
    ageSelect.addEventListener('change', function () { state.age = ageSelect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvlSelect),
      el('div', { class: 'field' }, el('label', { for: 'age', text: 'Age' }), ageSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tvl = 'all'; state.age = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var badge = r.on_watchlist
        ? el('span', { class: 'badge watch', text: 'Watchlist' })
        : el('span', { class: 'badge early', text: 'Early' });
      var conf = el('span', { class: 'badge conf-' + r.confidence, text: r.confidence === 'high' ? 'High confidence' : r.confidence === 'medium' ? 'Medium confidence' : 'Low confidence', title: r.confidence_reason });
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: '$' + r.farm_sunk_usd + ' sunk' }),
        el('td', null, badge, conf)
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Net cost is the sunk gas a farm plan costs. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('cost', 'Net cost'),
            el('th', { scope: 'col', text: 'List' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var cappedCount = DATA.rows.filter(function (r) { return r.capped; }).length;
    var comps = (DATA.category_multiples || []).slice(0, 12);
    var compRows = comps.map(function (c) {
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { class: 'num', text: c.median === null ? 'n/a' : fmtMult(c.median) }),
        el('td', { class: 'num', text: c.ceiling_usd === null || c.ceiling_usd === undefined ? 'none' : fmtUsd(c.ceiling_usd) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('p', { text: 'Method in one paragraph: the multiple is priced off the tokens that already trade in the same category, the age curve is steepest in the first 90 days because that is when a protocol most often fails, and a single week of growth is capped at +60% because one week cannot tell a spike from durable growth. Then a ceiling: no protocol is worth more than half of everything its category\u2019s tokens are worth today. On this snapshot ' + cappedCount + ' of ' + DATA.board_size + ' rows hit that ceiling; without it, this snapshot\u2019s top row would claim about 17 times its whole category\u2019s traded value. This radar does not predict whether or when a token is issued; it prices what a token would be worth if the protocol\u2019s record stayed as it is.' }),
      el('div', { class: 'formula' },
        'implied = min( round( tvl_usd x categoryMultiple x growth x maturity x breadth ), ' + m.ceiling_share + ' x category traded value ) — growth = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + '; maturity = ' + m.maturity_floor + ' + ' + (m.maturity_kink_value - m.maturity_floor).toFixed(1) + ' x age/' + m.maturity_kink_days + ' under ' + m.maturity_kink_days + ' days, else ' + m.maturity_kink_value + ' + 0.2 x (age - ' + m.maturity_kink_days + ')/' + (m.maturity_days - m.maturity_kink_days) + '; breadth = 1 + ' + m.breadth_step + ' x min(chains - 1, ' + m.breadth_max_chains + ')'
      ),
      el('p', { class: 'sub', text: 'The category multiple is the median market-cap-to-TVL ratio of the live-token protocols in the same category, shrunk toward the global median of ' + fmtMult(DATA.global_multiple) + ' and clamped to ' + m.comp_min + 'x-' + m.comp_max + 'x, so one thin comp cannot run away with the board. The ceiling is the category\u2019s own traded value: the sum of its live tokens\u2019 market caps, halved. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('h3', { text: 'Tested blind on the tokens that already trade' }),
      el('p', { text: 'Before the board is built, the pricing core is fitted on half the live tokens and scored on the other half it never saw. Even/odd by slug (' + DATA.validation.even_odd.test_n + ' held out) gives a rank correlation of ' + DATA.validation.even_odd.spearman + ' and a median miss of ' + DATA.validation.even_odd.median_abs_log_error + ' in log terms, with ' + DATA.validation.even_odd.within_2x + ' of ' + DATA.validation.even_odd.test_n + ' within 2x of the real market cap. Walk-forward — older tokens training the newer ones (' + DATA.validation.walk_forward.test_n + ' held out) — gives ' + DATA.validation.walk_forward.spearman + ' and a median miss of ' + DATA.validation.walk_forward.median_abs_log_error + ', with ' + DATA.validation.walk_forward.within_2x + ' of ' + DATA.validation.walk_forward.test_n + ' within 2x. A flat global multiple scores ' + DATA.validation.even_odd.flat_spearman + ' and ' + DATA.validation.walk_forward.flat_spearman + ' on the same splits, with a typical miss of ' + DATA.validation.even_odd.flat_median_abs_log_error + ' and ' + DATA.validation.walk_forward.flat_median_abs_log_error + ' — so the category fit does not out-rank a flat multiple on the tokens that already trade.' }),
      el('p', { text: 'Read the numbers straight: a median miss near ' + DATA.validation.even_odd.median_abs_log_error + ' in log terms is roughly a ' + Math.round(Math.exp(DATA.validation.even_odd.median_abs_log_error)) + '-fold typical miss, so this model ranks roughly, it does not price to the dollar. The ceiling is not part of the test: applying it to held-out live tokens cuts the even/odd rank correlation from ' + DATA.validation.even_odd.spearman + ' to ' + DATA.validation.even_odd.ceiling_spearman + ', because a live token can be most of its category. The ceiling stays anyway, as a claim discipline for pre-token rows only — without it the board\u2019s top row would claim $622M. What the multiples do is price categories differently on the board itself: its top 10 shares only ' + DATA.validation.board_top10_tvl_overlap + ' of 10 rows with the TVL top 10, and its rank 1 sits at TVL rank ' + DATA.validation.board_rank1_tvl_rank + '.' }),
      el('h3', { text: 'Research note' }),
      el('p', { text: 'What the model assumes: a category\u2019s tokens keep trading near their median multiple, TVL persists, and a longer run with no token means a likelier launch, not a certain one. What would falsify it: a held-out rank correlation near zero, which the test above rules out on one split and barely clears on the other. What it cannot see: whether or when any protocol issues a token, a single week\u2019s growth spike, or gas prices moving — the farm plans use typical gas per chain, not a live quote. Implied value is the entry\u2019s own claim, never a price.' }),
      el('h3', { text: 'Category multiples, highest first' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'comps' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Live comps' }), el('th', { scope: 'col', text: 'Median mcap / TVL' }), el('th', { scope: 'col', text: 'Ceiling' }))),
          el('tbody', null, compRows)
        )
      ),
      el('p', { class: 'sub', text: '"No token" means DefiLlama records none for the protocol: a protocol on the list may still have a token its record does not carry. Implied value is an estimate, not a price.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? '  ·  Watchlist' : '  ·  Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: fmtMult(row.category_multiple) + ' (' + (row.category || 'Other') + ', ' + row.category_comps + ' live comps)' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: String(row.breadth_multiplier) })),
        el('div', null, el('span', { text: 'Category traded value' }), el('b', { class: 'num', text: row.category_live_mcap_usd ? fmtUsd(row.category_live_mcap_usd) : 'none — no live token in this category' })),
        el('div', null, el('span', { text: 'Ceiling (half of traded)' }), el('b', { class: 'num', text: row.ceiling_usd === null || row.ceiling_usd === undefined ? 'none' : fmtUsd(row.ceiling_usd) })),
        el('div', null, el('span', { text: 'Capped by the ceiling' }), el('b', { class: 'num', text: row.capped ? 'yes — the raw value was higher' : 'no' })),
        el('div', null, el('span', { text: 'Confidence' }), el('b', { class: 'num', text: row.confidence + ' — ' + row.confidence_reason })),
        el('div', null, el('span', { text: 'Net cost to farm' }), el('b', { class: 'num', text: '$' + row.farm_sunk_usd + ' sunk in gas + $' + row.farm_capital_usd + ' capital at risk, over ' + row.farm_days + ' days' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (Math.abs(recomputed - row.implied_value_usd) / row.implied_value_usd > 0.005 ? ', which differs from the board: the data would be stale.' : ', the same number board.json carries.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // The top 10 as a radar sweep: one spoke per protocol, length is implied value on a log
  // scale, so the shape shows how far the leaders sit ahead of the rest of the top 10.
  // Pure SVG built in the page, no network and no image: the spokes are the board's own rows.
  function top10Radar() {
    var top = DATA.rows.slice(0, 10);
    if (top.length === 0) return null;
    var cx = 150, cy = 150, R = 120;
    var vals = top.map(function (r) { return Math.log10(Math.max(1, r.implied_value_usd)); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      return n;
    }
    var svg = svgEl('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': 'Top 10 protocols by implied value, log scale' });
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: (R * f).toFixed(1), fill: 'none', stroke: '#223140', 'stroke-width': '1' }));
    });
    var pts = [];
    top.forEach(function (r, i) {
      var ang = (i / top.length) * Math.PI * 2 - Math.PI / 2;
      var frac = hi === lo ? 1 : 0.15 + 0.85 * (vals[i] - lo) / (hi - lo);
      var x = cx + Math.cos(ang) * R * frac, y = cy + Math.sin(ang) * R * frac;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: (cx + Math.cos(ang) * R).toFixed(1), y2: (cy + Math.sin(ang) * R).toFixed(1), stroke: '#223140', 'stroke-width': '1' }));
      svg.appendChild(svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: '4.5', fill: '#2ee6a8' }));
      var num = svgEl('text', { x: (cx + Math.cos(ang) * (R + 15)).toFixed(1), y: (cy + Math.sin(ang) * (R + 15) + 4).toFixed(1), fill: '#e6eef4', 'font-size': '12', 'font-weight': '600', 'text-anchor': 'middle' });
      num.textContent = String(i + 1);
      svg.appendChild(num);
    });
    svg.appendChild(svgEl('polygon', { points: pts.join(' '), fill: 'rgba(46,230,168,0.12)', stroke: '#2ee6a8', 'stroke-width': '1.5' }));
    var legend = el('ol', { class: 'radar-legend' }, top.map(function (r) {
      return el('li', null, el('b', { text: r.rank + '. ' + r.name }), el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }));
    }));
    return el('section', { class: 'panel radar-panel' },
      el('div', { class: 'radar-head' }, el('h2', { text: 'Top 10 at a glance' }), el('p', { class: 'sub', text: 'Spoke length is implied value on a log scale, so the shape shows the gap between the leaders and the rest of the top 10.' })),
      el('div', { class: 'radar-body' }, svg, legend)
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    if (state.tab === 'pre-token') shell.appendChild(top10Radar());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
