// Token Radar's dark dashboard (radar-4). It reads window.RADAR — written beside
// dashboard/ by main.ts — and paints the ranked board, a filterable table, a
// per-protocol detail drawer with the model's own inputs and the protocol's farm
// plan. No network: every byte it shows is already inside data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tvl: 'all', age: 'all', conf: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  // One formatting surface for the whole page, so a number is spelled the same
  // way in the table, the drawer and the model panel.
  var fmt = {
    usd: function (n) {
      if (n === null || n === undefined || !isFinite(n)) return 'n/a';
      var a = Math.abs(n);
      if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
      if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
      return '$' + Math.round(n);
    },
    pct: function (n) {
      return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    },
    age: function (days) {
      if (days === null || days === undefined) return 'unknown';
      return days >= 365 ? (days / 365).toFixed(1) + 'y' : Math.max(0, Math.round(days)) + 'd';
    },
    mult: function (n) {
      return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : n.toFixed(2) + 'x';
    }
  };

  // The model in one place: the page recomputes a row from the snapshot figures
  // and checks the number board.json carries, so the page's code and the board's
  // data are visibly the same arithmetic. The ceiling is the category's own
  // traded value: no protocol is worth more than half of everything its
  // category's tokens are worth today.
  function clampGrowth(row, model) {
    var raw = (row.change_7d === null || row.change_7d === undefined) ? 0 : row.change_7d;
    return Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
  }
  function maturityCurve(ageDays, model) {
    var a = Math.min(Math.max(ageDays, 0), model.maturity_days);
    if (a <= model.maturity_kink_days) return model.maturity_floor + (model.maturity_kink_value - model.maturity_floor) * (a / model.maturity_kink_days);
    return model.maturity_kink_value + (1 - model.maturity_kink_value) * ((a - model.maturity_kink_days) / (model.maturity_days - model.maturity_kink_days));
  }
  function impliedOf(row, model) {
    var growthMult = 1 + (clampGrowth(row, model) / 100) * model.growth_weight;
    var age = (row.age_days === null || row.age_days === undefined) ? model.unknown_age_days : row.age_days;
    var breadth = 1 + model.breadth_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_chains);
    var raw = Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturityCurve(age, model) * breadth));
    if (row.ceiling_usd !== null && row.ceiling_usd !== undefined && raw > row.ceiling_usd) return row.ceiling_usd;
    return raw;
  }

  // Small DOM builder: h('td', {class: 'num'}, text) reads like the markup it makes.
  // attrs.text sets text, attrs.html sets markup, on* keys wire listeners, and the
  // rest become attributes; children may be nodes, strings or arrays of either.
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
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
  // Farm economics live in one object: typical gas per chain, the deposit size
  // by TVL band, and the hold length by age. The page mirrors the derivation
  // main.ts writes to board.json, so the drawer and the board cannot disagree
  // about what a farm costs or how long it runs.
  var Farm = {
    gasUsd: function (chain) { return GAS[chain] === undefined ? 1 : GAS[chain]; },
    mainChain: function (p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; },
    deposit: function (p) {
      if (p.tvl_usd >= 5e9) return 250;
      if (p.tvl_usd >= 1e9) return 150;
      if (p.tvl_usd >= 1e8) return 100;
      return 50;
    },
    holdDays: function (age) {
      if (age === null || age === undefined) return 30;
      if (age < 180) return 60;
      if (age < 365) return 45;
      return 30;
    }
  };
  // One action per category shape, as a rule table instead of a chain of ifs:
  // the first rule whose keyword matches the category wins, in table order.
  // The wording is the same as the steps board.json carries, so the drawer
  // and the board describe the same farm.
  var ACTION_RULES = [
    { keys: ['lend', 'cdp', 'collateral'], make: function (p, capital, chain) { return `Supply $${capital} of USDC to ${p.name} on ${chain} and keep the position open.`; } },
    { keys: ['index'], make: function (p, capital, chain) { return `Buy $${capital} of ${p.name}'s index tokens on ${chain} and hold them.`; } },
    { keys: ['dex'], make: function (p, capital, chain) { return `Provide $${capital} of liquidity to ${p.name}'s main pool on ${chain} and keep the position open.`; } },
    { keys: ['yield aggregator', 'yield', 'leveraged farm', 'farm'], make: function (p, capital, chain) { return `Deposit $${capital} of USDC into ${p.name}'s main yield vault on ${chain} and keep the shares.`; } },
    { keys: ['risk curator', 'capital allocator', 'curator', 'allocator'], make: function (p, capital, chain) { return `Deposit $${capital} into a ${p.name} vault on ${chain} and keep the shares.`; } },
    { keys: ['liquidity manager'], make: function (p, capital, chain) { return `Deposit $${capital} into ${p.name}'s managed liquidity position on ${chain} and keep it open.`; } },
    { keys: ['bridge'], make: function (p, capital, chain) { return `Bridge $${capital} of USDC to ${chain} through ${p.name} and use the bridged funds in its app.`; } },
    { keys: ['staking', 'restak'], make: function (p, capital, chain) { return `Stake $${capital} of the chain's staking asset through ${p.name} and keep the receipt.`; } },
    { keys: ['perpetual', 'derivative', 'basis trading'], make: function (p, capital, chain) { return `Deposit $${capital} of USDC as margin on ${p.name} and open one small hedge.`; } },
    { keys: ['prediction'], make: function (p, capital) { return `Fund $${capital} and place one market position on ${p.name}.`; } },
    { keys: ['stable'], make: function (p, capital, chain) { return `Mint or deposit $${capital} of the stable asset through ${p.name} on ${chain}.`; } },
    { keys: ['rwa'], make: function (p, capital, chain) { return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`; } },
    { keys: ['insurance'], make: function (p, capital, chain) { return `Buy $${capital} of cover from ${p.name} on ${chain} and keep the policy.`; } },
    { keys: ['anchor btc', 'decentralized btc'], make: function (p, capital, chain) { return `Mint $${capital} of the BTC-backed asset through ${p.name} on ${chain} and hold it.`; } },
    { keys: ['payment', 'card'], make: function (p, capital, chain) { return `Load $${capital} through ${p.name} on ${chain} and spend once from it.`; } },
    { keys: ['governance'], make: function (p, capital, chain) { return `Deposit $${capital} into ${p.name} on ${chain} and vote in one governance round.`; } },
    { keys: ['otc'], make: function (p, capital, chain) { return `Complete one $${capital} trade through ${p.name} on ${chain}.`; } },
    { keys: ['chain'], make: function (p, capital) { return `Bridge $${capital} of USDC to ${p.name}'s chain and use one native app there.`; } },
    { keys: ['cedefi'], make: function (p, capital, chain) { return `Deposit $${capital} into ${p.name}'s managed product on ${chain} and keep the position open.`; } }
  ];
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < ACTION_RULES.length; i++) {
      var rule = ACTION_RULES[i];
      for (var j = 0; j < rule.keys.length; j++) {
        if (c.indexOf(rule.keys[j]) >= 0) return rule.make(p, capital, chain);
      }
    }
    return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
  }
  // The weekly qualifying action, by the same rule-table shape.
  var WEEKLY_RULES = [
    { keys: ['lend', 'cdp', 'collateral'], text: 'a deposit, a borrow or a repayment' },
    { keys: ['index'], text: 'a rebalance check or a vote' },
    { keys: ['dex', 'liquidity manager'], text: 'a swap or a liquidity adjustment' },
    { keys: ['bridge'], text: 'a bridge transfer' },
    { keys: ['staking', 'restak'], text: 'a stake, a restake or a claim' },
    { keys: ['perpetual', 'derivative', 'basis trading'], text: 'a trade or a margin adjustment' },
    { keys: ['prediction'], text: 'a market position' },
    { keys: ['governance'], text: 'a vote' }
  ];
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < WEEKLY_RULES.length; i++) {
      var rule = WEEKLY_RULES[i];
      for (var j = 0; j < rule.keys.length; j++) {
        if (c.indexOf(rule.keys[j]) >= 0) return rule.text;
      }
    }
    return 'a deposit, a swap or a vote';
  }
  // The one risk that can break this category's farm, in one sentence, from
  // the category's shape — same rule-table shape as the action, same order.
  var RISK_RULES = [
    { keys: ['anchor btc', 'decentralized btc'], text: 'Risk: the BTC backing can slip below one BTC, and redemptions can queue when everyone exits at once.' },
    { keys: ['basis trading'], text: 'Risk: funding can flip against the basis trade, and the hedge can move faster than the position.' },
    { keys: ['cedefi'], text: 'Risk: part of the product is custodial, so the operator staying solvent is part of the bet.' },
    { keys: ['bridge'], text: 'Risk: a bridge pause or a wrapped-asset depeg can strand funds on the far chain.' },
    { keys: ['cdp', 'collateral'], text: 'Risk: a sharp collateral drop can liquidate the vault, and a governance pause can freeze withdrawals.' },
    { keys: ['card'], text: 'Risk: the card program can pause or change terms, so keep only spending money on it.' },
    { keys: ['chain'], text: 'Risk: the chain itself is young, so a halt or an outage strands every position built on it.' },
    { keys: ['index'], text: 'Risk: the index can rebalance into a falling asset, so the basket is only as good as its worst holding.' },
    { keys: ['dex'], text: 'Risk: impermanent loss can eat the yield if the pool ratio moves, and a thin pool can strand the position.' },
    { keys: ['derivative', 'perpetual'], text: 'Risk: a sharp move can liquidate the hedge, and funding can flip and start charging the position.' },
    { keys: ['governance'], text: 'Risk: a vote can change the rules the farm depends on, so the position is a bet on the next decision.' },
    { keys: ['insurance'], text: 'Risk: a claim can be denied by governance, and cover only pays when the policy trigger fires exactly.' },
    { keys: ['interest rate'], text: 'Risk: a rate move can reprice the position against you, and fixed terms can lock a bad rate in.' },
    { keys: ['lend'], text: 'Risk: a bad-debt event or a governance pause can freeze withdrawals; never farm with funds you need back soon.' },
    { keys: ['liquidity manager'], text: 'Risk: the manager can rebalance into a losing range, and its fees are charged whether it wins or not.' },
    { keys: ['otc'], text: 'Risk: the counterparty can fail to settle, and a large trade can move the price against you.' },
    { keys: ['curator', 'allocator'], text: 'Risk: the curator allocations are opaque and can rotate; one bad allocation can cut the vault value.' },
    { keys: ['payment'], text: 'Risk: the payment rail can pause or change fees, so keep only spending money in the position.' },
    { keys: ['prediction'], text: 'Risk: a market can resolve against the position, and the payout is all or nothing.' },
    { keys: ['rwa'], text: 'Risk: the off-chain asset can default, and its issuer can freeze redemptions.' },
    { keys: ['restak', 'staking'], text: 'Risk: slashing or an unstaking queue can delay exit, and the receipt token can trade below its backing.' },
    { keys: ['stable'], text: 'Risk: a depeg breaks the peg the plan assumes, and the stable asset is only as good as its backing.' },
    { keys: ['uncollateralized'], text: 'Risk: the borrower can default with no collateral behind the loan, so the loss can be total.' },
    { keys: ['leveraged farm', 'farm', 'yield'], text: 'Risk: the vault strategy can change and its rewards can dry up; check the live APY before each deposit.' }
  ];
  function riskFor(p) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < RISK_RULES.length; i++) {
      var rule = RISK_RULES[i];
      for (var j = 0; j < rule.keys.length; j++) {
        if (c.indexOf(rule.keys[j]) >= 0) return rule.text;
      }
    }
    return 'Risk: the protocol is young and its token may never come; farm only with funds you can afford to leave.';
  }
  // The plan's totals, read straight off the row: board.json already carries
  // the sunk gas, the capital at risk and the hold length main.ts computed,
  // so the drawer quotes the board's own numbers instead of a second copy of
  // the arithmetic. Sunk gas is gone even if the farm pays nothing; the
  // deposit is recoverable on exit.
  function farmSummary(p) {
    var sunk = p.farm_sunk_usd, capital = p.farm_capital_usd, hold = p.farm_days;
    var weeks = Math.ceil(hold / 7);
    var activeMin = 5 + 15 + ((p.chains && p.chains.length >= 3) ? 20 : 0) + 10 * weeks + 10 + 5;
    return {
      text: 'Plan total: about $' + sunk + ' sunk in gas (gone even if the farm pays nothing) plus $' + capital + ' of capital at risk (recoverable on exit), about ' + activeMin + ' minutes of active work spread over ' + hold + ' days. ' + riskFor(p),
      cost: '$' + sunk + ' sunk in gas plus $' + capital + ' of capital at risk',
      time: hold + ' days'
    };
  }
  // A step carries its action, its cost and its time as fields; the text the
  // drawer shows is action + cost + time, clipped to the gate's 600 chars.
  function stepText(step) {
    if (step.text.indexOf('Plan total:') === 0) return step.text;
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = Farm.mainChain(p);
    var gas = Farm.gasUsd(chain);
    var capital = Farm.deposit(p);
    var hold = Farm.holdDays(p.age_days);
    var setupGas = Math.max(1, Math.ceil(gas * 2));
    var weeklyGas = Math.max(1, Math.ceil(gas));
    var steps = [
      { text: 'Day 1 — Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: `under $${weeklyGas} of gas on ${chain} for the first transaction`, time: '5 minutes' },
      { text: `Day 1 — ${actionFor(p, capital, chain)}`, cost: `$${capital} of capital and about $${setupGas} of gas on ${chain} for two transactions`, time: '15 minutes to set up' }
    ];
    if (p.chains && p.chains.length >= 3) {
      var second = p.chains[1];
      var gas2 = Farm.gasUsd(second);
      steps.push({ text: `Day 2 — Repeat half the position, $${Math.floor(capital / 2)}, on ${second} as well, so the activity shows on a second chain.`, cost: `$${Math.floor(capital / 2)} of capital and about $${Math.max(1, Math.ceil(gas2 * 2))} of gas on ${second}`, time: '20 minutes' });
    }
    steps.push(
      { text: `Every week — Make one qualifying action each week, such as ${weeklyActionFor(p)}.`, cost: `about $${weeklyGas} of gas on ${chain} a week`, time: '10 minutes a week' },
      { text: `Days 1–${hold} — Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: hold + ' days' },
      { text: `Day ${hold} — Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Ongoing — Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    );
    steps.push(farmSummary(p));
    return steps.map(stepText);
  }

  // The shareable state, as a spec: each field knows its hash key and its
  // default, so reading and writing the hash is one loop each way.
  var PARAMS = [
    { key: 'q', field: 'q', def: '' },
    { key: 'p', field: 'selected', def: null },
    { key: 'category', field: 'category', def: 'all' },
    { key: 'chain', field: 'chain', def: 'all' },
    { key: 'tvl', field: 'tvl', def: 'all' },
    { key: 'age', field: 'age', def: 'all' },
    { key: 'conf', field: 'conf', def: 'all' }
  ];
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    PARAMS.forEach(function (spec) {
      var v = params.get(spec.key);
      if (v !== null) state[spec.field] = v;
    });
  }
  function writeHash() {
    var params = new URLSearchParams();
    PARAMS.forEach(function (spec) {
      var v = state[spec.field];
      if (v && v !== spec.def) params.set(spec.key, v);
    });
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.tvl !== 'all' && r.tvl_usd < Number(state.tvl)) return false;
      if (state.conf !== 'all' && r.confidence !== state.conf) return false;
      if (state.age === 'young' && !(r.age_days !== null && r.age_days < 90)) return false;
      if (state.age === 'mid' && !(r.age_days !== null && r.age_days >= 90 && r.age_days <= 365)) return false;
      if (state.age === 'mature' && !(r.age_days !== null && r.age_days > 365)) return false;
      if (state.age === 'unknown' && r.age_days !== null) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  // One accessor per sort key, so adding a column is one line here and one
  // header below. Nulls sort to the back in either direction.
  var SORTS = {
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    growth: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    age: function (r) { return r.age_days === null ? Infinity : r.age_days; },
    cost: function (r) { return r.farm_sunk_usd; },
    implied: function (r) { return r.implied_value_usd; }
  };
  function sortedRows(list) {
    var get = SORTS[state.sort] || SORTS.implied;
    return list.slice().sort(function (a, b) {
      var av = get(a), bv = get(b);
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function topBar() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })),
      h('div', { class: 'top-meta' },
        h('span', { text: 'Snapshot ' + DATA.as_of }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function intro() {
    return h('section', { class: 'lede' },
      h('div', null,
        h('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        h('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, every one of them passing the same exclusion rule. Implied value is a model, not a promise.' })
      ),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('span', { text: 'Watchlist covered' }), h('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        h('div', { class: 'fact' }, h('span', { text: 'Pre-token rows scored' }), h('b', { text: String(DATA.board_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Early rows below the floor' }), h('b', { text: String(DATA.early_size) })),
        h('div', { class: 'fact' }, h('span', { text: 'Live-token protocols set aside' }), h('b', { text: String(DATA.live_size) }))
      )
    );
  }

  // One select per filter, built from the same small helper, so the bar stays
  // uniform and a new filter is a few lines. The confidence filter is new:
  // it narrows the board to the rows the model itself trusts most.
  function filterSelect(id, label, options, current, onPick) {
    var select = h('select', { id: id, 'aria-label': label },
      h('option', { value: 'all', text: options[0][1] }),
      options.slice(1).map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === current ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { onPick(select.value); writeHash(); render(); });
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), select);
  }
  function filterBar() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catOpts = [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; }));
    var chainOpts = [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; }));
    var pre = h('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = h('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return h('div', { class: 'controls' },
      h('div', { class: 'field' }, h('label', { for: 'q', text: 'Search' }), search),
      filterSelect('category', 'Category', catOpts, state.category, function (v) { state.category = v; }),
      filterSelect('chain', 'Chain', chainOpts, state.chain, function (v) { state.chain = v; }),
      filterSelect('tvl', 'TVL', [['all', 'Any TVL'], ['50000000', 'TVL $50M+'], ['100000000', 'TVL $100M+'], ['500000000', 'TVL $500M+'], ['1000000000', 'TVL $1B+']], state.tvl, function (v) { state.tvl = v; }),
      filterSelect('age', 'Age', [['all', 'Any age'], ['young', 'Under 90 days'], ['mid', '90 days to 1 year'], ['mature', 'Over 1 year'], ['unknown', 'Age unknown']], state.age, function (v) { state.age = v; }),
      filterSelect('conf', 'Confidence', [['all', 'Any confidence'], ['high', 'High confidence'], ['medium', 'Medium confidence'], ['low', 'Low confidence']], state.conf, function (v) { state.conf = v; }),
      h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, pre, live)),
      h('span', { class: 'count', text: state.tab === 'pre-token' ? visibleRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return h('th', { scope: 'col' },
      h('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? h('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function confidenceLabel(r) {
    return r.confidence === 'high' ? 'High confidence' : r.confidence === 'medium' ? 'Medium confidence' : 'Low confidence';
  }
  function rowCells(r, max) {
    var growth = r.change_7d === null ? 'n/a' : fmt.pct(r.change_7d);
    var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
    return [
      h('td', { class: 'num', text: String(r.rank) }),
      h('td', null, h('div', { class: 'name' },
        h('b', { text: r.name }),
        h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
      )),
      h('td', { class: 'num', text: fmt.usd(r.tvl_usd) }),
      h('td', { class: 'num ' + growthClass, text: growth }),
      h('td', { class: 'num', text: fmt.age(r.age_days) }),
      h('td', null, h('div', { class: 'implied' },
        h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
        h('span', { class: 'num', text: fmt.usd(r.implied_value_usd) })
      )),
      h('td', { class: 'num', text: '$' + r.farm_sunk_usd + ' sunk' }),
      h('td', null,
        h('span', { class: 'badge ' + (r.on_watchlist ? 'watch' : 'early'), text: r.on_watchlist ? 'Watchlist' : 'Early' }),
        h('span', { class: 'badge conf-' + r.confidence, text: confidenceLabel(r), title: r.confidence_reason })
      )
    ];
  }

  function preTokenTable() {
    var list = sortedRows(visibleRows());
    if (list.length === 0) {
      return h('div', { class: 'panel' }, h('div', { class: 'empty' },
        h('h2', { text: 'No protocol matches that filter' }),
        h('p', { text: 'Clear the search or pick another category to see the board again.' }),
        h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tvl = 'all'; state.age = 'all'; state.conf = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = h('tbody');
    list.forEach(function (r) {
      var tr = h('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { showProtocol(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showProtocol(r.slug); } }
      }, rowCells(r, max));
      tbody.appendChild(tr);
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Net cost is the sunk gas a farm plan costs. Select a row for its model and farm plan.' }),
          h('thead', null, h('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            sortHeader('cost', 'Net cost'),
            h('th', { scope: 'col', text: 'List' })
          )),
          tbody
        )
      )
    );
  }

  function liveTokenTable() {
    var tbody = h('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(h('tr', null,
        h('td', { class: 'num', text: 'live' }),
        h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        h('td', { class: 'num', text: fmt.usd(r.tvl_usd) }),
        h('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmt.pct(r.change_7d) }),
        h('td', { class: 'num', text: fmt.usd(r.mcap_usd) }),
        h('td', null, h('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function compTable() {
    var comps = (DATA.category_multiples || []).slice(0, 12);
    return h('div', { class: 'table-wrap' },
      h('table', { class: 'comps' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Category' }), h('th', { scope: 'col', text: 'Multiple' }), h('th', { scope: 'col', text: 'Live comps' }), h('th', { scope: 'col', text: 'Median mcap / TVL' }), h('th', { scope: 'col', text: 'Ceiling' }))),
        h('tbody', null, comps.map(function (c) {
          return h('tr', null,
            h('td', { text: c.category }),
            h('td', { class: 'num', text: fmt.mult(c.multiple) }),
            h('td', { class: 'num', text: String(c.comps) }),
            h('td', { class: 'num', text: c.median === null ? 'n/a' : fmt.mult(c.median) }),
            h('td', { class: 'num', text: c.ceiling_usd === null || c.ceiling_usd === undefined ? 'none' : fmt.usd(c.ceiling_usd) })
          );
        }))
      )
    );
  }

  function methodPanel() {
    var m = DATA.model;
    var v = DATA.validation;
    var cappedCount = DATA.rows.filter(function (r) { return r.capped; }).length;
    var formula = 'implied = min( round( tvl_usd x categoryMultiple x growth x maturity x breadth ), ' + m.ceiling_share + ' x category traded value ) — growth = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + '; maturity = ' + m.maturity_floor + ' + ' + (m.maturity_kink_value - m.maturity_floor).toFixed(1) + ' x age/' + m.maturity_kink_days + ' under ' + m.maturity_kink_days + ' days, else ' + m.maturity_kink_value + ' + 0.2 x (age - ' + m.maturity_kink_days + ')/' + (m.maturity_days - m.maturity_kink_days) + '; breadth = 1 + ' + m.breadth_step + ' x min(chains - 1, ' + m.breadth_max_chains + ')';
    return h('section', { class: 'panel model' },
      h('h2', { text: 'How implied value is computed' }),
      h('p', { class: 'sub', text: 'One function scores every row from the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      h('p', { text: 'The multiple comes from the tokens already trading in the same category; the age curve is steepest in the first 90 days, because that is when a protocol most often fails; and one week of growth is capped at +60%, because a single week cannot tell a spike from durable growth. Then a ceiling: no protocol is worth more than half of everything its category\u2019s tokens are worth today. On this snapshot ' + cappedCount + ' of ' + DATA.board_size + ' rows hit that ceiling; without it, this snapshot\u2019s top row would claim about 17 times its whole category\u2019s traded value. This radar does not predict whether or when a token is issued; it prices what a token would be worth if the protocol\u2019s record stayed as it is.' }),
      h('div', { class: 'formula', text: formula }),
      h('p', { class: 'sub', text: 'The category multiple is the median market-cap-to-TVL ratio of the live-token protocols in the same category, shrunk toward the global median of ' + fmt.mult(DATA.global_multiple) + ' and clamped to ' + m.comp_min + 'x-' + m.comp_max + 'x, so one thin comp cannot run away with the board. The ceiling is the category\u2019s own traded value: the sum of its live tokens\u2019 market caps, halved. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      h('h3', { text: 'Tested blind on the tokens that already trade' }),
      h('p', { text: 'Before the board is built, the pricing core is fitted on half the live tokens and scored on the other half it never saw. Even/odd by slug (' + v.even_odd.test_n + ' held out) gives a rank correlation of ' + v.even_odd.spearman + ' and a median miss of ' + v.even_odd.median_abs_log_error + ' in log terms, with ' + v.even_odd.within_2x + ' of ' + v.even_odd.test_n + ' within 2x of the real market cap. Walk-forward — older tokens training the newer ones (' + v.walk_forward.test_n + ' held out) — gives ' + v.walk_forward.spearman + ' and a median miss of ' + v.walk_forward.median_abs_log_error + ', with ' + v.walk_forward.within_2x + ' of ' + v.walk_forward.test_n + ' within 2x. A flat global multiple scores ' + v.even_odd.flat_spearman + ' and ' + v.walk_forward.flat_spearman + ' on the same splits, with a typical miss of ' + v.even_odd.flat_median_abs_log_error + ' and ' + v.walk_forward.flat_median_abs_log_error + ' — so the category fit does not out-rank a flat multiple on the tokens that already trade.' }),
      h('p', { text: 'Read the numbers straight: a median miss near ' + v.even_odd.median_abs_log_error + ' in log terms is roughly a ' + Math.round(Math.exp(v.even_odd.median_abs_log_error)) + '-fold typical miss, so this model ranks roughly, it does not price to the dollar. The ceiling is not part of the test: applying it to held-out live tokens cuts the even/odd rank correlation from ' + v.even_odd.spearman + ' to ' + v.even_odd.ceiling_spearman + ', because a live token can be most of its category. The ceiling stays anyway, as a claim discipline for pre-token rows only — without it the board\u2019s top row would claim $622M. What the multiples do is price categories differently on the board itself: its top 10 shares only ' + v.board_top10_tvl_overlap + ' of 10 rows with the TVL top 10, and its rank 1 sits at TVL rank ' + v.board_rank1_tvl_rank + '.' }),
      h('h3', { text: 'Research note' }),
      h('p', { text: 'What the model assumes: a category\u2019s tokens keep trading near their median multiple, TVL persists, and a longer run with no token means a likelier launch, not a certain one. What would falsify it: a held-out rank correlation near zero, which the test above rules out on one split and barely clears on the other. What it cannot see: whether or when any protocol issues a token, a single week\u2019s growth spike, or gas prices moving — the farm plans use typical gas per chain, not a live quote. Implied value is the entry\u2019s own claim, never a price.' }),
      h('h3', { text: 'Category multiples, highest first' }),
      compTable(),
      h('p', { class: 'sub', text: '"No token" means DefiLlama records none for the protocol: a protocol on the list may still have a token its record does not carry. Implied value is an estimate, not a price.' })
    );
  }

  var dialog = h('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  // The drawer's model inputs, as a field spec: each row is a label and a
  // value already formatted, so adding a field is one line, not a new div.
  function equationRows(row) {
    return [
      ['TVL', fmt.usd(row.tvl_usd)],
      ['Category multiple', fmt.mult(row.category_multiple) + ' (' + (row.category || 'Other') + ', ' + row.category_comps + ' live comps)'],
      ['Seven-day growth', fmt.pct(row.change_7d)],
      ['Age with no token', fmt.age(row.age_days)],
      ['Chains', String((row.chains || []).length)],
      ['Growth multiplier', String(row.growth_multiplier)],
      ['Maturity multiplier', String(row.maturity_multiplier)],
      ['Breadth multiplier', String(row.breadth_multiplier)],
      ['Category traded value', row.category_live_mcap_usd ? fmt.usd(row.category_live_mcap_usd) : 'none — no live token in this category'],
      ['Ceiling (half of traded)', row.ceiling_usd === null || row.ceiling_usd === undefined ? 'none' : fmt.usd(row.ceiling_usd)],
      ['Capped by the ceiling', row.capped ? 'yes — the raw value was higher' : 'no'],
      ['Confidence', row.confidence + ' — ' + row.confidence_reason],
      ['Net cost to farm', '$' + row.farm_sunk_usd + ' sunk in gas + $' + row.farm_capital_usd + ' capital at risk, over ' + row.farm_days + ' days'],
      ['Implied value', fmt.usd(row.implied_value_usd)]
    ];
  }

  function showProtocol(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(h('div', { class: 'detail-head' },
      h('div', null,
        h('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? '  ·  Watchlist' : '  ·  Early') }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var agree = Math.abs(recomputed - row.implied_value_usd) / row.implied_value_usd <= 0.005;
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Implied value' }),
      h('div', { class: 'equation' }, equationRows(row).map(function (pair) {
        return h('div', null, h('span', { text: pair[0] }), h('b', { class: 'num', text: pair[1] }));
      })),
      h('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmt.usd(recomputed) + (agree ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(h('section', { class: 'detail-section' },
      h('h3', { text: 'Farm plan' }),
      h('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return h('li', null, h('b', { text: action }), h('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // The top 10 as a radar sweep: one spoke per protocol, length is implied
  // value on a log scale, so the shape shows how far the leaders sit ahead
  // of the rest of the top 10. Pure SVG built in the page, no network and no
  // image: the spokes are the board's own rows.
  function leadersRadar() {
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
    var legend = h('ol', { class: 'radar-legend' }, top.map(function (r) {
      return h('li', null, h('b', { text: r.rank + '. ' + r.name }), h('span', { class: 'num', text: fmt.usd(r.implied_value_usd) }));
    }));
    return h('section', { class: 'panel radar-panel' },
      h('div', { class: 'radar-head' }, h('h2', { text: 'Top 10 at a glance' }), h('p', { class: 'sub', text: 'Spoke length is implied value on a log scale, so the shape shows the gap between the leaders and the rest of the top 10.' })),
      h('div', { class: 'radar-body' }, svg, legend)
    );
  }

  function render() {
    app.textContent = '';
    var shell = h('div', { class: 'shell' });
    shell.appendChild(topBar());
    shell.appendChild(intro());
    if (state.tab === 'pre-token') shell.appendChild(leadersRadar());
    shell.appendChild(filterBar());
    shell.appendChild(state.tab === 'pre-token' ? preTokenTable() : liveTokenTable());
    if (state.tab === 'pre-token') shell.appendChild(methodPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) showProtocol(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
