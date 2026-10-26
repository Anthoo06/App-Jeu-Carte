/* Sons du tirage, fabriqués à la volée avec Web Audio (aucun fichier).
   suspense : roulement de caisse claire qui accélère et monte, environ 2 s.
   reveal   : impact grave + carillon lumineux quand la carte se retourne. */
var Son = (function () {
  'use strict';
  var ctx = null, noise = null;

  function noiseBuffer(c) {
    var len = Math.floor(c.sampleRate * 1.5), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function bus(c) {
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    var g = c.createGain(); g.gain.value = 0.9;
    comp.connect(g); g.connect(c.destination);
    return comp;
  }

  /* Un coup de caisse claire : bruit filtré + petit corps grave. */
  function snare(c, out, buf, t, gain) {
    var src = c.createBufferSource(); src.buffer = buf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.2); src.stop(t + 0.1);
    var o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    og.gain.setValueAtTime(gain * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.08);
  }

  function suspenseAt(c, out, buf, t0, dur) {
    // Roulement : de 11 à 34 coups par seconde, de plus en plus fort.
    var t = t0;
    while (t < t0 + dur) {
      var p = (t - t0) / dur;
      snare(c, out, buf, t, 0.12 + 0.5 * p * p);
      t += 0.09 - 0.06 * p;
    }
    // Nappe qui monte d'une quinte, en arrière-plan.
    [0, 7].forEach(function (cents) {
      var o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = 'sawtooth'; o.detune.value = cents;
      o.frequency.setValueAtTime(146.8, t0); o.frequency.exponentialRampToValueAtTime(293.7, t0 + dur);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
      o.connect(lp); lp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.1);
    });
  }

  function revealAt(c, out, buf, t) {
    // Impact grave.
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
    // Cymbale douce.
    var src = c.createBufferSource(), hp = c.createBiquadFilter(), cg = c.createGain();
    src.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 6500;
    cg.gain.setValueAtTime(0.18, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(hp); hp.connect(cg); cg.connect(out); src.start(t); src.stop(t + 0.75);
    // Carillon : do – mi – sol – do en arpège rapide.
    [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) {
      var tt = t + 0.02 + i * 0.05;
      [[1, 'sine', 0.16], [2.01, 'sine', 0.04], [1, 'triangle', 0.05]].forEach(function (h) {
        var osc = c.createOscillator(), gg = c.createGain();
        osc.type = h[1]; osc.frequency.value = f * h[0];
        gg.gain.setValueAtTime(0.0001, tt); gg.gain.exponentialRampToValueAtTime(h[2], tt + 0.006);
        gg.gain.exponentialRampToValueAtTime(0.0001, tt + 1.1);
        osc.connect(gg); gg.connect(out); osc.start(tt); osc.stop(tt + 1.15);
      });
    });
  }

  /* Arrivée : souffle filtré qui monte pendant la rotation, puis petit « pop » quand la carte se pose (dur = moment où elle se pose). */
  function arriveAt(c, out, buf, t0, dur) {
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; src.loop = true;
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(2400, t0 + dur * 0.9);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.06);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t0); src.stop(t0 + dur + 0.1);
    var t = t0 + dur;
    var o = c.createOscillator(), og = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.28, t + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.18);
    var th = c.createOscillator(), tg = c.createGain();
    th.type = 'sine'; th.frequency.setValueAtTime(110, t); th.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    tg.gain.setValueAtTime(0.4, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    th.connect(tg); tg.connect(out); th.start(t); th.stop(t + 0.22);
  }
  /* Glissement : bref frottement de carte. */
  function slideAt(c, out, buf, t) {
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + 0.35);
  }

  function latency(c) { return Math.min(0.15, (c.outputLatency || 0) + (c.baseLatency || 0)); }

  function live() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { ctx = new AC(); noise = noiseBuffer(ctx); ctx._out = bus(ctx); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  return {
    /* À appeler pendant un appui de l'utilisateur, pour que le navigateur autorise le son. */
    unlock: function () { try { live(); } catch (e) { /* pas de son */ } },
    suspense: function (dur) { try { var c = live(); if (c) suspenseAt(c, c._out, noise, c.currentTime + 0.02, dur); } catch (e) { /* pas de son */ } },
    // Le haut-parleur a un léger retard (surtout sur Android) : on avance le son d'autant pour qu'il tombe avec l'image.
    arrive: function (land) { try { var c = live(); if (c) arriveAt(c, c._out, noise, c.currentTime, Math.max(0.05, land - latency(c))); } catch (e) { /* pas de son */ } },
    slide: function () { try { var c = live(); if (c) slideAt(c, c._out, noise, c.currentTime + 0.01); } catch (e) { /* pas de son */ } },
    reveal: function () { try { var c = live(); if (c) revealAt(c, c._out, noise, c.currentTime + 0.01); } catch (e) { /* pas de son */ } },
    /* Pour écouter hors de l'appli : rend suspense + révélation dans un contexte hors-ligne. */
    renderDemo: function (OfflineCtx) {
      var c = new OfflineCtx(2, 44100 * 6, 44100), buf = noiseBuffer(c), out = bus(c);
      arriveAt(c, out, buf, 0.2, 0.95); suspenseAt(c, out, buf, 2.2, 2.0); revealAt(c, out, buf, 4.25);
      return c.startRendering();
    }
  };
})();
