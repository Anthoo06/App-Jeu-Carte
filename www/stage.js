/* Scène de tirage : chaque groupe arrive au centre en tournant, se révèle, puis se range dans la rangée du bas.
   opts : el (conteneur), color(i), esc(s), haptic(niveau 1..3), settings() → réglages, sound (Son), onDone(). */
function Scene(opts) {
  'use strict';
  var el = opts.el;
  var center = el.querySelector('.stage-center'), hint = el.querySelector('.stage-hint');
  var tray = el.querySelector('.tray'), count = el.querySelector('.stage-count');
  var doneBtn = el.querySelector('.stage-done'), skipBtn = el.querySelector('.stage-skip');
  var items = [], idx = 0, phase = 'idle', timers = [], card = null;

  var ARRIVE_MS = 1300, SUSPENSE_MS = 2000, FLIP_MS = 600, STORE_MS = 450;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function faceHTML(it) {
    return '<span class="glabel">' + it.label + '</span>' + it.names.map(function (n) { return '<span class="nm">' + opts.esc(n) + '</span>'; }).join('');
  }
  function bigCard(it, down) {
    var w = document.createElement('div');
    w.className = 'scard' + (it.bench ? ' bench' : '');
    w.style.setProperty('--c', it.color);
    w.innerHTML = '<div class="sflip' + (down ? ' down' : '') + '"><div class="sface sfront">' + faceHTML(it) + '</div>' +
      '<div class="sface sback" aria-hidden="true">?</div></div>';
    return w;
  }
  function trayCard(it) {
    var t = document.createElement('div');
    t.className = 'tcard' + (it.bench ? ' bench' : '');
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
  var nbGroups = 0;

  /* Arrivée : minuscule au centre, la carte grandit en tournant ; les vibrations s'intensifient. */
  function arrive() {
    var it = items[idx], s = opts.settings();
    var down = s.suspense && !it.bench;
    card = bigCard(it, down);
    center.innerHTML = '';
    center.appendChild(card);
    phase = 'arriving';
    setCount(); setHint('');
    card.animate([
      { transform: 'scale(.06) rotate(-900deg)' },
      { transform: 'scale(1.06) rotate(8deg)', offset: 0.85 },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: ARRIVE_MS, easing: 'cubic-bezier(.25,.6,.3,1)' });
    // Pulsations de plus en plus rapprochées et fortes.
    var t = 0, gap = 260;
    while (t < ARRIVE_MS - 60) {
      (function (tt) { later(function () { opts.haptic(tt < ARRIVE_MS * 0.45 ? 1 : tt < ARRIVE_MS * 0.8 ? 2 : 3); }, tt); })(t);
      t += gap; gap = Math.max(45, gap * 0.78);
    }
    later(function () {
      opts.haptic(3);
      phase = down ? 'hidden' : 'shown';
      setHint(down ? 'Touche la carte pour la retourner' : (idx < items.length - 1 ? 'Touche la carte pour passer à la suivante' : 'Touche la carte pour la ranger'));
    }, ARRIVE_MS);
  }

  /* Suspense : musique et vibrations pendant 2 s, puis la carte se retourne. */
  function reveal() {
    phase = 'revealing'; setHint('');
    var s = opts.settings();
    if (s.sound) opts.sound.suspense(SUSPENSE_MS / 1000);
    card.classList.add('shake');
    for (var t = 0; t < SUSPENSE_MS; t += 70) (function (tt) { later(function () { opts.haptic(tt < SUSPENSE_MS / 2 ? 1 : 2); }, tt); })(t);
    later(function () {
      card.classList.remove('shake');
      if (s.sound) opts.sound.reveal();
      opts.haptic(3);
      card.querySelector('.sflip').classList.remove('down');
      card.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: FLIP_MS, easing: 'ease-out' });
    }, SUSPENSE_MS);
    later(function () {
      phase = 'shown';
      setHint(idx < items.length - 1 ? 'Touche la carte pour passer à la suivante' : 'Touche la carte pour la ranger');
    }, SUSPENSE_MS + FLIP_MS);
  }

  /* Rangement : la carte file vers sa place dans la rangée du bas. */
  function store() {
    phase = 'storing'; setHint('');
    var it = items[idx], t = trayCard(it);
    t.style.visibility = 'hidden';
    tray.appendChild(t);
    tray.scrollLeft = tray.scrollWidth;
    var a = card.getBoundingClientRect(), b = t.getBoundingClientRect();
    var dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    var anim = card.animate([{ transform: 'none' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (b.width / a.width) + ')' }],
      { duration: STORE_MS, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' });
    opts.haptic(1);
    anim.onfinish = function () {
      t.style.visibility = '';
      center.innerHTML = ''; card = null;
      next();
    };
  }

  function next() {
    idx++;
    if (idx < items.length) arrive(); else finish();
  }
  function finish() {
    phase = 'done'; idx = items.length;
    count.textContent = 'Tous les groupes sont sortis';
    setHint('');
    skipBtn.hidden = true;
    doneBtn.hidden = false;
    center.innerHTML = '';
  }
  /* « Tout révéler » : range directement tout ce qui reste. */
  function skip() {
    clearTimers();
    if (card) card.getAnimations().forEach(function (a) { a.cancel(); });
    for (var i = idx; i < items.length; i++) tray.appendChild(trayCard(items[i]));
    tray.scrollLeft = tray.scrollWidth;
    finish();
  }

  center.addEventListener('click', function () {
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
    start: function (draw) {
      clearTimers();
      nbGroups = draw.groups.length;
      items = draw.groups.map(function (g, i) { return { names: g, label: 'Groupe ' + (i + 1), color: opts.color(i) }; });
      if (draw.bench.length) items.push({ names: draw.bench, label: 'Sur le banc', color: 'var(--muted)', bench: true });
      idx = 0;
      tray.innerHTML = ''; tray.scrollLeft = 0;
      doneBtn.hidden = true; skipBtn.hidden = false;
      arrive();
    },
    stop: function () {
      clearTimers();
      phase = 'idle';
      center.innerHTML = ''; card = null;
    }
  };
}
