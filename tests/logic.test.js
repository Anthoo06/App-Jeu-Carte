const test = require('node:test');
const assert = require('node:assert');
const L = require('../www/logic.js');
const Store = require('../www/store.js');

const sum = a => a.reduce((x, y) => x + y, 0);
const names = n => Array.from({ length: n }, (_, i) => 'J' + i);
const opts = o => Object.assign({ size: 2, leftover: 'bigger', together: [], apart: [], hist: new Map(), avoid: false, benchCounts: new Map() }, o);

test('planSizes : chaque façon de gérer le reste', () => {
  assert.deepStrictEqual(L.planSizes(6, { size: 2, leftover: 'bigger' }), { sizes: [2, 2, 2], bench: 0 });
  assert.deepStrictEqual(L.planSizes(7, { size: 2, leftover: 'bigger' }), { sizes: [3, 2, 2], bench: 0 });
  assert.deepStrictEqual(L.planSizes(7, { size: 2, leftover: 'smaller' }), { sizes: [2, 2, 2, 1], bench: 0 });
  assert.deepStrictEqual(L.planSizes(7, { size: 2, leftover: 'bench' }), { sizes: [2, 2, 2], bench: 1 });
  assert.deepStrictEqual(L.planSizes(7, { size: 4, leftover: 'bigger' }), { sizes: [4, 3], bench: 0 });
  assert.deepStrictEqual(L.planSizes(3, { size: 4, leftover: 'bigger' }), { sizes: [3], bench: 0 });
});

test('drawGroups : tout le monde est placé une seule fois', () => {
  for (const n of [2, 5, 7, 12]) for (const leftover of ['bigger', 'smaller', 'bench']) {
    const r = L.drawGroups(names(n), opts({ size: 3, leftover }));
    const all = r.groups.flat().concat(r.bench);
    assert.strictEqual(all.length, n);
    assert.strictEqual(new Set(all).size, n);
  }
});

test('drawGroups : contraintes respectées', () => {
  const p = names(8);
  for (let t = 0; t < 30; t++) {
    const r = L.drawGroups(p, opts({ apart: [['J0', 'J1']], together: [['J2', 'J3']] }));
    const g01 = r.groups.find(g => g.includes('J0'));
    assert.ok(!g01.includes('J1'));
    assert.ok(r.groups.find(g => g.includes('J2')).includes('J3'));
  }
});

test('drawGroups : paires répétées signalées seulement si « éviter » est coché', () => {
  const hist = new Map([[L.pk('A', 'B'), 1]]);
  const off = L.drawGroups(['A', 'B'], opts({ hist, avoid: false }));
  assert.strictEqual(off.repeats, 0);
  const on = L.drawGroups(['A', 'B'], opts({ hist, avoid: true }));
  assert.strictEqual(on.repeats, 1);
});

test('drawGroups : moins de 2 joueurs → erreur', () => {
  assert.ok(L.drawGroups(['A'], opts()).error);
});

test('conversion v1 → v2', () => {
  const v1 = {
    v: 1,
    players: [{ name: 'Alice', present: true }, { name: 'Bob', present: false }, { name: 'Chloé', present: true }],
    lists: [{ id: 'x', name: 'Tarot', players: ['Alice', 'Bob'] }],
    apart: [['Alice', 'Bob']], together: [['Alice', 'Inconnu']],
    history: [{ id: 'h1', ts: 1, groups: [['Alice', 'Chloé']], bench: [] }],
    settings: { mode: 'size', size: 4, leftover: 'balanced', reveal: 'cards', avoid: false, theme: 'dark', labels: 'teams' }
  };
  const s = Store.sanitize(v1);
  assert.strictEqual(s.v, 2);
  assert.deepStrictEqual(s.players[1], { name: 'Bob', present: false });
  assert.deepStrictEqual(s.lists[0].players, [{ name: 'Alice', present: true }, { name: 'Bob', present: true }]);
  assert.deepStrictEqual(s.apart, [['Alice', 'Bob']]);
  assert.deepStrictEqual(s.together, []);
  assert.strictEqual(s.history.length, 1);
  assert.deepStrictEqual(s.settings, Object.assign({}, Store.DEF, { pick: 0, other: 4, leftover: 'bigger', suspense: true, avoid: false, theme: 'dark' }));
  assert.strictEqual(Store.sanitize({ v: 1, players: [], settings: { size: 3 } }).settings.pick, 3);
  assert.strictEqual(Store.sanitize({ v: 1, players: [], settings: { mode: 'count', size: 3 } }).settings.pick, 2);
});

test('export puis import : tout revient, réglages compris, sans résultat affiché', () => {
  const st = Store.defaults();
  st.players = [{ name: 'Alice', present: true }, { name: 'Bob', present: false }];
  st.settings = Object.assign({}, Store.DEF, { pick: 0, other: 5, avoid: false, suspense: true, showHistory: true, leftover: 'smaller', bench: true });
  st.last = { id: 'l', ts: 1, groups: [['Alice', 'Bob']], bench: [] };
  const back = Store.parseExport(Store.exportText(st));
  assert.deepStrictEqual(back.players, st.players);
  assert.deepStrictEqual(back.settings, st.settings);
  assert.strictEqual(back.last, null);
  assert.strictEqual(Store.parseExport('pas du json'), null);
  assert.strictEqual(Store.parseExport('{"a":1}'), null);
});

test('ancien réglage « Remplaçants » → case banc cochée', () => {
  const v1 = Store.sanitize({ v: 1, players: [], settings: { size: 2, leftover: 'bench' } }).settings;
  assert.strictEqual(v1.bench, true);
  assert.strictEqual(v1.leftover, 'bigger');
  const v2 = Store.sanitize({ v: 2, players: [], settings: { leftover: 'bench' } }).settings;
  assert.strictEqual(v2.bench, true);
  assert.strictEqual(Store.leftover(v2), 'bench');
  assert.strictEqual(Store.leftover(Object.assign({}, v2, { bench: false })), 'bigger');
});

test('historique limité à 50, favoris gardés', () => {
  const h = Array.from({ length: 60 }, (_, i) => ({ id: 'h' + i, fav: i === 59, groups: [['A', 'B']], bench: [] }));
  Store.trimHistory(h);
  assert.strictEqual(h.length, 50);
  assert.ok(h.some(x => x.id === 'h59'));
});
