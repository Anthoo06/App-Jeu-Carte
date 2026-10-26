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
  var items = [], idx = 0, phase = 'idle', timers = [], card = null, nbGroups = 0;

  var ARRIVE_MS = 1500, SUSPENSE_MS = 2000, FLIP_MS = 700, STORE_MS = 650, GATHER_MS = 750;
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
    var it = items[idx], s = opts.settings();
    var down = s.suspense && !it.bench;
    card = bigCard(it, down);
    clearCenter();
    center.appendChild(card);
    phase = 'arriving';
    setCount(); setHint('');
    card.animate([
      { transform: 'scale(.05) rotate(-720deg)' },
      { transform: 'scale(.55) rotate(-200deg)', offset: 0.45 },
      { transform: 'scale(1.05) rotate(6deg)', offset: 0.86 },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: ARRIVE_MS, easing: 'cubic-bezier(.3,.55,.35,1)' });
    if (s.sound) opts.sound.arrive(ARRIVE_MS / 1000);
    var t = 0, gap = 280;
    while (t < ARRIVE_MS - 80) {
      (function (tt) { later(function () { opts.haptic(tt < ARRIVE_MS * 0.45 ? 1 : tt < ARRIVE_MS * 0.8 ? 2 : 3); }, tt); })(t);
      t += gap; gap = Math.max(45, gap * 0.8);
    }
    later(function () {
      opts.haptic(3);
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

  /* Suspense : musique, tremblement et vibrations pendant 2 s, puis la carte se retourne. */
  function reveal() {
    phase = 'revealing'; setHint('');
    var s = opts.settings();
    if (s.sound) opts.sound.suspense(SUSPENSE_MS / 1000);
    card.animate(shakeFrames(SUSPENSE_MS), { duration: SUSPENSE_MS, easing: 'linear' });
    for (var t = 0; t < SUSPENSE_MS; t += 70) (function (tt) { later(function () { opts.haptic(tt < SUSPENSE_MS / 2 ? 1 : 2); }, tt); })(t);
    later(function () {
      if (s.sound) opts.sound.reveal();
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
    anim.onfinish = function () {
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
      c.animate([
        { transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ')', transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' }
      ], { duration: GATHER_MS, delay: i * 55, easing: SMOOTH, fill: 'backwards' });
    });
    endBox.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 400, delay: GATHER_MS * 0.6 + cards.length * 55, easing: SMOOTH, fill: 'backwards' });
  }
  /* « Tout révéler » : range directement tout ce qui reste. */
  function skip() {
    clearTimers();
    if (card) card.getAnimations().forEach(function (a) { a.cancel(); });
    card = null;
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

  return {
    /* instant : sans animation, toutes les cartes s'affichent directement au centre. */
    start: function (draw, instant) {
      clearTimers();
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
      phase = 'idle';
      clearCenter(); card = null;
    }
  };
}
