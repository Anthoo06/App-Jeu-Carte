/* Scène de tirage : chaque groupe arrive au centre en tournant, se révèle, puis glisse dans la rangée du bas.
   À la fin, toutes les cartes se réunissent au centre, avec « Terminé » juste en dessous.
   opts : el (conteneur), color(i), esc(s), haptic(niveau 1..3), settings() → réglages, sound (Son), onDone(). */
/* Fleurs dans deux coins opposés d'une carte : une fleur par couleur de groupe (0 à 7 ; -1 = aucune).
   Dessins dans www/flowers, générés par tools/dessine-fleurs.py. */
function flowerCorners(v) {
  if (v < 0) return '';
  return ['bl', 'tr'].map(function (k) {
    return '<img class="corner ' + k + '" src="flowers/f' + v + '-' + k + '.svg" alt="" aria-hidden="true">';
  }).join('');
}

function Scene(opts) {
  'use strict';
  var el = opts.el;
  var center = el.querySelector('.stage-center'), hint = el.querySelector('.stage-hint');
  var tray = el.querySelector('.tray'), count = el.querySelector('.stage-count');
  var endBox = el.querySelector('.stage-end'), doneBtn = el.querySelector('.stage-done'), skipBtn = el.querySelector('.stage-skip');
  // gen change à chaque démarrage, arrêt ou saut : une animation lancée avant ne doit plus rien déclencher après.
  var items = [], idx = 0, phase = 'idle', timers = [], card = null, nbGroups = 0, gen = 0;

  var LAND_MS = 950, ARRIVE_MS = 1300, SUSPENSE_MS = 2000, FLIP_MS = 700, STORE_MS = 650, GATHER_MS = 750;
  var SMOOTH = 'cubic-bezier(.22,.8,.24,1)';

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function faceHTML(it) {
    return flowerCorners(it.flowers) + '<span class="glabel">' + it.label + '</span><span class="nms">' +
      it.names.map(function (n) { return '<span class="nm">' + opts.esc(n) + '</span>'; }).join('') + '</span>';
  }
  function bigCard(it, down) {
    var w = document.createElement('div');
    w.className = 'scard' + (it.bench ? ' bench' : '');
    w.style.setProperty('--c', it.color);
    w.innerHTML = '<div class="sflip' + (down ? ' down' : '') + '"><div class="sface sfront deco">' + faceHTML(it) + '</div>' +
      '<div class="sface sback" aria-hidden="true">?</div></div>';
    return w;
  }
  function trayCard(it) {
    var t = document.createElement('div');
    t.className = 'tcard deco' + (it.bench ? ' bench' : '');
    t.style.setProperty('--c', it.color);
    t.setAttribute('role', 'group');
    t.setAttribute('aria-label', it.label + ' : ' + it.names.join(', '));
    t.innerHTML = faceHTML(it);
    return t;
  }

  function setHint(t) { hint.textContent = t; }
  function setCount() {
    var it = items[idx];
    count.textContent = it ? (it.bench ? 'Sur le banc' : 'Groupe ' + (idx + 1) + ' / ' + nbGroups) : '';
  }
  function shownHint() { return idx < items.length - 1 ? 'Touche la carte pour passer à la suivante' : 'Touche la carte pour la ranger'; }

  /* Le bloc de fin (note, Copier, Garder, Terminé) vit sous les cartes réunies ; on le remet à sa place avant de vider le centre. */
  function parkEnd() { if (endBox.parentNode !== el) el.insertBefore(endBox, tray); endBox.hidden = true; }
  function clearCenter() { parkEnd(); center.innerHTML = ''; }

  /* Arrivée : minuscule au centre, la carte grandit en tournant de moins en moins vite, avec souffle et vibrations croissantes. */
  function arrive() {
    clearTimers();
    var it = items[idx], s = opts.settings();
    var down = s.suspense && !it.bench;
    card = bigCard(it, down);
    clearCenter();
    center.appendChild(card);
    phase = 'arriving';
    setCount(); setHint('');
    // La carte se pose à LAND_MS (pleine taille, presque droite) puis se stabilise ; le « pop » et la
    // dernière vibration tombent pile à ce moment-là.
    card.animate([
      { transform: 'scale(.05) rotate(-720deg)', easing: 'cubic-bezier(.4,.15,.5,1)' },
      { transform: 'scale(1.06) rotate(5deg)', offset: LAND_MS / ARRIVE_MS, easing: 'cubic-bezier(.3,.7,.4,1)' },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: ARRIVE_MS, easing: 'linear' });
    if (s.sound) opts.sound.arrive(LAND_MS / 1000);
    var t = 0, gap = 240;
    while (t < LAND_MS - 60) {
      (function (tt) { later(function () { opts.haptic(tt < LAND_MS * 0.45 ? 1 : tt < LAND_MS * 0.8 ? 2 : 3); }, tt); })(t);
      t += gap; gap = Math.max(40, gap * 0.78);
    }
    later(function () { opts.haptic(3); }, LAND_MS);
    later(function () {
      phase = down ? 'hidden' : 'shown';
      setHint(down ? 'Touche la carte pour la retourner' : shownHint());
    }, ARRIVE_MS);
  }

  /* Tremblement du suspense : de plus en plus ample, calculé image par image pour rester fluide. */
  function shakeFrames(ms) {
    var frames = [], n = Math.round(ms / 16);
    for (var i = 0; i <= n; i++) {
      var p = i / n, amp = 0.6 + 3.4 * p * p, w = Math.sin(i * 0.9) * amp;
      frames.push({ transform: 'rotate(' + w.toFixed(2) + 'deg) scale(' + (1 + 0.05 * p).toFixed(3) + ')' });
    }
    frames[n] = { transform: 'rotate(0deg) scale(1.05)' };
    return frames;
  }

  /* Suspense : musique, tremblement et vibrations pendant 2 s, puis la carte se retourne (le carillon est
     programmé avec le roulement, pour tomber pile au retournement). */
  function reveal() {
    phase = 'revealing'; setHint('');
    var s = opts.settings();
    if (s.sound) opts.sound.suspense(SUSPENSE_MS / 1000);
    card.animate(shakeFrames(SUSPENSE_MS), { duration: SUSPENSE_MS, easing: 'linear' });
    for (var t = 0; t < SUSPENSE_MS; t += 70) (function (tt) { later(function () { opts.haptic(tt < SUSPENSE_MS / 2 ? 1 : 2); }, tt); })(t);
    later(function () {
      opts.haptic(3);
      card.querySelector('.sflip').classList.remove('down');
      card.animate([{ transform: 'scale(1.05)' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: FLIP_MS, easing: SMOOTH });
    }, SUSPENSE_MS);
    later(function () { phase = 'shown'; setHint(shownHint()); }, SUSPENSE_MS + FLIP_MS);
  }

  /* Rangement : la carte glisse en douceur jusqu'à sa place dans la rangée du bas. */
  function store() {
    phase = 'storing'; setHint('');
    var it = items[idx], t = trayCard(it);
    t.style.visibility = 'hidden';
    tray.appendChild(t);
    tray.scrollTo({ left: tray.scrollWidth, behavior: 'auto' });
    var a = card.getBoundingClientRect(), b = t.getBoundingClientRect();
    var dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), k = b.width / a.width;
    var anim = card.animate([
      { transform: 'none' },
      { transform: 'translate(' + (dx * 0.35) + 'px,' + (dy * 0.25) + 'px) scale(' + (1 - (1 - k) * 0.35) + ') rotate(-4deg)', offset: 0.35 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')' }
    ], { duration: STORE_MS, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' });
    if (opts.settings().sound) opts.sound.slide();
    opts.haptic(1);
    var my = gen;
    anim.onfinish = function () {
      if (my !== gen) return;   // scène fermée ou sautée pendant le glissement
      t.style.visibility = '';
      t.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      center.innerHTML = ''; card = null;
      next();
    };
  }

  function next() {
    idx++;
    if (idx < items.length) arrive(); else finish();
  }
  function finish(instant) {
    phase = 'done'; idx = items.length;
    count.textContent = 'Tous les groupes sont sortis';
    setHint('');
    skipBtn.hidden = true;
    gather(instant);
  }
  /* Fin : les cartes de la rangée glissent au centre ; le bloc de fin se place juste en dessous. */
  function gather(instant) {
    var cards = Array.prototype.slice.call(tray.children);
    var before = cards.map(function (c) { return c.getBoundingClientRect(); });
    var wrap = document.createElement('div'), inner = document.createElement('div'), box = document.createElement('div');
    wrap.className = 'final';
    inner.className = 'finalinner';
    box.className = 'finalgrid' + (cards.length > 4 ? ' many' : '');
    inner.appendChild(box);
    inner.appendChild(endBox);
    wrap.appendChild(inner);
    center.innerHTML = '';
    center.appendChild(wrap);
    cards.forEach(function (c) { box.appendChild(c); });
    tray.hidden = true;
    endBox.hidden = false;
    if (instant) return;
    cards.forEach(function (c, i) {
      var a = before[i], b = c.getBoundingClientRect();
      if (!a.width || !b.width) return;
      // Seule la transformation est animée (pas l'origine) : l'animation reste entièrement sur le processeur graphique.
      c.style.transformOrigin = '0 0';
      c.animate([
        { transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ')' },
        { transform: 'none' }
      ], { duration: GATHER_MS, delay: i * 55, easing: SMOOTH, fill: 'backwards' });
    });
    endBox.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 400, delay: GATHER_MS * 0.6 + cards.length * 55, easing: SMOOTH, fill: 'backwards' });
  }
  /* « Tout révéler » : range directement tout ce qui reste. */
  function skip() {
    clearTimers();
    gen++;
    if (opts.settings().sound) opts.sound.cut();
    if (card) card.getAnimations().forEach(function (a) { a.cancel(); });
    card = null;
    // Pendant un rangement, la carte du groupe en cours est déjà dans la rangée (encore invisible).
    if (phase === 'storing') { tray.lastChild.style.visibility = ''; idx++; }
    for (var i = idx; i < items.length; i++) tray.appendChild(trayCard(items[i]));
    finish();
  }

  center.addEventListener('click', function (e) {
    if (e.target.closest('.stage-end')) return;
    if (phase === 'hidden') reveal();
    else if (phase === 'shown') store();
  });
  skipBtn.addEventListener('click', skip);
  doneBtn.addEventListener('click', function () { opts.onDone(); });

  /* Rangée du bas : les cartes s'inclinent dans le sens du défilement, puis se redressent. */
  var lastX = 0, lastT = 0, tilt = 0, target = 0, raf = 0;
  function loop() {
    target *= 0.85;
    tilt += (target - tilt) * 0.25;
    tray.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
    if (Math.abs(tilt) > 0.05 || Math.abs(target) > 0.05) raf = requestAnimationFrame(loop);
    else { tray.style.setProperty('--tilt', '0deg'); raf = 0; }
  }
  tray.addEventListener('scroll', function () {
    var now = performance.now(), x = tray.scrollLeft;
    var dt = Math.max(8, now - lastT), v = (x - lastX) / dt;
    lastX = x; lastT = now;
    if (dt > 120) return;
    target = Math.max(-35, Math.min(35, -v * 18));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });

  /* Préchauffage : une grande carte dessinée une fois hors écran, pour que la première vraie carte n'ait pas d'à-coup. */
  function warmUp() {
    // Dans l'écran (sinon le navigateur ne dessine rien) mais quasi invisible, derrière tout, le temps de deux images.
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;opacity:.01;z-index:-1;pointer-events:none';
    for (var f = 0; f < 8; f++) {
      var w = bigCard({ names: ['A'], label: '', color: opts.color(f), flowers: f }, false);
      w.style.position = 'absolute';
      box.appendChild(w);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 400);
  }
  if (window.requestIdleCallback) requestIdleCallback(warmUp, { timeout: 1500 }); else setTimeout(warmUp, 600);

  return {
    /* instant : sans animation, toutes les cartes s'affichent directement au centre. */
    start: function (draw, instant) {
      clearTimers();
      gen++;
      nbGroups = draw.groups.length;
      items = draw.groups.map(function (g, i) { return { names: g, label: 'Groupe ' + (i + 1), color: opts.color(i), flowers: opts.flowers(i) }; });
      if (draw.bench.length) items.push({ names: draw.bench, label: 'Sur le banc', color: 'var(--muted)', flowers: -1, bench: true });
      idx = 0;
      clearCenter();
      tray.innerHTML = ''; tray.scrollLeft = 0; tray.hidden = false;
      skipBtn.hidden = false;
      if (instant) {
        items.forEach(function (it) { tray.appendChild(trayCard(it)); });
        finish(true);
        return;
      }
      arrive();
    },
    stop: function () {
      clearTimers();
      gen++;
      opts.sound.cut();
      if (card) card.getAnimations().forEach(function (a) { a.cancel(); });
      phase = 'idle';
      clearCenter(); card = null;
    }
  };
}
