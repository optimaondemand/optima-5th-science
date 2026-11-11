// One step at a time: walk every step of every tab with Next, then Back; report anything wrong.
// usage: node stepwalk.js <page url> [width=1150] [shots prefix]      (serve the repo first: python3 -m http.server 8100)
// Fails when: a step shows nothing, the page scrolls sideways, the count does not move, the last step is not "Step N of N",
// a tab's last Next does not open the next tab, or the page throws an error.
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2], w = process.argv[3] || 1150, pre = process.argv[4], shots = !!pre;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('response', r => { if (r.status() >= 400 && /localhost|127\.0\.0\.1/.test(r.url()) && !/\.(mp4|mp3|webm|vtt|glb)(\?|$)/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.OneStep && OneStep.ready, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  const panels = await p.evaluate(() => OneStep.info().map(P => P.id));
  const out = { url: url.split('/').pop(), w: +w, tabs: {}, problems: [], errs };
  let n = 0, lastCount = '';
  for (let t = 0; t < panels.length; t++) {
    const id = panels[t]; let guard = 0; out.tabs[id] = [];
    // the panel must be on screen (first: already; later: reached by the previous tab's last Next)
    const on = await p.evaluate(id => { const e = document.getElementById(id); return e.getBoundingClientRect().height > 0; }, id);
    if (!on) { out.problems.push(id + ' not open after the previous tab ended'); break; }
    while (guard++ < 60) {
      const st = await p.evaluate(id => { const P = document.getElementById(id), bar = P.querySelector(':scope > .os-bar'); const vis = [...P.querySelectorAll('.os-unit:not(.os-hide)')].filter(e => !e.closest('.os-hide') && e.getBoundingClientRect().height > 2);
        const de = document.documentElement; const nb = bar.querySelector('.os-next').getBoundingClientRect();
        return { count: bar.querySelector('.os-count').textContent, label: bar.querySelector('.os-label').textContent, disabled: bar.querySelector('.os-next').disabled, vis: vis.length, words: vis.reduce((t, e) => t + (e.innerText || '').split(/\s+/).filter(Boolean).length, 0), h: Math.round(P.getBoundingClientRect().height), sideways: de.scrollWidth > de.clientWidth + 2, top: Math.round(vis[0] ? vis[0].getBoundingClientRect().top : -1), nextW: Math.round(nb.width) }; }, id);
      n++; out.tabs[id].push(`${st.count} · w${st.words} h${st.h} top${st.top} → ${st.label}`);
      if (!st.vis) out.problems.push(`${id} ${st.count}: nothing on screen`);
      if (st.sideways) out.problems.push(`${id} ${st.count}: sideways scroll`);
      if (st.count === lastCount) out.problems.push(`${id}: count did not change (${st.count})`);
      lastCount = st.count;
      if (shots) await p.screenshot({ path: `${pre}-${id.replace('tab-', '')}-${String(out.tabs[id].length).padStart(2, '0')}.png`, fullPage: true });
      if (st.disabled) break;
      const before = await p.evaluate(() => OneStep.info().map(P => P.at).join());
      await p.click(`#${id} > .os-bar .os-next`); await p.waitForTimeout(350);
      const after = await p.evaluate(() => OneStep.info().map(P => P.at).join());
      if (before === after) break;   // the last Next opened the next tab
    }
  }
  const m = /Step (\d+) of (\d+)/.exec(lastCount) || [];
  if (m[1] !== m[2]) out.problems.push('last step reads "' + lastCount + '"');
  if (+m[2] !== n) out.problems.push(`walked ${n} steps but the page says ${m[2]}`);
  // Back all the way on the last tab
  let backs = 0; const lastId = panels[panels.length - 1];
  while (backs < 60 && await p.evaluate(id => getComputedStyle(document.querySelector('#' + id + ' > .os-bar .os-back')).visibility === 'visible', lastId)) { await p.click(`#${lastId} > .os-bar .os-back`); backs++; }
  out.backs = backs; out.steps = n;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
  if (out.problems.length || errs.length) { console.error('FAIL: ' + out.problems.concat(errs).join(' | ')); process.exit(1); } else console.error('OK: ' + n + ' steps, last reads "' + lastCount + '"');
})();
