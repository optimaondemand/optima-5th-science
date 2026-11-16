/* tab-quiet.js · shared by every OAO science lesson page (Grades 3-5). Same file in all three repos.
   A lesson is one long page with tabs, so a video, a guide's voice clip, the read-aloud voice or an
   opener film kept playing after a student moved to another tab. When the tab changes, this stops
   every sound on the page. Nothing restarts on its own: the student presses play again.
     - <video>/<audio> on the page, and the guide/narrator clips the layers make with new Audio()
     - the browser's read-aloud voice (speechSynthesis)
     - YouTube / Vimeo embeds (pause message)
     - embeds from other sites (3D room / viewer, 3D models): unloaded while their tab is hidden, see park()
     - the cinematic openers: their layers listen for the 'optima:quiet' event and pause their own timeline
   Left alone on purpose: looping background music the student switched on (it belongs to the whole page).
   Load it in <head> so it sees every clip the layers create. Plain ES5, no dependencies. */
(function () {
  'use strict';
  if (window.__optimaTabQuiet) return;
  window.__optimaTabQuiet = true;

  var media = [];              // clips started from script (many are never added to the page)
  var GRACE = 400;             // ms: a clip started by the tab change itself is not stopped
  var lastSpeak = 0;

  var MP = window.HTMLMediaElement && HTMLMediaElement.prototype;
  if (MP && MP.play) {
    var play0 = MP.play;
    MP.play = function () {
      if (media.indexOf(this) < 0) media.push(this);
      this.__tqAt = Date.now();
      return play0.apply(this, arguments);
    };
  }
  var SS = window.speechSynthesis;
  if (SS && SS.speak) {
    var speak0 = SS.speak;
    try { SS.speak = function () { lastSpeak = Date.now(); return speak0.apply(SS, arguments); }; } catch (e) {}
  }

  function quiet(grace) {
    var now = Date.now();
    try { document.dispatchEvent(new Event('optima:quiet')); } catch (e) {}
    var all = media.slice();
    var els = document.querySelectorAll('audio, video');
    for (var i = 0; i < els.length; i++) if (all.indexOf(els[i]) < 0) all.push(els[i]);
    all.forEach(function (m) {
      if (m.loop && !m.isConnected) return;                       // page-wide background music
      if (grace && now - (m.__tqAt || 0) < GRACE) return;        // started by this tab change
      try { if (!m.paused) m.pause(); } catch (e) {}
    });
    media = media.filter(function (m) { return !m.paused || m.isConnected; });
    if (SS && (SS.speaking || SS.pending) && !(grace && now - lastSpeak < GRACE)) { try { SS.cancel(); } catch (e) {} }
    var fr = document.querySelectorAll('iframe');
    for (var j = 0; j < fr.length; j++) {
      var f = fr[j], s = f.src || '', w = f.contentWindow;
      try {
        if (/youtube(-nocookie)?\.com\/embed/.test(s)) { if (w) w.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); }
        else if (/player\.vimeo\.com/.test(s)) { if (w) w.postMessage('{"method":"pause"}', '*'); }
        else if (/^https?:/.test(s) && s.indexOf(location.origin) !== 0 && !f.hasAttribute('data-keep-playing') && !f.getClientRects().length) park(f);
      } catch (e) {}
    }
  }

  /* An embed from another site (the 3D room / viewer, a 3D model) can't be told to pause, so when its tab
     is hidden it is taken off the page, which stops its sound. A card waits in its place; one tap brings
     it back (it reloads from its start). Add data-keep-playing to an iframe to leave it alone. */
  function park(f) {
    var card = document.createElement('div');
    card.className = 'tq-parked';
    card.setAttribute('style', 'aspect-ratio:16/9;max-width:100%;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0e1b41;color:#fff;border-radius:12px;font:600 18px system-ui,sans-serif;text-align:center;padding:16px;box-sizing:border-box');
    card.innerHTML = '<div>⏸ Paused while you were on another tab</div>' +
      '<button type="button" style="font:700 18px system-ui,sans-serif;padding:12px 26px;border:0;border-radius:999px;background:#f17422;color:#fff;cursor:pointer">▶ Open it again</button>';
    f.parentNode.replaceChild(card, f);
    card.querySelector('button').addEventListener('click', function () { card.parentNode.replaceChild(f, card); });
  }
  window.optimaQuiet = function () { quiet(false); };

  /* which tab panel is showing. Works for every lesson style:
     .tab-panel.active (base lessons, G4, G5), .wl-panel.on (G3 Wonder Films), role="tabpanel" */
  var PANEL = '.tab-panel, .wl-panel, [role="tabpanel"]';
  function isPanel(n) { return n && n.nodeType === 1 && n.matches && n.matches(PANEL); }
  function shown() {
    var out = [], ps = document.querySelectorAll(PANEL);
    for (var i = 0; i < ps.length; i++) if (ps[i].getClientRects().length) out.push(ps[i].id || i);
    return out.join('|');
  }

  function start() {
    var cur = shown(), pending = false;
    // 1. a tap on a tab button: stop sound before the tab's own code runs
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('.tab-btn, .wl-tab, [role="tab"]');
      if (!b || b.classList.contains('active') || b.classList.contains('on') || b.getAttribute('aria-selected') === 'true') return;
      quiet(false);
    }, true);
    // 2. any other way the tab changes (Next / Back steps, "go to clue", a restored tab): watch the panels
    if (window.MutationObserver) new MutationObserver(function (recs) {
      if (pending) return;
      for (var i = 0; i < recs.length; i++) if (isPanel(recs[i].target)) {
        pending = true;
        setTimeout(function () {
          pending = false;
          var now = shown();
          if (now !== cur) { cur = now; quiet(true); }
        }, 0);
        return;
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
