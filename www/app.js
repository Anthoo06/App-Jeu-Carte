/* Écran de l'appli : affichage, actions, navigation. La logique de tirage est dans logic.js, les données dans store.js. */
(function () {
  'use strict';
  var KEY = 'la-donne:v2', OLD_KEY = 'la-donne:v1';
  var NB_COLORS = 8;
  /* Couches ouvertes par-dessus l'écran principal. Elles ne touchent pas à l'adresse de la page, qui peut être dans un cadre (artefact). */
  var LAYERS = { reglages: 'v-settings', contraintes: 'v-cons', sauvegarde: 'v-backup', historique: 'v-history', listes: 'dlg-listes', tirage: 'stage' };
  var PAGES = { reglages: 1, contraintes: 1, sauvegarde: 1, historique: 1 };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clean = Store.clean;

  var storageOk = true;
  // stack : couches ouvertes, la dernière est visible (ex. Paramètres puis Contraintes).
  var ui = { favOnly: false, stack: [], layer: '', mainScroll: 0, listName: '' };
  var pendingDraw = null;

  /* ----- Stockage ----- */
  function loadState() {
    var raw = null;
    try {
      localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
      raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    } catch (e) { storageOk = false; }
    if (raw) { try { return Store.sanitize(JSON.parse(raw)); } catch (e) { /* données illisibles : on repart de zéro */ } }
    return Store.firstRun();
  }
  var state = loadState();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { storageOk = false; }
  }

  /* ----- Utilitaires ----- */
  function toast(m) {
    var t = $('#toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function buzz(ms) { if (state.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignoré */ } } }
  /* Vibration de force 1 (légère) à 3 (forte) : vraie force dans l'APK, durée plus longue dans un navigateur. */
  function haptic(level) {
    if (!state.settings.vibrate) return;
    var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { H.impact({ style: ['LIGHT', 'MEDIUM', 'HEAVY'][level - 1] }).catch(function () {}); return; }
    buzz([8, 18, 35][level - 1]);
  }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return new Date(ts).toISOString().slice(0, 16); }
  }
  function sizeWord(s, pl) {
    var W = { 1: ['solo', 'solos'], 2: ['duo', 'duos'], 3: ['trio', 'trios'], 4: ['quatuor', 'quatuors'], 5: ['quintette', 'quintettes'] };
    var w = W[s]; return w ? w[pl ? 1 : 0] : (pl ? 'groupes' : 'groupe') + ' de ' + s;
  }
  function describeSizes(sizes, bench) {
    var cnt = {}; sizes.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; });
    var t = Object.keys(cnt).map(Number).sort(function (a, b) { return b - a; }).map(function (s) { return cnt[s] + ' ' + sizeWord(s, cnt[s] > 1); }).join(' + ');
    if (bench) t += ' + ' + bench + ' sur le banc';
    return t;
  }
  function gColor(i) { return 'var(--g' + (i % NB_COLORS) + ')'; }
  function gFlowers(i) { return i % 8; }
  function presentNames() { return state.players.filter(function (p) { return p.present; }).map(function (p) { return p.name; }); }
  function copyText(text, okMsg) {
    function fallback() { var t = $('#copyText'); t.value = text; $('#copySheet').hidden = false; t.focus(); t.select(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg || 'Copié'); }, fallback);
    else fallback();
  }
  function drawText(d) {
    var lines = ['La Donne · ' + fmtDate(d.ts)];
    d.groups.forEach(function (g, i) { lines.push('Groupe ' + (i + 1) + ' : ' + g.join(', ')); });
    if (d.bench && d.bench.length) lines.push('Sur le banc : ' + d.bench.join(', '));
    return lines.join('\n');
  }
  /* Retire les contraintes qui citent un joueur qui n'est plus dans la liste. */
  function pruneConstraints() {
    var names = state.players.map(function (p) { return p.name; });
    state.apart = Store.cleanPairs(state.apart, names);
    state.together = Store.cleanPairs(state.together, names);
  }

  /* ----- Écran principal ----- */
  function renderPlayers() {
    var ul = $('#pills');
    ul.innerHTML = state.players.length ? state.players.map(function (p, i) {
      var n = esc(p.name);
      return '<li class="pill' + (p.present ? '' : ' off') + '"><button type="button" class="pt" data-act="toggle" data-i="' + i + '" aria-pressed="' + p.present + '">' + n + '</button>' +
        '<button type="button" class="px" data-act="del" data-i="' + i + '" aria-label="Retirer ' + n + '">×</button></li>';
    }).join('') : '<li class="empty">Ajoute des prénoms ci-dessus.</li>';
    var n = presentNames().length, m = state.players.length;
    $('#pcount').textContent = m ? n + ' / ' + m + ' présent' + (n > 1 ? 's' : '') : '';
    $('.pfoot .link').hidden = !m;
    renderDrawPanel();
  }
  function renderDrawPanel() {
    var s = state.settings, n = presentNames().length;
    $$('[data-act="pick"]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.v) === s.pick)); });
    $('#otherRow').hidden = s.pick !== 0;
    if (document.activeElement !== $('#otherInput')) $('#otherInput').value = s.other;
    $('#avoid').checked = s.avoid;
    var p = $('#preview'), k = Store.groupSize(s);
    if (n < 2) p.textContent = 'Il faut au moins 2 joueurs présents.';
    else {
      var plan = planSizes(n, { size: k, leftover: Store.leftover(s) });
      p.textContent = n + ' joueurs → ' + describeSizes(plan.sizes, plan.bench);
    }
    // La case « banc » n'apparaît que si le compte ne tombe pas juste.
    var rest = n > k ? n % k : 0;
    $('#benchRow').hidden = !rest;
    if (rest) {
      $('#bench').checked = s.bench;
      $('#benchLbl').textContent = 'Mettre ' + rest + ' joueur' + (rest > 1 ? 's' : '') + ' sur le banc';
    }
    var nc = state.apart.length + state.together.length;
    var cl = $('#consLine');
    cl.hidden = !nc;
    if (nc) cl.innerHTML = nc + ' contrainte' + (nc > 1 ? 's' : '') + ' active' + (nc > 1 ? 's' : '') + ' · <button type="button" class="link" data-act="open" data-layer="contraintes">voir</button>';
    $('#histBtn').hidden = !s.showHistory;
  }

  function doDraw() {
    if (ui.layer) return;   // double appui : la scène est déjà ouverte
    var s = state.settings, err = $('#drawErr');
    err.textContent = '';
    var r = drawGroups(presentNames(), {
      size: Store.groupSize(s), leftover: Store.leftover(s),
      together: state.together, apart: state.apart,
      hist: pairCounts(state.history), avoid: s.avoid,
      benchCounts: benchCountsOf(state.history)
    });
    if (r.error) { err.textContent = r.error; return; }
    var entry = { id: Store.uid(), ts: Date.now(), fav: false, groups: r.groups, bench: r.bench };
    state.last = { id: entry.id, ts: entry.ts, fav: false, groups: r.groups, bench: r.bench, violations: r.violations, repeats: r.repeats };
    state.history.unshift(entry);
    Store.trimHistory(state.history);
    save();
    // Le résultat s'affiche toujours dans la scène : groupe par groupe avec « Animation », sinon directement.
    var L = state.last, notes = [];
    if (L.violations) notes.push('Contraintes « à séparer » trop serrées : ' + L.violations + ' paire' + (L.violations > 1 ? 's restent' : ' reste') + ' ensemble.');
    if (L.repeats) notes.push(L.repeats + ' paire' + (L.repeats > 1 ? 's' : '') + ' déjà vue' + (L.repeats > 1 ? 's' : '') + ' : plus assez de nouvelles combinaisons.');
    $('.stage-note').textContent = notes.join(' ');
    $('.stage-end .keep').hidden = !s.showHistory;
    if (s.sound) Son.unlock();
    pendingDraw = { draw: L, instant: !s.anim || reduced() };
    if (pendingDraw.instant) buzz(25);
    openLayer('tirage');
  }

  function addNames(text) {
    var parts = String(text).split(/[,;\n]+/).map(function (x) { return clean(x); }).filter(Boolean);
    var have = Object.create(null); state.players.forEach(function (p) { have[p.name.toLowerCase()] = 1; });
    var added = 0, dups = [], full = false;
    parts.forEach(function (n) {
      var k = n.toLowerCase();
      if (have[k]) { dups.push(n); return; }
      if (state.players.length >= Store.MAXP) { full = true; return; }
      have[k] = 1; state.players.push({ name: n, present: true }); added++;
    });
    var msg = [];
    if (dups.length) msg.push('Déjà dans la liste : ' + dups.join(', ') + '.');
    if (full) msg.push('Maximum ' + Store.MAXP + ' joueurs.');
    $('#addMsg').textContent = msg.join(' ');
    if (added) { state.meta.example = false; save(); renderPlayers(); }
    return added;
  }

  /* ----- Fenêtre Listes : sauvegarder la liste actuelle, charger une liste ----- */
  function renderLists() {
    $('#lists').innerHTML = state.lists.length ? state.lists.map(function (l) {
      return '<li class="row pick"><button type="button" class="load" data-act="list-load" data-id="' + esc(l.id) + '"><span>' + esc(l.name) + '</span><span class="mono">' + l.players.length + ' joueurs</span></button>' +
        '<button type="button" class="x" data-act="list-del" data-confirm data-id="' + esc(l.id) + '" aria-label="Supprimer la liste ' + esc(l.name) + '">🗑</button></li>';
    }).join('') : '<li class="empty">Aucune liste pour l\'instant : donne un nom à la liste actuelle et sauvegarde-la.</li>';
  }
  function saveList() {
    var nm = clean($('#saveName').value, 40), msg = $('#saveMsg');
    if (!nm) { msg.textContent = 'Donne un nom à la liste.'; $('#saveName').focus(); return; }
    if (!state.players.length) { msg.textContent = 'La liste de joueurs est vide.'; return; }
    var players = state.players.map(function (p) { return { name: p.name, present: p.present }; });
    var ex = state.lists.find(function (l) { return l.name.toLowerCase() === nm.toLowerCase(); });
    if (ex) { ex.players = players; toast('« ' + ex.name + ' » mise à jour'); }
    else {
      if (state.lists.length >= 100) { msg.textContent = 'Maximum 100 listes.'; return; }
      state.lists.push({ id: Store.uid(), name: nm, players: players });
      toast('« ' + nm + ' » sauvegardée');
    }
    ui.listName = nm;
    msg.textContent = '';
    save();
    renderLists();
  }

  /* ----- Paramètres ----- */
  function fillSelect(sel) {
    var cur = sel.value;
    sel.innerHTML = '<option value="">Joueur…</option>' + state.players.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>'; }).join('');
    sel.value = state.players.some(function (p) { return p.name === cur; }) ? cur : '';
  }
  function renderCons() {
    ['#apartA', '#apartB', '#togA', '#togB'].forEach(function (s) { fillSelect($(s)); });
    function rows(list, kind) {
      return list.map(function (p, i) {
        return '<li class="row"><span class="rname">' + esc(p[0]) + (kind === 'apart' ? ' ≠ ' : ' + ') + esc(p[1]) + '</span><button type="button" class="x" data-act="cons-del" data-kind="' + kind + '" data-i="' + i + '" aria-label="Retirer cette contrainte">×</button></li>';
      }).join('');
    }
    $('#apartList').innerHTML = rows(state.apart, 'apart');
    $('#togList').innerHTML = rows(state.together, 'together');
  }
  function renderSettings() {
    var s = state.settings;
    $$('#v-settings [data-set]').forEach(function (el) { el.checked = !!s[el.dataset.set]; });
    $$('#v-settings [data-act="set"]').forEach(function (b) { b.setAttribute('aria-pressed', String(String(s[b.dataset.k]) === b.dataset.v)); });
    var nc = state.apart.length + state.together.length;
    $('#consCount').textContent = nc ? nc + ' active' + (nc > 1 ? 's' : '') : 'aucune';
  }
  function renderBackup() {
    $('#exportBox').value = Store.exportText(state);
    $('#storageWarn').hidden = storageOk;
  }
  function importState() {
    var msg = $('#importMsg');
    var inc = Store.parseExport($('#importBox').value);
    if (!inc) { msg.textContent = 'Ce texte n\'est pas une sauvegarde de La Donne : colle le texte exporté complet, sans rien ajouter.'; return; }
    msg.textContent = '';
    state = inc;
    ui.listName = '';
    $('#importBox').value = '';
    save();
    applyTheme();
    closeAll();
    renderMain();
    toast('Import terminé : vérifie les réglages, puis tire au sort');
  }

  /* ----- Historique ----- */
  function renderHistory() {
    var list = state.history.filter(function (d) { return !ui.favOnly || d.fav; });
    $('#favFilter').setAttribute('aria-pressed', String(ui.favOnly));
    $('#favFilter').classList.toggle('primary', ui.favOnly);
    $('#hlist').innerHTML = list.length ? list.map(function (d) {
      return '<li class="h' + (d.fav ? ' fav' : '') + '"><span class="when">' + esc(fmtDate(d.ts)) + '</span><ul class="hg">' +
        d.groups.map(function (g, i) { return '<li style="--c:' + gColor(i) + '"><i aria-hidden="true"></i><span>' + g.map(esc).join(', ') + '</span></li>'; }).join('') +
        (d.bench.length ? '<li style="--c:var(--muted)"><i aria-hidden="true"></i><span>Sur le banc : ' + d.bench.map(esc).join(', ') + '</span></li>' : '') +
        '</ul><div class="tools"><button type="button" class="btn" data-act="h-fav" data-id="' + esc(d.id) + '" aria-pressed="' + d.fav + '">' + (d.fav ? '★ Favori' : '☆ Favori') + '</button>' +
        '<button type="button" class="btn" data-act="h-copy" data-id="' + esc(d.id) + '">Copier</button>' +
        '<button type="button" class="btn" data-act="h-del" data-confirm data-id="' + esc(d.id) + '" aria-label="Supprimer ce tirage">×</button></div></li>';
    }).join('') : '<li class="empty">' + (ui.favOnly ? 'Aucun favori pour l\'instant.' : 'Aucun tirage pour l\'instant.') + '</li>';
    var pc = pairCounts(state.history), arr = [];
    pc.forEach(function (c, k) { if (c >= 2) arr.push([k.split('\u0001'), c]); });
    arr.sort(function (a, b) { return b[1] - a[1]; });
    $('#pairStats').innerHTML = arr.length ? arr.slice(0, 10).map(function (x) { return '<li class="row"><span class="rname">' + esc(x[0][0]) + ' + ' + esc(x[0][1]) + '</span><span class="mono" style="padding-right:10px">' + x[1] + ' fois</span></li>'; }).join('') : '<li class="empty">Aucune paire tirée plus d\'une fois.</li>';
  }

  /* ----- Thème ----- */
  function applyTheme() {
    var t = state.settings.theme, r = document.documentElement;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    r.classList.toggle('decor', !!state.settings.decor);
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#111317' : '#FAF8F3';
  }

  /* ----- Navigation entre les couches (pile) ----- */
  function openLayer(name) { if (LAYERS[name] && ui.layer !== name) { ui.stack.push(name); route(); } }
  function closeLayer() { if (ui.stack.length) { ui.stack.pop(); route(); } }
  function closeAll() { if (ui.stack.length) { ui.stack = []; route(); } }
  function route() {
    var prev = ui.layer, layer = ui.stack[ui.stack.length - 1] || '';
    if (!PAGES[prev] && PAGES[layer]) ui.mainScroll = window.scrollY;
    ui.layer = layer;
    Object.keys(LAYERS).forEach(function (k) { $('#' + LAYERS[k]).hidden = k !== layer; });
    $('#v-main').hidden = !!PAGES[layer];
    if (layer === 'reglages') renderSettings();
    if (layer === 'contraintes') renderCons();
    if (layer === 'sauvegarde') renderBackup();
    if (layer === 'historique') renderHistory();
    if (layer === 'listes') {
      renderLists();
      $('#saveName').value = ui.listName; $('#saveMsg').textContent = '';
    }
    if (layer === 'tirage') {
      if (!pendingDraw) { closeLayer(); return; }
      scene.start(pendingDraw.draw, pendingDraw.instant); pendingDraw = null;
    }
    if (prev === 'tirage' && layer !== 'tirage') scene.stop();
    // La page derrière une fenêtre ou la scène ne défile pas.
    document.documentElement.classList.toggle('locked', layer === 'tirage' || layer === 'listes');
    if (PAGES[layer] && layer !== prev) window.scrollTo(0, 0);
    else if (!layer && PAGES[prev]) { renderMain(); window.scrollTo(0, ui.mainScroll); }
  }

  var scene = Scene({
    el: $('#stage'), esc: esc, color: gColor, flowers: gFlowers, haptic: haptic, sound: Son,
    settings: function () { return state.settings; },
    onDone: function () { closeLayer(); }
  });
  function renderMain() { renderPlayers(); }

  /* ----- Actions ----- */
  function act(btn) {
    var a = btn.dataset.act, d = btn.dataset, s = state.settings;
    switch (a) {
      case 'open': openLayer(d.layer); break;
      case 'add': submitNames(); break;
      case 'save-list': saveList(); break;
      case 'back': closeLayer(); break;
      case 'toggle': var p = state.players[Number(d.i)]; if (p) { p.present = !p.present; save(); renderPlayers(); } break;
      case 'del':
        state.players.splice(Number(d.i), 1);
        state.meta.example = false; pruneConstraints(); save(); renderPlayers(); break;
      case 'clear':
        state.players = []; state.apart = []; state.together = []; state.meta.example = false; ui.listName = '';
        save(); renderPlayers(); $('#nameInput').focus(); break;
      case 'pick': s.pick = Number(d.v); save(); renderDrawPanel(); if (s.pick === 0) $('#otherInput').focus(); break;
      case 'draw': doDraw(); break;
      case 'set':
        var o = {}; o[d.k] = d.v;
        state.settings = Store.cleanSettings(Object.assign({}, s, o));
        if (d.k === 'theme') applyTheme();
        save(); renderSettings(); renderDrawPanel(); break;
      case 'copy-last': if (state.last) copyText(drawText(state.last), 'Tirage copié'); break;
      case 'keep':
        if (!state.last) break;
        var he = state.history.find(function (h) { return h.id === state.last.id; });
        if (!he) { he = { id: state.last.id, ts: state.last.ts, fav: false, groups: state.last.groups, bench: state.last.bench }; state.history.unshift(he); }
        he.fav = true; Store.trimHistory(state.history); save(); toast('Gardé dans les favoris'); break;
      case 'list-load':
        var l = state.lists.find(function (x) { return x.id === d.id; }); if (!l) break;
        state.players = l.players.map(function (x) { return { name: x.name, present: x.present }; });
        state.meta.example = false; ui.listName = l.name;
        pruneConstraints(); save(); closeLayer(); renderPlayers(); toast('« ' + l.name + ' » chargée'); break;
      case 'list-del': state.lists = state.lists.filter(function (x) { return x.id !== d.id; }); save(); renderLists(); break;
      case 'cons-add':
        var kind = d.kind, A = kind === 'apart' ? '#apartA' : '#togA', B = kind === 'apart' ? '#apartB' : '#togB';
        var x1 = $(A).value, x2 = $(B).value, cm = $('#consMsg');
        if (!x1 || !x2) { cm.textContent = 'Choisis deux joueurs.'; break; }
        if (x1 === x2) { cm.textContent = 'Choisis deux joueurs différents.'; break; }
        var other = kind === 'apart' ? state.together : state.apart;
        if (other.some(function (q) { return pk(q[0], q[1]) === pk(x1, x2); })) { cm.textContent = 'Ces deux joueurs ont déjà la contrainte inverse.'; break; }
        var mine = kind === 'apart' ? state.apart : state.together;
        if (mine.some(function (q) { return pk(q[0], q[1]) === pk(x1, x2); })) { cm.textContent = 'Cette contrainte existe déjà.'; break; }
        mine.push([x1, x2]); cm.textContent = ''; save(); renderCons(); break;
      case 'cons-del': (d.kind === 'apart' ? state.apart : state.together).splice(Number(d.i), 1); save(); renderCons(); break;
      case 'h-filter': ui.favOnly = !ui.favOnly; renderHistory(); break;
      case 'h-clear': state.history = state.history.filter(function (h) { return h.fav; }); save(); renderHistory(); break;
      case 'h-fav': var hf = state.history.find(function (h) { return h.id === d.id; }); if (hf) { hf.fav = !hf.fav; save(); renderHistory(); } break;
      case 'h-del': state.history = state.history.filter(function (h) { return h.id !== d.id; }); save(); renderHistory(); break;
      case 'h-copy': var hc = state.history.find(function (h) { return h.id === d.id; }); if (hc) copyText(drawText(hc), 'Tirage copié'); break;
      case 'export-copy': copyText($('#exportBox').value, 'Sauvegarde copiée'); break;
      case 'import': importState(); break;
      case 'reset-all':
        state = Store.defaults(); ui.favOnly = false; ui.listName = '';
        save(); applyTheme(); renderSettings(); toast('Tout est remis à zéro'); break;
      case 'copy-close': $('#copySheet').hidden = true; break;
    }
  }
  /* ----- Événements ----- */
  // Les actions qui effacent demandent un second appui (« Confirmer ? ») dans les 3 secondes.
  function disarm(b) { if (!b.dataset.armed) return; delete b.dataset.armed; b.textContent = b.dataset.label; b.classList.remove('armed'); }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.hasAttribute('data-confirm')) {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = 'Confirmer ?'; btn.classList.add('armed');
        btn._t = setTimeout(function () { disarm(btn); }, 3000); return;
      }
      clearTimeout(btn._t); disarm(btn);
    }
    act(btn);
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el.dataset || !el.dataset.set) return;
    var k = el.dataset.set, o = {};
    o[k] = el.type === 'checkbox' ? el.checked : el.value;
    state.settings = Store.cleanSettings(Object.assign({}, state.settings, o));
    if (k === 'decor') applyTheme();
    save();
    renderDrawPanel();
  });
  $('#otherInput').addEventListener('input', function (e) {
    var v = Math.round(Number(e.target.value));
    if (v >= 2 && v <= 10) { state.settings.other = v; save(); renderDrawPanel(); }
  });
  $('#otherInput').addEventListener('blur', function (e) { e.target.value = state.settings.other; });
  // Pas de <form> : dans un cadre sécurisé (artefact), l'envoi de formulaire peut être bloqué.
  function submitNames() {
    var inp = $('#nameInput');
    if (addNames(inp.value) || !inp.value.trim()) inp.value = '';
    else inp.select();
    inp.focus();
  }
  $('#nameInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitNames(); } });
  // Au collage, les retours à la ligne deviennent des virgules pour garder les prénoms séparés.
  $('#nameInput').addEventListener('paste', function (e) {
    var cb = e.clipboardData || window.clipboardData; if (!cb) return;
    var txt = cb.getData('text'); if (!/[\r\n]/.test(txt)) return;
    e.preventDefault();
    var el = e.target;
    el.setRangeText(txt.replace(/\s*[\r\n]+\s*/g, ', ').replace(/^,\s*|,\s*$/g, ''), el.selectionStart, el.selectionEnd, 'end');
  });
  $('#saveName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveList(); } });
  $$('.sheet').forEach(function (sh) {
    sh.addEventListener('click', function (e) {
      if (e.target !== sh) return;
      if (sh.id === 'copySheet') sh.hidden = true; else closeLayer();
    });
  });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }

  // Échap (sur ordinateur) : comme le bouton retour, ferme la fenêtre ou la page ouverte.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('#copySheet').hidden) $('#copySheet').hidden = true; else closeLayer();
  });

  // Bouton retour d'Android : ferme la couche ouverte, sinon quitte l'appli.
  var Cap = window.Capacitor;
  if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.App) {
    Cap.Plugins.App.addListener('backButton', function () {
      if (!$('#copySheet').hidden) { $('#copySheet').hidden = true; return; }
      if (ui.layer) closeLayer(); else Cap.Plugins.App.exitApp();
    });
  }

  /* ----- Démarrage ----- */
  // Les dessins de fleurs sont chargés et décodés d'avance : la première carte arrive sans à-coup.
  for (var f = 0; f < 8; f++) ['bl', 'tr'].forEach(function (k) {
    var im = new Image(); im.src = 'flowers/f' + f + '-' + k + '.svg';
    if (im.decode) im.decode().catch(function () {});
  });
  save();
  applyTheme();
  renderMain();
})();
