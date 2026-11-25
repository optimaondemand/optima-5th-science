// 20.02 play script: node tools/sparkle/lessons/20-02/play.js [width]   (serve the repo on :8765 first)
const { chromium } = require('playwright');
const W = +(process.argv[2] || 1150), URL = 'http://localhost:8765/lesson-20-02-investigation-structure-and-function-comparison.html?steps=0';
const log = (...a) => console.log(W + ' |', ...a);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const ev = (f, a) => p.evaluate(f, a);
  // Warm-Up: wrong check first, then solve by swapping (taps)
  await p.click('.nc-mn-check'); log('menu wrong fb:', (await p.textContent('.nc-mn-fb')).slice(0, 80));
  for (let k = 0; k < 6; k++) {
    const order = await ev(() => JSON.parse(localStorage.getItem('oao.nc.g5sci-20-2')).mn.order);
    const i = order.findIndex((v, j) => v !== j); if (i < 0) break; const j = order.indexOf(i);
    await p.click(`.nc-mn-food[data-slot="${i}"]`); await p.click(`.nc-mn-food[data-slot="${j}"]`);
  }
  await p.click('.nc-mn-check'); log('menu:', (await p.textContent('.nc-mn-fb')).slice(0, 60));
  await p.click('.nc-mn-t[data-f="beans"][data-t="spoon"]'); await p.click('.nc-mn-t[data-f="rice"][data-t="clothespin"]'); await p.click('.nc-mn-save');
  log('seal:', await p.textContent('.nc-mn-seal'), '| edit visible:', await p.isVisible('.nc-mn-edit'));
  await p.fill('#pred-1', 'I think the spoon will win with beans because it is wide. The clothespin will win with rice because it pinches.');
  // Lesson
  await ev(() => switchTab('lesson')); await p.waitForTimeout(300);
  await p.click('.nc-src-hl[data-i="0"]'); log('hunt1 wrong:', (await p.textContent('.nc-src-asks')).slice(0, 120));
  for (let i = 0; i < 8; i++) await p.click(`.nc-src-hl[data-i="${i}"]`);
  log('source done:', await ev(() => document.querySelector('.nc-src').classList.contains('nc-done')));
  // caliper: try reading too early (wrong), then drag jaws to target via the hit areas
  await p.click('.nc-cp-read'); log('caliper wrong:', await p.textContent('.nc-cp-fb'));
  for (let h = 0; h < 4; h++) {
    await p.click(`.nc-cp-tab[data-i="${h}"]`);
    const t = await ev(h => { const H = JSON.parse(document.getElementById('nc-data').textContent).caliper.heads[h]; return H; }, h);
    for (const [w, y] of [['t', t.top], ['b', t.bot]]) {
      const pt = await ev(({ w, y, x }) => { const svg = document.querySelector('.nc-cp-svg'), hit = [...svg.querySelectorAll('.nc-cp-jaw')].find(g => g.dataset.w === w).querySelector('.nc-cp-hit'); const r = hit.getBoundingClientRect(); const m = svg.getScreenCTM(); return { sx: r.x + r.width * 0.3, sy: r.y + r.height / 2, ty: m.f + y * m.d }; }, { w, y, x: t.x });
      await p.mouse.move(pt.sx, pt.sy); await p.mouse.down(); await p.mouse.move(pt.sx, pt.ty, { steps: 6 }); await p.mouse.up();
    }
    await p.click('.nc-cp-read'); await p.waitForTimeout(950);
    log('caliper', h, await p.textContent('.nc-cp-fb'));
  }
  await p.click('.nc-cp-o[data-i="1"]'); await p.click('.nc-cp-o[data-i="0"]'); log('caliper done:', await ev(() => document.querySelector('.nc-cp').classList.contains('nc-done')));
  // shadow: wrong by tap, one by drag, rest by tap
  await p.click('.nc-sh-tool[data-k="straw"]'); await p.click('.nc-sh-bird[data-i="0"]'); log('shadow wrong:', (await p.textContent('.nc-sh-fb')).slice(0, 80));
  const tb = await p.$('.nc-sh-tool[data-k="nutcracker"]'), bb = await p.$('.nc-sh-bird[data-i="0"]'); const A = await tb.boundingBox(), B = await bb.boundingBox();
  await p.mouse.move(A.x + A.width / 2, A.y + A.height / 2); await p.mouse.down(); await p.mouse.move(B.x + B.width / 2, B.y + B.height / 2, { steps: 10 }); await p.mouse.up();
  log('shadow drag ok:', await ev(() => document.querySelector('.nc-sh-bird[data-i="0"]').classList.contains('ok')));
  for (const [k, i] of [['straw', 1], ['spear', 2], ['hook', 3], ['strainer', 4], ['chisel', 5]]) { await p.click(`.nc-sh-tool[data-k="${k}"]`); await p.click(`.nc-sh-bird[data-i="${i}"]`); }
  log('shadow done:', await ev(() => document.querySelector('.nc-sh').classList.contains('nc-done')));
  await p.click('.nc-pl-o[data-i="1"]'); await p.click('.nc-pl-o[data-i="0"]'); log('plant:', (await p.textContent('.nc-pl-fb')).slice(0, 40));
  // flaw
  await p.click('.nc-fw-plan[data-i="0"] .nc-fw-part[data-j="2"]'); log('flaw wrong:', await p.textContent('.nc-fw-plan[data-i="0"] .nc-fw-fb'));
  await p.click('.nc-fw-plan[data-i="3"] .nc-fw-part[data-j="0"]');
  for (const [i, j] of [[0, 0], [1, 1], [2, 3]]) await p.click(`.nc-fw-plan[data-i="${i}"] .nc-fw-part[data-j="${j}"]`);
  await p.click('.nc-fw-plan[data-i="3"] .nc-fw-fair'); log('flaw:', await p.textContent('.nc-fw-score'));
  // lab: junk number first, then real data
  await p.fill('.nc-bl-in[data-t="spoon"][data-f="beans"]', 'lots'); log('junk:', await p.textContent('.nc-bl-fb'));
  const data = { spoon: [22, 9], tweezers: [7, 18], clothespin: [11, 6] };
  for (const t in data) { await p.fill(`.nc-bl-in[data-t="${t}"][data-f="beans"]`, String(data[t][0])); await p.fill(`.nc-bl-in[data-t="${t}"][data-f="rice"]`, String(data[t][1])); }
  log('graph shown:', await p.isVisible('.nc-bl-graph'), '| compare:', (await p.textContent('.nc-bl-rows')).replace(/\s+/g, ' '));
  log('warm-up locked:', await p.textContent('.nc-mn-seal'), '| edit hidden:', !(await p.isVisible('.nc-mn-edit')));
  await p.click('.nc-bl-o[data-i="2"]'); await p.click('.nc-bl-o[data-i="0"]'); log('twist shown:', await p.isVisible('.nc-bl-wow'));
  // timer quick check
  await p.click('.nc-bl-start'); await p.waitForTimeout(1200); log('timer:', await p.textContent('.nc-bl-clock'), '| stop visible:', await p.isVisible('.nc-bl-stop')); await p.click('.nc-bl-stop');
  // on-screen trial (30 s)
  await p.click('.nc-bl-mode[data-m="screen"]'); await p.click('.nc-bl-pt[data-t="tweezers"]'); await p.click('.nc-bl-pf[data-f="rice"]'); await p.click('.nc-bl-go');
  const plate = await (await p.$('.nc-bl-plate')).boundingBox();
  const t0 = Date.now();
  while (Date.now() - t0 < 29000) { await p.mouse.click(plate.x + plate.width * 0.29, plate.y + plate.height * 0.5); await p.mouse.click(plate.x + plate.width * 0.8, plate.y + plate.height * 0.55); await p.waitForTimeout(250); }
  await p.waitForTimeout(2500); log('screen trial:', await p.textContent('.nc-bl-sfb'), '| table value:', await p.inputValue('.nc-bl-in[data-t="tweezers"][data-f="rice"]'));
  // wonder extras
  for (const s of await p.$$('details.nc-wx')) { await s.evaluate(d => { d.open = true; d.dispatchEvent(new Event('toggle')); }); }
  await p.waitForTimeout(2500);
  log('video can play:', await ev(async () => { const v = document.querySelector('.nc-wx-video'); try { await v.play(); await new Promise(r => setTimeout(r, 800)); return v.currentTime > 0.2; } catch (e) { return 'err ' + e.message; } }));
  const gb = await (await p.$('.nc-bars')).boundingBox(); await p.mouse.move(gb.x + gb.width * 0.85, gb.y + gb.height / 2); log('graph read:', await p.textContent('.nc-dt-read'));
  await p.click('details.nc-wx .nc-opt[data-i="0"] >> nth=0').catch(() => {});
  log('3D:', await ev(() => !!document.querySelector('model-viewer')), await ev(() => new Promise(r => { const m = document.querySelector('model-viewer'); if (!m) return r('none'); if (m.loaded) return r('loaded'); m.addEventListener('load', () => r('loaded')); m.addEventListener('error', e => r('error')); setTimeout(() => r('timeout'), 8000); })));
  await p.click('.nc-cab-add'); log('cabinet:', await p.textContent('.nc-cab-n'));
  // highlighter note
  await p.click('.nc-t-hl'); await p.waitForTimeout(200); const n1 = await p.$$eval('.nc-note', n => n.length); await p.click('.nc-t-hl'); await p.waitForTimeout(200); log('highlighter notes on/off:', n1, await p.$$eval('.nc-note', n => n.filter(x => /ighlight/.test(x.textContent)).length));
  // reload keeps everything
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  log('after reload:', JSON.stringify(await ev(() => ({ mn: document.querySelector('.nc-mn').classList.contains('nc-done'), cp: document.querySelector('.nc-cp').classList.contains('nc-done'), sh: document.querySelector('.nc-sh').classList.contains('nc-done'), fw: document.querySelector('.nc-fw').classList.contains('nc-done'), bl: document.querySelector('.nc-bl').classList.contains('nc-done'), pred: document.getElementById('pred-1').value.length }))));
  log('dead buttons:', await ev(() => [...document.querySelectorAll('button')].filter(b => b.disabled && b.offsetParent && !b.textContent.trim()).length));
  await ev(() => { switchTab('assignment'); window.refreshGathered && refreshGathered(); });
  const ga = await p.inputValue('#gatheredOutput'); log('gathered:', ga.split('\n').filter(l => /^---|Best|Spoon|units/.test(l)).join(' / ').slice(0, 900));
  // resets
  await ev(() => switchTab('lesson'));
  for (const s of ['.nc-mn-reset', '.nc-cp-reset', '.nc-sh-reset', '.nc-fw-reset']) { await ev(s => document.querySelector(s).click(), s); }
  log('after resets:', JSON.stringify(await ev(() => ({ cp: document.querySelector('.nc-cp').classList.contains('nc-done'), sh: document.querySelector('.nc-sh').classList.contains('nc-done'), fw: document.querySelector('.nc-fw').classList.contains('nc-done') }))));
  log('NC_FAILED:', JSON.stringify(await ev(() => window.NC_FAILED)), '| page errors:', errs.length ? errs : 'none');
  await b.close();
})();
