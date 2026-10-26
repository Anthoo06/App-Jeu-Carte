/* Données de l'appli : valeurs par défaut, nettoyage, conversion des anciennes sauvegardes (v1). Pur, sans DOM. */

var Store = (function (L) {
  'use strict';
  var MAXP = 60, MAXLEN = 24, HIST_LIMIT = 50;
  var DEF = { pick: 2, other: 4, leftover: 'bigger', avoid: true, suspense: false, showHistory: false, anim: true, vibrate: true, theme: 'auto' };
  var CHOICES = { pick: [2, 3, 0], leftover: ['bigger', 'smaller', 'bench'], theme: ['auto', 'light', 'dark'] };
  var BOOLS = ['avoid', 'suspense', 'showHistory', 'anim', 'vibrate'];

  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || MAXLEN); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* Taille de groupe effective : 2, 3, ou la valeur « Autre ». */
  function groupSize(s) { return s.pick === 0 ? s.other : s.pick; }

  function defaults() {
    return { v: 2, players: [], lists: [], apart: [], together: [], history: [], last: null, settings: Object.assign({}, DEF), meta: { example: false } };
  }
  function firstRun() {
    var d = defaults();
    ['Alice', 'Bastien', 'Camille', 'David', 'Emma', 'Farid', 'Gaëlle'].forEach(function (n) { d.players.push({ name: n, present: true }); });
    d.meta.example = true;
    return d;
  }

  /* Joueurs uniques (sans tenir compte des majuscules). Accepte des prénoms seuls (v1) ou des { name, present }. */
  function cleanPlayers(arr) {
    var seen = {}, out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var n = clean(typeof x === 'string' ? x : (x && x.name));
      var k = n.toLowerCase();
      if (n && !seen[k] && out.length < MAXP) { seen[k] = 1; out.push({ name: n, present: !(x && typeof x === 'object' && x.present === false) }); }
    });
    return out;
  }
  function cleanPairs(arr, names) {
    var ok = {}, seen = {}, out = [];
    names.forEach(function (n) { ok[n] = 1; });
    (Array.isArray(arr) ? arr : []).forEach(function (p) {
      if (!Array.isArray(p) || p.length < 2) return;
      var a = clean(p[0]), b = clean(p[1]);
      if (!ok[a] || !ok[b] || a === b) return;
      var k = L.pk(a, b);
      if (seen[k]) return;
      seen[k] = 1; out.push([a, b]);
    });
    return out;
  }
  function cleanDraw(x) {
    if (!x || typeof x !== 'object') return null;
    var groups = (Array.isArray(x.groups) ? x.groups : []).slice(0, 60).map(function (g) {
      return (Array.isArray(g) ? g : []).slice(0, MAXP).map(function (n) { return clean(n); }).filter(Boolean);
    }).filter(function (g) { return g.length; });
    if (!groups.length) return null;
    var bench = (Array.isArray(x.bench) ? x.bench : []).slice(0, MAXP).map(function (n) { return clean(n); }).filter(Boolean);
    return { id: clean(x.id, 40) || uid(), ts: Number(x.ts) > 0 ? Number(x.ts) : Date.now(), fav: x.fav === true, groups: groups, bench: bench };
  }
  function cleanSettings(o) {
    var s = Object.assign({}, DEF);
    o = (o && typeof o === 'object') ? o : {};
    Object.keys(CHOICES).forEach(function (k) { if (CHOICES[k].indexOf(o[k]) >= 0) s[k] = o[k]; });
    BOOLS.forEach(function (k) { if (typeof o[k] === 'boolean') s[k] = o[k]; });
    var ot = Math.round(Number(o.other)); if (ot >= 2 && ot <= 10) s.other = ot;
    return s;
  }
  /* Réglages de la v1 (mode/size/reveal…) vers ceux de la v2. */
  function migrateSettings(o) {
    o = (o && typeof o === 'object') ? o : {};
    var s = { leftover: o.leftover === 'balanced' ? 'bigger' : o.leftover, avoid: o.avoid, suspense: o.reveal === 'cards', anim: o.anim, vibrate: o.vibrate, theme: o.theme };
    var size = Math.round(Number(o.size));
    if (o.mode !== 'count' && size >= 2 && size <= 10) {
      if (size === 2 || size === 3) s.pick = size;
      else { s.pick = 0; s.other = size; }
    }
    return cleanSettings(s);
  }
  function trimHistory(history) {
    var extra = history.length - HIST_LIMIT;
    for (var i = history.length - 1; i >= 0 && extra > 0; i--) { if (!history[i].fav) { history.splice(i, 1); extra--; } }
    return history;
  }
  function sanitize(o) {
    var d = defaults();
    if (!o || typeof o !== 'object') return d;
    var v1 = o.v !== 2;
    d.players = cleanPlayers(o.players);
    var names = d.players.map(function (p) { return p.name; });
    d.lists = (Array.isArray(o.lists) ? o.lists : []).slice(0, 100).map(function (l) {
      return { id: clean(l && l.id, 40) || uid(), name: clean(l && l.name, 40) || 'Liste', players: cleanPlayers(l && l.players) };
    }).filter(function (l) { return l.players.length; });
    d.apart = cleanPairs(o.apart, names);
    d.together = cleanPairs(o.together, names);
    d.history = trimHistory((Array.isArray(o.history) ? o.history : []).map(cleanDraw).filter(Boolean).slice(0, 500));
    d.last = cleanDraw(o.last);
    d.settings = v1 ? migrateSettings(o.settings) : cleanSettings(o.settings);
    d.meta = { example: !!(o.meta && o.meta.example) && d.players.length > 0 };
    return d;
  }
  /* Un texte d'export (v1 ou v2) vers un état propre, ou null s'il n'en est pas un. */
  function parseExport(text) {
    var data;
    try { data = JSON.parse(String(text || '').trim()); } catch (e) { return null; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.players)) return null;
    var st = sanitize(data);
    st.last = null;
    st.meta.example = false;
    return st;
  }
  function exportText(state) {
    var c = JSON.parse(JSON.stringify(state));
    delete c.last;
    return JSON.stringify(c, null, 1);
  }

  return {
    MAXP: MAXP, MAXLEN: MAXLEN, HIST_LIMIT: HIST_LIMIT, DEF: DEF,
    clean: clean, uid: uid, groupSize: groupSize, defaults: defaults, firstRun: firstRun,
    cleanPlayers: cleanPlayers, cleanPairs: cleanPairs, cleanSettings: cleanSettings, migrateSettings: migrateSettings,
    trimHistory: trimHistory, sanitize: sanitize, parseExport: parseExport, exportText: exportText
  };
})(typeof module !== 'undefined' ? require('./logic.js') : { pk: pk });

if (typeof module !== 'undefined') module.exports = Store;
