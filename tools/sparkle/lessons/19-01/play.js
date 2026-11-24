// 19.01 play script: plays every game by tap and by drag, wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/19-01/play.js [1150|420]
// At 420 px it runs with reduced motion on (the no-animation path, buttons); at 1150 px with motion (drags, real waits).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '19-01'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-19-01-what-organs-help-the-human-body-function.html?steps=0';
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
    const done = sel => ev(s => !!document.querySelector(s) && document.querySelector(s).classList.contains('nc-done'), sel);
    const closeNotes = () => ev(() => document.querySelectorAll('.nc-note button').forEach(b => b.click()));
    const shot = async (sel, name) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `play-${W}-${name}.png`) }); };
    const tab = async id => { await ev(i => window.switchTab(i), id); await p.waitForTimeout(250); };
    const box = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); return l.boundingBox(); };

    if (!RM) {
      await click('.nc-op-start'); await p.waitForTimeout(2600);
      const op = await ev(() => window.__ncOpener && window.__ncOpener.state());
      op && op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
      console.log('     caption now:', await txt('.nc-op-cap-t'), '|', await txt('.nc-op-sub'));
      await click('.nc-op-skip');
    }

    // ── Warm-Up: pin the heart
    await shot('.nc-pn', 'pin-0');
    (await ev(() => document.querySelector('.nc-pn-save').disabled)) ? OK('Save waits for a pin') : FAIL('save enabled early');
    const xb = await box('.nc-pn-fig');
    await p.mouse.click(xb.x + xb.width * 0.78, xb.y + xb.height * 0.6); await p.waitForTimeout(150); // far to the person's left first
    if (!RM) { await p.mouse.move(xb.x + xb.width * 0.78, xb.y + xb.height * 0.6); await p.mouse.down(); await p.mouse.move(xb.x + xb.width * 0.7, xb.y + xb.height * 0.62, { steps: 6 }); await p.mouse.up(); }
    else { await click('.nc-pn-keys button[data-d="-1,0"]'); }
    const pn = await ev(() => JSON.parse(localStorage.getItem('oao.nc.g5sci-19-1')).pn);
    pn && pn.x < 0.78 ? OK(`pin moved (${pn.x.toFixed(2)}, ${pn.y.toFixed(2)})`) : FAIL('pin move ' + JSON.stringify(pn));
    await click('.nc-pn-save');
    (await txt('.nc-pn-seal')).indexOf('Saved') > -1 ? OK('pin saved: ' + await txt('.nc-pn-seal')) : FAIL('save');
    (await ev(() => !document.querySelector('.nc-pn-edit').hidden)) ? OK('Move my pin button offered') : FAIL('edit button');
    await p.fill('#pred-1', 'I put my pin on the left because I feel my heart beat on the left side of my chest.');
    await shot('.nc-pn', 'pin-1');
    const st = await p.locator('.nc-wl-st').count(); for (let i = 0; i < st; i++) await click(`.nc-wl-st[data-i="${i}"]`);
    console.log('     word lens:', await txt('.nc-wl-dots'));
    await closeNotes();

    // ── Part 1: source + vein
    await tab('lesson');
    await shot('.nc-src', 'source');
    await click('.nc-src-hl[data-i="0"]'); console.log('     hunt 1 miss:', (await txt('.nc-src-asks')).slice(0, 160));
    await click('.nc-src-hl[data-i="1"]'); await click('.nc-src-hl[data-i="5"]'); console.log('     hunt 2 miss:', (await txt('.nc-src-asks')).slice(-90));
    await click('.nc-src-hl[data-i="6"]');
    (await done('.nc-src')) ? OK('both hunts found') : FAIL('hunts');
    await closeNotes();
    await shot('.nc-vn', 'vein-0');
    const fig = await box('.nc-vn-fig'), at = (x, y) => [fig.x + x / 600 * fig.width, fig.y + y / 1200 * fig.height];
    const dragPath = async (pts) => { const a = at(...pts[0]); await p.mouse.move(a[0], a[1]); await p.mouse.down(); for (const q of pts.slice(1)) { const c = at(...q); await p.mouse.move(c[0], c[1], { steps: 8 }); } await p.mouse.up(); await p.waitForTimeout(RM ? 150 : 1300); };
    if (!RM) {
      await dragPath([[200, 400], [210, 700]]); console.log('     off the vein:', await txt('.nc-vn-fb'));
      await dragPath([[284, 470], [283, 560]]); console.log('     short slide:', await txt('.nc-vn-fb'));
      await dragPath([[282, 600], [305, 674], [326, 741], [335, 829], [330, 900]]); console.log('     slide down:', await txt('.nc-vn-fb'));
    } else { await click('.nc-vn-up'); console.log('     up first:', await txt('.nc-vn-fb')); await click('.nc-vn-down'); console.log('     slide down:', await txt('.nc-vn-fb')); }
    (await ev(() => !document.querySelector('.nc-vn-lift').hidden)) ? OK('Lift the thumb appears') : FAIL('lift button');
    await shot('.nc-vn', 'vein-1');
    await click('.nc-vn-lift'); await p.waitForTimeout(RM ? 150 : 1200); console.log('     lift:', await txt('.nc-vn-fb'));
    if (!RM) { await dragPath([[330, 918], [335, 829], [332, 790], [330, 760]]); console.log('     slide up:', await txt('.nc-vn-fb')); }
    else if (!(await ev(() => JSON.parse(localStorage.getItem('oao.nc.g5sci-19-1')).vn.up))) await click('.nc-vn-up');
    (await ev(() => !document.querySelector('.nc-vn-ask').hidden)) ? OK('question appears after three tests: ' + await txt('.nc-vn-task')) : FAIL('vein question hidden: ' + await txt('.nc-vn-task'));
    await click('.nc-vn-ask .nc-opt[data-i="1"]'); console.log('     vein miss:', await txt('.nc-vn-afb'));
    await click('.nc-vn-ask .nc-opt[data-i="0"]');
    (await done('.nc-vn')) ? OK('vein done') : FAIL('vein not done');
    await shot('.nc-vn', 'vein-2');

    // ── Part 2: knock one out
    await click('.nc-ko-org[data-k="brain"]'); console.log('     brain:', await txt('.nc-ko-panel'));
    await click('.nc-ko-org[data-k="brain"]');
    for (const [k, wrong, right] of [['heart', 2, 0], ['lungs', 0, 1], ['stomach', 2, 2]]) {
      await click(`.nc-ko-org[data-k="${k}"]`);
      await click(`.nc-ko-opts .nc-opt[data-i="${k === 'stomach' ? right : wrong}"]`);
      await p.waitForTimeout(RM ? 200 : 3200);
      console.log(`     ${k}:`, (await txt('.nc-ko-fb')).slice(0, 80), '|', (await txt('.nc-ko-end')));
      if (k === 'heart') await shot('.nc-ko', 'knock-heart');
    }
    (await done('.nc-ko')) ? OK('knock done: ' + await txt('.nc-ko-score')) : FAIL('knock not done: ' + await txt('.nc-ko-score'));
    await closeNotes();
    await click('.nc-wx:has(video) summary');
    const vid = await ev(async () => { const v = document.querySelector('.nc-wx-video'); v.muted = true; try { await v.play(); } catch (e) { return 'play error ' + e.message; } await new Promise(r => setTimeout(r, 900)); return v.currentTime > 0 ? 'playing ' + v.currentTime.toFixed(1) : 'not playing'; });
    vid.startsWith('playing') ? OK('footage ' + vid) : FAIL('footage ' + vid);

    // ── Part 3: race the reflex
    await click('.nc-rx-go'); await p.waitForTimeout(300);
    const pb = await box('.nc-rx-pad'); await p.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2); console.log('     early tap:', await txt('.nc-rx-msg'));
    (await ev(() => !document.querySelector('.nc-rx-go').hidden)) ? OK('Start shows again after an early tap: ' + await txt('.nc-rx-go')) : FAIL('no way to retry after early tap');
    for (let i = 0; i < 3; i++) {
      await click('.nc-rx-go');
      await p.waitForSelector('.nc-rx-pad.red', { timeout: 6000 });
      await p.waitForTimeout(180 + i * 40);
      await p.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2); await p.waitForTimeout(150);
    }
    console.log('     times:', await txt('.nc-rx-times'));
    (await done('.nc-rx')) ? OK('reflex done') : FAIL('reflex not done');
    console.log('     bars:', (await txt('.nc-rx-bars')).replace(/\s+/g, ' '));
    await shot('.nc-rx', 'reflex');

    // ── Part 4: light the team
    await click('.nc-tm-org[data-k="lungs"]'); await click('.nc-tm-org[data-k="stomach"]'); await click('.nc-tm-check'); console.log('     stairs wrong:', await txt('.nc-tm-fb'));
    await click('.nc-tm-org[data-k="stomach"]'); await click('.nc-tm-check'); console.log('     stairs missing:', await txt('.nc-tm-fb'));
    const team = { 0: ['heart', 'muscles', 'brain', 'skeleton'], 1: ['stomach', 'intestines', 'heart', 'pancreas'], 2: ['skin', 'muscles', 'brain'], 3: ['intestines', 'heart', 'kidneys', 'bladder'] };
    for (const i of [0, 1, 2, 3]) {
      await click(`.nc-tm-tab[data-i="${i}"]`);
      for (const k of team[i]) await click(`.nc-tm-org[data-k="${k}"]`);
      await click('.nc-tm-check'); console.log(`     case ${i}:`, (await txt('.nc-tm-fb')).slice(0, 90));
    }
    (await done('.nc-tm')) ? OK('team done') : FAIL('team not done');
    console.log('     compare:', (await txt('.nc-tm-rows')).replace(/\s+/g, ' '));
    (await ev(() => document.querySelector('.nc-pn-edit').hidden && !document.querySelector('.nc-pn .nc-pn-real').hidden)) ? OK('warm-up locked and shows the real heart') : FAIL('warm-up not locked');
    await closeNotes();
    await shot('.nc-tm', 'team-done');
    // data
    await click('.nc-wx:has(.nc-bars) summary');
    const bb = await box('.nc-bars'); await p.mouse.move(bb.x + bb.width * 0.15, bb.y + bb.height * 0.6); console.log('     bar readout:', await txt('.nc-wx:has(.nc-bars) .nc-dt-read'));
    await click('.nc-wx:has(.nc-bars) .nc-opt[data-i="1"]'); console.log('     data miss:', await txt('.nc-wx:has(.nc-bars) .nc-fb'));
    await click('.nc-wx:has(.nc-bars) .nc-opt[data-i="0"]');
    (await txt('.nc-wx:has(.nc-bars) .nc-fb')).indexOf('slower') > -1 ? OK('data question') : FAIL('data question');
    await shot('.nc-wx:has(.nc-bars)', 'data');
    await click('.nc-wx:has(.nc-cab) summary'); await p.waitForTimeout(4000);
    const mv = await ev(() => { const m = document.querySelector('model-viewer'); return m ? (m.loaded ? 'loaded' : 'present, not loaded') : 'none'; });
    mv === 'loaded' ? OK('3D model loads') : FAIL('3D model ' + mv);
    await shot('.nc-wx:has(.nc-cab)', 'cabinet');
    await click('.nc-cab-add'); await closeNotes();

    // ── Assignment
    await tab('assignment');
    console.log('     saved reaction chip:', (await txt('.nc-rx-saved')).replace(/\s+/g, ' '));
    await p.fill('#nc-p1', 'asdf'); await p.fill('#nc-p3', 'My average was about a quarter second. The reflex is faster because the spinal cord tells the muscles to pull before the brain feels it.');
    await click('.nc-plan-c[data-i="0"]');
    const g = await ev(() => { window.refreshGathered(); return document.getElementById('gatheredOutput').value; });
    g.indexOf('PART 3: MY REACTION TIME') > -1 && g.indexOf('PART 4: ORGAN TEAMS') > -1 && g.indexOf('My heart pin') > -1 ? OK('gathered answers include pin, reaction time, teams') : FAIL('gathered lines');
    console.log(g.split('\n').slice(6, 18).join('\n'));
    await shot('.nc-np', 'notebook-page');

    // ── reload keeps everything
    await p.reload(); await p.waitForTimeout(900);
    const keep = await ev(() => ({ pn: document.querySelector('.nc-pn-seal').textContent, vn: document.querySelector('.nc-vn').classList.contains('nc-done'), ko: document.querySelector('.nc-ko').classList.contains('nc-done'), rx: document.querySelector('.nc-rx').classList.contains('nc-done'), tm: document.querySelector('.nc-tm').classList.contains('nc-done'), p3: document.getElementById('nc-p3').value.length }));
    keep.vn && keep.ko && keep.rx && keep.tm && keep.p3 > 20 && keep.pn.indexOf('Part 4 showed') > -1 ? OK('reload keeps everything') : FAIL('reload lost something ' + JSON.stringify(keep));
    await tab('lesson');
    const lbl = await ev(() => [...document.querySelectorAll('.nc-vn button, .nc-ko button, .nc-rx button, .nc-tm button')].filter(b => b.offsetParent && b.disabled && !b.textContent.trim()).length);
    lbl ? FAIL(lbl + ' disabled unlabeled buttons') : OK('no unlabeled dead-end buttons');
    await click('.nc-vn-reset'); (await done('.nc-vn')) ? FAIL('vein reset') : OK('vein reset');
    await click('.nc-ko-reset'); (await txt('.nc-ko-score')).startsWith('0') ? OK('knock reset') : FAIL('knock reset');
    await click('.nc-rx-reset'); (await txt('.nc-rx-times')) === '' ? OK('reflex reset') : FAIL('reflex reset');
    const nf = await ev(() => window.NC_FAILED); nf.length ? FAIL('NC_FAILED ' + nf) : OK('NC_FAILED empty');
    errs.length ? FAIL('page errors: ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall ok');
})();
