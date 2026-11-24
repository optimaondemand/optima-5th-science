// 18.02 play script: plays every game by tap and by drag, wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/18-02/play.js [1150|420]
// At 420 px it runs with reduced motion on (the no-animation path); at 1150 px with motion (real waits).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '18-02'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-18-02-model-energy-from-sun-to-plants-and-animals.html?steps=0';
let fails = 0; const FAIL = m => { fails++; console.log('FAIL', m); }, OK = m => console.log('ok  ', m);
const only = process.argv[2] ? [+process.argv[2]] : [1150, 420];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const W of only) {
    const RM = W === 420;
    console.log(`\n=== ${W}px${RM ? ' (reduced motion)' : ''} ===`);
    const ctx = await b.newContext({ viewport: { width: W, height: 900 }, reducedMotion: RM ? 'reduce' : 'no-preference', hasTouch: RM });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(900);
    const ev = (f, a) => p.evaluate(f, a);
    const click = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(140); };
    const txt = sel => ev(s => (document.querySelector(s) || {}).textContent || '', sel);
    const closeNotes = () => ev(() => document.querySelectorAll('.nc-note button').forEach(b => b.click()));
    const shot = async (sel, name) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `play-${W}-${name}.png`) }); };
    const tab = async id => { await ev(i => window.switchTab(i), id); await p.waitForTimeout(250); };
    const box = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); return l.boundingBox(); };
    const drag = async (from, to) => { const a = await box(from), c = await box(to); await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 10, { steps: 4 }); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(200); };

    if (!RM) {
      await click('.nc-op-start'); await p.waitForTimeout(2600);
      const op = await ev(() => window.__ncOpener && window.__ncOpener.state());
      op && op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
      console.log('     caption now:', await txt('.nc-op-cap-t'), '|', await txt('.nc-op-sub'));
      await click('.nc-op-skip');
    }

    // ── Warm-Up: turn the arrow
    await shot('.nc-tn', 'turn-0');
    (await ev(() => document.querySelector('.nc-tn-ask').hidden)) ? OK('meaning question waits for an arrow') : FAIL('ask shown early');
    if (RM) { await click('.nc-tn-turn'); } else { await drag('.nc-tn-arrow', '.nc-tn-tag >> nth=1'); }
    console.log('     arrow now:', await txt('.nc-tn-now'));
    await click('.nc-tn-turn'); console.log('     after Turn:', await txt('.nc-tn-now'));
    if (!RM) { await drag('.nc-tn-arrow', '.nc-tn-tag >> nth=0'); console.log('     after drag to the rabbit:', await txt('.nc-tn-now')); }
    else { if ((await txt('.nc-tn-now')).indexOf('rabbit') < 0) await click('.nc-tn-turn'); }
    (await txt('.nc-tn-now')).indexOf('rabbit') > -1 ? OK('arrow points to the rabbit') : FAIL('arrow direction');
    await click('.nc-tn-opts .nc-opt[data-i="1"]'); await click('.nc-tn-save');
    (await txt('.nc-tn-seal')).indexOf('Saved') > -1 ? OK('prediction saved: ' + await txt('.nc-tn-seal')) : FAIL('save');
    (await ev(() => document.querySelector('.nc-tn-turn').disabled && !document.querySelector('.nc-tn-turn').hidden)) ? OK('Turn button stays visible and labeled when saved: ' + await txt('.nc-tn-turn')) : FAIL('turn button state');
    await p.fill('#pred-1', 'I think the arrow points to the rabbit because the rabbit gets the energy from the clover it eats.');
    await shot('.nc-tn', 'turn-1');
    // word lens
    const st = await p.locator('.nc-wl-st').count(); for (let i = 0; i < st; i++) await click(`.nc-wl-st[data-i="${i}"]`);
    console.log('     word lens:', await txt('.nc-wl-dots'));
    await closeNotes();

    // ── Part 1: source + trace
    await tab('lesson');
    await shot('.nc-src', 'source');
    await click('.nc-src-hl[data-i="0"]'); console.log('     hunt 1 miss:', await txt('.nc-src-asks'));
    await click('.nc-src-hl[data-i="3"]'); await click('.nc-src-hl[data-i="1"]');
    (await ev(() => document.querySelector('.nc-src').classList.contains('nc-done'))) ? OK('both hunts found') : FAIL('hunts');
    await closeNotes();
    await click('.nc-tc-box[data-k="fox"]'); console.log('     trace wrong start:', await txt('.nc-tc-fb'));
    for (const k of ['marine', 'seals']) await click(`.nc-tc-box[data-k="${k}"]`);
    await click('.nc-tc-box[data-k="fox"]'); console.log('     trace wrong mid:', await txt('.nc-tc-fb'));
    await click('.nc-tc-box[data-k="bear"]');
    for (const k of ['plants', 'ptarmigan', 'fox']) await click(`.nc-tc-box[data-k="${k}"]`);
    await click('.nc-tc-box[data-k="geese"]'); console.log('     find wrong:', await txt('.nc-tc-fb'));
    for (const k of ['seals', 'birds', 'dung2']) await click(`.nc-tc-box[data-k="${k}"]`);
    (await ev(() => document.querySelector('.nc-tc').classList.contains('nc-done'))) ? OK('trace done: ' + await txt('.nc-tc-task')) : FAIL('trace not done: ' + await txt('.nc-tc-task'));
    await shot('.nc-tc', 'trace');

    // ── Part 2: flip and run
    await shot('.nc-fl', 'flip-0');
    await click('.nc-fl-run'); await p.waitForTimeout(RM ? 200 : 5200);
    console.log('     run 1 says:', (await txt('.nc-fl-says')).replace(/\s+/g, ' ').slice(0, 300));
    (await ev(() => document.querySelector('.nc-fl').classList.contains('nc-done'))) ? FAIL('won with backward arrows') : OK('backward arrows do not win');
    await shot('.nc-fl', 'flip-1');
    await click('.nc-fl-ar[data-i="1"]'); await click('.nc-fl-ar[data-i="3"]');
    await click('.nc-fl-run'); await p.waitForTimeout(RM ? 200 : 5200);
    (await ev(() => document.querySelector('.nc-fl').classList.contains('nc-done'))) ? OK('flip done: ' + await txt('.nc-fl-win')) : FAIL('flip not done');
    await shot('.nc-fl', 'flip-2');
    // footage
    await click('.nc-wx:has(video) summary');
    const vid = await ev(async () => { const v = document.querySelector('.nc-wx-video'); v.muted = true; try { await v.play(); } catch (e) { return 'play error ' + e.message; } await new Promise(r => setTimeout(r, 900)); return v.currentTime > 0 ? 'playing ' + v.currentTime.toFixed(1) : 'not playing'; });
    vid.startsWith('playing') ? OK('footage ' + vid) : FAIL('footage ' + vid);

    // ── Part 3: pond
    for (let i = 0; i < 6; i++) { await click(`.nc-pd-spot[data-i="${i}"]`); if (i === 2) { console.log('     pond after 3:', await txt('.nc-pd-fb')); await shot('.nc-pd', 'pond-3'); } }
    (await ev(() => document.querySelector('.nc-pd').classList.contains('nc-done'))) ? OK('pond done: ' + await txt('.nc-pd-fb')) : FAIL('pond');
    const lines = await ev(() => document.querySelectorAll('.nc-pd-svg line').length); lines >= 12 ? OK(lines + ' web arrows drawn') : FAIL('web arrows ' + lines);
    await shot('.nc-pd', 'pond-6');

    // ── Part 4: draw
    await click('.nc-dw-pl[data-i="0"]');
    await shot('.nc-dw', 'draw-0');
    const tapArrow = async (a, c) => { await click(`.nc-dw-card[data-k="${a}"]`); await click(`.nc-dw-card[data-k="${c}"]`); };
    const arrow = async (a, c) => RM ? tapArrow(a, c) : drag(`.nc-dw-card[data-k="${a}"]`, `.nc-dw-card[data-k="${c}"]`);
    await arrow('grass', 'sun'); console.log('     backward:', await txt('.nc-dw-fb'));
    await arrow('hawk', 'grass'); console.log('     no link:', await txt('.nc-dw-fb'));
    await arrow('sun', 'grass'); await arrow('grass', 'cricket'); await arrow('cricket', 'anole');
    await click('.nc-dw-undo'); (await ev(() => window.localStorage.getItem('oao.nc.g5sci-18-2'))).indexOf('"anole"') < 0 ? OK('undo erases the last arrow') : FAIL('undo');
    await arrow('cricket', 'anole'); await arrow('anole', 'hawk');
    console.log('     core done:', await txt('.nc-dw-fb'));
    (await p.locator('.nc-dw-card').count()) === 7 ? OK('extra cards appear') : FAIL('extra cards');
    await arrow('cricket', 'mock'); await arrow('hawk', 'mush');
    (await ev(() => document.querySelector('.nc-dw').classList.contains('nc-done'))) ? OK('draw done') : FAIL('draw not done: ' + await txt('.nc-dw-fb'));
    console.log('     table:', (await txt('.nc-dw-table')).replace(/\s+/g, ' ').slice(0, 260));
    console.log('     compare:', (await txt('.nc-dw-rows')).replace(/\s+/g, ' '));
    (await ev(() => document.querySelector('.nc-tn-edit').hidden)) ? OK('warm-up locked after Part 4') : FAIL('warm-up not locked');
    await closeNotes();
    await shot('.nc-dw', 'draw-done');
    // data
    await click('.nc-wx:has(.nc-bars) summary');
    const bb = await box('.nc-bars'); await p.mouse.move(bb.x + bb.width * 0.9, bb.y + bb.height * 0.6); console.log('     bar readout:', await txt('.nc-wx .nc-dt-read'));
    await click('.nc-wx:has(.nc-bars) .nc-opt[data-i="1"]'); console.log('     data miss:', await txt('.nc-wx:has(.nc-bars) .nc-fb'));
    await click('.nc-wx:has(.nc-bars) .nc-opt[data-i="0"]');
    (await txt('.nc-wx:has(.nc-bars) .nc-fb')).indexOf('12 times') > -1 ? OK('data question') : FAIL('data question');
    await shot('.nc-wx:has(.nc-bars)', 'data');
    // cabinet
    await click('.nc-wx:has(.nc-cab) summary'); await p.waitForTimeout(4000);
    const mv = await ev(() => { const m = document.querySelector('model-viewer'); return m ? (m.loaded ? 'loaded' : 'present, not loaded') : 'none'; });
    mv === 'loaded' ? OK('3D model loads') : FAIL('3D model ' + mv);
    await shot('.nc-wx:has(.nc-cab)', 'cabinet');
    await click('.nc-cab-add'); await closeNotes();

    // ── Assignment
    await tab('assignment');
    console.log('     saved model chip:', (await txt('.nc-dw-saved')).replace(/\s+/g, ' '));
    await p.fill('#nc-p1', 'asdf'); await p.fill('#nc-p3', 'Matter like dung and dead plants goes around in a cycle because bacteria turn it into salts that plants use again, but energy only moves one way.');
    await click('.nc-plan-c[data-i="0"]');
    const g = await ev(() => { window.refreshGathered(); return document.getElementById('gatheredOutput').value; });
    g.indexOf('PART 4: MY FOOD CHAIN MODEL') > -1 && g.indexOf('Sun → Grass') > -1 ? OK('gathered answers include the model') : FAIL('gathered model line');
    console.log(g.split('\n').slice(6, 16).join('\n'));
    await shot('.nc-np', 'notebook-page');

    // ── reload keeps everything
    await p.reload(); await p.waitForTimeout(900);
    const keep = await ev(() => ({ tn: document.querySelector('.nc-tn-seal').textContent, tc: document.querySelector('.nc-tc').classList.contains('nc-done'), fl: document.querySelector('.nc-fl').classList.contains('nc-done'), pd: document.querySelector('.nc-pd').classList.contains('nc-done'), dw: document.querySelector('.nc-dw').classList.contains('nc-done'), p3: document.getElementById('nc-p3').value.length }));
    keep.tc && keep.fl && keep.pd && keep.dw && keep.p3 > 20 && keep.tn.indexOf('Part 4 showed') > -1 ? OK('reload keeps everything') : FAIL('reload lost something ' + JSON.stringify(keep));
    // try again buttons
    await tab('lesson');
    await click('.nc-fl-mix'); (await ev(() => !document.querySelector('.nc-fl').classList.contains('nc-done'))) ? OK('Mix up the arrows resets the flip game') : FAIL('mix');
    await click('.nc-pd-reset'); (await txt('.nc-pd-count')).startsWith('0') ? OK('pond reset') : FAIL('pond reset');
    await click('.nc-tc-reset'); (await txt('.nc-tc-task')).indexOf('Path 1') > -1 ? OK('trace reset') : FAIL('trace reset');
    const nf = await ev(() => window.NC_FAILED); nf.length ? FAIL('NC_FAILED ' + nf) : OK('NC_FAILED empty');
    errs.length ? FAIL('page errors: ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall ok');
})();
