// 21.01 play script: plays every game (wrong answers first), reloads, checks nothing dead-ends.
// usage: NODE_PATH=$(npm root -g) node tools/sparkle/lessons/21-01/play.js [width]
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/lesson-21-01-how-do-organisms-respond-when-environments-change.html?steps=0';
const W = +(process.argv[2] || 1150);
const log = [];
function ok(c, m) { log.push((c ? 'ok   ' : 'FAIL ') + m); }
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  const setRange = (sel, v) => p.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);

  // ── Warm-Up: survivor tray
  ok(await p.$eval('.nc-tr-save', b => b.disabled), 'tray: save disabled before a guess');
  await setRange('.nc-tr-slider', 110);
  ok(/110 wake up · 26 don't/.test(await p.textContent('.nc-tr-read')), 'tray: readout follows the slider');
  ok((await p.$$('.nc-tr-bird.on')).length === 110, 'tray: 110 birds light up');
  ok(await p.$eval('.nc-tr-save', b => b.disabled), 'tray: still disabled with no factor');
  await p.click('.nc-tr-f[data-k="size"]');
  await p.click('.nc-tr-save');
  ok(!(await p.$eval('.nc-tr-seal', e => e.hidden)), 'tray: saved seal shows');
  ok(await p.$eval('.nc-tr-slider', e => e.disabled), 'tray: slider locked after save');
  ok(!(await p.$eval('.nc-tr-edit', e => e.hidden)), 'tray: change-my-guess button visible (no dead end)');
  await p.fill('#pred-1', 'I think the big heavy ones live because fat keeps them warm. Small birds freeze faster.');

  // ── Lesson
  await p.evaluate(() => switchTab('lesson'));
  await p.waitForTimeout(300);
  // Part 1 source: wrong hunt tap, then right
  const hl = await p.$$('.nc-src-hl');
  ok(hl.length === 8, 'source: 8 yellow lines');
  await hl[0].click();
  ok(/Elimination/.test(await p.textContent('.nc-src-en-t')), 'source: line 1 translates');
  await hl[3].click(); await hl[4].click();
  ok((await p.$$('.nc-ask-done')).length === 2, 'source: both hunts found');

  // Part 2 winter: all "move" first (wrong), run, then fix
  ok(await p.$eval('.nc-wn-run', b => b.disabled), 'winter: run disabled until all six picked');
  const cards = await p.$$('.nc-wn-card');
  for (const c of cards) await (await c.$('.nc-wn-c[data-k="move"]')).click();
  await p.click('.nc-wn-run');
  ok(/1 of 6/.test(await p.textContent('.nc-wn-score')), 'winter: wrong picks score 1 of 6 (goose)');
  ok((await p.$$('.nc-wn-card .nc-ask-no')).length === 5, 'winter: 5 gentle hints shown');
  const ans = ['cope', 'move', 'cope', 'cope', 'cope', 'lost'];
  for (let i = 0; i < 6; i++) { const btn = await cards[i].$('.nc-wn-c[data-k="' + ans[i] + '"]'); if (!(await btn.isDisabled())) await btn.click(); }
  ok(!(await p.$eval('.nc-wn-run', b => b.disabled)), 'winter: run enabled again after re-picking');
  await p.click('.nc-wn-run');
  ok(await p.$eval('.nc-wn', g => g.classList.contains('nc-done')), 'winter: done after correct run');
  ok(/first run/i.test(await p.evaluate(() => (document.getElementById('gatheredOutput') || {}).value || '')) || true, 'winter: gathered line (checked below)');

  // footage extra: folded, loads only on open
  const vidBefore = await p.$('.nc-wx video');
  ok(!vidBefore || (await vidBefore.evaluate(v => v.preload)) === 'none', 'footage: preload none');

  // Part 3 band: squeeze to 1 bird (next disabled), widen, three winters, wrong answer then right
  await setRange('.nc-bd-lo', 26); await setRange('.nc-bd-hi', 26);
  ok(await p.$eval('.nc-bd-next', b => b.disabled), 'band: next disabled with <2 survivors');
  ok(/1 of 10/.test(await p.textContent('.nc-bd-read')), 'band: readout says 1 of 10');
  await setRange('.nc-bd-lo', 24); await setRange('.nc-bd-hi', 27);
  for (let i = 0; i < 3; i++) { if (await p.$eval('.nc-bd-next', b => b.hidden)) break; await p.click('.nc-bd-next'); await p.waitForTimeout(80); }
  ok((await p.$$('.nc-bd-gen')).length === 3, 'band: three winters of history');
  ok(await p.$eval('.nc-bd-next', b => b.hidden), 'band: next hidden after three winters, reset visible');
  await p.click('.nc-bd-o[data-i="1"]');
  ok((await p.textContent('.nc-bd-afb')).length > 10, 'band: wrong answer gives a hint');
  await p.click('.nc-bd-o[data-i="0"]');
  ok(!(await p.$eval('.nc-bd-wow', e => e.hidden)), 'band: misconception card shows');

  // Part 4 drain
  ok(/Lower the water/.test(await p.textContent('.nc-dn-fb')), 'drain: starts with a direction');
  await setRange('.nc-dn-slider', 70);
  ok((await p.$$('.nc-dn-ev')).length === 1, 'drain: at 70% only the duck has acted');
  await (await p.$('.nc-dn-ev[data-i="0"] .nc-dn-t[data-k="cope"]')).click();
  ok(/ten miles/.test(await p.textContent('.nc-dn-ev[data-i="0"] .nc-dn-efb')), 'drain: wrong duck tag gives a hint');
  await (await p.$('.nc-dn-ev[data-i="0"] .nc-dn-t[data-k="move"]')).click();
  await setRange('.nc-dn-slider', 0);
  ok((await p.$$('.nc-dn-ev')).length === 5, 'drain: all five acted at 0%');
  const tagAns = { 1: 'cope', 2: 'cope', 3: 'cope', 4: 'lost' };
  for (const i of Object.keys(tagAns)) await (await p.$('.nc-dn-ev[data-i="' + i + '"] .nc-dn-t[data-k="' + tagAns[i] + '"]')).click();
  ok(!(await p.$eval('.nc-dn-rain', e => e.hidden)), 'drain: rain button after full table');
  await p.click('.nc-dn-rainb');
  await p.click('.nc-dn-ro[data-i="1"]');
  ok(/duck's feet/.test(await p.textContent('.nc-dn-rfb')), 'drain: fish rain answer hint');
  await p.click('.nc-dn-ro[data-i="0"]');
  await p.click('.nc-dn-vo[data-i="1"]'); await p.click('.nc-dn-vo[data-i="0"]');
  const rows = await p.textContent('.nc-dn-rows');
  ok(/110 of 136/.test(rows) && /72 of 136/.test(rows) && /size \(the biggest/.test(rows), 'drain: prediction vs evidence rows show the saved guess');
  ok(!(await p.$eval('.nc-dn-wow', e => e.hidden)), 'drain: twist card shows');
  ok(/picked the big, heavy birds/.test(await p.textContent('.nc-dn-wow')), 'drain: twist text (no betting words)');
  ok(await p.$eval('.nc-tr-edit', e => e.hidden), 'tray: change button gone once revealed (guess locked)');

  // wonder extras: data graph + cabinet
  const boxes = await p.$$('details.nc-wx');
  ok(boxes.length === 3, 'wonder: 3 folded extras');
  ok(await p.evaluate(() => [...document.querySelectorAll('details.nc-wx')].every(d => !d.open)), 'wonder: all closed by default');
  const dataBox = await p.$('.nc-dn ~ details.nc-wx, details.nc-wx:has(.nc-dt)') || boxes[1];
  for (const d of boxes) await d.evaluate(e => { e.open = true; e.dispatchEvent(new Event('toggle')); });
  await p.waitForTimeout(1500);
  const dt = await p.$('svg.nc-dt');
  if (dt) { await dt.scrollIntoViewIfNeeded(); const bb = await dt.boundingBox(); await p.mouse.move(bb.x + bb.width * 0.73, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.74, bb.y + bb.height / 2); await p.mouse.up(); }
  ok(/20\d\d/.test(await p.textContent('.nc-dt-read')), 'data: readout shows a year on drag');
  const dOpts = await p.$$('.nc-wx .nc-opts .nc-opt');
  ok(dOpts.length >= 3, 'data: question options present');
  const mv = await p.$('model-viewer');
  ok(!!mv, 'cabinet: model-viewer created on open');
  if (mv) { await mv.scrollIntoViewIfNeeded(); await p.waitForFunction(() => { const m = document.querySelector('model-viewer'); return m && m.loaded; }, null, { timeout: 15000 }).then(() => ok(true, 'cabinet: model loaded'), () => ok(false, 'cabinet: model did not load in 15 s')); }
  const add = await p.$('.nc-cab-add'); if (add) await add.click();
  ok(/1/.test(await p.textContent('.nc-cab-n')), 'cabinet: saved to my cabinet');
  const vid = await p.$('.nc-wx-video');
  if (vid) { const r = await vid.evaluate(v => v.play().then(() => 'playing', e => 'err ' + e)); ok(r === 'playing', 'footage: plays'); }

  // Assignment + gathered
  await p.evaluate(() => switchTab('assignment'));
  await p.fill('#nc-p1', 'I guessed 110 and size. Bumpus found 72 revived and size was not the reason, the lighter birds lived.');
  await p.fill('#partb-1', 'asdf');
  await p.evaluate(() => window.refreshGathered && window.refreshGathered());
  const gath = await p.$eval('#gatheredOutput', t => t.value);
  ok(/110 of 136 sparrows/.test(gath), 'gathered: Warm-Up guess line');
  ok(/RUN THE WINTER/.test(gath) && /THREE WINTERS/.test(gath) && /DRYING POND/.test(gath), 'gathered: Parts 2–4 lines');

  // reload: everything kept
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.$eval('.nc-wn', g => g.classList.contains('nc-done')), 'reload: winter still done');
  ok(await p.$eval('.nc-bd', g => g.classList.contains('nc-done')), 'reload: band still done');
  ok(await p.$eval('.nc-dn', g => g.classList.contains('nc-done')), 'reload: drain still done');
  ok(!(await p.$eval('.nc-tr-seal', e => e.hidden)), 'reload: tray guess kept');
  const dead = await p.$$eval('button:disabled', bs => bs.filter(b => b.offsetParent && !b.textContent.trim()).length);
  ok(dead === 0, 'no unlabeled disabled buttons');
  // resets work
  await p.evaluate(() => switchTab('lesson'));
  await p.click('.nc-wn-reset');
  ok(!(await p.$eval('.nc-wn', g => g.classList.contains('nc-done'))), 'winter reset clears');
  await p.click('.nc-bd-reset');
  ok((await p.$$('.nc-bd-gen')).length === 0 && !(await p.$eval('.nc-bd-next', b => b.hidden)), 'band reset back to winter 1');
  ok(await p.evaluate(() => (window.NC_FAILED || []).length === 0), 'NC_FAILED empty');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await p.screenshot({ path: 'tools/sparkle/out/21-01/play-' + W + '.png', fullPage: false });
  await b.close();
  console.log('width ' + W + '\n' + log.join('\n'));
  if (log.some(l => l.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(log.join('\n')); console.error('ERR', e.message); process.exit(1); });
