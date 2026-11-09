/* The Notebook Chain — G5 Science sparkle layer (OAO).
   Everything comes from <script type="application/json" id="nc-data">. A missing key turns off only its own part.
   Parts: opener (cinematic Powers of Ten zoom), source (a real notebook page, tap to translate),
   nextPage (the student's own page in the chain, fed into Gathered Answers). */
(function () {
  'use strict';
  var dataEl = document.getElementById('nc-data');
  if (!dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { console.error('[nc] bad data', e); return; }
  window.NC_FAILED = [];
  function guard(name, fn) { try { fn(); } catch (e) { console.error('[nc] ' + name, e); window.NC_FAILED.push(name); } }

  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'oao.nc.' + (D.prefix || 'lesson');
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  document.documentElement.classList.add('nc-on');

  /* ───────────── Sound: a soft synthesized score (no files; only after the student turns it on) ───────────── */
  var Snd = (function () {
    var ctx = null, master = null, pad = [], on = false, air = null;
    function ensure() {
      if (ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(master);
      [55, 82.41, 110.0, 164.81].forEach(function (f, i) {
        var o = ctx.createOscillator(); o.type = i < 2 ? 'triangle' : 'sine'; o.frequency.value = f;
        o.detune.value = (i % 2 ? 6 : -6);
        var g = ctx.createGain(); g.gain.value = [0.22, 0.16, 0.07, 0.04][i];
        var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
        var lg = ctx.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
        o.connect(g); g.connect(lp); o.start(); pad.push(o);
      });
      // a breath of air
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      air = { buf: buf };
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
      var ag = ctx.createGain(); ag.gain.value = 0.018; src.connect(bp); bp.connect(ag); ag.connect(master); src.start();
      return true;
    }
    function set(v) {
      if (v && !ensure()) return false;
      on = v;
      if (!ctx) return false;
      if (ctx.state === 'suspended') ctx.resume();
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(v ? 0.55 : 0, t + (v ? 1.6 : 0.5));
      return on;
    }
    function whoosh() {
      if (!on || !ctx) return;
      var t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = air.buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.6);
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 1.9);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 2);
    }
    function chime() {
      if (!on || !ctx) return;
      var t = ctx.currentTime;
      [[55, 0.35, 3.5, 'sine'], [659.25, 0.07, 3, 'sine'], [987.77, 0.05, 3.4, 'sine'], [1318.5, 0.035, 3.8, 'sine']].forEach(function (n, i) {
        var o = ctx.createOscillator(); o.type = n[3]; o.frequency.value = n[0];
        var g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.12); g.gain.linearRampToValueAtTime(n[1], t + i * 0.12 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + n[2]);
        o.connect(g); g.connect(master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + n[2] + 0.1);
      });
    }
    return { set: set, isOn: function () { return on; }, whoosh: whoosh, chime: chime };
  })();

  /* ───────────── Voice: one clip at a time (narration, Keeper, Word Lens, 1648 lines) ───────────── */
  var Voice = (function () {
    var cur = null, curKey = null, onEnd = null;
    function src(key) { return (D.audio || '') + D.prefix + '-' + key + '.mp3'; }
    function stop() {
      if (cur) { try { cur.pause(); } catch (e) {} }
      if (onEnd) { var f = onEnd; onEnd = null; f(true); }
      cur = null; curKey = null;
    }
    function play(key, opts) {
      opts = opts || {};
      stop();
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      var a = new Audio(src(key)); a.preload = 'auto';
      cur = a; curKey = key; onEnd = opts.onEnd || null;
      a.addEventListener('ended', function () { if (cur === a) { var f = onEnd; onEnd = null; cur = null; curKey = null; if (f) f(false); } });
      if (opts.onTime) a.addEventListener('timeupdate', function () { if (cur === a) opts.onTime(a.currentTime, a.duration || 0); });
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { if (cur === a) { var f = onEnd; onEnd = null; cur = null; if (f) f(true); } });
      return a;
    }
    return { play: play, stop: stop, key: function () { return curKey; }, src: src };
  })();

  /* ───────────── 1. The opener ───────────── */
  function buildOpener() {
    var O = D.opener;
    if (!O || !O.frames || !O.frames.length) return;
    var hero = document.querySelector('.hero-visual') || document.querySelector('.tab-bar');
    if (!hero) return;
    var F = O.frames, N = F.length, OUT = !!O.out, G = OUT ? F.slice().reverse() : F, R = O.zoom || 6, STEP = O.step || 3.9, PRE = 1.6, TITLE_AT = (N - 1) + 0.0;
    var voiceOn = true, lastFront = -1;
    function stepFor(i) { var d = (F[i] && F[i].dur) || 0; return Math.max(STEP, d / 0.68 + 0.4); }
    function frontAt(zz) { var i = Math.floor(zz), t = zz - i; if (zz < 0) return 0; if (i >= N - 1) return N - 1; return t > 0.9 ? i + 1 : i; }

    var wrap = mk('section', 'nc-op');
    wrap.setAttribute('aria-label', 'Opening film');
    var meter = F.map(function (f, i) { return '<i data-i="' + i + '"></i>'; }).join('');
    wrap.innerHTML =
      '<div class="nc-op-stage" role="img" aria-label="' + esc(O.alt) + '">' +
        '<div class="nc-op-frames"></div>' +
        '<div class="nc-op-grain" aria-hidden="true"></div><div class="nc-op-vig" aria-hidden="true"></div>' +
        '<div class="nc-op-bar nc-op-bar-t" aria-hidden="true"></div><div class="nc-op-bar nc-op-bar-b" aria-hidden="true"></div>' +
        '<div class="nc-op-meter" aria-hidden="true"><span class="nc-op-meter-k">Zoom</span>' + meter + '</div>' +
        '<div class="nc-op-cap" aria-hidden="true"><div class="nc-op-cap-t"></div><div class="nc-op-cap-s"><span class="nc-op-rule"></span><span class="nc-op-scale"></span></div></div>' +
        '<div class="nc-op-sub" aria-live="polite"></div>' +
        '<div class="nc-op-title">' +
          '<div class="nc-op-tk">' + esc(O.kicker) + ' · Big Question</div>' +
          '<h2 class="nc-op-tt">' + esc(O.question) + '</h2>' +
          '<button type="button" class="nc-op-again">↺ Watch the opening again</button>' +
        '</div>' +
        '<button type="button" class="nc-op-start" hidden><span class="nc-op-start-i">▶</span><span>Play the opening</span><small>about 1 minute · sound on</small></button>' +
        '<div class="nc-op-ctl">' +
          '<button type="button" class="nc-op-b nc-op-pp" aria-label="Pause">❚❚</button>' +
          '<button type="button" class="nc-op-b nc-op-snd" aria-label="Turn sound on" aria-pressed="false">🔈<span>Sound</span></button>' +
          '<button type="button" class="nc-op-b nc-op-skip" aria-label="Skip the opening">Skip ⏭</button>' +
          '<button type="button" class="nc-op-b nc-op-cr" aria-label="Show where the pictures come from" aria-expanded="false">ⓘ<span>Pictures</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="nc-op-credits" hidden></div>';
    hero.parentNode.insertBefore(wrap, hero);

    var stage = wrap.querySelector('.nc-op-stage'), box = wrap.querySelector('.nc-op-frames');
    stage.setAttribute('data-kicker', O.kicker || '');
    var capT = wrap.querySelector('.nc-op-cap-t'), capS = wrap.querySelector('.nc-op-scale'), cap = wrap.querySelector('.nc-op-cap');
    var sub = wrap.querySelector('.nc-op-sub'), title = wrap.querySelector('.nc-op-title');
    var pp = wrap.querySelector('.nc-op-pp'), snd = wrap.querySelector('.nc-op-snd'), skip = wrap.querySelector('.nc-op-skip');
    var crB = wrap.querySelector('.nc-op-cr'), crBox = wrap.querySelector('.nc-op-credits'), startB = wrap.querySelector('.nc-op-start');
    var ticks = wrap.querySelectorAll('.nc-op-meter i');

    // credits + a written version of the film (for anyone who can't watch it)
    crBox.innerHTML = '<h3>Where the pictures come from</h3><ol>' + (O.credits || []).map(function (c) {
      return '<li><b>' + esc(c[0]) + '.</b> ' + esc(c[1]) + (c[2] ? ' · ' + esc(c[2]) : '') + (c[3] ? ' · <a href="' + esc(c[3]) + '" target="_blank" rel="noopener">source</a>' : '') + '</li>';
    }).join('') + '</ol><h3>What the film says</h3><p>' + F.map(function (f) { return esc(f.line); }).join(' ') + ' ' + esc(O.question) + '</p>';

    // frames
    // OUT (near to far): the frames are listed in playing order, smallest first; G holds them biggest first,
    // and each frame's fx/fy says where the frame played just before it sits inside it.
    var els = G.map(function (f) {
      var e;
      if (f.type === 'air') { e = mk('canvas', 'nc-op-f nc-op-air'); }
      else { e = mk('img', 'nc-op-f'); e.alt = ''; e.decoding = 'async'; e.src = f.img; e.draggable = false; }
      e.style.opacity = '0';
      box.appendChild(e);
      return e;
    });

    var Sw = 0, Sh = 0, base = [];
    function layout() {
      Sw = stage.clientWidth; Sh = stage.clientHeight;
      base = G.map(function (f, i) {
        var w = f.w || Sw, h = f.h || Sh;
        if (f.type === 'air') { w = Sw; h = Sh; sizeAir(els[i]); }
        var c = f.fit === 'contain' ? Math.min(Sw / w, Sh / h) : Math.max(Sw / w, Sh / h);
        if (f.fit === 'contain') c *= 1.05;
        var bw = w * c, bh = h * c;
        els[i].style.width = bw + 'px'; els[i].style.height = bh + 'px';
        return { w: bw, h: bh };
      });
      render(z);
    }

    // the air: drifting CO2 (and a few water) molecules, drawn as a model
    var mol = [], airCtx = null, airW = 0, airH = 0;
    function sizeAir(cv) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(Sw * dpr); cv.height = Math.round(Sh * dpr);
      airCtx = cv.getContext('2d'); airCtx.setTransform(dpr, 0, 0, dpr, 0, 0); airW = Sw; airH = Sh;
      if (!mol.length) {
        for (var i = 0; i < 26; i++) {
          mol.push({ x: Math.random(), y: Math.random(), d: 0.35 + Math.random() * 0.9, a: Math.random() * 6.28,
            vx: (Math.random() - 0.5) * 0.012, vy: (Math.random() - 0.5) * 0.01, va: (Math.random() - 0.5) * 0.4, w: i % 5 === 4 });
        }
        mol.sort(function (p, q) { return p.d - q.d; });
      }
    }
    function atom(x, y, r, c1, c2, blur) {
      var g = airCtx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      airCtx.fillStyle = g; airCtx.globalAlpha = blur;
      airCtx.beginPath(); airCtx.arc(x, y, r, 0, 6.2832); airCtx.fill();
    }
    function drawAir(dt) {
      if (!airCtx) return;
      var g = airCtx.createRadialGradient(airW / 2, airH / 2, 10, airW / 2, airH / 2, Math.max(airW, airH) * 0.7);
      g.addColorStop(0, '#16324a'); g.addColorStop(1, '#05070d');
      airCtx.globalAlpha = 1; airCtx.fillStyle = g; airCtx.fillRect(0, 0, airW, airH);
      var u = Math.min(airW, airH) / 9;
      mol.forEach(function (m) {
        m.x = (m.x + m.vx * dt + 1.2) % 1.2; m.y = (m.y + m.vy * dt + 1.2) % 1.2; m.a += m.va * dt;
        var x = (m.x - 0.1) * airW, y = (m.y - 0.1) * airH, r = u * 0.32 * m.d, al = 0.35 + 0.65 * (1 - Math.abs(m.d - 0.9));
        var cx = Math.cos(m.a), sy = Math.sin(m.a);
        if (m.w) { // water: O in the middle, two small H
          atom(x + cx * r * 1.1 - sy * r * 0.7, y + sy * r * 1.1 + cx * r * 0.7, r * 0.62, '#ffffff', '#9fb3c8', al);
          atom(x - cx * r * 1.1 - sy * r * 0.7, y - sy * r * 1.1 + cx * r * 0.7, r * 0.62, '#ffffff', '#9fb3c8', al);
          atom(x, y, r * 1.05, '#ff8a80', '#b3261e', al);
        } else {   // carbon dioxide: O = C = O in a line
          atom(x - cx * r * 1.75, y - sy * r * 1.75, r * 1.05, '#ff8a80', '#b3261e', al);
          atom(x + cx * r * 1.75, y + sy * r * 1.75, r * 1.05, '#ff8a80', '#b3261e', al);
          atom(x, y, r * 0.95, '#8d99a6', '#1d232b', al);
        }
      });
      airCtx.globalAlpha = 1;
    }

    // z runs from -1 (black) to N-1 (the air); the title appears after that
    var z = -1, playing = false, last = 0, held = 0, ended = false, lastStep = -2, subI = -1;
    function ease(u) { return u - Math.sin(u * 6.2832) / 6.2832 * 0.55; } // lingers at each picture
    function render(zz) {
      var gz = OUT ? (zz < 0 ? N - 1 : (N - 1) - zz) : zz;
      var i = Math.floor(gz), t = gz - i;
      if (gz < 0) { i = 0; t = 0; }
      if (i >= N - 1) { i = N - 1; t = 0; }
      // captions follow the playing order
      var iL = Math.floor(zz), tL = zz - iL;
      if (zz < 0) { iL = 0; tL = 0; }
      if (iL >= N - 1) { iL = N - 1; tL = 0; }
      for (var k = 0; k < N; k++) {
        var e = els[k];
        if (k !== i && k !== i + 1) { if (e.style.opacity !== '0') e.style.opacity = '0'; continue; }
        var f = G[k], b = base[k];
        var s, cx, cy, op = 1;
        if (k === i) {
          var tz = zz < 0 ? 0 : t;
          s = Math.pow(R, tz);
          var p = smooth(0, 1, tz);
          cx = lerp(0.5, f.fx, p); cy = lerp(0.5, f.fy, p);
          if (zz < 0) { s = lerp(0.82, 1, smooth(-1, 0, zz)); op = smooth(-1, -0.45, zz); }
          var left = Sw / 2 - cx * b.w * s, top = Sh / 2 - cy * b.h * s;
          e.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
          e.style.opacity = String(op);
          e.style.zIndex = '1';
          e.classList.remove('nc-feather');
          e.style.webkitMaskImage = e.style.maskImage = '';
          e._P = { x: Sw / 2 + (f.fx - cx) * b.w * s, y: Sh / 2 + (f.fy - cy) * b.h * s, s: s };
        } else {
          var P = els[i]._P; if (!P) continue;
          var s2 = P.s / R, l2 = P.x - 0.5 * b.w * s2, t2 = P.y - 0.5 * b.h * s2;
          e.style.transform = 'translate3d(' + l2.toFixed(1) + 'px,' + t2.toFixed(1) + 'px,0) scale(' + s2.toFixed(4) + ')';
          e.style.opacity = String(smooth(0.35, 0.8, t));
          e.style.zIndex = '2';
          // a soft rectangular edge that shrinks to nothing by the time this picture fills the screen
          var fe = (lerp(26, 0, smooth(0.8, 1, t))).toFixed(1);
          var g1 = 'linear-gradient(to right, transparent 0%, #000 ' + fe + '%, #000 ' + (100 - fe) + '%, transparent 100%)';
          var g2 = 'linear-gradient(to bottom, transparent 0%, #000 ' + fe + '%, #000 ' + (100 - fe) + '%, transparent 100%)';
          e.style.webkitMaskImage = e.style.maskImage = g1 + ',' + g2;
          e.style.webkitMaskComposite = 'source-in'; e.style.maskComposite = 'intersect';
        }
      }
      // captions belong to the picture in front
      var front = zz < 0 ? 0 : (tL > 0.9 && iL < N - 1 ? iL + 1 : iL);
      var cOp;
      if (zz < 0) cOp = smooth(-0.45, 0, zz);
      else if (iL >= N - 1) cOp = 1;
      else if (tL < 0.62) cOp = 1;
      else if (tL < 0.9) cOp = 1 - smooth(0.62, 0.8, tL);
      else cOp = smooth(0.9, 1, tL);
      if (cap._i !== front) { cap._i = front; capT.textContent = F[front].label; capS.textContent = F[front].scale; for (var q = 0; q < ticks.length; q++) ticks[q].classList.toggle('on', q <= front); }
      cap.style.opacity = String(ended ? 0 : cOp);
      var subOp = zz < -0.2 ? 0 : (iL >= N - 1 ? 1 : (tL < 0.7 ? 1 : 1 - smooth(0.7, 0.86, tL)));
      if (tL > 0.92 && iL < N - 1) subOp = 0;
      var sI = (tL > 0.92 && iL < N - 1) ? -1 : (zz < -0.2 ? -1 : iL);
      if (sI !== subI) { subI = sI; sub.textContent = sI < 0 ? '' : F[sI].line; }
      sub.style.opacity = String(ended ? 0 : subOp);
      if (iL !== lastStep && zz >= 0 && tL > 0.35 && iL < N - 1) { lastStep = iL; Snd.whoosh(); }
    }

    var rafId = 0;
    function tick(now) {
      rafId = requestAnimationFrame(tick);
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now;
      // the air keeps drifting even when the film is finished
      if (els[N - 1].style.opacity !== '0' || ended) drawAir(dt * 4);
      if (!playing) return;
      // wait for the next picture to load before zooming into it
      var nextI = Math.min(N - 1, Math.floor(z) + 1), ne = els[OUT ? N - 1 - nextI : nextI];
      if (ne.tagName === 'IMG' && !ne.complete && z - Math.floor(z) > 0.3) { return; }
      var fr = frontAt(z);
      if (fr !== lastFront) { lastFront = fr; if (voiceOn && F[fr].clip) Voice.play(F[fr].clip); }
      if (z < 0) z = Math.min(0, z + dt / PRE);
      else if (z < TITLE_AT) {
        var u = (z - Math.floor(z)) ; // position within the step
        var raw = (Math.floor(z) + invEase(u)) + dt / stepFor(Math.floor(z));
        z = Math.min(TITLE_AT, Math.floor(raw) + ease(raw - Math.floor(raw)));
      } else {
        held += dt;
        var holdFor = Math.max(1.6, ((F[N - 1].dur || 0) + 0.8) - (stepFor(N - 2) * 0.1));
        if (held > holdFor && !ended) { finish(); if (voiceOn && O.titleClip) setTimeout(function () { if (ended) Voice.play(O.titleClip); }, 700); }
      }
      render(z);
    }
    // ease() is monotonic; invert it numerically so pause/resume keeps its place
    function invEase(y) { var lo = 0, hi = 1; for (var k = 0; k < 18; k++) { var m = (lo + hi) / 2; if (ease(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; }

    function finish() {
      ended = true; playing = false; wrap.classList.add('nc-op-end'); wrap.classList.remove('nc-op-poster'); startB.hidden = true;
      z = N - 1; render(z);
      Snd.chime();
      store.seen = 1; save();
      pp.hidden = true; skip.hidden = true;
    }
    function play(fromStart) {
      if (fromStart) { z = -1; held = 0; ended = false; lastStep = -2; lastFront = -1; wrap.classList.remove('nc-op-end'); }
      startB.hidden = true; pp.hidden = false; skip.hidden = false; wrap.classList.remove('nc-op-poster');
      playing = true; last = 0; wrap.classList.add('nc-op-playing'); wrap.classList.remove('nc-op-paused');
      pp.textContent = '❚❚'; pp.setAttribute('aria-label', 'Pause');
      if (!rafId) rafId = requestAnimationFrame(tick);
    }
    function pause() {
      playing = false; wrap.classList.add('nc-op-paused'); Voice.stop(); lastFront = -1;
      pp.textContent = '▶'; pp.setAttribute('aria-label', 'Play');
    }
    pp.addEventListener('click', function () { playing ? pause() : play(false); });
    skip.addEventListener('click', function () { Voice.stop(); finish(); });
    function soundUI() {
      snd.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
      snd.innerHTML = (voiceOn ? '🔊' : '🔈') + '<span>' + (voiceOn ? 'Sound on' : 'Sound off') + '</span>';
    }
    function begin() { if (voiceOn) Snd.set(true); soundUI(); if (RM) return stillsStart(); play(true); }
    wrap.querySelector('.nc-op-again').addEventListener('click', begin);
    startB.addEventListener('click', begin);
    snd.addEventListener('click', function () {
      var v = !voiceOn; voiceOn = v; Snd.set(v); if (!v) Voice.stop();
      snd.setAttribute('aria-pressed', v ? 'true' : 'false');
      snd.innerHTML = (v ? '🔊' : '🔈') + '<span>' + (v ? 'Sound on' : 'Sound') + '</span>';
      snd.setAttribute('aria-label', v ? 'Turn sound off' : 'Turn sound on');
    });
    crB.addEventListener('click', function () {
      var open = crBox.hidden; crBox.hidden = !open; crB.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) pause(); });

    // reduced motion: no zooming. The pictures appear one at a time, at the student's pace.
    var stillI = -1;
    function stillsStart() {
      ended = false; wrap.classList.remove('nc-op-end'); wrap.classList.add('nc-op-stills');
      startB.hidden = true; stillI = -1; stillsNext();
    }
    function stillsNext() {
      stillI++;
      if (stillI >= N) { wrap.classList.remove('nc-op-stills'); finish(); return; }
      z = stillI; render(z); if (voiceOn && F[stillI].clip) Voice.play(F[stillI].clip);
    }
    stage.addEventListener('click', function (e) {
      if (wrap.classList.contains('nc-op-stills') && !e.target.closest('button')) stillsNext();
    });
    var nextStill = mk('button', 'nc-op-b nc-op-next', 'Next picture →'); nextStill.type = 'button';
    nextStill.addEventListener('click', function (e) { e.stopPropagation(); stillsNext(); });
    wrap.querySelector('.nc-op-ctl').insertBefore(nextStill, skip);

    // only on the first tab (the banner rule)
    var origSwitch = window.switchTab;
    if (typeof origSwitch === 'function') {
      window.switchTab = function (id) {
        origSwitch.apply(this, arguments);
        var first = id === 'vocab';
        wrap.hidden = !first;
        if (!first && playing) pause();
      };
    }

    window.addEventListener('resize', function () { layout(); });
    layout();
    rafId = requestAnimationFrame(tick);

    if (RM) { ended = true; wrap.classList.add('nc-op-end'); z = N - 1; render(z); pp.hidden = true; skip.hidden = true; startB.hidden = false; return; }
    if (store.seen) { finish(); soundUI(); }
    else { z = 0; render(0); pp.hidden = true; skip.hidden = true; startB.hidden = false; wrap.classList.add('nc-op-poster'); soundUI(); }
    window.__ncOpener = { play: play, pause: pause, finish: finish, seek: function (v) { z = v; render(z); }, state: function () { return { z: z, playing: playing, ended: ended }; } };
  }

  /* ───────────── Shared helpers ───────────── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function words(s) { return (String(s).trim().match(/[A-Za-z0-9'’]+/g) || []).length; }
  function hide(el) { if (el) el.classList.add('nc-hide'); }
  function job(list) { return '<ol class="nc-job">' + list.map(function (j) { return '<li>' + esc(j) + '</li>'; }).join('') + '</ol>'; }
  function gameHead(kicker, title) { return '<div class="nc-g-k">' + esc(kicker) + '</div><h4 class="nc-g-t">' + esc(title) + '</h4>'; }
  function after(ref, el) { ref.parentNode.insertBefore(el, ref.nextSibling); return el; }
  function before(ref, el) { ref.parentNode.insertBefore(el, ref); return el; }
  function textEl(root, needle) {
    var all = $$('p, div', root).filter(function (e) { return e.children.length < 6 && e.textContent.indexOf(needle) > -1; });
    all.sort(function (a, b) { return a.textContent.length - b.textContent.length; });
    return all[0] || null;
  }
  function refresh() { if (typeof window.refreshGathered === 'function') { try { window.refreshGathered(); } catch (e) {} } }

  // a short success sound (only after a tap, never on load)
  var pctx = null;
  function ping(bad) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      pctx = pctx || new AC();
      var t = pctx.currentTime, notes = bad ? [220, 196] : [784, 1175];
      notes.forEach(function (f, i) {
        var o = pctx.createOscillator(), g = pctx.createGain(); o.type = bad ? 'triangle' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(bad ? 0.06 : 0.12, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.45);
        o.connect(g); g.connect(pctx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.5);
      });
    } catch (e) {}
  }

  // notes that stay until the student closes them (at most 3)
  var noteBox = null;
  function note(html) {
    if (!noteBox) { noteBox = mk('div', 'nc-notes'); noteBox.setAttribute('aria-live', 'polite'); document.body.appendChild(noteBox); }
    var n = mk('div', 'nc-note', '<div>' + html + '</div><button type="button" aria-label="Close">✕</button>');
    n.querySelector('button').addEventListener('click', function () { n.remove(); });
    noteBox.appendChild(n);
    while (noteBox.children.length > 3) noteBox.firstChild.remove();
    return n;
  }

  /* ───────────── The Keeper: a clip card with Spotlight ───────────── */
  var KEEPER_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#18295a"/><path d="M14 27v-3a10 10 0 0 1 20 0v3" fill="none" stroke="#cfe8ff" stroke-width="2.6" stroke-linecap="round"/><rect x="11.5" y="26" width="6" height="9" rx="2.5" fill="#7fe0a8"/><rect x="30.5" y="26" width="6" height="9" rx="2.5" fill="#7fe0a8"/></svg>';
  function keeperCard(key) {
    var K = D.keeper && D.keeper.clips && D.keeper.clips[key];
    if (!K) return null;
    var c = mk('div', 'nc-k');
    c.innerHTML = '<div class="nc-k-face">' + KEEPER_SVG + '</div>' +
      '<div class="nc-k-body"><div class="nc-k-name">' + esc(D.keeper.name) + (D.keeper.role ? ' <span>' + esc(D.keeper.role) + '</span>' : '') + '</div>' +
      '<div class="nc-k-row"><button type="button" class="nc-k-play">▶ Listen</button><button type="button" class="nc-k-read" aria-expanded="false">Read the words</button><span class="nc-k-bar"><i></i></span></div>' +
      '<p class="nc-k-text" hidden>' + esc(K.text) + '</p></div>';
    var play = c.querySelector('.nc-k-play'), read = c.querySelector('.nc-k-read'), txt = c.querySelector('.nc-k-text'), bar = c.querySelector('.nc-k-bar i');
    var fired = [];
    function clear() { $$('.nc-cue-now').forEach(function (e) { e.classList.remove('nc-cue-now', 'nc-fx-glow', 'nc-fx-pop', 'nc-fx-wiggle', 'nc-fx-point', 'nc-fx-trace', 'nc-fx-reveal'); }); }
    function cueAt(t, d) {
      var cues = K.cues || [], plain = K.text.replace(/[^A-Za-z0-9' ]/g, ' ');
      cues.forEach(function (q, i) {
        if (fired[i]) return;
        var at = plain.toLowerCase().indexOf(q.at.toLowerCase().replace(/[^a-z0-9' ]/g, ' '));
        if (at < 0) { if (!fired[i]) { fired[i] = 1; window.NC_FAILED.push('cue:' + key + ':' + q.at); } return; }
        var when = (at / plain.length) * (d || K.dur);
        if (t >= when) {
          fired[i] = 1;
          var els = $$(q.sel); if (!els.length) return;
          if (!q.all) els = [els[q.i || 0] || els[0]];
          if (q.scroll !== false && els[0] && i === 0) { try { els[0].scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); } catch (e) {} }
          els.forEach(function (e) {
            e.classList.add('nc-cue-now', 'nc-fx-' + (RM ? 'glow' : (q.fx || 'glow')));
            setTimeout(function () { e.classList.remove('nc-cue-now', 'nc-fx-' + (q.fx || 'glow'), 'nc-fx-glow'); }, 2600);
          });
        }
      });
    }
    function stopUI() { play.textContent = '▶ Listen'; c.classList.remove('nc-k-on'); bar.style.width = '0'; }
    play.addEventListener('click', function () {
      if (Voice.key() === key) { Voice.stop(); return; }
      fired = []; clear();
      play.textContent = '❚❚ Pause'; c.classList.add('nc-k-on');
      Voice.play(key, {
        onTime: function (t, d) { bar.style.width = (d ? (t / d * 100) : 0) + '%'; cueAt(t, d); },
        onEnd: function () { stopUI(); }
      });
      store.heard = store.heard || {}; store.heard[key] = 1; save();
    });
    read.addEventListener('click', function () { txt.hidden = !txt.hidden; read.setAttribute('aria-expanded', String(!txt.hidden)); read.textContent = txt.hidden ? 'Read the words' : 'Hide the words'; });
    return c;
  }
  function putKeeper(key, ref, where) {
    var c = keeperCard(key); if (!c || !ref) return null;
    return where === 'before' ? before(ref, c) : (where === 'prepend' ? ref.insertBefore(c, ref.firstChild) : after(ref, c));
  }

  /* ───────────── The year-long notebook (bound pages across lessons) ───────────── */
  var BOOK = 'oao.nc.g5sci.notebook';
  function book() { try { return JSON.parse(localStorage.getItem(BOOK) || '{}') || {}; } catch (e) { return {}; } }
  // a week can have two lessons on one page: D.part (2 = day 2) keeps day 2's work beside day 1's instead of over it
  function slot(b) { var s = b[D.page] = b[D.page] || {}; s.page = D.page; if (!D.part) return s; return (s['part' + D.part] = s['part' + D.part] || {}); }
  function cabinetCount(bk) {
    var n = 0;
    Object.keys(bk).forEach(function (k) { var p = bk[k] || {}; if (p.cabinet) n++; Object.keys(p).forEach(function (q) { if (/^part\d/.test(q) && p[q] && p[q].cabinet) n++; }); });
    return n;
  }
  function bind(extra) {
    var b = book(); Object.assign(slot(b), { title: D.title, lesson: D.lesson, at: Date.now() }, extra || {});
    try { localStorage.setItem(BOOK, JSON.stringify(b)); } catch (e) {}
    renderRibbon();
  }
  var ribbon = null;
  function renderRibbon() {
    if (!ribbon) return;
    var b = book(), n = Object.keys(b).length, P = D.pages || 30, dots = '';
    for (var i = 1; i <= P; i++) dots += '<i class="' + (b[i] ? 'on' : '') + (i === D.page ? ' me' : '') + '" title="Page ' + i + '"></i>';
    ribbon.innerHTML = '<span class="nc-rb-k">📓 My Notebook Chain</span><span class="nc-rb-dots" aria-hidden="true">' + dots + '</span><span class="nc-rb-n">' + n + ' of ' + P + ' pages</span>';
  }
  function buildRibbon(parent) {
    if (!parent) return;
    ribbon = mk('div', 'nc-ribbon'); parent.appendChild(ribbon); renderRibbon();
  }

  /* ───────────── Lean shape: tabs, cuts, figure ───────────── */
  function buildLean() {
    var T = D.tabs || {};
    (T.hide || []).forEach(function (id) { var b = $('.tab-btn[data-tab="' + id + '"]'); if (b) b.hidden = true; });
    Object.keys(T.labels || {}).forEach(function (id) {
      var b = $('.tab-btn[data-tab="' + id + '"]'); if (!b) return;
      var chk = b.querySelector('.tab-check');
      b.textContent = T.labels[id]; if (chk) b.appendChild(chk);
    });
    var orig = window.switchTab, intro = $('.intro-2col');
    if (typeof orig === 'function') {
      window.switchTab = function (id) {
        id = (T.redirect || {})[id] || id;
        var r = orig.call(this, id);
        if (intro) intro.classList.toggle('nc-hide', id !== 'vocab');
        return r;
      };
    }
    // next buttons: the Lesson goes straight to Self-Check
    $$('#tab-lesson .tab-next-btn').forEach(function (b) { b.setAttribute('onclick', "switchTab('quiz')"); b.textContent = 'Continue to 🧠 Self-Check →'; });
    $$('#tab-vocab .tab-next-btn').forEach(function (b) { b.textContent = 'Continue to 📖 The Lesson →'; });
    // the photo at the top of the Lesson
    var FG = D.figure;
    if (FG) {
      var fig = $(FG.sel);
      if (fig) {
        fig.innerHTML = '<div class="lesson-figure-label">' + esc(FG.label) + '</div><img src="' + esc(FG.img) + '" alt="' + esc(FG.alt) + '"><div class="lesson-figure-caption">' + esc(FG.caption) + ' <span class="nc-credit">' + esc(FG.credit) + '</span></div>';
      }
    }
    // the lean cuts in the Lesson (one thinking stop per tab, no extra callouts)
    $$('#tab-lesson .socratic-q').forEach(hide);
    hide($('#tab-lesson .mind-blow')); hide($('#tab-lesson .go-deeper'));
    var rw = textEl($('#tab-lesson'), 'Real-World Connection'); if (rw && rw.tagName === 'P') hide(rw);
    // the Investigate tab's content lives in Part 4 now
    var ex = $('#tab-explore'); if (ex) ex.classList.add('nc-merged');
    // Warm-Up: the "copy this sentence" box gives the answer away before the bets
    var copy = textEl($('#tab-vocab'), 'Copy this sentence');
    if (copy) { var c2 = copy; while (c2.parentNode && !c2.parentNode.classList.contains('card-body') && c2.parentNode.id !== 'tab-vocab') c2 = c2.parentNode; hide(c2); }
    // clean top: everything is answered on the page, details live in the info strip
    hide($('.need-strip')); hide($('.info-strip'));
    if (D.opener) { var bq = $$('.intro-2col .card').filter(function (c) { return /Big Question/i.test(c.textContent); })[0]; if (bq) { hide(bq); var i2 = $('.intro-2col'); if (i2) i2.classList.add('nc-one'); } }
  }

  /* ───────────── Warm-Up: Build the tree (a prediction) ───────────── */
  var PRED_LINE = null; // set by a warm-up module that is not the tree: returns [heading, summary]
  var PRED_COL = { soil: '#8d6e63', water: '#3498db', air: '#a6dcef', sun: '#f5b041' };
  function buildBets() {
    var W = D.warmup; if (!W || !W.predict) return;
    var B = W.predict, pred = $('#pred-1'); if (!pred) throw new Error('pred-1 missing');
    var host = pred.closest('.response-q') || pred.parentNode;
    var card = host.closest('.activity-card') || host.parentNode;
    $$('.callout, .socratic-q', card).forEach(hide);
    // store.tree = the source chosen for each of the 10 pieces, bottom to top
    store.tree = store.tree || [];
    var g = mk('div', 'nc-g nc-pred');
    var pieces = '', cx = 200, cy = 200, R = 182;
    for (var i = 0; i < 10; i++) {
      var a0 = (-90 + i * 36) * Math.PI / 180, a1 = (-90 + (i + 1) * 36) * Math.PI / 180;
      var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      pieces += '<path class="nc-pc" data-i="' + i + '" d="M' + cx + ' ' + cy + ' L' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + R + ' ' + R + ' 0 0 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Z"/>';
    }
    g.innerHTML = '<div class="nc-g-k">Warm-Up game</div><h4 class="nc-g-t nc-pred-title">' + esc(B.title) + '</h4><p class="nc-p">' + esc(B.intro) + '</p>' + job(B.job) +
      '<div class="nc-pred-stage">' +
        '<figure class="nc-pred-fig"><svg class="nc-pred-tree" viewBox="0 0 400 400" role="img" aria-label="A real slice of a tree trunk, cut into 10 equal pieces. Each piece stands for about 16 pounds of the willow.">' +
          '<defs><clipPath id="ncSliceClip"><circle cx="200" cy="200" r="190"/></clipPath><radialGradient id="ncBark" cx="50%" cy="50%" r="50%"><stop offset="0.93" stop-color="#5d4037" stop-opacity="0"/><stop offset="1" stop-color="#3e2723"/></radialGradient></defs>' +
          '<circle cx="200" cy="200" r="196" fill="#4e342e"/>' +
          '<image href="' + esc(B.slice) + '" x="10" y="10" width="380" height="380" clip-path="url(#ncSliceClip)" preserveAspectRatio="xMidYMid slice"/>' +
          '<circle cx="200" cy="200" r="190" fill="url(#ncBark)"/>' +
          pieces +
        '</svg><figcaption class="nc-credit">' + esc(B.sliceCredit) + '</figcaption></figure>' +
        '<div class="nc-pred-side">' +
          '<div class="nc-q" style="margin-top:0">Fill the next piece with…</div>' +
          '<div class="nc-pred-srcs">' + B.sources.map(function (p) {
            return '<button type="button" class="nc-pred-src" data-k="' + p.k + '"><span class="nc-sw" style="background:' + PRED_COL[p.k] + '"></span><span class="nc-bet-ic">' + p.icon + '</span><b>' + esc(p.label) + '</b><span class="nc-pred-n">0 pieces</span></button>';
          }).join('') + '</div>' +
          '<div class="nc-bet-foot"><button type="button" class="nc-pred-undo">↶ Undo</button><button type="button" class="nc-bet-reset">↺ Start over</button><span class="nc-bet-left"></span></div>' +
        '</div>' +
      '</div>' +
      '<div class="nc-bet-seal" hidden>' + esc(B.saved) + '</div>' +
      '<label class="nc-np-l" for="pred-1" style="margin-top:12px">' + esc(B.reasonPrompt) + '</label>';
    before(host, g);
    pred.placeholder = 'I think most of the tree came from ___ because…';
    var left = g.querySelector('.nc-bet-left'), seal = g.querySelector('.nc-bet-seal');
    function counts() { var c = { soil: 0, water: 0, air: 0, sun: 0 }; store.tree.forEach(function (k) { c[k]++; }); store.bets = c; return c; }
    function draw() {
      var c = counts();
      $$('.nc-pc', g).forEach(function (r) {
        var k = store.tree[+r.dataset.i];
        r.setAttribute('fill', k ? PRED_COL[k] : 'rgba(255,255,255,0)'); r.setAttribute('fill-opacity', k ? '0.82' : '0');
        r.setAttribute('stroke', 'rgba(255,255,255,0.9)'); r.setAttribute('stroke-width', '2');
        r.classList.toggle('next', !k && +r.dataset.i === store.tree.length);
      });
      $$('.nc-pred-src', g).forEach(function (b) { var n = c[b.dataset.k]; b.querySelector('.nc-pred-n').textContent = n + (n === 1 ? ' piece' : ' pieces'); });
      var rest = 10 - store.tree.length;
      left.textContent = rest ? rest + ' pieces left' : 'Your tree is built.';
      seal.hidden = !!rest; g.classList.toggle('nc-done', !rest);
      if (!rest && !store.betsDone) { store.betsDone = 1; save(); ping(); bind({ prediction: c }); }
      refresh();
    }
    function add(k) {
      if (store.tree.length >= 10) { ping(true); return; }
      store.tree.push(k); save(); draw();
      var r = $('.nc-pc[data-i="' + (store.tree.length - 1) + '"]', g);
      if (r && !RM) { r.classList.remove('pop'); void r.getBBox(); r.classList.add('pop'); }
    }
    $$('.nc-pred-src', g).forEach(function (b) { b.addEventListener('click', function () { add(b.dataset.k); }); });
    g.querySelector('.nc-pred-undo').addEventListener('click', function () { store.tree.pop(); store.betsDone = 0; save(); draw(); });
    g.querySelector('.nc-bet-reset').addEventListener('click', function () { store.tree = []; store.betsDone = 0; save(); draw(); });
    draw();
    putKeeper('k-warmup', g.querySelector('.nc-job'), 'after');
  }

  /* ───────────── Word Lens ───────────── */
  function buildWordLens() {
    var L = D.wordlens; if (!L) return;
    var grid = $('#tab-vocab .vocab-grid'); if (!grid) return;
    var heard = store.words || {};
    var w = mk('div', 'nc-wl');
    w.innerHTML = '<p class="nc-p">' + esc(L.intro) + '</p>' +
      '<div class="nc-wl-card" aria-live="polite"><div class="nc-wl-lens" aria-hidden="true">🔎</div><div class="nc-wl-word">Pick a word</div><div class="nc-wl-def">Tap a word sticker below.</div></div>' +
      '<div class="nc-wl-stickers">' + L.words.map(function (x, i) { return '<button type="button" class="nc-wl-st" data-i="' + i + '"><span>' + x.icon + '</span>' + esc(x.w) + '</button>'; }).join('') + '</div>' +
      '<div class="nc-wl-dots"></div>';
    grid.parentNode.insertBefore(w, grid); hide(grid);
    var oldP = grid.parentNode.querySelector(':scope > p'); if (oldP && /flip/i.test(oldP.textContent)) hide(oldP);
    putKeeper('k-words', w, 'before');
    var cardW = w.querySelector('.nc-wl-word'), cardD = w.querySelector('.nc-wl-def'), card = w.querySelector('.nc-wl-card'), dots = w.querySelector('.nc-wl-dots');
    function drawDots() {
      var n = 0; dots.innerHTML = L.words.map(function (x, i) { if (heard[i]) n++; return '<i class="' + (heard[i] ? 'on' : '') + '"></i>'; }).join('') + '<span>' + n + ' of ' + L.words.length + ' words</span>';
      $$('.nc-wl-st', w).forEach(function (b) { b.classList.toggle('seen', !!heard[b.dataset.i]); });
    }
    $$('.nc-wl-st', w).forEach(function (b) {
      b.addEventListener('click', function () {
        var x = L.words[+b.dataset.i];
        card.classList.remove('nc-wl-go'); void card.offsetWidth; card.classList.add('nc-wl-go');
        cardW.textContent = x.w; cardD.textContent = x.def;
        heard[b.dataset.i] = 1; store.words = heard; save(); drawDots();
        if (x.clip) Voice.play(x.clip);
        if (Object.keys(heard).length === L.words.length && !store.wordsDone) { store.wordsDone = 1; save(); ping(); note('📚 You heard all six words.'); }
      });
    });
    drawDots();
  }

  /* ───────────── Part 1: the real 1648 page ───────────── */
  function buildSource() {
    var S = D.source; if (!S) return;
    var p1 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 1|Section 1/.test(e.textContent); })[0];
    var body = p1 && p1.closest('.card').querySelector('.card-body'); if (!body) throw new Error('Part 1 card missing');
    var card = mk('div', 'nc-g nc-src');
    var rows = S.lines.map(function (l, i) {
      var top = (l.y[0] / S.h * 100).toFixed(2), hgt = ((l.y[1] - l.y[0]) / S.h * 100).toFixed(2);
      return '<button type="button" class="nc-src-hl" data-i="' + i + '" style="top:' + top + '%;height:' + hgt + '%" aria-label="Line ' + (i + 1) + ': hear it in plain English"><span>' + (i + 1) + '</span></button>';
    }).join('');
    card.innerHTML = gameHead(S.kicker, S.title) + '<p class="nc-p">' + esc(S.intro) + '</p>' + job(S.job) +
      '<div class="nc-src-grid">' +
        '<div class="nc-src-page"><div class="nc-src-paper"><img src="' + esc(S.img) + '" alt="' + esc(S.alt || 'A printed page in Latin from 1648, describing the willow experiment.') + '" width="' + S.w + '" height="' + S.h + '">' + rows + '</div>' +
          '<div class="nc-src-tag">' + esc(S.tag || 'Real source from 1648') + '</div></div>' +
        '<div class="nc-src-side">' +
          '<div class="nc-src-en" aria-live="polite"><div class="nc-src-en-k">Plain English</div><div class="nc-src-en-t">Tap a yellow line on the page.</div></div>' +
          '<div class="nc-src-read"><span class="nc-src-count">0</span> of ' + S.lines.length + ' lines read</div>' +
          '<div class="nc-src-asks"></div>' +
        '</div>' +
      '</div>' +
      '<p class="nc-credit">' + esc(S.credit) + '</p>';
    body.appendChild(card);
    putKeeper('k-part1', card.querySelector('.nc-src-grid'), 'before');
    var en = card.querySelector('.nc-src-en-t'), cnt = card.querySelector('.nc-src-count'), asksBox = card.querySelector('.nc-src-asks');
    var read = store.read || {}, asks = S.asks || []; store.asks = store.asks || {};
    function askI() { var i = 0; while (i < asks.length && store.asks[i]) i++; return i; }
    function renderAsk(msg) {
      var now = askI();
      asksBox.innerHTML = asks.map(function (a, i) {
        if (i > now) return '<div class="nc-ask nc-ask-later">' + esc(a.q) + '</div>';
        var done = store.asks[i];
        return '<div class="nc-ask' + (done ? ' nc-ask-done' : ' nc-ask-now') + '"><div class="nc-ask-q">' + (done ? '✅ ' : '🔎 ') + esc(a.q) + '</div>' +
          '<div class="nc-ask-fb">' + (done ? esc(a.yes) : (msg ? '<span class="nc-ask-no">🤔 ' + esc(msg) + '</span>' : '')) + '</div></div>';
      }).join('');
      if (asks.length) card.classList.toggle('nc-done', now >= asks.length);
    }
    function mark() {
      var n = 0;
      $$('.nc-src-hl', card).forEach(function (b) { var r = !!read[b.dataset.i]; b.classList.toggle('nc-read', r); if (r) n++; });
      cnt.textContent = n;
      if (!asks.length) card.classList.toggle('nc-done', n >= S.lines.length); // no hunts: done when every line is read
    }
    $$('.nc-src-hl', card).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.dataset.i, L = S.lines[i];
        $$('.nc-src-hl', card).forEach(function (x) { x.classList.toggle('nc-now', x === b); });
        en.innerHTML = '<span class="nc-src-ln">Line ' + (i + 1) + '</span> “' + esc(L.en) + '”';
        if (L.clip) Voice.play(L.clip);
        read[i] = 1; store.read = read; save(); mark();
        var a = asks[askI()];
        if (!a) return;
        if (L.tag === a.tag) {
          store.asks[askI()] = 1; save(); ping(); b.classList.add('nc-hit'); setTimeout(function () { b.classList.remove('nc-hit'); }, 900);
          renderAsk();
          if (askI() >= asks.length) note('📜 Part 1 done: you found both lines on the real page.');
        } else renderAsk(a.no);
      });
    });
    mark(); renderAsk();
  }

  /* ───────────── Part 2: Weigh the air ───────────── */
  function buildAir() {
    var A = D.air; if (!A) return;
    var p2 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 2|Section 2/.test(e.textContent); })[0];
    var body = p2 && p2.closest('.card').querySelector('.card-body'); if (!body) throw new Error('Part 2 card missing');
    var g = mk('div', 'nc-g nc-air');
    g.innerHTML = gameHead(A.kicker, A.title) + '<div class="nc-why">' + esc(A.why) + '</div>' + job(A.job) +
      '<div class="nc-air-stage">' +
        '<svg class="nc-air-svg" viewBox="0 0 420 230" role="img" aria-label="A soccer ball on a digital kitchen scale, with a hand pump connected by a hose.">' +
          '<defs>' +
            '<radialGradient id="ncBall" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e9edf2"/><stop offset="1" stop-color="#9aa6b2"/></radialGradient>' +
            '<radialGradient id="ncBallShade" cx="40%" cy="30%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient>' +
            '<linearGradient id="ncSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="0.5" stop-color="#c3cad2"/><stop offset="1" stop-color="#8b96a3"/></linearGradient>' +
            '<linearGradient id="ncBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5a6d"/><stop offset="1" stop-color="#26313e"/></linearGradient>' +
            '<linearGradient id="ncPump" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c0392b"/><stop offset="0.45" stop-color="#ff6f5e"/><stop offset="1" stop-color="#922b21"/></linearGradient>' +
            '<linearGradient id="ncTable" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7b98c"/><stop offset="1" stop-color="#b48a57"/></linearGradient>' +
            '<clipPath id="ncBallClip"><ellipse class="nc-air-clip" cx="205" cy="118" rx="44" ry="36"/></clipPath>' +
          '</defs>' +
          '<rect x="0" y="196" width="420" height="34" fill="url(#ncTable)"/>' +
          '<ellipse cx="205" cy="200" rx="110" ry="7" fill="#000" opacity="0.18"/>' +
          '<rect x="110" y="164" width="190" height="34" rx="9" fill="url(#ncBody)"/>' +
          '<rect x="104" y="152" width="202" height="13" rx="5" fill="url(#ncSteel)" stroke="#7d8894" stroke-width="0.8"/>' +
          '<rect x="146" y="171" width="118" height="22" rx="4" fill="#06140b" stroke="#000" stroke-width="1"/>' +
          '<text class="nc-air-read" x="205" y="188" text-anchor="middle" font-family="\'Courier New\',monospace" font-weight="700" font-size="17" fill="#7dffb0">410.0 g</text>' +
          '<circle cx="282" cy="181" r="5" fill="#9aa6b2"/><text x="282" y="196" text-anchor="middle" font-size="6" fill="#c9d2dc" font-family="Nunito,sans-serif">TARE</text>' +
          '<ellipse cx="205" cy="153" rx="34" ry="5" fill="#000" opacity="0.22"/>' +
          '<g class="nc-air-ball">' +
            '<ellipse class="nc-air-blob" cx="205" cy="118" rx="44" ry="36" fill="url(#ncBall)"/>' +
            '<g clip-path="url(#ncBallClip)" fill="#1f252c">' +
              '<path d="M205 104 l12 9 -5 14 h-14 l-5 -14z"/>' +
              '<path d="M167 104 l10 -4 8 9 -4 12 -12 2 -6 -9z" opacity="0.92"/>' +
              '<path d="M243 104 l-10 -4 -8 9 4 12 12 2 6 -9z" opacity="0.92"/>' +
              '<path d="M188 146 l6 -12 h22 l6 12 -10 8 h-14z" opacity="0.85"/>' +
              '<path d="M195 80 l10 -4 10 4 -2 10 h-16z" opacity="0.85"/>' +
            '</g>' +
            '<g clip-path="url(#ncBallClip)" fill="none" stroke="#9aa6b2" stroke-width="0.9" opacity="0.8"><path d="M217 113 L238 108 M212 127 L222 142 M198 127 L188 142 M193 113 L172 108 M205 104 L205 90"/></g>' +
            '<ellipse class="nc-air-shade" cx="205" cy="118" rx="44" ry="36" fill="url(#ncBallShade)"/>' +
            '<ellipse cx="190" cy="99" rx="13" ry="7" fill="#fff" opacity="0.55" transform="rotate(-25 190 99)"/>' +
          '</g>' +
          '<path d="M247 124 C 290 126, 300 168, 336 166" fill="none" stroke="#1f2a36" stroke-width="4.5" stroke-linecap="round"/>' +
          '<path d="M247 124 C 290 126, 300 168, 336 166" fill="none" stroke="#4a5a6d" stroke-width="2" stroke-linecap="round"/>' +
          '<g class="nc-air-pumpgfx">' +
            '<rect x="331" y="186" width="40" height="8" rx="3" fill="#2c3440"/>' +
            '<rect x="338" y="116" width="26" height="72" rx="6" fill="url(#ncPump)"/>' +
            '<rect x="338" y="132" width="26" height="4" fill="#fff" opacity="0.25"/>' +
            '<rect class="nc-air-rod" x="347" y="74" width="8" height="46" rx="2" fill="url(#ncSteel)"/>' +
            '<rect class="nc-air-handle" x="326" y="68" width="50" height="10" rx="5" fill="#1f2a36"/>' +
          '</g>' +
        '</svg>' +
        '<div class="nc-air-side"><button type="button" class="nc-btn nc-air-pump">💨 Pump</button><div class="nc-air-count">0 of ' + A.pumps + ' pumps</div><div class="nc-air-log"></div><button type="button" class="nc-air-reset" hidden>↺ Let the air out and try again</button></div>' +
      '</div>' +
      '<p class="nc-credit">' + esc(A.note) + '</p>' +
      '<div class="nc-air-q" hidden><div class="nc-q">' + esc(A.q) + '</div><div class="nc-opts">' + A.options.map(function (o, i) { return '<button type="button" class="nc-opt" data-i="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div class="nc-fb" aria-live="polite"></div></div>';
    body.appendChild(g);
    putKeeper('k-part2', g.querySelector('.nc-air-stage'), 'before');
    var n = store.pumps || 0, readT = g.querySelector('.nc-air-read'), cnt = g.querySelector('.nc-air-count'), log = g.querySelector('.nc-air-log'), q = g.querySelector('.nc-air-q'), blob = g.querySelector('.nc-air-blob');
    function draw(anim) {
      var grams = (A.start + n * A.per).toFixed(1);
      readT.textContent = grams + ' g';
      cnt.textContent = n + ' of ' + A.pumps + ' pumps';
      var rx = 40 + n * 0.4, ry = 30 + n * 0.6; [blob, g.querySelector('.nc-air-clip'), g.querySelector('.nc-air-shade')].forEach(function (e) { if (e) { e.setAttribute('rx', rx.toFixed(1)); e.setAttribute('ry', ry.toFixed(1)); } });
      log.innerHTML = '<div>Start: <b>' + A.start.toFixed(1) + ' g</b></div>' + (n ? '<div>Now: <b>' + grams + ' g</b></div><div class="nc-air-diff">+' + (n * A.per).toFixed(1) + ' g of air</div>' : '');
      var full = n >= A.pumps, pb = g.querySelector('.nc-air-pump');
      pb.disabled = full; pb.textContent = full ? '💨 Pump (the ball is full)' : '💨 Pump';
      g.querySelector('.nc-air-reset').hidden = !n;
      if (full || store.airDone) q.hidden = false;
      if (anim && !RM) { g.classList.remove('nc-pumping'); void g.offsetWidth; g.classList.add('nc-pumping'); }
    }
    g.querySelector('.nc-air-reset').addEventListener('click', function () { n = 0; store.pumps = 0; save(); draw(false); });
    // the pump drawing works like the button
    var pg = g.querySelector('.nc-air-pumpgfx'); pg.style.cursor = 'pointer'; pg.addEventListener('click', function () { g.querySelector('.nc-air-pump').click(); });
    g.querySelector('.nc-air-pump').addEventListener('click', function () {
      if (n >= A.pumps) return; n++; store.pumps = n; save(); draw(true);
      try { var AC = window.AudioContext || window.webkitAudioContext; pctx = pctx || new AC(); var t = pctx.currentTime, src = pctx.createBufferSource(), len = pctx.sampleRate * 0.25, buf = pctx.createBuffer(1, len, pctx.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); src.buffer = buf; var f = pctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; var gg = pctx.createGain(); gg.gain.value = 0.08; src.connect(f); f.connect(gg); gg.connect(pctx.destination); src.start(t); } catch (e) {}
    });
    var fb = g.querySelector('.nc-fb');
    $$('.nc-opt', g).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = A.options[+b.dataset.i];
        if (o.ok) { b.classList.add('ok'); fb.innerHTML = '✅ ' + esc(A.win); store.airDone = 1; save(); ping(); g.classList.add('nc-done'); }
        else { b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 700); fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(o.hint) + '</span>'; ping(true); }
      });
    });
    draw(false);
    if (store.airDone) { var okb = $$('.nc-opt', g).filter(function (b) { return A.options[+b.dataset.i].ok; })[0]; if (okb) okb.classList.add('ok'); fb.innerHTML = '✅ ' + esc(A.win); g.classList.add('nc-done'); }
  }

  /* ───────────── Part 3: Read the bag ───────────── */
  function buildBag() {
    var B = D.bag; if (!B) return;
    var p3 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 3|Section 3/.test(e.textContent); })[0];
    var body = p3 && p3.closest('.card').querySelector('.card-body'); if (!body) throw new Error('Part 3 card missing');
    var g = mk('div', 'nc-g nc-bag');
    var numsSvg = B.nums.map(function (x, i) { return '<g class="nc-bag-n" data-i="' + i + '" tabindex="0" role="button" aria-label="Number ' + (i + 1) + ' on the label"><rect x="' + (78 + i * 52) + '" y="128" width="44" height="40" rx="8" fill="#fff" stroke="#2e7d32" stroke-width="2.5"/><text x="' + (100 + i * 52) + '" y="157" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="22" fill="#1b5e20">' + x.n + '</text></g>'; }).join('<text x="0" y="0"></text>');
    g.innerHTML = gameHead(B.kicker, B.title) + '<div class="nc-why">' + esc(B.why) + '</div>' + job(B.job) +
      '<div class="nc-bag-stage">' +
        '<svg class="nc-bag-svg" viewBox="0 0 320 320" role="img" aria-label="A fertilizer bag labeled 10-10-10, net weight 20 pounds. An example made for this lesson.">' +
          '<defs><linearGradient id="ncBagG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9dcb8"/><stop offset="0.35" stop-color="#f8efd6"/><stop offset="0.7" stop-color="#efe2bf"/><stop offset="1" stop-color="#d8c79c"/></linearGradient>' +
          '<linearGradient id="ncBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8f46"/><stop offset="1" stop-color="#2e6b33"/></linearGradient>' +
          '<filter id="ncBagSh" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.28"/></filter></defs>' +
          '<g filter="url(#ncBagSh)">' +
          '<path d="M46 34 L274 34 L286 296 Q160 310 34 296 Z" fill="url(#ncBagG)" stroke="#b39b6a" stroke-width="1.5"/>' +
          '<path d="M46 34 L274 34 L276 52 L44 52 Z" fill="#d3c08f"/>' +
          '<path d="M52 43 H268" stroke="#9c8655" stroke-width="1.5" stroke-dasharray="5 4"/>' +
          '<path d="M40 70 L280 70 L282 118 L38 118 Z" fill="url(#ncBand)"/>' +
          '<path d="M60 110 C 90 80 120 80 140 104" fill="none" stroke="#a5d6a7" stroke-width="3" opacity="0.6"/>' +
          '<text x="160" y="100" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="27" fill="#fff" letter-spacing="1">' + esc(B.brand) + '</text>' +
          '<text x="160" y="140" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="13" fill="#5d4037" letter-spacing="1.5">ALL-PURPOSE “PLANT FOOD”</text>' +
          '<rect x="68" y="150" width="184" height="66" rx="10" fill="#fffdf5" stroke="#c9b48a"/>' +
          '<text x="160" y="164" text-anchor="middle" font-family="Nunito,sans-serif" font-size="9" font-weight="800" fill="#8d6e63" letter-spacing="2">GUARANTEED ANALYSIS</text>' +
          B.nums.map(function (x, i) { return '<g class="nc-bag-n" data-i="' + i + '" tabindex="0" role="button" aria-label="Number ' + (i + 1) + ' on the label"><rect x="' + (84 + i * 52) + '" y="170" width="44" height="38" rx="8" fill="#fff" stroke="#2e7d32" stroke-width="2.5"/><text x="' + (106 + i * 52) + '" y="197" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="22" fill="#1b5e20">' + x.n + '</text></g>'; }).join('') +
          '<text x="160" y="232" text-anchor="middle" font-family="Nunito,sans-serif" font-size="11" font-weight="800" fill="#6d4c41" letter-spacing="3">N  ·  P  ·  K</text>' +
          '<text x="160" y="268" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="16" fill="#3e2723">NET WT. ' + B.netLb + ' LB</text>' +
          '<text x="160" y="288" text-anchor="middle" font-family="Nunito,sans-serif" font-size="9.5" fill="#8d6e63">Example label made for this lesson</text>' +
          '</g>' +
        '</svg>' +
        '<div class="nc-bag-side">' +
          '<div class="nc-bag-tips"></div>' +
          '<div class="nc-bag-ask" hidden><div class="nc-q">' + esc(B.ask) + '</div><div class="nc-bag-row"><input class="nc-num" type="number" inputmode="decimal" min="0" step="0.5" aria-label="Pounds of nutrients"> <span>pounds</span> <button type="button" class="nc-btn nc-bag-check">Check</button></div><div class="nc-fb nc-bag-fb" aria-live="polite"></div></div>' +
        '</div>' +
      '</div>' +
      '<p class="nc-credit">' + esc(B.exampleNote) + '</p>' +
      '<div class="nc-bag-cmp" hidden>' +
        '<div class="nc-bal"><div class="nc-bal-l"><b>6 lb</b><span>nutrients in a whole bag</span><i style="height:6px"></i></div><div class="nc-bal-r"><b>164 lb</b><span>new willow (with 0 lb fertilizer)</span><i style="height:120px"></i></div></div>' +
        '<p class="nc-p">' + esc(B.compare) + '</p>' +
        '<div class="nc-q">' + esc(B.stampQ) + '</div><div class="nc-opts">' + B.stamps.map(function (o, i) { return '<button type="button" class="nc-opt nc-stamp" data-i="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div class="nc-fb nc-stamp-fb" aria-live="polite"></div>' +
      '</div>';
    body.appendChild(g);
    putKeeper('k-part3', g.querySelector('.nc-bag-stage'), 'before');
    var seen = store.bagSeen || {}, tips = g.querySelector('.nc-bag-tips'), ask = g.querySelector('.nc-bag-ask'), cmp = g.querySelector('.nc-bag-cmp');
    function drawTips() {
      tips.innerHTML = B.nums.map(function (x, i) { return '<div class="nc-bag-tip' + (seen[i] ? ' on' : '') + '">' + (seen[i] ? '<b>' + x.n + '% ' + esc(x.name) + '</b><br>' + esc(x.tip) : 'Number ' + (i + 1) + ': tap it on the bag') + '</div>'; }).join('');
      $$('.nc-bag-n', g).forEach(function (n) { n.classList.toggle('on', !!seen[n.dataset.i]); });
      if (Object.keys(seen).length >= B.nums.length) ask.hidden = false;
    }
    $$('.nc-bag-n', g).forEach(function (n) {
      function go() { seen[n.dataset.i] = 1; store.bagSeen = seen; save(); drawTips(); }
      n.addEventListener('click', go); n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    var inp = g.querySelector('.nc-num'), fb = g.querySelector('.nc-bag-fb');
    function okNum() { cmp.hidden = false; fb.innerHTML = '✅ Right: about ' + B.answer + ' pounds of the 20 are nutrients. The rest is filler that helps spread it.'; inp.value = B.answer; }
    g.querySelector('.nc-bag-check').addEventListener('click', function () {
      var v = parseFloat(inp.value);
      if (Math.abs(v - B.answer) < 0.01) { store.bagNum = 1; save(); ping(); okNum(); }
      else { fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(B.answerHint) + '</span>'; ping(true); }
    });
    var sfb = g.querySelector('.nc-stamp-fb');
    $$('.nc-stamp', g).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = B.stamps[+b.dataset.i];
        if (o.ok) { b.classList.add('ok', 'nc-stamped'); sfb.innerHTML = '✅ ' + esc(B.win); store.bagDone = 1; save(); ping(); g.classList.add('nc-done'); }
        else { b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 700); sfb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(o.hint) + '</span>'; ping(true); }
      });
    });
    drawTips();
    if (store.bagNum) okNum();
    if (store.bagDone) { var okb = $$('.nc-stamp', g).filter(function (b) { return B.stamps[+b.dataset.i].ok; })[0]; if (okb) okb.classList.add('ok', 'nc-stamped'); sfb.innerHTML = '✅ ' + esc(B.win); g.classList.add('nc-done'); }
  }

  /* ───────────── Part 4: the five-year time-lapse, the prediction check, the wow ───────────── */
  function buildTimelapse() {
    var T = D.timelapse; if (!T) return;
    var anchor = $('#tab-lesson .diagram-wrap') || $('#tab-lesson .key-concept');
    var act = $('#tab-lesson .act-body'); if (!act) throw new Error('lesson body missing');
    var sec = mk('div', 'nc-part4');
    sec.innerHTML = '<div class="card theme-sky nc-p4card"><div class="card-head"><div class="card-head-icon">🔬</div><div><div class="card-head-label">Part 4</div><div class="card-head-title">The Willow Tree Data</div></div></div><div class="card-body"><p>' + esc(T.intro) + '</p><div class="nc-g nc-tl"></div></div></div>';
    act.appendChild(sec);
    var g = sec.querySelector('.nc-tl');
    var P = D.warmup && D.warmup.predict ? D.warmup.predict.sources : [];
    g.innerHTML = gameHead(T.kicker, 'Run the five years') + job(T.job) +
      '<div class="nc-tl-stage">' +
        '<div class="nc-tl-scale nc-tl-tree"><div class="nc-tl-sk">🌳 Tree</div><div class="nc-tl-val">' + esc(T.tree.start) + '</div></div>' +
        '<figure class="nc-tl-svg nc-tl-photo"><img class="nc-tl-a" src="' + esc(T.photos.start) + '" alt="' + esc(T.photos.startAlt) + '"><img class="nc-tl-b" src="' + esc(T.photos.end) + '" alt="' + esc(T.photos.endAlt) + '">' +
          '<div class="nc-tl-year">Year 0</div><div class="nc-tl-air" style="opacity:0"><span>💧 rain</span><span>💨 air</span><span>☀️ light</span></div>' +
          '<figcaption>' + esc(T.photos.caption) + '</figcaption></figure>' +
        '<div class="nc-tl-scale nc-tl-soil"><div class="nc-tl-sk">🪨 Soil (dried)</div><div class="nc-tl-val">' + esc(T.soil.start) + '</div></div>' +
      '</div>' +
      '<label class="nc-tl-sl">Year <input class="nc-tl-slider" type="range" min="0" max="5" step="1" value="0" aria-label="Year, from 0 to 5"> <b class="nc-tl-y">0</b></label>' +
      '<div class="nc-tl-not"><span>💧 Rainwater added: not weighed</span><span>💨 Air around the leaves: not weighed</span><span>🍂 Fallen leaves: not weighed</span></div>' +
      '<p class="nc-tl-note">' + esc(T.note) + '</p>' +
      '<div class="nc-tl-table"><div class="nc-tl-th">What he measured</div><div class="nc-tl-th">Start</div><div class="nc-tl-th">After 5 years</div><div class="nc-tl-th">Change</div>' +
        T.inputs.map(function (x) {
          var row = x.k === 'tree' ? T.tree : T.soil;
          return '<div class="nc-tl-td">' + (x.k === 'tree' ? '🌳 Willow tree' : '🪨 Soil in the pot') + '</div><div class="nc-tl-td">' + esc(row.start) + '</div><div class="nc-tl-td nc-tl-end">?</div>' +
            '<div class="nc-tl-td"><input class="nc-num nc-tl-in" data-k="' + x.k + '" type="number" inputmode="decimal" step="0.5" min="0" aria-label="' + esc(x.label) + ' in ' + esc(x.unit) + '" disabled> <span class="nc-tl-u">' + esc(x.unit) + '</span><div class="nc-tl-fb" data-k="' + x.k + '"></div></div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="nc-btn nc-tl-open" disabled>🌳 Compare my tree with the evidence</button>' +
      '<div class="nc-reveal" hidden><h5>Your prediction vs. the evidence</h5><div class="nc-rv-rows">' + P.map(function (p) {
        return '<div class="nc-rv-row" data-k="' + p.k + '"><div class="nc-rv-lb">' + p.icon + ' ' + esc(p.label) + '</div><div class="nc-rv-bars"><div class="nc-rv-b nc-rv-me"><i></i><span></span></div><div class="nc-rv-b nc-rv-real"><i></i><span></span></div></div><div class="nc-rv-note">' + esc(T.realNotes[p.k] || '') + '</div></div>';
      }).join('') + '</div><div class="nc-rv-key"><span class="me">Your tree</span><span class="real">What the evidence shows</span></div></div>' +
      '<div class="nc-wow" hidden>' +
        '<div class="nc-wow-k">The twist</div>' +
        '<blockquote class="nc-wow-q">“' + esc(T.wow.quote) + ' <span class="nc-wow-strike">' + esc(T.wow.strike) + '</span><span class="nc-wow-add">' + esc(T.wow.add) + '</span>”</blockquote>' +
        '<p class="nc-wow-nums">' + esc(T.wow.line) + '</p>' +
        '<p class="nc-wow-chain">📓 That’s why the Notebook Chain keeps going: the next scientist checks the last one. Next week, a new page.</p>' +
      '</div>';
    putKeeper('k-part4', g.querySelector('.nc-tl-stage'), 'before');
    var sl = g.querySelector('.nc-tl-slider'), yb = g.querySelector('.nc-tl-y'), yt = g.querySelector('.nc-tl-year'), air = g.querySelector('.nc-tl-air'), imB = g.querySelector('.nc-tl-b'), imA = g.querySelector('.nc-tl-a');
    var tv = g.querySelector('.nc-tl-tree .nc-tl-val'), sv = g.querySelector('.nc-tl-soil .nc-tl-val');
    var maxY = store.tlMax || 0;
    function drawY(y) {
      yb.textContent = y; yt.textContent = 'Year ' + y;
      imB.style.opacity = String(y / 5); imA.style.transform = 'scale(' + (1 + y * 0.03) + ')';
      air.style.opacity = y > 0 && y < 5 ? '1' : '0';
      tv.textContent = y === 0 ? T.tree.start : (y === 5 ? T.tree.end : T.between);
      sv.textContent = y === 0 ? T.soil.start : (y === 5 ? T.soil.end : T.between);
      tv.classList.toggle('nc-tl-nw', y > 0 && y < 5); sv.classList.toggle('nc-tl-nw', y > 0 && y < 5);
      if (y > maxY) { maxY = y; store.tlMax = y; save(); }
      if (maxY >= 5) {
        $$('.nc-tl-end', g).forEach(function (e, i) { e.textContent = i === 0 ? T.tree.end : T.soil.end; });
        $$('.nc-tl-in', g).forEach(function (e) { e.disabled = false; });
      }
    }
    sl.addEventListener('input', function () { drawY(+sl.value); });
    var got = store.tlIn || {};
    function checkIns() {
      T.inputs.forEach(function (x) {
        var inp = $('.nc-tl-in[data-k="' + x.k + '"]', g), fb = $('.nc-tl-fb[data-k="' + x.k + '"]', g);
        if (got[x.k]) { inp.value = x.answer; inp.classList.add('ok'); fb.innerHTML = '✅'; return; }
        if (inp.value === '') { fb.innerHTML = ''; return; }
        var v = parseFloat(inp.value);
        if (Math.abs(v - x.answer) <= x.tol) { got[x.k] = 1; store.tlIn = got; save(); ping(); inp.classList.add('ok'); fb.innerHTML = '✅'; }
        else fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(x.hint) + '</span>';
      });
      var all = T.inputs.every(function (x) { return got[x.k]; });
      g.querySelector('.nc-tl-open').disabled = !all;
    }
    $$('.nc-tl-in', g).forEach(function (inp) { inp.addEventListener('change', checkIns); inp.addEventListener('keyup', function (e) { if (e.key === 'Enter') checkIns(); }); });
    var openB = g.querySelector('.nc-tl-open'), rv = g.querySelector('.nc-reveal'), wow = g.querySelector('.nc-wow');
    function reveal(anim) {
      rv.hidden = false; openB.hidden = true;
      var bets = store.bets || {};
      $$('.nc-rv-row', g).forEach(function (r) {
        var k = r.dataset.k, me = bets[k] || 0, real = T.real[k] || 0;
        var mi = r.querySelector('.nc-rv-me i'), ri = r.querySelector('.nc-rv-real i');
        r.querySelector('.nc-rv-me span').textContent = me + (me === 1 ? ' piece' : ' pieces');
        r.querySelector('.nc-rv-real span').textContent = (real ? 'about ' + real : '0') + ' pieces';
        if (anim && !RM) { mi.style.width = '0'; ri.style.width = '0'; setTimeout(function () { mi.style.width = (me * 10) + '%'; ri.style.width = (real * 10) + '%'; }, 60); }
        else { mi.style.width = (me * 10) + '%'; ri.style.width = (real * 10) + '%'; }
      });
      wow.hidden = false;
      if (!wow.querySelector('.nc-k')) putKeeper('k-wow', wow, 'prepend');
      g.classList.add('nc-done');
    }
    openB.addEventListener('click', function () { store.revealed = 1; save(); ping(); reveal(true); bind({ prediction: store.bets, revealed: 1 }); note('🌳 Compared. Read the twist below.'); });
    sl.value = maxY >= 5 ? 5 : 0; drawY(+sl.value); checkIns();
    if (store.revealed) reveal(false);
  }

  /* ───────────── Warm-Up: the soil-cup slider (a prediction on a real photo) ───────────── */
  function cupSVG(full) {
    // a glass measuring cup, filled with soil when "full"
    return '<svg class="nc-cup' + (full ? ' on' : '') + '" viewBox="0 0 40 46" aria-hidden="true">' +
      '<path d="M6 6 h26 l-3 34 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 z" fill="url(#ncCupGlass)" stroke="#8aa0b4" stroke-width="1.4"/>' +
      (full ? '<path d="M7.4 14 h23.2 l-2.4 26 a3 3 0 0 1 -3 3 h-12.4 a3 3 0 0 1 -3 -3 z" fill="url(#ncCupSoil)"/><ellipse cx="19" cy="14.5" rx="11.4" ry="2" fill="#7b5a40"/>' : '') +
      '<path d="M32 12 q7 1 6 9 q-1 7 -8 8" fill="none" stroke="#8aa0b4" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M10 10 v26" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M26 20 h4 M26 27 h3.5 M26 34 h3" stroke="#6d8296" stroke-width="1.2"/></svg>';
  }
  function buildCups() {
    var C = D.cups; if (!C) return;
    var pred = $('#pred-1'); if (!pred) throw new Error('pred-1 missing');
    var host = pred.closest('.response-q') || pred.parentNode;
    var card = host.closest('.activity-card') || host.parentNode;
    $$('.callout, .socratic-q', card).forEach(hide);
    var MAX = C.max || 10;
    var g = mk('div', 'nc-g nc-cups');
    g.innerHTML = '<div class="nc-g-k">Warm-Up game</div><h4 class="nc-g-t nc-cup-title">' + esc(C.title) + '</h4><p class="nc-p">' + esc(C.intro) + '</p>' + job(C.job) +
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
        '<linearGradient id="ncCupGlass" x1="0" x2="1"><stop offset="0" stop-color="#eef6fb" stop-opacity=".9"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#d5e4ee" stop-opacity=".9"/></linearGradient>' +
        '<linearGradient id="ncCupSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6448"/><stop offset="1" stop-color="#4e3626"/></linearGradient></defs></svg>' +
      '<div class="nc-cup-stage">' +
        '<figure class="nc-cup-fig"><img src="' + esc(C.img) + '" alt="' + esc(C.imgAlt) + '"><figcaption class="nc-credit">' + esc(C.credit) + '</figcaption></figure>' +
        '<div class="nc-cup-side">' +
          '<div class="nc-cup-read" aria-live="polite"><b class="nc-cup-n">0</b><span class="nc-cup-u">cups of soil</span></div>' +
          '<div class="nc-cup-row"></div>' +
          '<div class="nc-cup-ctl"><button type="button" class="nc-cup-b nc-cup-minus" aria-label="One cup fewer">−</button>' +
            '<input class="nc-cup-sl" type="range" min="0" max="' + MAX + '" step="1" value="0" aria-label="Cups of soil the lettuce used up, from 0 to ' + MAX + '">' +
            '<button type="button" class="nc-cup-b nc-cup-plus" aria-label="One cup more">+</button></div>' +
          '<div class="nc-cup-scale"><span>0</span><span>' + MAX + ' cups</span></div>' +
          '<button type="button" class="nc-btn nc-cup-save">🔒 Save my prediction</button>' +
          '<button type="button" class="nc-cup-edit" hidden>✎ Change my prediction</button>' +
        '</div>' +
      '</div>' +
      '<div class="nc-bet-seal nc-cup-seal" hidden></div>' +
      '<label class="nc-np-l" for="pred-1" style="margin-top:12px">' + esc(C.reasonPrompt) + '</label>';
    before(host, g);
    pred.placeholder = C.placeholder || 'I think the lettuce used up ___ cups of soil because…';
    var sl = g.querySelector('.nc-cup-sl'), nEl = g.querySelector('.nc-cup-n'), row = g.querySelector('.nc-cup-row'), saveB = g.querySelector('.nc-cup-save'), editB = g.querySelector('.nc-cup-edit'), seal = g.querySelector('.nc-cup-seal');
    store.cups = store.cups == null ? null : store.cups;
    var cur = store.cups == null ? 0 : store.cups;
    PRED_LINE = function () { return ['--- WARM-UP: MY PREDICTION ---', 'Cups of soil I predicted the lettuce used up: ' + (store.cups == null ? '(not saved yet)' : store.cups)]; };
    function draw() {
      sl.value = cur; nEl.textContent = cur;
      g.querySelector('.nc-cup-u').textContent = cur === 1 ? 'cup of soil' : 'cups of soil';
      var h = ''; for (var i = 0; i < MAX; i++) h += cupSVG(i < cur); row.innerHTML = h;
      var saved = store.cups != null, locked = !!store.cupsRevealed;
      [sl, g.querySelector('.nc-cup-minus'), g.querySelector('.nc-cup-plus')].forEach(function (e) { e.disabled = saved; });
      saveB.hidden = saved; editB.hidden = !saved || locked;
      seal.hidden = !saved;
      seal.textContent = !saved ? '' : (locked ? (C.lockedNote || '') .replace('{n}', store.cups) : C.saved.replace('{n}', store.cups));
      g.classList.toggle('nc-done', saved);
      refresh();
    }
    function set(v) { if (store.cups != null) return; cur = clamp(v, 0, MAX); draw(); }
    sl.addEventListener('input', function () { set(+sl.value); });
    g.querySelector('.nc-cup-minus').addEventListener('click', function () { set(cur - 1); });
    g.querySelector('.nc-cup-plus').addEventListener('click', function () { set(cur + 1); });
    saveB.addEventListener('click', function () { store.cups = cur; save(); ping(); bind({ prediction: { cups: cur } }); draw(); });
    editB.addEventListener('click', function () { if (store.cupsRevealed) return; store.cups = null; save(); draw(); });
    document.addEventListener('nc:cups', draw);
    draw();
    putKeeper('k-warmup', g.querySelector('.nc-job'), 'after');
  }

  /* ───────────── Part 1 game: sort the scientist's sentences (claim / evidence), then pick the reasoning ───────────── */
  function buildSort() {
    var S = D.sort; if (!S) return;
    var src = $('.nc-src'), body = src ? src.parentNode : null;
    if (!body) { var p1 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 1|Section 1/.test(e.textContent); })[0]; body = p1 && p1.closest('.card').querySelector('.card-body'); }
    if (!body) throw new Error('Part 1 card missing');
    var g = mk('div', 'nc-g nc-sort');
    g.innerHTML = gameHead(S.kicker, S.title) + '<p class="nc-p">' + esc(S.intro) + '</p>' + job(S.job) +
      '<div class="nc-sort-pile" aria-label="Sentences to sort"></div>' +
      '<div class="nc-sort-bins">' + S.bins.map(function (b) {
        return '<div class="nc-sort-bin" data-k="' + b.k + '" role="button" tabindex="0" aria-label="Put the chosen sentence in ' + esc(b.label) + '"><div class="nc-sort-bh"><b>' + esc(b.label) + '</b><span>' + esc(b.sub) + '</span></div><div class="nc-sort-in"></div></div>';
      }).join('') + '</div>' +
      '<div class="nc-fb nc-sort-fb" aria-live="polite"></div>' +
      '<div class="nc-sort-reason" hidden><div class="nc-q">' + esc(S.reason.q) + '</div><div class="nc-opts">' + S.reason.opts.map(function (o, i) { return '<button type="button" class="nc-opt" data-i="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div class="nc-fb nc-sort-rfb" aria-live="polite"></div></div>' +
      '<button type="button" class="nc-cup-edit nc-sort-again" hidden>↺ Sort them again</button>';
    after(src || body.lastChild, g);
    var pile = g.querySelector('.nc-sort-pile'), fb = g.querySelector('.nc-sort-fb'), rs = g.querySelector('.nc-sort-reason'), rfb = g.querySelector('.nc-sort-rfb');
    store.sort = store.sort || {}; var placed = store.sort.placed || (store.sort.placed = {});
    var sel = null;
    function cardEl(i) {
      var c = S.cards[i], e = mk('button', 'nc-sort-c', '<span class="nc-sort-ln">Line ' + c.line + '</span>' + esc(c.t));
      e.type = 'button'; e.dataset.i = i; return e;
    }
    function draw() {
      pile.innerHTML = ''; $$('.nc-sort-in', g).forEach(function (b) { b.innerHTML = ''; });
      S.cards.forEach(function (c, i) {
        var e = cardEl(i);
        if (placed[i]) { e.classList.add('nc-sort-placed'); e.disabled = true; g.querySelector('.nc-sort-bin[data-k="' + c.k + '"] .nc-sort-in').appendChild(e); }
        else { if (sel === i) e.classList.add('sel'); pile.appendChild(e); wire(e); }
      });
      var left = S.cards.filter(function (c, i) { return !placed[i]; }).length;
      if (!left) { pile.innerHTML = '<div class="nc-sort-empty">' + esc(S.sortedNote) + '</div>'; rs.hidden = false; }
      else rs.hidden = true;
      g.querySelector('.nc-sort-again').hidden = !store.sort.done;
      g.classList.toggle('nc-done', !!store.sort.done);
      if (store.sort.done) { var ok = $$('.nc-opt', rs).filter(function (b) { return S.reason.opts[+b.dataset.i].ok; })[0]; if (ok) ok.classList.add('ok'); rfb.innerHTML = '✅ ' + esc(S.reason.win); }
    }
    function drop(i, k) {
      var c = S.cards[i];
      if (c.k === k) { placed[i] = k; save(); ping(); fb.innerHTML = '✅ ' + esc(c.yes); sel = null; draw(); }
      else {
        ping(true); fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(S.no[k] || 'Read the line again.') + '</span>';
        var e = $('.nc-sort-c[data-i="' + i + '"]', pile); if (e && !RM) { e.classList.remove('no'); void e.offsetWidth; e.classList.add('no'); }
      }
    }
    // tap a sentence, then tap a box; or drag the sentence onto a box
    function wire(e) {
      var i = +e.dataset.i, sx = 0, sy = 0, ghost = null, moved = false;
      e.addEventListener('click', function () { if (moved) { moved = false; return; } sel = sel === i ? null : i; draw(); if (sel != null) fb.textContent = 'Now tap Claim or Evidence.'; });
      e.addEventListener('pointerdown', function (ev) { if (ev.button) return; sx = ev.clientX; sy = ev.clientY; moved = false; e.setPointerCapture(ev.pointerId); });
      e.addEventListener('pointermove', function (ev) {
        if (!e.hasPointerCapture(ev.pointerId)) return;
        if (!ghost && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) { ghost = e.cloneNode(true); ghost.className = 'nc-sort-c nc-sort-ghost'; ghost.style.width = e.offsetWidth + 'px'; document.body.appendChild(ghost); moved = true; }
        if (ghost) { ghost.style.left = (ev.clientX - 20) + 'px'; ghost.style.top = (ev.clientY - 16) + 'px'; $$('.nc-sort-bin', g).forEach(function (b) { var r = b.getBoundingClientRect(); b.classList.toggle('over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom); }); }
      });
      e.addEventListener('pointerup', function (ev) {
        if (!ghost) return;
        ghost.remove(); ghost = null;
        var over = $$('.nc-sort-bin', g).filter(function (b) { return b.classList.contains('over'); })[0];
        $$('.nc-sort-bin', g).forEach(function (b) { b.classList.remove('over'); });
        if (over) drop(i, over.dataset.k);
      });
    }
    $$('.nc-sort-bin', g).forEach(function (b) {
      function go() { if (sel == null) { fb.textContent = 'First tap a sentence above.'; return; } drop(sel, b.dataset.k); }
      b.addEventListener('click', go); b.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') go(); });
    });
    $$('.nc-opt', rs).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = S.reason.opts[+b.dataset.i];
        if (o.ok) { b.classList.add('ok'); rfb.innerHTML = '✅ ' + esc(S.reason.win); if (!store.sort.done) { store.sort.done = 1; save(); ping(); note('📜 Part 1 done: claim, evidence, and the reasoning Priestley left out.'); } draw(); }
        else { b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 700); rfb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(o.hint) + '</span>'; ping(true); }
      });
    });
    g.querySelector('.nc-sort-again').addEventListener('click', function () { store.sort = { placed: {} }; placed = store.sort.placed; save(); sel = null; fb.textContent = ''; rfb.textContent = ''; $$('.nc-opt', rs).forEach(function (b) { b.classList.remove('ok'); }); draw(); });
    draw();
  }

  /* ───────────── Part 2 game: run Priestley's jars, day by day ───────────── */
  function buildJars() {
    var J = D.jars; if (!J) return;
    var p2 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 2|Section 2/.test(e.textContent); })[0];
    var body = p2 && p2.closest('.card').querySelector('.card-body'); if (!body) throw new Error('Part 2 card missing');
    var g = mk('div', 'nc-g nc-jar');
    function jarSVG(id, x, label) {
      return '<g class="nc-jar-j nc-jar-' + id + '" transform="translate(' + x + ',0)">' +
        '<rect x="22" y="186" width="96" height="10" rx="3" fill="#6b4f36"/>' +                                     // stand
        '<rect class="nc-jar-wax" x="64" y="146" width="12" height="40" rx="2" fill="url(#ncWax)"/>' +              // candle
        '<line x1="70" y1="146" x2="70" y2="139" stroke="#2b1d12" stroke-width="1.6"/>' +
        '<g class="nc-jar-flame"><path d="M70 112 C 62 126, 63 138, 70 140 C 77 138, 78 126, 70 112 Z" fill="url(#ncFlame)"/><path d="M70 124 C 67 131, 68 137, 70 138 C 72 137, 73 131, 70 124 Z" fill="#fff6c8"/></g>' +
        '<g class="nc-jar-smoke"><path d="M70 136 q-6 -12 0 -22 q6 -10 0 -20" fill="none" stroke="#9aa4ad" stroke-width="2.4" stroke-linecap="round" opacity=".7"/></g>' +
        (id === 'a' ? '<g class="nc-jar-mint">' +
          '<path d="M44 186 C 46 160, 44 132, 48 102" fill="none" stroke="#3f7d3a" stroke-width="3" stroke-linecap="round"/>' +
          ['M48 104 c -14 -6 -18 6 -6 10 z', 'M48 104 c 12 -10 18 2 6 8 z', 'M47 124 c -15 -4 -17 9 -4 10 z', 'M47 124 c 13 -8 18 5 5 9 z', 'M46 146 c -14 -3 -15 10 -3 10 z', 'M46 146 c 13 -6 16 6 4 9 z', 'M45 166 c -12 -2 -12 9 -2 8 z'].map(function (d) { return '<path d="' + d + '" fill="url(#ncMint)" stroke="#2f6a2b" stroke-width=".8"/>'; }).join('') +
          '</g>' : '') +
        '<path d="M14 196 V58 C14 30 126 30 126 58 V196" fill="url(#ncGlass)" stroke="#9fb6c7" stroke-width="2"/>' +        // bell jar
        '<path d="M26 182 V64 C26 46 44 40 54 40" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="4" stroke-linecap="round"/>' +
        '<ellipse cx="70" cy="32" rx="12" ry="5" fill="#cfe0ea" stroke="#9fb6c7"/>' +
        '<text x="70" y="226" text-anchor="middle" font-size="13" font-weight="800" fill="#2B1D12">' + esc(label) + '</text>' +
        '</g>';
    }
    g.innerHTML = gameHead(J.kicker, J.title) + '<div class="nc-why">' + esc(J.why) + '</div>' + job(J.job) +
      '<figure class="nc-jar-plate"><img src="' + esc(J.plate.img) + '" alt="' + esc(J.plate.alt) + '"><figcaption>' + esc(J.plate.caption) + ' <span class="nc-credit">' + esc(J.plate.credit) + '</span></figcaption></figure>' +
      '<div class="nc-jar-stage">' +
        '<div class="nc-jar-date"><span class="nc-jar-day">' + esc(J.dates[0]) + '</span><small>Day <b class="nc-jar-dn">0</b></small></div>' +
        '<svg class="nc-jar-svg" viewBox="0 0 330 236" role="img" aria-label="A model of Priestley\'s two glass jars over water, each with a candle inside. Jar A can hold a sprig of mint.">' +
          '<defs><linearGradient id="ncGlass" x1="0" x2="1"><stop offset="0" stop-color="#e3f1f8" stop-opacity=".55"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#cfe2ee" stop-opacity=".6"/></linearGradient>' +
            '<linearGradient id="ncWax" x1="0" x2="1"><stop offset="0" stop-color="#f6ecd2"/><stop offset=".5" stop-color="#fffaf0"/><stop offset="1" stop-color="#d9c9a3"/></linearGradient>' +
            '<radialGradient id="ncFlame" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fff3a6"/><stop offset=".55" stop-color="#ffb43a"/><stop offset="1" stop-color="#e2541c"/></radialGradient>' +
            '<linearGradient id="ncMint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd06f"/><stop offset="1" stop-color="#3f8f3a"/></linearGradient>' +
            '<linearGradient id="ncTrough" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d9ea"/><stop offset="1" stop-color="#6f9fbd"/></linearGradient></defs>' +
          '<rect x="0" y="190" width="330" height="22" rx="4" fill="url(#ncTrough)"/><rect x="0" y="190" width="330" height="3" fill="#e9f6fc" opacity=".8"/>' +
          jarSVG('a', 14, 'Jar A') + jarSVG('b', 176, 'Jar B') +
        '</svg>' +
        '<div class="nc-jar-model">Model of Priestley\'s jars</div>' +
      '</div>' +
      '<div class="nc-jar-panel" aria-live="polite"></div>';
    body.appendChild(g);
    putKeeper('k-part2', g.querySelector('.nc-jar-stage'), 'before');
    var panel = g.querySelector('.nc-jar-panel'), dayEl = g.querySelector('.nc-jar-day'), dn = g.querySelector('.nc-jar-dn');
    store.jar = store.jar || { step: 0, day: 0, picks: {} };
    var st = store.jar;
    function setScene() {
      g.classList.toggle('nc-jar-mintin', st.step >= 2);
      var a = g.querySelector('.nc-jar-a'), b = g.querySelector('.nc-jar-b');
      // flames: step 0 burning in A only (the first candle); 1 both out; 4 test: A burns, B out
      a.classList.toggle('lit', st.step === 0 || st.step >= 4); a.classList.toggle('out', st.step >= 1 && st.step < 4);
      b.classList.toggle('out', st.step >= 1 && st.step < 4); b.classList.toggle('fail', st.step >= 4);
      b.classList.toggle('hidejar', st.step < 1);
      a.classList.toggle('grow', st.step >= 3);
      dn.textContent = st.day; dayEl.textContent = J.dates[Math.min(st.day, J.dates.length - 1)] || J.dates[0];
    }
    function predBlock(k) {
      var P = J.predict[k], picked = st.picks[k];
      return '<div class="nc-q">' + esc(P.q) + '</div><div class="nc-opts nc-jar-opts" data-k="' + k + '">' + P.opts.map(function (o, i) {
        return '<button type="button" class="nc-opt' + (picked === i ? ' sel' : '') + '" data-i="' + i + '"' + (picked != null ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>';
    }
    function verdict(k) { var P = J.predict[k], p = st.picks[k]; return p == null ? '' : '<p class="nc-jar-you">You predicted: <b>' + esc(P.opts[p]) + '</b> ' + (p === P.ans ? '✅' : '· ' + esc(P.miss)) + '</p>'; }
    function draw() {
      setScene();
      var h = '';
      if (st.step === 0) {
        h = '<p class="nc-p">' + esc(J.text[0]) + '</p><button type="button" class="nc-btn nc-jar-go" data-a="burn">🕯️ Let the candle burn out</button>';
      } else if (st.step === 1) {
        h = '<p class="nc-p">' + esc(J.text[1]) + '</p>' + predBlock('relight') +
          (st.picks.relight != null ? verdict('relight') + '<p class="nc-p">' + esc(J.text[2]) + '</p><button type="button" class="nc-btn nc-jar-go" data-a="mint">🌿 Put the mint in Jar A</button>' : '');
      } else if (st.step === 2) {
        h = '<p class="nc-p">' + esc(J.text[3]) + '</p>' + predBlock('test') +
          (st.picks.test != null ? '<p class="nc-p">' + esc(J.text[4]) + '</p><div class="nc-jar-row"><button type="button" class="nc-btn nc-jar-go" data-a="day">⏩ Wait one day</button><button type="button" class="nc-cup-edit nc-jar-go" data-a="skip">⏭ Skip to day 10</button></div>' : '');
      } else if (st.step === 3) {
        h = '<p class="nc-p">' + esc(J.text[5]) + '</p><button type="button" class="nc-btn nc-jar-go" data-a="test">🕯️ Lower a lit candle into each jar</button>';
      } else {
        h = verdict('test') + '<blockquote class="nc-jar-quote">“' + esc(J.quote) + '” <span>Joseph Priestley, 1772</span></blockquote><p class="nc-p">' + esc(J.win) + '</p>' +
          '<button type="button" class="nc-cup-edit nc-jar-go" data-a="again">↺ Run it again</button>';
      }
      panel.innerHTML = h;
      g.classList.toggle('nc-done', st.step >= 4);
      $$('.nc-jar-go', panel).forEach(function (b) { b.addEventListener('click', function () { act(b.dataset.a); }); });
      $$('.nc-jar-opts .nc-opt', panel).forEach(function (b) {
        b.addEventListener('click', function () { var k = b.parentNode.dataset.k; if (st.picks[k] != null) return; st.picks[k] = +b.dataset.i; save(); ping(); draw(); });
      });
    }
    function act(a) {
      if (a === 'burn') {
        g.querySelector('.nc-jar-a').classList.add('dying'); panel.querySelector('.nc-jar-go').disabled = true; panel.querySelector('.nc-jar-go').textContent = '🕯️ Burning…';
        setTimeout(function () { g.querySelector('.nc-jar-a').classList.remove('dying'); st.step = 1; save(); draw(); }, RM ? 50 : 2600);
      }
      else if (a === 'mint') { st.step = 2; save(); ping(); draw(); }
      else if (a === 'day' || a === 'skip') { st.day = a === 'skip' ? 10 : st.day + 1; if (st.day >= 10) { st.day = 10; st.step = 3; } save(); draw(); }
      else if (a === 'test') { st.step = 4; save(); ping(); draw(); bind({ jars: st.picks }); if (!store.jarNote) { store.jarNote = 1; save(); note('🕯️ The candle burned in Jar A. The mint changed the air.'); } }
      else if (a === 'again') { store.jar = st = { step: 0, day: 0, picks: {} }; save(); draw(); }
    }
    draw();
  }

  /* ───────────── Part 3 game: hear the other side, answer each line with evidence ───────────── */
  function buildOtherSide() {
    var O = D.otherside; if (!O) return;
    var p3 = $$('#tab-lesson .card-head-label').filter(function (e) { return /Part 3|Section 3/.test(e.textContent); })[0];
    var body = p3 && p3.closest('.card').querySelector('.card-body'); if (!body) throw new Error('Part 3 card missing');
    var g = mk('div', 'nc-g nc-os');
    g.innerHTML = gameHead(O.kicker, O.title) + '<div class="nc-why">' + esc(O.why) + '</div>' + job(O.job) +
      '<div class="nc-os-grid"><div class="nc-os-qs"></div><div class="nc-os-cards">' + O.cards.map(function (c, i) {
        return '<button type="button" class="nc-os-c" data-i="' + i + '">' + (c.img ? '<img src="' + esc(c.img) + '" alt="' + esc(c.alt || '') + '">' : '<span class="nc-os-ic" aria-hidden="true">' + c.icon + '</span>') + '<b>' + esc(c.title) + '</b><span>' + esc(c.text) + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="nc-fb nc-os-fb" aria-live="polite"></div>' +
      '<div class="nc-os-reveal" hidden></div>' +
      '<button type="button" class="nc-cup-edit nc-os-again" hidden>↺ Answer them again</button>' +
      (O.credit ? '<p class="nc-credit">' + esc(O.credit) + '</p>' : '');
    body.appendChild(g);
    putKeeper('k-part3', g.querySelector('.nc-os-grid'), 'before');
    var qs = g.querySelector('.nc-os-qs'), fb = g.querySelector('.nc-os-fb'), rv = g.querySelector('.nc-os-reveal');
    store.os = store.os || {}; var got = store.os;
    function now() { var i = 0; while (i < O.quotes.length && got[i]) i++; return i; }
    function draw() {
      var n = now();
      qs.innerHTML = O.quotes.map(function (q, i) {
        var state = got[i] ? 'done' : (i === n ? 'now' : 'later');
        return '<div class="nc-os-q nc-os-' + state + '"><button type="button" class="nc-os-play" data-i="' + i + '" aria-label="Play the quote">▶</button><div><div class="nc-os-qt">“' + esc(q.t) + '”</div>' +
          (got[i] ? '<div class="nc-os-ans">✅ ' + esc(q.yes) + '</div>' : (i === n ? '<div class="nc-os-hint">Tap the evidence card that answers this.</div>' : '')) + '</div></div>';
      }).join('');
      $$('.nc-os-play', qs).forEach(function (b) { b.addEventListener('click', function () { var q = O.quotes[+b.dataset.i]; if (q.clip) Voice.play(q.clip); }); });
      $$('.nc-os-c', g).forEach(function (b) { var c = O.cards[+b.dataset.i]; b.classList.toggle('used', O.quotes.some(function (q, i) { return got[i] && q.ans === c.k; })); });
      var all = n >= O.quotes.length;
      g.classList.toggle('nc-done', all); g.querySelector('.nc-os-again').hidden = !all;
      if (store.cupsRevealed) showCups();
    }
    function showCups() {
      var R = O.cupsReveal; if (!R) return;
      var me = store.cups;
      rv.hidden = false;
      rv.innerHTML = '<div class="nc-os-rk">' + esc(R.kicker) + '</div><div class="nc-os-rrow"><div><small>You predicted</small><b>' + (me == null ? '—' : me + (me === 1 ? ' cup' : ' cups')) + '</b></div><div class="nc-os-real"><small>The evidence</small><b>0 cups</b></div></div><p>' + esc(R.text) + '</p>';
    }
    $$('.nc-os-c', g).forEach(function (b) {
      b.addEventListener('click', function () {
        var n = now(); if (n >= O.quotes.length) return;
        var c = O.cards[+b.dataset.i], q = O.quotes[n];
        if (c.k === q.ans) {
          got[n] = 1; save(); ping(); fb.innerHTML = '';
          if (q.reveal && !store.cupsRevealed) { store.cupsRevealed = 1; save(); document.dispatchEvent(new Event('nc:cups')); }
          if (now() >= O.quotes.length && !store.osNote) { store.osNote = 1; save(); note('⚖️ All three answered with evidence.'); }
          draw();
        } else {
          ping(true); b.classList.remove('no'); void b.offsetWidth; b.classList.add('no');
          fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(c.decoy ? c.hint : O.wrong) + '</span>';
        }
      });
    });
    g.querySelector('.nc-os-again').addEventListener('click', function () { store.os = got = {}; save(); fb.textContent = ''; draw(); });
    draw();
  }

  /* ───────────── Part 4: the last two witnesses (sealed-jar CO₂ meter, the dark box), then prediction vs evidence ───────────── */
  function buildMeter() {
    var M = D.meter; if (!M) return;
    var act = $('#tab-lesson .act-body'); if (!act) throw new Error('lesson body missing');
    var sec = mk('div', 'nc-part4');
    sec.innerHTML = '<div class="card theme-sky nc-p4card"><div class="card-head"><div class="card-head-icon">🔬</div><div><div class="card-head-label">Part 4</div><div class="card-head-title">' + esc(M.cardTitle) + '</div></div></div><div class="card-body"><p>' + esc(M.intro) + '</p><div class="nc-g nc-mt"></div></div></div>';
    act.appendChild(sec);
    var g = sec.querySelector('.nc-mt');
    var J = M.jar, T = M.trays;
    var GW = 560, GH = 170, GL = 42, GR = 10, GT = 10, GB = 26, HMAX = J.hours, CLO = 0, CHI = 450;
    function GX(h) { return GL + h * (GW - GL - GR) / HMAX; }
    function GY(c) { return GT + (CHI - c) * (GH - GT - GB) / (CHI - CLO); }
    var axis = ''; for (var h = 0; h <= HMAX; h++) axis += '<text x="' + GX(h).toFixed(1) + '" y="' + (GH - 8) + '" font-size="10" fill="#7a6a58" text-anchor="middle">' + h + '</text>';
    for (var c = 0; c <= 400; c += 100) axis += '<line x1="' + GL + '" x2="' + (GW - GR) + '" y1="' + GY(c).toFixed(1) + '" y2="' + GY(c).toFixed(1) + '" stroke="#f0e8dc"/><text x="' + (GL - 6) + '" y="' + (GY(c) + 3).toFixed(1) + '" font-size="10" fill="#7a6a58" text-anchor="end">' + c + '</text>';
    g.innerHTML = gameHead(M.kicker, J.title) + job(J.job) +
      '<div class="nc-mt-pred"></div>' +
      '<div class="nc-mt-lab" hidden>' +
        '<div class="nc-mt-rig">' +
          '<svg class="nc-mt-svg" viewBox="0 0 200 200" role="img" aria-label="A model: a potted plant sealed inside a clear jar with a carbon dioxide sensor, under a lamp.">' +
            '<defs><radialGradient id="ncLamp" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/><stop offset="1" stop-color="#fff6c4" stop-opacity="0"/></radialGradient>' +
              '<linearGradient id="ncPot" x1="0" x2="1"><stop offset="0" stop-color="#b5653c"/><stop offset=".5" stop-color="#d98a5c"/><stop offset="1" stop-color="#97502c"/></linearGradient>' +
              '<linearGradient id="ncLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc95f"/><stop offset="1" stop-color="#2f7d34"/></linearGradient></defs>' +
            '<rect class="nc-mt-dark" x="0" y="0" width="200" height="200" rx="12" fill="#1b2433"/>' +
            '<path class="nc-mt-beam" d="M70 22 L130 22 L178 196 L22 196 Z" fill="url(#ncLamp)"/>' +
            '<path d="M76 6 h48 l-8 18 h-32 z" fill="#3d4a5c"/><rect x="96" y="0" width="8" height="8" fill="#2a3442"/>' +
            '<path d="M40 192 V74 C40 50 160 50 160 74 V192 Z" fill="url(#ncGlass)" stroke="#9fb6c7" stroke-width="2"/>' +
            '<rect x="34" y="188" width="132" height="8" rx="3" fill="#7d8a99"/>' +
            '<path d="M80 188 l-6 -34 h52 l-6 34 z" fill="url(#ncPot)"/><rect x="72" y="150" width="56" height="8" rx="2" fill="#a85a33"/><ellipse cx="100" cy="151" rx="26" ry="3" fill="#4e3626"/>' +
            '<path d="M100 150 C 99 132, 101 116, 100 98" stroke="#3f7d3a" stroke-width="3" fill="none"/>' +
            ['M100 104 c -26 -12 -32 10 -6 12 z', 'M100 104 c 24 -16 32 8 6 12 z', 'M100 122 c -28 -6 -28 14 -4 12 z', 'M100 122 c 26 -10 30 10 4 12 z', 'M100 138 c -22 -4 -22 12 -2 10 z', 'M100 138 c 20 -8 24 8 2 10 z'].map(function (d) { return '<path d="' + d + '" fill="url(#ncLeaf)" stroke="#2a6a2c" stroke-width=".8"/>'; }).join('') +
            '<rect x="132" y="160" width="22" height="26" rx="3" fill="#20262e"/><rect x="135" y="164" width="16" height="9" rx="1.5" fill="#7fe0a8"/><circle cx="143" cy="180" r="2.2" fill="#9aa4ad"/>' +
          '</svg>' +
          '<div class="nc-mt-meter"><small>CO₂ sensor</small><b class="nc-mt-ppm">' + J.start + '</b><span>ppm</span><div class="nc-mt-hr">Hour <b>0</b></div></div>' +
        '</div>' +
        '<div class="nc-mt-ctl"><button type="button" class="nc-mt-light" aria-pressed="true">💡 Light is ON</button><button type="button" class="nc-btn nc-mt-run">▶ Run</button><button type="button" class="nc-cup-edit nc-mt-reset">↺ Reset the jar</button></div>' +
        '<svg class="nc-mt-graph" viewBox="0 0 ' + GW + ' ' + GH + '" role="img" aria-label="A graph of the carbon dioxide in the jar, hour by hour.">' + axis +
          '<g class="nc-mt-bands"></g><polyline class="nc-mt-line" fill="none" stroke="#2e86c1" stroke-width="2.6" stroke-linejoin="round" points=""/>' +
          '<text x="' + GL + '" y="9" font-size="9.5" fill="#7a6a58">CO₂ in the jar (ppm)</text><text x="' + (GW - GR) + '" y="' + (GH - 8) + '" font-size="9.5" fill="#7a6a58" text-anchor="end">hours</text></svg>' +
        '<div class="nc-mt-need"></div>' +
        '<p class="nc-mt-note">' + esc(J.note) + '</p>' +
        '<div class="nc-mt-q" hidden><div class="nc-q">' + esc(J.q) + '</div><div class="nc-opts">' + J.opts.map(function (o, i) { return '<button type="button" class="nc-opt" data-i="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div class="nc-fb nc-mt-fb" aria-live="polite"></div></div>' +
      '</div>' +
      '<div class="nc-mt-trays" hidden><h4 class="nc-g-t">' + esc(T.title) + '</h4><p class="nc-p">' + esc(T.intro) + '</p><div class="nc-mt-tpred"></div>' +
        '<div class="nc-mt-box"><button type="button" class="nc-btn nc-mt-open" disabled>📦 Open the dark box</button></div>' +
        '<div class="nc-mt-treveal" hidden><figure class="nc-mt-photo"><img src="' + esc(T.img) + '" alt="' + esc(T.alt) + '"><figcaption>' + esc(T.caption) + ' <span class="nc-credit">' + esc(T.credit) + '</span></figcaption></figure><p class="nc-p nc-mt-tres"></p><p class="nc-mt-light-note">' + esc(T.lightNote) + '</p></div>' +
      '</div>' +
      '<div class="nc-reveal nc-mt-cmp" hidden><h5>' + esc(M.compareTitle) + '</h5><div class="nc-mt-rows"></div></div>' +
      '<div class="nc-wow nc-mt-wow" hidden><div class="nc-wow-k">The twist</div><blockquote class="nc-wow-q">“' + esc(M.twist.quote) + '”</blockquote><p class="nc-wow-nums">' + esc(M.twist.line) + '</p><p class="nc-wow-chain">' + esc(M.twist.chain) + '</p></div>';
    putKeeper('k-part4', g.querySelector('.nc-job'), 'after');
    store.mt = store.mt || {}; var S = store.mt;
    if (!S.pts) S.pts = [[0, J.start, 1]];
    var predBox = g.querySelector('.nc-mt-pred'), lab = g.querySelector('.nc-mt-lab'), lightB = g.querySelector('.nc-mt-light'), runB = g.querySelector('.nc-mt-run');
    var ppm = g.querySelector('.nc-mt-ppm'), hrEl = g.querySelector('.nc-mt-hr b'), line = g.querySelector('.nc-mt-line'), bands = g.querySelector('.nc-mt-bands'), need = g.querySelector('.nc-mt-need');
    var light = S.light == null ? true : !!S.light, timer = null;
    function opts(P, k, cls) {
      var picked = S[k];
      return '<div class="nc-q">' + esc(P.q) + '</div><div class="nc-opts ' + cls + '">' + P.opts.map(function (o, i) { return '<button type="button" class="nc-opt' + (picked === i ? ' sel' : '') + '" data-i="' + i + '"' + (picked != null ? ' disabled' : '') + '>' + esc(o) + '</button>'; }).join('') + '</div>' +
        (picked != null ? '<p class="nc-jar-you">Your prediction is saved: <b>' + esc(P.opts[picked]) + '</b></p>' : '');
    }
    function lightH() { var t = 0; for (var i = 1; i < S.pts.length; i++) if (S.pts[i][2]) t += S.pts[i][0] - S.pts[i - 1][0]; return t; }
    function darkH() { var t = 0; for (var i = 1; i < S.pts.length; i++) if (!S.pts[i][2]) t += S.pts[i][0] - S.pts[i - 1][0]; return t; }
    function drawGraph() {
      var last = S.pts[S.pts.length - 1];
      line.setAttribute('points', S.pts.map(function (p) { return GX(p[0]).toFixed(1) + ',' + GY(p[1]).toFixed(1); }).join(' '));
      var b = ''; for (var i = 1; i < S.pts.length; i++) if (!S.pts[i][2]) b += '<rect x="' + GX(S.pts[i - 1][0]).toFixed(1) + '" y="' + GT + '" width="' + (GX(S.pts[i][0]) - GX(S.pts[i - 1][0])).toFixed(1) + '" height="' + (GH - GT - GB) + '" fill="#1b2433" opacity=".12"/>';
      bands.innerHTML = b;
      ppm.textContent = Math.round(last[1]); hrEl.textContent = last[0].toFixed(1).replace('.0', '');
      lightB.textContent = light ? '💡 Light is ON' : '🌑 Light is OFF'; lightB.setAttribute('aria-pressed', String(light));
      g.querySelector('.nc-mt-rig').classList.toggle('dark', !light);
      var full = last[0] >= HMAX - 1e-6;
      runB.disabled = full; runB.textContent = full ? '▶ Run (the 8 hours are up)' : (timer ? '❚❚ Pause' : '▶ Run');
      var lh = lightH(), dh = darkH(), ready = lh >= J.needLight && dh >= J.needDark;
      need.innerHTML = '<span class="' + (lh >= J.needLight ? 'ok' : '') + '">💡 In the light: ' + lh.toFixed(1).replace('.0', '') + ' of ' + J.needLight + ' hours</span><span class="' + (dh >= J.needDark ? 'ok' : '') + '">🌑 In the dark: ' + dh.toFixed(1).replace('.0', '') + ' of ' + J.needDark + ' hours</span>' +
        (full && !ready ? '<span class="nc-ask-no">Reset the jar and try again: you need time in the light and in the dark.</span>' : '');
      g.querySelector('.nc-mt-q').hidden = !(ready || S.jarDone);
    }
    function step() {
      var last = S.pts[S.pts.length - 1]; if (last[0] >= HMAX) { stop(); return; }
      var dt = 0.25, cN = light ? last[1] - (last[1] - J.floor) * J.k * dt : Math.min(J.start + 40, last[1] + J.rise * dt);
      S.pts.push([+(last[0] + dt).toFixed(2), +cN.toFixed(1), light ? 1 : 0]); save(); drawGraph();
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } drawGraph(); }
    runB.addEventListener('click', function () { if (timer) { stop(); return; } timer = setInterval(step, RM ? 60 : 280); drawGraph(); });
    lightB.addEventListener('click', function () { light = !light; S.light = light; save(); drawGraph(); });
    g.querySelector('.nc-mt-reset').addEventListener('click', function () { stop(); S.pts = [[0, J.start, 1]]; light = true; S.light = true; save(); drawGraph(); });
    var fb = g.querySelector('.nc-mt-fb');
    $$('.nc-mt-q .nc-opt', g).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = J.opts[+b.dataset.i];
        if (o.ok) { b.classList.add('ok'); fb.innerHTML = '✅ ' + esc(J.win); if (!S.jarDone) { S.jarDone = 1; save(); ping(); } drawAll(); }
        else { b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 700); fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(o.hint) + '</span>'; ping(true); }
      });
    });
    var tpred = g.querySelector('.nc-mt-tpred'), openB = g.querySelector('.nc-mt-open');
    openB.addEventListener('click', function () { S.trayOpen = 1; save(); ping(); drawAll(); });
    function drawAll() {
      predBox.innerHTML = opts(J.predict, 'jarPred', 'nc-mt-p1');
      $$('.nc-mt-p1 .nc-opt', predBox).forEach(function (b) { b.addEventListener('click', function () { if (S.jarPred != null) return; S.jarPred = +b.dataset.i; save(); ping(); drawAll(); }); });
      lab.hidden = S.jarPred == null;
      if (S.jarDone) { var ok = $$('.nc-mt-q .nc-opt', g).filter(function (b) { return J.opts[+b.dataset.i].ok; })[0]; if (ok) ok.classList.add('ok'); fb.innerHTML = '✅ ' + esc(J.win); }
      g.querySelector('.nc-mt-trays').hidden = !S.jarDone;
      tpred.innerHTML = opts(T.predict, 'trayPred', 'nc-mt-p2');
      $$('.nc-mt-p2 .nc-opt', tpred).forEach(function (b) { b.addEventListener('click', function () { if (S.trayPred != null) return; S.trayPred = +b.dataset.i; save(); ping(); drawAll(); }); });
      openB.disabled = S.trayPred == null || !!S.trayOpen;
      openB.textContent = S.trayOpen ? '📦 The box is open' : (S.trayPred == null ? '📦 Open the dark box (predict first)' : '📦 Open the dark box');
      var tr = g.querySelector('.nc-mt-treveal'); tr.hidden = !S.trayOpen;
      if (S.trayOpen) g.querySelector('.nc-mt-tres').innerHTML = (S.trayPred === T.predict.ans ? '✅ ' : '') + esc(T.result);
      var cmp = g.querySelector('.nc-mt-cmp'), wow = g.querySelector('.nc-mt-wow');
      var done = S.jarDone && S.trayOpen;
      cmp.hidden = !done; wow.hidden = !done;
      g.classList.toggle('nc-done', !!done);
      if (done) {
        var rows = [
          [M.rows[0], store.cups == null ? '(not saved)' : store.cups + (store.cups === 1 ? ' cup' : ' cups'), M.rows[0 + 3]],
          [M.rows[1], S.jarPred == null ? '—' : J.predict.opts[S.jarPred], M.rows[1 + 3]],
          [M.rows[2], S.trayPred == null ? '—' : T.predict.opts[S.trayPred], M.rows[2 + 3]]
        ];
        g.querySelector('.nc-mt-rows').innerHTML = '<div class="nc-mt-r nc-mt-rh"><span></span><span>You predicted</span><span>The evidence</span></div>' + rows.map(function (r) { return '<div class="nc-mt-r"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span><span class="nc-mt-ev">' + esc(r[2]) + '</span></div>'; }).join('');
        if (!wow.querySelector('.nc-k')) putKeeper('k-wow', wow, 'prepend');
        if (!S.bound) { S.bound = 1; save(); bind({ jar: S.jarPred, trays: S.trayPred, revealed: 1 }); note('🔬 All the witnesses are in. Read the twist below.'); }
      }
      drawGraph();
    }
    drawAll();
  }

  /* ───────────── Assignment: Part B trim, Part C notebook page, CER planner, checklist ───────────── */
  function buildAssignment() {
    var A = D.assignment || {}, tab = $('#tab-assignment'); if (!tab) return;
    putKeeper('k-assign', tab, 'prepend');
    if (A.hidePartA) {
      var pa = textEl(tab, 'Part A'), pa1 = $('#parta-1');
      if (pa && pa.tagName === 'P') { hide(pa); hide(pa.nextElementSibling); }
      if (pa1) { var q = pa1.closest('.response-q'); hide(q && q.previousElementSibling); hide(q); }
    }
    (A.hideQ || []).forEach(function (id) { var t = document.getElementById(id); if (!t) return; var q = t.closest('.response-q'); hide(q && q.previousElementSibling); hide(q); });
    Object.keys(A.renumber || {}).forEach(function (id) { var t = document.getElementById(id); if (!t) return; var q = t.closest('.response-q'); var num = q && q.previousElementSibling && q.previousElementSibling.querySelector('.pq-num'); if (num) num.textContent = A.renumber[id]; });
    (A.hide || []).forEach(function (s) { $$(s, tab).forEach(hide); });
    // Part C label becomes the CER label; the notebook page becomes Part C
    var pc = textEl(tab, 'Part C'); if (pc && pc.tagName === 'P') pc.innerHTML = '✍️ Claim · Evidence · Reasoning';
    var cer = $('.cer-block', tab);
    var N = D.nextPage;
    if (N && cer) {
      var card = mk('div', 'nc-np');
      card.innerHTML = '<div class="nc-np-head"><div class="nc-np-k">📓 The Notebook Chain · Page ' + esc(D.page) + '</div><h3 class="nc-np-t">' + esc(N.title) + '</h3><p>' + esc(N.intro) + '</p></div>' +
        '<div class="nc-np-paper">' + N.boxes.map(function (b) {
          return '<label class="nc-np-q" for="' + b.id + '"><span class="nc-np-l">' + esc(b.label) + '</span><span class="nc-np-p">' + esc(b.prompt) + '</span></label>' +
            '<textarea class="nc-np-a" id="' + b.id + '" data-label="Part C — ' + esc(b.label) + '" data-min="' + (b.min || 0) + '" rows="3" placeholder="Write here…"></textarea>' +
            '<div class="nc-np-c" id="' + b.id + '-c">0 of ' + (b.min || 0) + ' words</div>';
        }).join('') + '</div>' +
        '<div class="nc-chain">' + (D.chain || []).map(function (c) {
          return '<div class="nc-link' + (c.you ? ' nc-link-you' : '') + '"><div class="nc-link-p">Page ' + c.page + '</div><div class="nc-link-w">' + esc(c.who) + '</div><div class="nc-link-q">' + esc(c.what) + '</div>' + (c.you ? '<div class="nc-link-me">your page</div>' : '') + '</div>';
        }).join('<div class="nc-link-ring" aria-hidden="true"></div>') + '</div>';
      var pcHead = pc && pc.tagName === 'P' ? pc : cer;
      before(pcHead, card);
      buildRibbon(card);
      store.np = store.np || {};
      $$('.nc-np-a', card).forEach(function (ta) {
        var min = +ta.dataset.min, c = document.getElementById(ta.id + '-c');
        function upd() { var n = words(ta.value); c.textContent = n + ' of ' + min + ' words' + (n >= min ? ' ✓' : ''); c.classList.toggle('nc-ok', n >= min); }
        ta.value = store.np[ta.id] || ''; upd();
        ta.addEventListener('input', function () { store.np[ta.id] = ta.value; save(); upd(); refresh(); bind({ np: store.np }); });
      });
    }
    // the planner: tap evidence to add it to the Evidence box
    var PL = D.planner, ev = $('#cer-evidence');
    if (PL && ev && cer) {
      var pl = mk('div', 'nc-plan');
      pl.innerHTML = '<div class="nc-plan-k">Plan before you write</div><p class="nc-p">' + esc(PL.intro) + '</p><div class="nc-plan-cards">' + PL.cards.map(function (c, i) { return '<button type="button" class="nc-plan-c" data-i="' + i + '">＋ ' + esc(c) + '</button>'; }).join('') + '</div><p class="nc-plan-tip">Remember C-E-R? Claim = what you think is true. Evidence = facts that prove it. Reasoning = how the facts prove your claim.</p>';
      var head = $('.cer-header', cer); after(head || cer.firstChild, pl);
      $$('.nc-plan-c', pl).forEach(function (b) {
        b.addEventListener('click', function () {
          var t = PL.cards[+b.dataset.i];
          if (ev.value.indexOf(t) > -1) return;
          ev.value = (ev.value.trim() ? ev.value.trim() + ' ' : '') + t; b.classList.add('used');
          ev.dispatchEvent(new Event('input', { bubbles: true })); refresh();
        });
        if (ev.value.indexOf(PL.cards[+b.dataset.i]) > -1) b.classList.add('used');
      });
    }
    // checklist matches the parts that are left
    var CL = D.checklist, list = $('.turn-in-checklist', tab);
    if (CL && list) {
      var first = list.querySelector('.turn-in-item'); var tmpl = first ? first.cloneNode(true) : null;
      if (tmpl) {
        list.innerHTML = '';
        CL.forEach(function (t) {
          var it = tmpl.cloneNode(true); it.classList.remove('checked');
          var spans = it.querySelectorAll('span'); var txt = spans[spans.length - 1];
          if (txt && txt !== it.querySelector('.check-icon')) txt.innerHTML = esc(t); else it.appendChild(mk('span', null, esc(t)));
          var ic = it.querySelector('.check-icon'); if (ic) ic.textContent = '';
          list.appendChild(it);
        });
      }
      var intro = textEl(tab, 'When you\'ve finished all three parts'); if (intro) intro.textContent = 'When you\'ve finished, copy your Gathered Answers into Canvas. Use this checklist to make sure everything is ready.';
    }
    var opts = textEl(tab, 'Photo It'); if (opts) { var grid = opts.closest('[style*="grid"]') || opts.parentNode.parentNode; if (grid && grid.parentNode !== tab) hide(grid); }
    // the journal download sits with Gathered Answers
    var acts = $('.gathered-actions', tab);
    if (acts) { var jb = mk('button', 'gathered-btn nc-journal-btn', '📓 Download my notebook page'); jb.type = 'button'; jb.addEventListener('click', journal); acts.insertBefore(jb, acts.firstChild); }
    // Gathered Answers: what this lean lesson really asks for
    window.refreshGathered = function () {
      var out = document.getElementById('gatheredOutput'); if (!out) return;
      var nm = (document.getElementById('student-name') || {}).value || '';
      var L = ['═══════════════════════════════════════════════', '  OPTIMA ACADEMY ONLINE — 5TH GRADE SCIENCE', '  Lesson ' + D.lesson + ' · ' + D.title, '  The Notebook Chain · Page ' + D.page, '  Student: ' + (nm.trim() || '(add your name above)'), '═══════════════════════════════════════════════', ''];
      function v(id) { var e = document.getElementById(id); return e && e.value.trim() ? e.value.trim() : '(not yet answered)'; }
      // the warm-up module that is on says how to write its prediction (PRED_LINE); 17.01's tree is the default
      var b = store.bets || {};
      var pl = PRED_LINE ? PRED_LINE() : ['--- WARM-UP: MY PREDICTION (10 PIECES OF THE TREE) ---', 'Soil ' + (b.soil || 0) + ' · Water ' + (b.water || 0) + ' · Air ' + (b.air || 0) + ' · Sunlight ' + (b.sun || 0)];
      L.push(pl[0], pl[1], 'My reason: ' + v('pred-1'), '');
      (A.keep || ['partb-2', 'partb-3']).forEach(function (id, k) { L.push('--- PART B — QUESTION ' + (k + 1) + ' ---', v(id), ''); });
      (D.nextPage ? D.nextPage.boxes : []).forEach(function (bx) { L.push('--- PART C — ' + bx.label.toUpperCase() + ' ---', v(bx.id), ''); });
      L.push('--- CLAIM ---', v('cer-claim'), '', '--- EVIDENCE ---', v('cer-evidence'), '', '--- REASONING ---', v('cer-reasoning'), '');
      out.value = L.join('\n');
    };
    refresh();
  }

  /* ───────────── Floating tools: Highlight, Sketch, Snap ───────────── */
  function buildTools() {
    var dock = mk('div', 'nc-dock');
    dock.innerHTML = '<button type="button" class="nc-tool nc-t-hl" aria-pressed="false"><span>🖍</span><b>Highlight</b></button><button type="button" class="nc-tool nc-t-sk"><span>✏️</span><b>Sketch</b></button><button type="button" class="nc-tool nc-t-sn"><span>📷</span><b>Snap</b></button>';
    document.body.appendChild(dock);
    // Highlight: select words, they turn yellow; tap a highlight to remove it
    var hlOn = false, hlNote = null, hlB = dock.querySelector('.nc-t-hl');
    hlB.addEventListener('click', function () {
      hlOn = !hlOn; hlB.setAttribute('aria-pressed', String(hlOn)); document.documentElement.classList.toggle('nc-hl-on', hlOn);
      if (hlNote) { hlNote.remove(); hlNote = null; }
      if (hlOn) {
        hlNote = note(store.hlTip ? '🖍 <b>Highlighter on.</b> Tap 🖍 again to turn it off.' : '🖍 <b>Highlighter on.</b> Drag across words to highlight them. Tap a highlight to remove it. Tap 🖍 again to turn it off.');
        if (!store.hlTip) { store.hlTip = 1; save(); }
      }
    });
    document.addEventListener('mouseup', function () { if (hlOn) setTimeout(markSel, 10); });
    document.addEventListener('touchend', function () { if (hlOn) setTimeout(markSel, 300); });
    function markSel() {
      var sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      var r = sel.getRangeAt(0), anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
      if (!anc.closest || !anc.closest('.tab-panel') || anc.closest('textarea, input, button, .nc-op')) return;
      try { var m = document.createElement('mark'); m.className = 'nc-hl'; r.surroundContents(m); } catch (e) { note('🖍 Highlight a little less at a time (one sentence or part of one).'); }
      sel.removeAllRanges();
    }
    document.addEventListener('click', function (e) { var m = e.target.closest && e.target.closest('mark.nc-hl'); if (m && hlOn) { var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); m.remove(); } });
    // Sketch: a drawing pad that saves into the notebook page
    dock.querySelector('.nc-t-sk').addEventListener('click', function () {
      var ov = mk('div', 'nc-modal');
      ov.innerHTML = '<div class="nc-modal-box" role="dialog" aria-label="Sketch pad"><div class="nc-modal-h"><b>✏️ Sketch pad</b><button type="button" class="nc-x" aria-label="Close">✕</button></div>' +
        '<div class="nc-sk-tools"><button type="button" data-c="#0E1C42" class="on">Pen</button><button type="button" data-c="#2e7d32">Green</button><button type="button" data-c="#2e86c1">Blue</button><button type="button" data-c="#fffef9">Eraser</button><button type="button" class="nc-sk-clear">Clear</button></div>' +
        '<canvas class="nc-sk-c" width="800" height="500"></canvas><div class="nc-modal-f"><span>Ideas: draw your willow with arrows for what goes in.</span><button type="button" class="nc-btn nc-sk-save">Save to my notebook page</button></div></div>';
      document.body.appendChild(ov);
      var cv = ov.querySelector('canvas'), cx = cv.getContext('2d'), col = '#0E1C42', down = false;
      cx.fillStyle = '#fffef9'; cx.fillRect(0, 0, 800, 500); cx.lineCap = 'round'; cx.lineJoin = 'round';
      if (store.sketch) { var im = new Image(); im.onload = function () { cx.drawImage(im, 0, 0); }; im.src = store.sketch; }
      function pt(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * 800 / r.width, (t.clientY - r.top) * 500 / r.height]; }
      function st(e) { e.preventDefault(); down = true; var p = pt(e); cx.beginPath(); cx.moveTo(p[0], p[1]); }
      function mv(e) { if (!down) return; e.preventDefault(); var p = pt(e); cx.strokeStyle = col; cx.lineWidth = col === '#fffef9' ? 22 : 4; cx.lineTo(p[0], p[1]); cx.stroke(); }
      function en() { down = false; }
      cv.addEventListener('mousedown', st); cv.addEventListener('mousemove', mv); window.addEventListener('mouseup', en);
      cv.addEventListener('touchstart', st, { passive: false }); cv.addEventListener('touchmove', mv, { passive: false }); cv.addEventListener('touchend', en);
      $$('.nc-sk-tools [data-c]', ov).forEach(function (b) { b.addEventListener('click', function () { col = b.dataset.c; $$('.nc-sk-tools [data-c]', ov).forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
      ov.querySelector('.nc-sk-clear').addEventListener('click', function () { cx.fillStyle = '#fffef9'; cx.fillRect(0, 0, 800, 500); });
      function close() { ov.remove(); }
      ov.querySelector('.nc-x').addEventListener('click', close);
      ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      ov.querySelector('.nc-sk-save').addEventListener('click', function () { try { store.sketch = cv.toDataURL('image/jpeg', 0.7); save(); note('✏️ Sketch saved. It prints on your notebook page.'); } catch (e) {} close(); });
      ov.querySelector('.nc-x').focus();
    });
    // Snap: drag a box around anything on the page; the snip prints on the notebook page
    var snapB = dock.querySelector('.nc-t-sn');
    snapB.addEventListener('click', function () {
      var hunt = (D.camera && D.camera.missions) || [];
      var ov = mk('div', 'nc-snap');
      ov.innerHTML = '<div class="nc-snap-bar">● CAMERA ON <span>Press, hold and drag a box around what you want.</span><button type="button" class="nc-x">Cancel</button></div>' +
        (hunt.length ? '<div class="nc-snap-hunt"><b>Photo hunt</b>' + hunt.map(function (h, i) { return '<div class="' + ((store.snaps || [])[i] ? 'on' : '') + '">' + ((store.snaps || [])[i] ? '✅ ' : '◻︎ ') + esc(h) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="nc-snap-box" hidden></div>';
      document.body.appendChild(ov);
      var bx = ov.querySelector('.nc-snap-box'), s0 = null;
      ov.querySelector('.nc-x').addEventListener('click', function () { ov.remove(); });
      function xy(e) { var t = e.touches ? e.touches[0] : e; return [t.clientX, t.clientY]; }
      function st(e) { if (e.target.closest('.nc-snap-bar, .nc-snap-hunt')) return; e.preventDefault(); s0 = xy(e); bx.hidden = false; mv(e); }
      function mv(e) { if (!s0) return; e.preventDefault(); var p = xy(e); var l = Math.min(p[0], s0[0]), t = Math.min(p[1], s0[1]); bx.style.cssText = 'left:' + l + 'px;top:' + t + 'px;width:' + Math.abs(p[0] - s0[0]) + 'px;height:' + Math.abs(p[1] - s0[1]) + 'px'; }
      function en(e) {
        if (!s0) return; var r = bx.getBoundingClientRect(); s0 = null;
        if (r.width < 20 || r.height < 20) { bx.hidden = true; return; }
        ov.innerHTML = '<div class="nc-snap-bar">Developing your photo…</div>';
        loadH2C(function (ok) {
          if (!ok) { ov.remove(); note('📷 The camera could not start here.'); return; }
          window.html2canvas(document.body, { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height, scale: 1, useCORS: true, logging: false,
            ignoreElements: function (el) { return el === ov || el.classList && el.classList.contains('nc-dock'); } })
            .then(function (c) {
              store.snaps = store.snaps || []; var url = c.toDataURL('image/jpeg', 0.7);
              var slot = store.snaps.length < 4 ? store.snaps.length : 3; store.snaps[slot] = url; save();
              ov.remove(); ping(); note('📷 Photo saved (' + Math.min(store.snaps.length, 4) + ' of 4). It prints on your notebook page.');
            }).catch(function () { ov.remove(); note('📷 That photo did not develop. Try a smaller box.'); });
        });
      }
      ov.addEventListener('mousedown', st); ov.addEventListener('mousemove', mv); ov.addEventListener('mouseup', en);
      ov.addEventListener('touchstart', st, { passive: false }); ov.addEventListener('touchmove', mv, { passive: false }); ov.addEventListener('touchend', en);
    });
  }
  function loadH2C(cb) {
    if (window.html2canvas) return cb(true);
    var s = document.createElement('script'); s.src = D.h2c; s.onload = function () { cb(!!window.html2canvas); }; s.onerror = function () { cb(false); }; document.head.appendChild(s);
  }

  /* ───────────── The notebook page download (journal) ───────────── */
  function journal() {
    refresh();
    var nm = ((document.getElementById('student-name') || {}).value || '').trim();
    var b = book(); bind({ np: store.np, prediction: store.bets });
    var txt = (document.getElementById('gatheredOutput') || {}).value || '';
    var pics = (store.snaps || []).concat(store.sketch ? [store.sketch] : []);
    var pages = Object.keys(book()).sort(function (a, c) { return a - c; });
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Notebook Chain · Page ' + D.page + '</title><style>' +
      'body{font-family:Georgia,serif;background:#efe7d6;margin:0;padding:24px;color:#2B1D12}.pg{max-width:760px;margin:0 auto;background:#fffef9;padding:36px 40px 40px 70px;box-shadow:0 6px 24px rgba(0,0,0,.15);position:relative;background-image:repeating-linear-gradient(transparent 0,transparent 27px,#dfe9f3 27px,#dfe9f3 28px)}' +
      '.pg:before{content:"";position:absolute;top:0;bottom:0;left:52px;width:2px;background:#f2a7a7}h1{font-size:28px;margin:0 0 4px}h2{font:900 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#7a5a2c;margin:0}pre{white-space:pre-wrap;font:15px/28px Georgia,serif}img{max-width:46%;margin:6px;border:1px solid #ccc}.c{font:12px Arial,sans-serif;color:#7a6a58}.btn{font:800 14px Arial;padding:8px 14px;margin-bottom:14px}@media print{.btn{display:none}body{background:#fff;padding:0}}</style></head><body>' +
      '<button class="btn" onclick="print()">🖨 Print or save as PDF</button><div class="pg"><h2>The Notebook Chain · Page ' + D.page + ' of ' + (D.pages || 30) + '</h2><h1>' + esc(D.title) + '</h1>' +
      '<p class="c">' + esc(nm || 'Name: __________') + ' · Lesson ' + esc(D.lesson) + ' · Pages in my chain so far: ' + pages.join(', ') + '</p><pre>' + esc(txt) + '</pre>' +
      (pics.length ? '<h2>My photos and sketch</h2>' + pics.map(function (p) { return '<img src="' + p + '">'; }).join('') : '') + '</div></body></html>';
    var w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'notebook-chain-page-' + D.page + '.html'; a.click(); }
  }


  /* ───────────── Wonder extras: optional, folded away so the lesson stays lean ───────────── */
  function wonderBox(icon, kicker, title, mins) {
    var d = mk('details', 'nc-wx');
    d.innerHTML = '<summary><span class="nc-wx-ic">' + icon + '</span><span class="nc-wx-tx"><span class="nc-wx-k">' + esc(kicker) + ' · optional' + (mins ? ' · about ' + mins + ' min' : '') + '</span><b>' + esc(title) + '</b></span><span class="nc-wx-arrow">▾</span></summary><div class="nc-wx-body"></div>';
    return d;
  }
  function buildWonder() {
    var Wd = D.wonder; if (!Wd) return;
    // 1. Real footage (Part 2: air is real stuff that moves around the planet)
    if (Wd.footage) {
      var F2 = Wd.footage, host = $(F2.after || '.nc-air');
      if (host) {
        var b1 = wonderBox('🎬', 'Real footage', F2.title, 1);
        b1.querySelector('.nc-wx-body').innerHTML = '<p class="nc-p">' + esc(F2.intro) + '</p>' +
          '<video class="nc-wx-video" controls playsinline muted preload="none" poster="' + esc(F2.poster) + '"><source src="' + esc(F2.src) + '" type="video/mp4"></video>' +
          '<ul class="nc-wx-look">' + F2.look.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="nc-credit">' + esc(F2.credit) + '</p>';
        after(host, b1);
      }
    }
    // 2. Real data (Part 4, after the twist)
    if (Wd.data) {
      var R = Wd.data, h4 = $(R.host || '.nc-tl');
      if (h4) {
        var b2 = wonderBox('📈', 'Real data', R.title, 3);
        // one line (R.values) or several (R.series: [{name, values, color}]) on the same axes
        var SER = R.series || [{ name: '', values: R.values, color: '#2e86c1' }], V = SER[0].values, n = V.length;
        var ALL = [].concat.apply([], SER.map(function (q) { return q.values; }));
        var lo = Math.floor(Math.min.apply(null, ALL) - 1), hi = Math.ceil(Math.max.apply(null, ALL) + 1);
        var W = 600, H = 220, L = 44, Rr = 10, T = 12, B = 30;
        function X(i) { return L + i * (W - L - Rr) / (n - 1); }
        function Y(v) { return T + (hi - v) * (H - T - B) / (hi - lo); }
        function pathOf(vals) { return vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' '); }
        var yrs = '', grid = '';
        for (var yy = 0; yy * 12 < n; yy++) { var xi = X(yy * 12); yrs += '<text x="' + xi.toFixed(1) + '" y="' + (H - 10) + '" font-size="10" fill="#7a6a58" text-anchor="middle">' + (R.start[0] + yy) + '</text>'; grid += '<line x1="' + xi.toFixed(1) + '" y1="' + T + '" x2="' + xi.toFixed(1) + '" y2="' + (H - B) + '" stroke="#efe6d8"/>'; }
        for (var gv = Math.ceil(lo / 5) * 5; gv <= hi; gv += 5) grid += '<line x1="' + L + '" y1="' + Y(gv).toFixed(1) + '" x2="' + (W - Rr) + '" y2="' + Y(gv).toFixed(1) + '" stroke="#f3ece0"/><text x="' + (L - 6) + '" y="' + (Y(gv) + 3).toFixed(1) + '" font-size="10" fill="#7a6a58" text-anchor="end">' + gv + '</text>';
        var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        b2.querySelector('.nc-wx-body').innerHTML = '<p class="nc-p">' + esc(R.intro) + '</p>' + job(R.job) +
          (SER.length > 1 ? '<div class="nc-dt-key">' + SER.map(function (q) { return '<span><i style="background:' + q.color + '"></i>' + esc(q.name) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="nc-dt-read" aria-live="polite">Drag across the graph.</div>' +
          '<svg class="nc-dt" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(R.alt || 'A line graph of carbon dioxide in the air at Mauna Loa from 2016 to 2026. It zigzags every year and climbs over time.') + '">' + grid +
            SER.map(function (q) { return '<path d="' + pathOf(q.values) + '" fill="none" stroke="' + q.color + '" stroke-width="2.4" stroke-linejoin="round" class="nc-dt-line"/>'; }).join('') + yrs +
            '<text x="' + L + '" y="9" font-size="9.5" fill="#7a6a58">CO₂, ' + esc(R.unit) + '</text>' +
            '<line class="nc-dt-cur" x1="0" y1="' + T + '" x2="0" y2="' + (H - B) + '" stroke="#0E1C42" stroke-dasharray="3 3" opacity="0"/>' + SER.map(function (q) { return '<circle class="nc-dt-dot" r="5" fill="' + (SER.length > 1 ? q.color : '#c0392b') + '" stroke="#fff" stroke-width="1.5" opacity="0"/>'; }).join('') +
            '<rect class="nc-dt-hit" x="' + L + '" y="0" width="' + (W - L - Rr) + '" height="' + H + '" fill="transparent"/></svg>' +
          '<div class="nc-q">' + esc(R.ask) + '</div><div class="nc-opts">' + R.opts.map(function (o, i) { return '<button type="button" class="nc-opt" data-i="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div class="nc-fb" aria-live="polite"></div>' +
          '<p class="nc-credit">' + esc(R.credit) + '</p>';
        var wow = $(R.after || '.nc-wow'); after(wow || h4, b2);
        var svg = b2.querySelector('.nc-dt'), cur = b2.querySelector('.nc-dt-cur'), dots = b2.querySelectorAll('.nc-dt-dot'), rd = b2.querySelector('.nc-dt-read');
        function at(e) {
          var r = svg.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, x = (t.clientX - r.left) * W / r.width;
          var i = Math.max(0, Math.min(n - 1, Math.round((x - L) / ((W - L - Rr) / (n - 1)))));
          var m = (R.start[1] - 1 + i) % 12, y = R.start[0] + Math.floor((R.start[1] - 1 + i) / 12);
          cur.setAttribute('x1', X(i)); cur.setAttribute('x2', X(i)); cur.setAttribute('opacity', '1');
          SER.forEach(function (q, k) { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(q.values[i])); dots[k].setAttribute('opacity', '1'); });
          rd.innerHTML = '<b>' + MON[m] + ' ' + y + ':</b> ' + SER.map(function (q) { return (q.name ? esc(q.name) + ' ' : '') + q.values[i].toFixed(1) + ' ppm'; }).join(' · ');
        }
        var hit = b2.querySelector('.nc-dt-hit');
        ['mousemove', 'touchmove', 'touchstart', 'click'].forEach(function (ev) { hit.addEventListener(ev, function (e) { if (ev.indexOf('touch') === 0) e.preventDefault(); at(e); }, { passive: false }); });
        var fb = b2.querySelector('.nc-fb');
        $$('.nc-opt', b2).forEach(function (bt) {
          bt.addEventListener('click', function () {
            var o = R.opts[+bt.dataset.i];
            if (o.ok) { bt.classList.add('ok'); fb.innerHTML = '✅ ' + esc(R.win); store.dataDone = 1; save(); ping(); }
            else { bt.classList.add('no'); setTimeout(function () { bt.classList.remove('no'); }, 700); fb.innerHTML = '<span class="nc-ask-no">🤔 ' + esc(o.hint) + '</span>'; ping(true); }
          });
        });
        if (!RM) b2.addEventListener('toggle', function () { if (b2.open && !b2._drawn) { b2._drawn = 1; $$('.nc-dt-line', b2).forEach(function (ln) { var len = ln.getTotalLength(); ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len; ln.getBoundingClientRect(); ln.style.transition = 'stroke-dashoffset 2.4s ease'; ln.style.strokeDashoffset = '0'; }); } });
      }
    }
    // 3. Wonder Cabinet (end of The Lesson): a real museum object in 3D
    if (Wd.cabinet) {
      var C = Wd.cabinet, endL = $('#tab-lesson .tab-next-wrap');
      if (endL) {
        var b3 = wonderBox('🗄️', 'Wonder Cabinet', C.title, 2);
        b3.querySelector('.nc-wx-body').innerHTML = '<div class="nc-cab"><div class="nc-cab-stage"><div class="nc-cab-load">Loading the 3D model…</div></div><div class="nc-cab-side"><p class="nc-p">' + esc(C.text) + '</p><p class="nc-cab-tip">Drag to spin it. Pinch or scroll to zoom.</p><button type="button" class="nc-btn nc-cab-add">＋ Put it in my cabinet</button><div class="nc-cab-n"></div></div></div><p class="nc-credit">' + esc(C.credit) + '</p>';
        before(endL, b3);
        var stage = b3.querySelector('.nc-cab-stage'), addB = b3.querySelector('.nc-cab-add'), cn = b3.querySelector('.nc-cab-n');
        function drawN() { var bk = book(), k = cabinetCount(bk); cn.textContent = k + (k === 1 ? ' object' : ' objects') + ' in your cabinet'; if (slot(bk).cabinet) { addB.textContent = '✓ In your cabinet'; addB.disabled = true; } }
        addB.addEventListener('click', function () { bind({ cabinet: C.title }); ping(); drawN(); note('🗄️ Added to your Wonder Cabinet.'); });
        drawN();
        var loaded = false;
        b3.addEventListener('toggle', function () {
          if (!b3.open || loaded) return; loaded = true;
          function show() {
            stage.innerHTML = '<model-viewer src="' + esc(C.model) + '" alt="' + esc(C.alt) + '" camera-controls touch-action="pan-y" auto-rotate auto-rotate-delay="0" rotation-per-second="18deg" shadow-intensity="1" exposure="1.05" style="width:100%;height:100%;background:radial-gradient(circle at 50% 40%, #fffaf0, #e9dcc6)"></model-viewer>';
          }
          if (window.customElements && customElements.get('model-viewer')) return show();
          var sc = document.createElement('script'); sc.src = C.viewer; sc.onload = show; sc.onerror = function () { stage.innerHTML = '<div class="nc-cab-load">The 3D viewer could not load here.</div>'; }; document.head.appendChild(sc);
        });
      }
    }
  }

  // number the tabs (Step 1, Step 2…) so students always know the order
  function buildTabs() {
    var n = 0;
    $$('.tab-btn').forEach(function (b) {
      if (b.hidden || b.querySelector('.nc-tab-n')) return;
      n++; b.insertBefore(mk('span', 'nc-tab-n', 'Step ' + n), b.firstChild);
    });
  }

  function boot() {
    guard('lean', buildLean);
    guard('tabs', buildTabs);
    guard('opener', buildOpener);
    guard('bets', buildBets);
    guard('cups', buildCups);
    guard('wordlens', buildWordLens);
    guard('source', buildSource);
    guard('sort', buildSort);
    guard('air', buildAir);
    guard('bag', buildBag);
    guard('timelapse', buildTimelapse);
    guard('jars', buildJars);
    guard('otherside', buildOtherSide);
    guard('meter', buildMeter);
    guard('assignment', buildAssignment);
    guard('wonder', buildWonder);
    guard('tools', buildTools);
    window.__ncSparkleAPI = {
      store: store, voice: Voice,
      teardown: function () {
        Voice.stop();
        document.querySelectorAll('.nc-wx,.nc-op,.nc-g,.nc-np,.nc-sort-ghost,.nc-k,.nc-wl,.nc-part4,.nc-plan,.nc-dock,.nc-ribbon,.nc-notes,.nc-tab-n,.nc-journal-btn').forEach(function (e) { e.remove(); });
        document.querySelectorAll('.nc-hide').forEach(function (e) { e.classList.remove('nc-hide'); });
        document.querySelectorAll('.tab-btn[hidden]').forEach(function (b) { b.hidden = false; });
        var ex = document.getElementById('tab-explore'); if (ex) ex.classList.remove('nc-merged');
        document.documentElement.classList.remove('nc-on', 'nc-hl-on');
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
