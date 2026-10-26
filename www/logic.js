/* Logique de tirage (pure, sans DOM). Utilisable dans la page et dans Node pour les tests. */

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pk(a, b) { return a < b ? a + '\u0001' + b : b + '\u0001' + a; }

function balancedSizes(n, c) {
  const base = Math.floor(n / c), extra = n % c, s = [];
  for (let i = 0; i < c; i++) s.push(base + (i < extra ? 1 : 0));
  return s;
}

/* Tailles de groupes pour n joueurs. o.size : joueurs par groupe ; o.leftover : bigger | smaller | bench */
function planSizes(n, o) {
  if (n < 1) return { sizes: [], bench: 0 };
  const k = Math.max(2, o.size);
  if (n <= k) return { sizes: [n], bench: 0 };
  const g = Math.floor(n / k), r = n % k;
  if (r === 0) return { sizes: Array(g).fill(k), bench: 0 };
  if (o.leftover === 'smaller') return { sizes: Array(g).fill(k).concat([r]), bench: 0 };
  if (o.leftover === 'bench') return { sizes: Array(g).fill(k), bench: r };
  // bigger : les restes rejoignent des groupes existants (k+1)
  if (r <= g) {
    const s = [];
    for (let i = 0; i < g; i++) s.push(k + (i < r ? 1 : 0));
    return { sizes: s, bench: 0 };
  }
  return { sizes: balancedSizes(n, g + 1), bench: 0 };
}

function buildUnits(players, together) {
  const idx = new Map(players.map((p, i) => [p, i]));
  const par = players.map((_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (const [a, b] of together) {
    if (idx.has(a) && idx.has(b)) par[find(idx.get(a))] = find(idx.get(b));
  }
  const m = new Map();
  players.forEach((p, i) => {
    const r = find(i);
    if (!m.has(r)) m.set(r, []);
    m.get(r).push(p);
  });
  return Array.from(m.values());
}

function groupsCost(gu, apartSet, hist, avoid) {
  let viol = 0, soft = 0;
  for (const units of gu) {
    const g = [].concat.apply([], units);
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const k = pk(g[i], g[j]);
      if (apartSet.has(k)) viol++;
      if (avoid) { const c = hist.get(k) || 0; soft += c * c; }
    }
  }
  return { viol, soft, total: viol * 1e6 + soft };
}

function placeUnits(units, sizes, rnd) {
  const order = shuffled(units, rnd).sort((a, b) => b.length - a.length);
  const cap = sizes.slice();
  const gu = sizes.map(() => []);
  for (const u of order) {
    const cands = [];
    for (let i = 0; i < cap.length; i++) if (cap[i] >= u.length) cands.push(i);
    if (!cands.length) return null;
    const i = cands[Math.floor(rnd() * cands.length)];
    gu[i].push(u);
    cap[i] -= u.length;
  }
  return gu;
}

function improve(gu, apartSet, hist, avoid, rnd, iters) {
  let best = groupsCost(gu, apartSet, hist, avoid);
  const ng = gu.length;
  if (ng < 2) return best;
  for (let it = 0; it < iters && best.total > 0; it++) {
    const a = Math.floor(rnd() * ng);
    let b = Math.floor(rnd() * (ng - 1)); if (b >= a) b++;
    if (!gu[a].length || !gu[b].length) continue;
    const ia = Math.floor(rnd() * gu[a].length), ib = Math.floor(rnd() * gu[b].length);
    if (gu[a][ia].length !== gu[b][ib].length) continue;
    const ua = gu[a][ia], ub = gu[b][ib];
    gu[a][ia] = ub; gu[b][ib] = ua;
    const c = groupsCost(gu, apartSet, hist, avoid);
    if (c.total <= best.total) best = c; else { gu[a][ia] = ua; gu[b][ib] = ub; }
  }
  return best;
}

function pairCounts(history) {
  const m = new Map();
  for (const d of history) for (const g of d.groups) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const k = pk(g[i], g[j]);
      m.set(k, (m.get(k) || 0) + 1);
    }
  }
  return m;
}

function benchCountsOf(history) {
  const m = new Map();
  for (const d of history) for (const p of (d.bench || [])) m.set(p, (m.get(p) || 0) + 1);
  return m;
}

/* o : size, leftover, together, apart, hist (Map), avoid, benchCounts (Map) */
function drawGroups(present, o, rnd) {
  rnd = rnd || Math.random;
  const n = present.length;
  if (n < 2) return { error: 'Il faut au moins 2 joueurs présents.' };
  const plan = planSizes(n, o);
  let players = present.slice(), bench = [];
  if (plan.bench > 0) {
    const order = shuffled(players, rnd).sort((a, b) => (o.benchCounts.get(a) || 0) - (o.benchCounts.get(b) || 0));
    bench = order.slice(0, plan.bench);
    players = players.filter(p => bench.indexOf(p) < 0);
  }
  const set = new Set(players);
  const inSet = ([a, b]) => set.has(a) && set.has(b);
  const together = o.together.filter(inSet);
  const apart = o.apart.filter(inSet);
  const apartSet = new Set(apart.map(([a, b]) => pk(a, b)));
  const units = buildUnits(players, together);
  const maxSize = Math.max.apply(null, plan.sizes);
  const big = units.find(u => u.length > maxSize);
  if (big) return { error: 'Les joueurs à réunir (' + big.join(', ') + ') ne tiennent pas dans un groupe de ' + maxSize + '.' };
  for (const u of units) for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
    if (apartSet.has(pk(u[i], u[j]))) return { error: 'Contradiction : ' + u[i] + ' et ' + u[j] + ' sont à réunir et à séparer.' };
  }
  const avoid = !!o.avoid && o.hist.size > 0;
  const search = apart.length > 0 || avoid;
  const rounds = search ? 250 : 200;
  let best = null, bestCost = null;
  for (let t = 0; t < rounds; t++) {
    const gu = placeUnits(units, plan.sizes, rnd);
    if (!gu) continue;
    const c = search ? improve(gu, apartSet, o.hist, avoid, rnd, 400) : groupsCost(gu, apartSet, o.hist, false);
    if (!best || c.total < bestCost.total) {
      best = gu.map(g => g.map(u => u.slice()));
      bestCost = c;
    }
    if (!search || bestCost.total === 0) break;
  }
  if (!best) return { error: 'Impossible de former ces groupes avec les contraintes « à réunir ».' };
  const groups = best.map(g => shuffled([].concat.apply([], g), rnd));
  let repeats = 0;
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    if ((o.hist.get(pk(g[i], g[j])) || 0) > 0) repeats++;
  }
  return { groups: shuffled(groups, rnd), bench, violations: bestCost.viol, repeats };
}

if (typeof module !== 'undefined') module.exports = { shuffled, pk, balancedSizes, planSizes, buildUnits, drawGroups, pairCounts, benchCountsOf };
