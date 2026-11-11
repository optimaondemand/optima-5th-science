/* One step at a time (science, G3-G5). Modeled on the ELA step walker (Nov 2026):
   "show one thing at a time, step by step, guide them, think like we are holding their hand."

   Per tab: one step on screen, with  ◂ Back · Step 3 of 27 · 👆 Next.  The last step's button opens the next tab.
   Nothing is removed from the page: hidden steps keep their answers, so saving, My answers and the checklists still work.
   The SAME file sits in optima-3rd-science, optima-4th-science and optima-5th-science (assets/sparkle/onestep.js);
   the grade is detected from the page. Turn it off with ?steps=0 in the address, or  onestep: false  in the lesson data.

   How a tab is cut into steps
   - "containers" (a big card that holds many things) are opened up; their header stays on screen while any of their steps is.
   - everything else is a unit. Units are grouped front to back:
       a heading or a lead (Opti's note, a mission strip, a divider) starts a step and pulls the next thing in with it;
       a tail (answer box, help ladder, button, anything hidden when the page loads) stays with the thing before it;
       a "whole" unit (a game, a lab, a stage) is one step by itself, with its lead;
       reading is cut when a step would pass about 70 words.
   - a step whose parts are all hidden by the page is skipped (and not counted).
   Other scripts that jump to a part of the page call  OneStep.reveal(element)  first. */
(function () {
  if (window.OneStep) return;
  var Q = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function off() { try { return /[?&]steps=0\b/.test(location.search) || (window.WL_DATA && window.WL_DATA.onestep === false) || (window.FS_DATA && window.FS_DATA.onestep === false) || (window.NC_DATA && window.NC_DATA.onestep === false) || window.ONESTEP === false; } catch (e) { return false; } }

  /* ---------- per-grade rules ---------- */
  var GRADES = {
    g3: { test: '.wl-panel', panels: '.wl-panel', sticky: '.wl-top', tabNext: ':scope > .wl-next',
      container: '#tab-assign > .wl-card:not(.wl-gather):not(.wl-credits):not(details):not(:has(> h3 + p:last-child))',
      frame: ':scope > h3, :scope > .k',
      lead: '.wl-scene, .wl-opti, .wl-start, .wl-amap, .wl-do, .wl-look',
      heading: 'h3, h4, .wl-part-h, .wl-sub',
      title: 'h2, h3, h4', notitle: '.wl-start, .wl-opti', whole: '.wl-stage, #wf-film, #m-quiz, #m-order, #m-words, #m-det, .wl-wow, .wl-gather, .wl-quiz-q, .wl-check, .wl-drawer, details',
      tail: 'textarea, .wl-fb, .wl-count, .wl-hint-chips, .wl-chips, .wl-save, button, .wl-saved, .wl-credits, .wl-key',
      never: '', cap: 70 },
    g4: { test: 'script[src*="fs-sparkle"], .fs-only', panels: '.tab-content, .tab-panel, [id^="tab-"]', sticky: '#tabBar, .tab-bar, .tab-nav, .tabs, .progress-wrap', tabNext: ':scope .tab-next-wrap',
      container: '.activity-card, .quiz-card, .card',
      frame: ':scope > .act-num, :scope > .act-time, :scope > .card-head, :scope > .card-header, :scope > .act-head',
      lead: '.fs-start, .fs-orn, .fs-ms, .fs-amap, .fs-casecard, .fs-recap, .fs-do',
      title: '.fs-game-t, h2, h3, h4', notitle: '.fs-start, .fs-ms',
      heading: 'h2, h3, h4',
      whole: '.fs-game, .fs-hunt, .fs-in, .fs-sk, .gathered-card, .quiz-q, .diagram-wrap, .fs-video, details',
      tail: 'textarea, .fs-help, .response-q, button, .quiz-score, .fs-saved, .saved-dot',
      never: '', cap: 100 },
    g5: { test: 'script[src*="nc-sparkle"], .nc-start, .nc-k', panels: '.tab-content, .tab-panel, [id^="tab-"]', sticky: '#tabBar, .tab-bar, .tab-nav, .tabs, .progress-wrap', tabNext: ':scope .tab-next-wrap',
      container: '.activity-card, .quiz-card, .card, .nc-part4',
      frame: ':scope > .act-num, :scope > .act-time, :scope > .card-head, :scope > .card-header, :scope > .card-head-icon',
      lead: '.nc-start, .nc-k, .nc-do, .nc-listen',
      title: '.nc-g-t, h2, h3, h4', notitle: '.nc-start, .nc-k',
      heading: 'h2, h3, h4',
      whole: '.nc-g, .nc-wl, .nc-np, .cer-block, .gathered-card, .quiz-q, .diagram-wrap, .lesson-figure, .student-chart-wrap, .nc-wx, .key-concept, details',
      tail: 'textarea, .response-q, button, .quiz-score, .saved-dot',
      never: '', cap: 110 }
  };
  function grade() { for (var k in GRADES) if (document.querySelector(GRADES[k].test)) return k; return null; }

  function is(n, sel) { try { return !!sel && n.matches(sel); } catch (e) { return false; } }
  /* words a student can see in this block (closed drawers and hidden parts do not count; works inside a tab that is not open) */
  function words(n) {
    var t = 0;
    (function walk(e) {
      for (var c = e.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) t += (c.nodeValue.match(/[A-Za-z0-9'’]+/g) || []).length;
        else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|TEMPLATE|TEXTAREA|SELECT|OPTION)$/.test(c.tagName)) {
          if (c.hidden || c.classList.contains('os-never') || getComputedStyle(c).display === 'none') continue;
          if (e.tagName === 'DETAILS' && !e.open && c.tagName !== 'SUMMARY') continue;
          walk(c);
        }
      }
    })(n);
    return t;
  }
  /* is this element shown by the PAGE (ignoring what the walker hides)? */
  function pageShown(n) { var h = n.classList.contains('os-hide'); if (h) n.classList.remove('os-hide'); var ok = !n.hidden && getComputedStyle(n).display !== 'none'; if (h) n.classList.add('os-hide'); return ok; }

  var G, PANELS = [], KEY = 'onestep:' + location.pathname + ':';

  function bodyOf(c) {   /* the element whose children are the container's contents; its other children are the header (always shown with it) */
    var b = c.querySelector(':scope > .act-body, :scope > .card-body'); if (b) return b;
    var last = c.lastElementChild;
    if (c.children.length === 2 && last && last.children.length > 1 && !is(last, G.whole) && !is(last, G.lead)) return last;
    return c;
  }
  function collect(root, chain, out) {
    [].slice.call(root.children).forEach(function (k) {
      if (/^(SCRIPT|STYLE|LINK)$/.test(k.tagName) || k.classList.contains('os-bar')) return;
      if (is(k, G.never)) { k.classList.add('os-never'); return; }
      if (root === chain[chain.length - 1] && chain.length > 1 && is(k, G.frame)) return;          /* a container's header: always with it */
      var big = k.tagName === 'DIV' && !k.className.replace(/os-\S+|scroll-reveal|visible|revealed/g, '').trim() && k.children.length >= 4 && pageShown(k) && words(k) > 2 * G.cap;   /* a big unnamed block opens up too */
      var b = (is(k, G.container) || big) && !is(k, G.whole) && pageShown(k) ? bodyOf(k) : null;
      if (b && [].slice.call(b.children).filter(function (x) { return !is(x, G.frame); }).length > 1) {
        k.classList.add('os-box'); var ch = chain.concat([k]);

        collect(b, ch, out); return;
      }
      out.push({ el: k, chain: chain.slice(1) });
    });
  }
  function hasInput(k) { return is(k, 'textarea, input, select') || !!k.querySelector('textarea, input:not([type=hidden]), select'); }
  function group(units) {
    var stops = [], cur = null, glue = false, body = 0, closed = false, pend = [];
    function open() { cur = pend; pend = []; stops.push(cur); body = 0; closed = false; }
    units.forEach(function (u) {
      var k = u.el, shown = pageShown(k), w = shown ? words(k) : 0;
      if (!shown && (!cur || closed)) { if (cur && !glue) cur.push(u); else pend.push(u); return; }   /* hidden when the page loads: rides with a neighbor */
      var tail = !shown || is(k, G.tail) || (k.id && /count|progress|score/i.test(k.id));
      if (tail && cur && cur.length) { cur.push(u); if (shown && hasInput(k)) closed = true; return; }
      var head = is(k, G.heading), whole = is(k, G.whole);
      var lead = is(k, G.lead) || (!head && !whole && w <= 12 && !hasInput(k) && !k.querySelector('img, svg, canvas, video, iframe'));   /* a short label line leads what follows */
      if (!cur) open();
      else if (glue) { /* stays with its heading / lead */ }
      else if (head || lead) { if (body || closed) open(); }
      else if (whole) { if (closed || body > 45) open(); }
      else if (closed) open();
      else if (body && body + w > G.cap) open();
      cur.push(u);
      if (head || lead) glue = true;
      else { glue = false; body += Math.max(w, 1); if (whole || hasInput(k)) closed = true; }
    });
    if (pend.length) { if (cur) [].push.apply(cur, pend); else stops.push(pend); }
    return stops.filter(function (s) { return s.length; });
  }
  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim().replace(/^[^A-Za-z0-9]+/, '').slice(0, 44); }
  function titleOf(stop) {
    var i, k, t;
    for (i = 0; i < stop.length; i++) { k = stop[i].el; if (is(k, 'h2, h3, h4') && pageShown(k) && clean(k.textContent)) return clean(k.textContent); }
    for (i = 0; i < stop.length; i++) { k = stop[i].el; if (!pageShown(k) || is(k, G.notitle)) continue;
      t = k.querySelector(G.title); if (t) { var kk = t.querySelector('.k'); var x = clean(kk ? t.textContent.replace(kk.textContent, '') : t.textContent); if (x) return x; } }
    for (i = 0; i < stop.length; i++) { k = stop[i].el; if (!pageShown(k) || is(k, G.notitle)) continue; t = k.querySelector('.k, .fs-game-k'); if (t && clean(t.textContent)) return clean(t.textContent); }
    /* the first step of a card takes the card's own title */
    var u0 = stop[0], c = u0 && u0.chain[u0.chain.length - 1];
    if (c && firstOf(c) === u0.el) { var h = c.querySelector(':scope > .act-head, :scope > .card-head, :scope > div:first-child'); t = h && h !== bodyOf(c) && h.querySelector('h2, h3, h4, [class*="title"]'); if (t && clean(t.textContent)) return clean(t.textContent); }
    return '';
  }
  function firstOf(c) { var b = bodyOf(c), k = b.firstElementChild; while (k && (k.classList.contains('os-box') || !k.classList.contains('os-unit'))) { if (k.classList.contains('os-box')) return firstOf(k); k = k.nextElementSibling; } return k; }
  function tabHidden(panel) {   /* a tab the page has switched off (its button is hidden) is not walked or counted */
    var key = (panel.id || '').replace(/^tab-/, ''); if (!key) return false;
    var btns = Q('[onclick], [data-tab], [aria-controls]').filter(function (b) { return !panel.contains(b) && ((b.getAttribute('onclick') || '').indexOf("'" + key + "'") > -1 || b.dataset.tab === key || b.getAttribute('aria-controls') === panel.id) && is(b, 'button, a, [role=tab], li, .tab-btn, .tab'); });
    btns = btns.filter(function (b) { return !b.closest('.tab-next-wrap, .wl-next, .os-bar'); });
    return btns.length > 0 && btns.every(function (b) { var e = b; while (e && e !== document.body) { if (e.hidden || getComputedStyle(e).display === 'none') return true; e = e.parentElement; } return false; });
  }
  function empty(stop) { return !stop.some(function (u) { return pageShown(u.el); }); }

  function setup(panel) {
    var units = []; collect(panel, [panel], units);
    var tn = G.tabNext ? panel.querySelector(G.tabNext) : null;
    units = units.filter(function (u) { if (tn && (u.el === tn || tn.contains(u.el))) return false; return true; });
    if (tn) tn.classList.add('os-never');
    var stops = group(units); if (!stops.length) { if (tn) tn.classList.remove('os-never'); return null; }
    units.forEach(function (u) { u.el.classList.add('os-unit'); });
    var bar = document.createElement('div'); bar.className = 'os-bar';
    bar.innerHTML = '<button type="button" class="os-back">◂ Back</button><span class="os-count" aria-live="polite"></span><button type="button" class="os-next"><span class="os-hand" aria-hidden="true">👆</span> <span class="os-label">Next</span></button>';
    panel.appendChild(bar);
    var P = { panel: panel, stops: stops, at: 0, bar: bar, back: bar.querySelector('.os-back'), next: bar.querySelector('.os-next'), label: bar.querySelector('.os-label'), count: bar.querySelector('.os-count'), tabNext: tn };
    try { var sv = +sessionStorage.getItem(KEY + (panel.id || PANELS.length)); if (sv > 0 && sv < stops.length) P.at = sv; } catch (e) {}
    P.next.addEventListener('click', function () { var j = seek(P, P.at + 1, 1); if (j < P.stops.length) show(P, j, true); else leave(P); });
    P.back.addEventListener('click', function () { var j = seek(P, P.at - 1, -1); if (j >= 0) show(P, j, true); });
    return P;
  }
  function seek(P, j, dir) { while (j >= 0 && j < P.stops.length && empty(P.stops[j])) j += dir; return j; }
  function leave(P) {
    var b = P.tabNext && (is(P.tabNext, 'button, a') ? P.tabNext : P.tabNext.querySelector('button, a'));
    if (b) b.click();
  }
  function paint() {
    var tot = 0, n = [];
    PANELS.forEach(function (P) { P.stops.forEach(function (s, j) { if (!empty(s)) { tot++; } if (j === P.at) n.push(tot || 1); }); });
    PANELS.forEach(function (P, i) {
      P.count.textContent = 'Step ' + n[i] + ' of ' + tot;
      var nx = seek(P, P.at + 1, 1), last = nx >= P.stops.length;
      var tb = P.tabNext && (is(P.tabNext, 'button, a') ? P.tabNext : P.tabNext.querySelector('button, a'));
      var t = last ? (tb ? (tb.textContent.replace(/\s+/g, ' ').replace(/[→▸➜]+\s*$/, '').trim() || 'Next') : 'All done') : (titleOf(P.stops[nx]) ? 'Next: ' + titleOf(P.stops[nx]) : 'Next');
      P.label.textContent = t; P.next.disabled = last && !tb; P.next.classList.toggle('os-end', last && !tb);
      P.back.style.visibility = seek(P, P.at - 1, -1) >= 0 ? 'visible' : 'hidden';
    });
  }
  function show(P, j, scroll) {
    if (empty(P.stops[j])) { var f = seek(P, j, 1); j = f < P.stops.length ? f : seek(P, j, -1); if (j < 0) j = 0; }
    P.at = j; try { sessionStorage.setItem(KEY + (P.panel.id || PANELS.indexOf(P)), j); } catch (e) {}
    var on = P.stops[j], boxes = [];
    P.stops.forEach(function (s, k) { s.forEach(function (u) { u.el.classList.toggle('os-hide', k !== j); }); });
    on.forEach(function (u) { u.chain.forEach(function (c) { if (boxes.indexOf(c) < 0) boxes.push(c); }); });
    Q('.os-box', P.panel).forEach(function (c) { c.classList.toggle('os-hide', boxes.indexOf(c) < 0); });
    paint();
    if (scroll) { var first = boxes[0] && boxes[0].contains(on[0].el) && isFirstIn(on[0], P) ? boxes[0] : on.filter(function (u) { return pageShown(u.el); })[0].el; land(first); }
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('onestep:show', { detail: { panel: P.panel, step: j } })); } catch (e) {}
  }
  function isFirstIn(u, P) {   /* is this unit the first unit of its outermost container? then land on the container's header */
    var c = u.chain[0]; if (!c) return false;
    for (var a = 0; a < P.stops.length; a++) for (var b = 0; b < P.stops[a].length; b++) if (P.stops[a][b].chain[0] === c) return P.stops[a][b] === u;
    return false;
  }
  function land(el) {
    if (!el) return; var pad = 12; Q(G.sticky).forEach(function (s) { var cs = getComputedStyle(s); if (/sticky|fixed/.test(cs.position)) pad = Math.max(pad, s.getBoundingClientRect().bottom + 12); });
    var y = el.getBoundingClientRect().top + window.scrollY - Math.min(pad, 220);
    window.scrollTo(0, Math.max(0, y));
  }
  /* jump helpers elsewhere on the page call this before they scroll to something */
  function reveal(el) {
    if (!el || !PANELS.length) return false;
    for (var i = 0; i < PANELS.length; i++) { var P = PANELS[i]; if (!P.panel.contains(el)) continue;
      for (var j = 0; j < P.stops.length; j++) if (P.stops[j].some(function (u) { return u.el === el || u.el.contains(el) || el.contains(u.el); })) { if (j !== P.at) show(P, j, false); return true; }
      var box = el.closest('.os-box');   /* a card's own header: go to the card's first step */
      if (box) for (j = 0; j < P.stops.length; j++) if (P.stops[j].some(function (u) { return u.chain.indexOf(box) > -1; })) { if (j !== P.at) show(P, j, false); return true; } }
    return false;
  }
  function boot() {
    if (off()) return; var g = grade(); if (!g) return; G = GRADES[g];
    document.documentElement.classList.add('os-on', 'os-' + g);
    var seen = [];
    Q(G.panels).forEach(function (p) { if (seen.some(function (s) { return s.contains(p); })) return; seen.push(p); if (tabHidden(p)) return; var P = setup(p); if (P) PANELS.push(P); });
    PANELS.forEach(function (P) { show(P, P.at, false); });
    window.OneStep.ready = true;
    try { document.dispatchEvent(new CustomEvent('onestep:ready')); } catch (e) {}
  }
  window.OneStep = { reveal: reveal, boot: boot, ready: false,
    info: function () { return PANELS.map(function (P) { return { id: P.panel.id, at: P.at, stops: P.stops.map(function (s) { return { empty: empty(s), title: titleOf(s), words: s.reduce(function (t, u) { return t + (pageShown(u.el) ? words(u.el) : 0); }, 0), parts: s.map(function (u) { return u.el.tagName.toLowerCase() + (u.el.id ? '#' + u.el.id : '') + '.' + String(u.el.className).replace(/os-\w+/g, '').trim().split(/\s+/).slice(0, 2).join('.') + (pageShown(u.el) ? '' : '(off)'); }) }; }) }; }); } };
  if (window.ONESTEP_MANUAL) return;   /* the layer calls OneStep.boot() itself when it has finished building the page */
  if (document.readyState === 'complete') setTimeout(boot, 400); else window.addEventListener('load', function () { setTimeout(boot, 400); });
})();
