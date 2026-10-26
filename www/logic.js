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

/* Coûts de paires précalculés : W[i * n + j] = 1 000 000 si i et j sont « à séparer », plus (nombre de fois
   déjà ensemble)² si l'on évite les répétitions. Les unités (joueurs ou blocs « à réunir ») sont des listes d'indices. */
function pairWeights(players, apartSet, hist, avoid) {
  const n = players.length, W = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const k = pk(players[i], players[j]);
    let w = apartSet.has(k) ? 1e6 : 0;
    if (avoid) { const c = hist.get(k) || 0; w += c * c; }
    W[i * n + j] = W[j * n + i] = w;
  }
  return W;
}

/* Coût entre l'unité u et les autres unités du groupe g (sauf celle d'indice skip). */
function link(u, g, skip, W, n) {
  let c = 0;
  for (let k = 0; k < g.length; k++) {
    if (k === skip) continue;
    const v = g[k];
    for (let x = 0; x < u.length; x++) { const row = u[x] * n; for (let y = 0; y < v.length; y++) c += W[row + v[y]]; }
  }
  return c;
}

function groupsCost(gu, W, n) {
  let total = 0;
  for (const g of gu) for (let k = 0; k < g.length; k++) total += link(g[k], g, k, W, n);
  return total / 2;
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

/* Recherche locale : on échange deux unités de même taille entre deux groupes si le coût ne monte pas.
   Seule la différence de coût des deux groupes touchés est calculée. */
function improve(gu, W, n, rnd, iters) {
  let total = groupsCost(gu, W, n);
  const ng = gu.length;
  if (ng < 2) return total;
  for (let it = 0; it < iters && total > 0; it++) {
    const a = Math.floor(rnd() * ng);
    let b = Math.floor(rnd() * (ng - 1)); if (b >= a) b++;
    if (!gu[a].length || !gu[b].length) continue;
    const ia = Math.floor(rnd() * gu[a].length), ib = Math.floor(rnd() * gu[b].length);
    const ua = gu[a][ia], ub = gu[b][ib];
    if (ua.length !== ub.length) continue;
    const delta = link(ub, gu[a], ia, W, n) + link(ua, gu[b], ib, W, n) - link(ua, gu[a], ia, W, n) - link(ub, gu[b], ib, W, n);
    if (delta <= 0) { gu[a][ia] = ub; gu[b][ib] = ua; total += delta; }
  }
  return total;
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
  const np = players.length, index = new Map(players.map((p, i) => [p, i]));
  const W = pairWeights(players, apartSet, o.hist, avoid);
  const unitIdx = units.map(u => u.map(p => index.get(p)));
  const rounds = search ? 250 : 200;
  let best = null, bestTotal = Infinity;
  for (let t = 0; t < rounds; t++) {
    const gu = placeUnits(unitIdx, plan.sizes, rnd);
    if (!gu) continue;
    const c = search ? improve(gu, W, np, rnd, 400) : 0;
    if (!best || c < bestTotal) {
      best = gu.map(g => g.map(u => u.slice()));
      bestTotal = c;
    }
    if (!search || bestTotal === 0) break;
  }
  if (!best) return { error: 'Impossible de former ces groupes avec les contraintes « à réunir ».' };
  const groups = best.map(g => shuffled([].concat.apply([], g).map(i => players[i]), rnd));
  let repeats = 0, violations = 0;
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const k = pk(g[i], g[j]);
    if (apartSet.has(k)) violations++;
    // Les paires répétées ne sont signalées que si l'on a demandé à les éviter.
    if (o.avoid && (o.hist.get(k) || 0) > 0) repeats++;
  }
  return { groups: shuffled(groups, rnd), bench, violations, repeats };
}

if (typeof module !== 'undefined') module.exports = { shuffled, pk, balancedSizes, planSizes, buildUnits, drawGroups, pairCounts, benchCountsOf };
