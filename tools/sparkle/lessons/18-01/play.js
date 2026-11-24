// 18.01 play script: plays every game by tap and by drag, wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/18-01/play.js
// At 420 px it runs with reduced motion on (the no-animation path); at 1150 px with motion (real waits).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '18-01'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-18-01-where-does-food-energy-begin.html?steps=0';
let fails = 0; const FAIL = m => { fails++; console.log('FAIL', m); }, OK = m => console.log('ok  ', m);

(async () => {
  const b = await chromium.launch();
  for (const W of [1150, 420]) {
    const RM = W === 420;
    console.log(`\n=== ${W}px${RM ? ' (reduced motion)' : ''} ===`);
    const ctx = await b.newContext({ viewport: { width: W, height: 900 }, reducedMotion: RM ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
    const ev = (f, a) => p.evaluate(f, a);
    const click = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(140); };
    const txt = sel => ev(s => (document.querySelector(s) || {}).textContent || '', sel);
    const closeNotes = () => ev(() => document.querySelectorAll('.nc-note button').forEach(b => b.click()));
    const shot = async (sel, name) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `play-${W}-${name}.png`) }); };

    // opener
    if (!RM) {
      await click('.nc-op-start'); await p.waitForTimeout(2600);
      const op = await ev(() => window.__ncOpener.state());
      op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
      console.log('     caption now:', await txt('.nc-op-cap-t'), '|', await txt('.nc-op-sub'));
      await click('.nc-op-skip'); (await ev(() => window.__ncOpener.state().ended)) ? OK('skip ends the opener') : FAIL('skip');
    }

    // warm-up: rewind my lunch
    (await ev(() => document.querySelector('.nc-rw-ask').hidden)) ? OK('questions wait for a meal') : FAIL('ask visible before a meal');
    await click('.nc-rw-meal[data-i="2"]');
    await click('.nc-rw-reach .nc-opt[data-i="1"]');
    (await ev(() => document.querySelector('.nc-rw-stepsq').hidden)) ? OK('"No" hides the steps question') : FAIL('steps shown for No');
    await click('.nc-rw-reach .nc-opt[data-i="0"]');
    await click('.nc-rw-plus'); await click('.nc-rw-plus'); await click('.nc-rw-minus');
    (await txt('.nc-rw-n')) === '3' ? OK('steps + and - work (3)') : FAIL('steps ' + await txt('.nc-rw-n'));
    await click('.nc-rw-save');
    let seal = await txt('.nc-rw-seal'); /Apple.*3 steps/.test(seal) ? OK('saved: ' + seal) : FAIL('seal ' + seal);
    await click('.nc-rw-edit'); (await ev(() => !document.querySelector('.nc-rw-meal').disabled)) ? OK('change my prediction unlocks') : FAIL('edit');
    await click('.nc-rw-minus'); await click('.nc-rw-save');
    await p.fill('#pred-1', 'I think the apple rewinds to the sun because the tree used sunlight to make it.');
    await shot('.nc-rw', 'rewind');
    for (let i = 0; i < 6; i++) await click(`.nc-wl-st[data-i="${i}"]`);
    /6 of 6/.test(await txt('.nc-wl-dots')) ? OK('word lens: 6 of 6') : FAIL('word lens');

    // lesson tab
    await ev(() => switchTab('lesson')); await p.waitForTimeout(300);
    // Part 1: the page and its hunts (wrong lines first)
    await click('.nc-src-hl[data-i="0"]');
    /Look for the line/.test(await txt('.nc-src-asks')) ? OK('hunt 1 miss gives a hint') : FAIL('hunt 1 miss');
    await click('.nc-src-hl[data-i="2"]'); await click('.nc-src-hl[data-i="4"]'); await click('.nc-src-hl[data-i="3"]'); await click('.nc-src-hl[data-i="1"]');
    (await ev(() => document.querySelector('.nc-src').classList.contains('nc-done'))) ? OK('source: both hunts found') : FAIL('source not done');
    (await txt('.nc-src-count')) === '5' ? OK('5 of 5 lines read') : FAIL('lines read');
    await shot('.nc-src', 'source');
    // Part 1 game: the sun dial
    const setSun = v => ev(v => { const s = document.querySelector('.nc-lp-sl'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    for (const v of [90, 45, 8]) {
      await setSun(v); await click('.nc-lp-go');
      if (!RM) { (await ev(() => document.querySelector('.nc-lp-go').disabled)) ? OK('counting locks the controls') : FAIL('not locked'); await p.waitForTimeout(6400); }
      if (v === 90 && !RM) await shot('.nc-lp-stage', 'lamp-sun');
    }
    const rec = await ev(() => JSON.parse(localStorage.getItem('oao.nc.g5sci-18-1')).lp.rec);
    console.log('     counts:', JSON.stringify(rec));
    rec.sun > rec.shade && rec.shade > 0 && rec.night === 0 ? OK('bright > shade > night = 0') : FAIL('counts ' + JSON.stringify(rec));
    await click('.nc-lp-q .nc-opt[data-i="2"]'); /table/.test(await txt('.nc-lp-fb')) ? OK('wrong answer: hint') : FAIL('lamp hint');
    await click('.nc-lp-q .nc-opt[data-i="0"]');
    (await ev(() => document.querySelector('.nc-lp').classList.contains('nc-done'))) ? OK('sun dial done') : FAIL('lamp not done');
    await setSun(80); await shot('.nc-lp', 'lamp');
    // Part 2: the sunbeam (one by drag, the rest by Shine; one wrong guess)
    await click('.nc-bm-c[data-i="0"] .nc-bm-gb[data-k="c"]');
    if (!RM) {
      await closeNotes(); await p.locator('.nc-bm-c[data-i="0"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(900); const s = await p.locator('.nc-bm-sun').boundingBox(); const t = await p.locator('.nc-bm-c[data-i="0"] .nc-bm-ph').boundingBox();
      await p.mouse.move(s.x + s.width / 2, s.y + s.height / 2); await p.mouse.down();
      await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(200);
      (await ev(() => document.querySelector('.nc-bm-c[data-i="0"]').classList.contains('lit'))) ? OK('drag the sun lights a photo') : FAIL('drag did not light');
    } else await click('.nc-bm-c[data-i="0"] .nc-bm-shine');
    const ans = ['p', 'c', 'p', 'c', 'p', 'c'];
    for (let i = 1; i < 6; i++) { await click(`.nc-bm-c[data-i="${i}"] .nc-bm-gb[data-k="${ans[i]}"]`); await click(`.nc-bm-c[data-i="${i}"] .nc-bm-shine`); }
    const sc = await txt('.nc-bm-score'); /5 of 6/.test(sc) ? OK('sunbeam: ' + sc.slice(0, 60)) : FAIL('score ' + sc);
    await shot('.nc-bm', 'beam');
    // Part 3: pour
    await click('.nc-po-p .nc-opt[data-i="0"]');
    if (!RM) {
      await closeNotes(); await p.locator('.nc-po-go').scrollIntoViewIfNeeded(); await p.waitForTimeout(900); const g = await p.locator('.nc-po-go').boundingBox(); console.log('     at pour button:', await ev(([x,y]) => { const e = document.elementFromPoint(x, y); return e && (e.className + ' ' + e.tagName + ' ' + (e.textContent||'').slice(0,40)); }, [g.x+20, g.y+10]), JSON.stringify(g)); await p.mouse.move(g.x + 20, g.y + 10); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up();
      /Keep pouring/.test(await txt('.nc-po-go')) ? OK('let go early: ' + await txt('.nc-po-go')) : FAIL('hold label');
      await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(3200);
    } else { for (let i = 0; i < 4; i++) await click('.nc-po-go'); await p.waitForTimeout(300); }
    const nums = await ev(() => [...document.querySelectorAll('.nc-po-n')].map(e => e.textContent));
    nums.join('|') === '☀️|1,000|100|10|1' ? OK('pour: ' + nums.join(' → ')) : FAIL('pour nums ' + nums.join('|'));
    for (let i = 0; i < 4; i++) {
      const right = ['light', 'chemical', 'motion', 'heat'][i], wrong = ['heat', 'motion', 'light', 'chemical'][i];
      await click(`.nc-po-row[data-i="${i}"] .nc-po-f[data-f="${wrong}"]`); await click(`.nc-po-row[data-i="${i}"] .nc-po-f[data-f="${right}"]`);
    }
    (await ev(() => !document.querySelector('.nc-po-q').hidden)) ? OK('all four energy forms tagged') : FAIL('tags');
    await click('.nc-po-q .nc-opt[data-i="0"]'); await click('.nc-po-q .nc-opt[data-i="1"]');
    (await ev(() => document.querySelector('.nc-po').classList.contains('nc-done'))) ? OK('pour done') : FAIL('pour not done');
    await shot('.nc-po', 'pour');
    // Part 4: rewind, build, switch
    for (let i = 0; i < 3; i++) { for (let k = 0; k < 3; k++) { const d = await ev(i => document.querySelector(`.nc-yd-meal[data-i="${i}"] .nc-yd-rw`).disabled, i); if (!d) await click(`.nc-yd-meal[data-i="${i}"] .nc-yd-rw`); } }
    (await ev(() => [...document.querySelectorAll('.nc-yd-meal')].every(e => e.classList.contains('done')))) ? OK('all three meals rewound to the sun') : FAIL('rewind');
    seal = await ev(() => document.querySelector('.nc-rw-seal').textContent); /Part 4 showed/.test(seal) ? OK('warm-up locked: ' + seal) : FAIL('lock ' + seal);
    await click('.nc-yd-card[data-k="hawk"]'); /Every chain starts/.test(await txt('.nc-yd-bfb')) ? OK('wrong card: hint') : FAIL('build hint');
    await click('.nc-yd-card[data-k="sun"]');
    if (!RM) {
      await closeNotes(); await p.locator('.nc-yd-slots').scrollIntoViewIfNeeded(); await p.waitForTimeout(900); const c = await p.locator('.nc-yd-card[data-k="grass"]').boundingBox(), s = await p.locator('.nc-yd-slots').boundingBox();
      await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
      (await ev(() => document.querySelectorAll('.nc-yd-slot.on').length)) === 2 ? OK('drag a card into the chain') : FAIL('drag card');
    } else await click('.nc-yd-card[data-k="grass"]');
    for (const k of ['cricket', 'anole', 'hawk']) await click(`.nc-yd-card[data-k="${k}"]`);
    (await ev(() => !document.querySelector('.nc-yd-s').hidden)) ? OK('chain built: the sun switch appears') : FAIL('build');
    (await ev(() => document.querySelector('.nc-yd-switch').disabled)) ? OK('switch waits for a prediction') : FAIL('switch not locked');
    await click('.nc-yd-sp .nc-opt[data-i="1"]');
    await click('.nc-yd-switch'); await p.waitForTimeout(RM ? 300 : 5200);
    const gone = await ev(() => document.querySelectorAll('.nc-yd-slot.gone').length), story = await ev(() => document.querySelectorAll('.nc-yd-story li').length);
    gone === 4 && story === 4 ? OK('sun off: 4 links fade, 4 story lines') : FAIL(`gone ${gone} story ${story}`);
    await shot('.nc-yd-s', 'sun-off');
    await click('.nc-yd-switch'); (await ev(() => document.querySelectorAll('.nc-yd-slot.gone').length)) === 0 ? OK('sun back on: chain returns') : FAIL('sun back');
    (await ev(() => !document.querySelector('.nc-yd-wow').hidden && !document.querySelector('.nc-yd-cmp').hidden)) ? OK('compare table + twist show') : FAIL('cmp/wow');
    console.log('     compare:', (await txt('.nc-yd-rows')).replace(/\s+/g, ' ').slice(0, 260));
    await shot('.nc-yd-cmp', 'compare'); await shot('.nc-yd-wow', 'twist');
    // wonder extras
    await ev(() => document.querySelectorAll('.nc-wx').forEach(d => d.open = true)); await p.waitForTimeout(600);
    const vid = await ev(() => { const v = document.querySelector('.nc-wx-video'); return v ? v.querySelector('source').getAttribute('src') : ''; });
    vid ? OK('footage: ' + vid) : FAIL('no video');
    await closeNotes(); await p.locator('.nc-dt').scrollIntoViewIfNeeded(); await p.waitForTimeout(900); const svg = await p.locator('.nc-dt').boundingBox();
    await p.mouse.move(svg.x + svg.width * 0.9, svg.y + svg.height / 2); await p.waitForTimeout(150);
    console.log('     data readout:', await txt('.nc-dt-read'));
    await click('.nc-wx .nc-opts .nc-opt:nth-child(1)'); await click('.nc-wx .nc-opts .nc-opt:nth-child(2)');
    /more than doubled|515/.test(await ev(() => [...document.querySelectorAll('.nc-wx .nc-fb')].map(e => e.textContent).join(' '))) ? OK('data question answered') : FAIL('data q');
    await shot('.nc-dt', 'data');
    await p.waitForTimeout(2500);
    const mv = await ev(() => { const m = document.querySelector('model-viewer'); return m ? (m.loaded ? 'loaded' : 'not loaded yet') : 'none'; });
    mv === 'loaded' ? OK('cabinet model loads') : console.log('note cabinet model:', mv);
    await click('.nc-cab-add'); /1 object/.test(await txt('.nc-cab-n')) ? OK('cabinet saves') : FAIL('cabinet ' + await txt('.nc-cab-n'));
    if (!RM) await shot('.nc-cab', 'cabinet');
    // highlighter note closes itself
    await click('.nc-t-hl'); const n1 = await ev(() => document.querySelectorAll('.nc-note').length);
    await click('.nc-t-hl'); const n2 = await ev(() => [...document.querySelectorAll('.nc-note')].filter(n => /Highlighter/.test(n.textContent)).length);
    n2 === 0 ? OK('highlighter note goes away') : FAIL('highlighter note stays');
    // assignment
    await ev(() => switchTab('assignment')); await p.waitForTimeout(300);
    await p.fill('#partb-1', 'The hawk eats anoles, which ate crickets, which ate grass that caught sunlight.');
    await p.fill('#nc-p1', 'The light gives the leaf energy to make sugar, and that energy goes to whatever eats the leaf.');
    await click('.nc-plan-c[data-i="0"]'); await click('.nc-plan-c[data-i="3"]');
    const g = await ev(() => document.getElementById('gatheredOutput').value);
    /Apple · rewinds all the way to the sun, in 2 steps/.test(g) && /hawk eats anoles/.test(g) ? OK('gathered answers include the prediction and Part B') : FAIL('gathered:\n' + g.slice(0, 600));
    // reload: nothing is lost
    await p.reload(); await p.waitForTimeout(900);
    const st = await ev(() => ({
      seal: document.querySelector('.nc-rw-seal').textContent, lamp: document.querySelector('.nc-lp').classList.contains('nc-done'),
      beam: document.querySelector('.nc-bm').classList.contains('nc-done'), pour: document.querySelector('.nc-po').classList.contains('nc-done'),
      yard: document.querySelector('.nc-yd').classList.contains('nc-done'), poAgain: !document.querySelector('.nc-po-again').hidden,
      failed: window.NC_FAILED.slice()
    }));
    st.lamp && st.beam && st.pour && st.yard && /Part 4 showed/.test(st.seal) ? OK('reload keeps every game') : FAIL('reload ' + JSON.stringify(st));
    st.poAgain ? OK('pour has a Pour again button (no dead end)') : FAIL('no pour again');
    st.failed.length ? FAIL('NC_FAILED ' + st.failed.join(',')) : OK('NC_FAILED empty');
    errs.length ? FAIL('page errors: ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall ok');
  process.exit(fails ? 1 : 0);
})();
