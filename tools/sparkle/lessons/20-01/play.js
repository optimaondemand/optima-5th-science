// 20.01 play script: plays every game, wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/20-01/play.js [1150|420]
// At 420 px it runs with reduced motion and touch; at 1150 px with motion (slider drags, real waits).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '20-01'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-20-01-how-do-structures-help-organisms-survive.html?steps=0';
const KEY = 'oao.nc.g5sci-20-1';
let fails = 0; const FAIL = m => { fails++; console.log('FAIL', m); }, OK = m => console.log('ok  ', m);
const only = process.argv[2] ? [+process.argv[2]] : [1150, 420];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const W of only) {
    const RM = W === 420;
    console.log(`\n=== ${W}px${RM ? ' (reduced motion, touch)' : ''} ===`);
    const ctx = await b.newContext({ viewport: { width: W, height: 900 }, reducedMotion: RM ? 'reduce' : 'no-preference', hasTouch: RM });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(900);
    const ev = (f, a) => p.evaluate(f, a);
    const S = () => ev(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
    const click = async (sel, i) => { const l = i == null ? p.locator(sel).first() : p.locator(sel).nth(i); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(150); };
    const txt = sel => ev(s => (document.querySelector(s) || {}).textContent || '', sel);
    const done = sel => ev(s => !!document.querySelector(s) && document.querySelector(s).classList.contains('nc-done'), sel);
    const closeNotes = () => ev(() => document.querySelectorAll('.nc-note button').forEach(b => b.click()));
    const shot = async (sel, name) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `play-${W}-${name}.png`) }); };
    const tab = async id => { await ev(i => window.switchTab(i), id); await p.waitForTimeout(250); };
    const setRange = async (sel, v) => ev(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);

    if (!RM) {
      await click('.nc-op-start'); await p.waitForTimeout(2600);
      const op = await ev(() => window.__ncOpener && window.__ncOpener.state());
      op && op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
      await p.screenshot({ path: path.join(OUT, `play-${W}-opener-mid.png`) });
      await click('.nc-op-skip');
    }

    // ── Warm-Up: Stack the weights
    await tab('vocab');
    (await ev(() => document.querySelector('.nc-sw-save').disabled)) ? OK('save is off until both guesses are set') : FAIL('save on with no guesses');
    for (let i = 0; i < 3; i++) await click('.nc-sw-p', 0);
    await click('.nc-sw-m', 0);
    for (let i = 0; i < 9; i++) await click('.nc-sw-p', 1);
    await click('.nc-sw-save');
    let s = await S(); s.sw && s.sw.saved && s.sw.solid === 2 && s.sw.tube === 9 ? OK('guess saved: solid 2, tube 9') : FAIL('guess ' + JSON.stringify(s.sw));
    (await ev(() => document.querySelector('.nc-sw-p').disabled)) ? OK('steppers lock after saving, labeled seal shows') : FAIL('steppers still on');
    await click('.nc-sw-edit'); (await ev(() => !document.querySelector('.nc-sw-p').disabled)) ? OK('change my guess unlocks') : FAIL('edit failed'); await click('.nc-sw-save');
    await p.fill('#pred-1', 'I think the hollow tube will hold more because it is wider and harder to bend.');
    await shot('.nc-sw', 'stack');
    // word lens
    for (let i = 0; i < 6; i++) await click('.nc-wl-st', i);
    (await txt('.nc-wl-dots')).includes('6 of 6') ? OK('word lens: 6 of 6') : FAIL('word lens');
    await closeNotes();

    // ── Lesson Part 1: source + Grow the giant
    await tab('lesson');
    await click('.nc-src-hl', 0); (await txt('.nc-ask-now')).includes('🤔') ? OK('hunt 1 wrong line gives a hint') : FAIL('no hint');
    await click('.nc-src-hl', 4); await click('.nc-src-hl', 2); await click('.nc-src-hl', 5);
    (await done('.nc-src')) ? OK('source: both hunts found') : FAIL('source not done');
    for (let i = 0; i < 8; i++) await click('.nc-src-hl', i);
    (await txt('.nc-src-count')) === '8' ? OK('all 8 lines read') : FAIL('lines read ' + await txt('.nc-src-count'));
    await closeNotes();
    await click('.nc-gt-sz', 1); (await txt('.nc-gt-state')).includes('Snap') ? OK('2x with a thin bone snaps') : FAIL('2x state ' + await txt('.nc-gt-state'));
    await setRange('.nc-gt-th', 2.2); (await txt('.nc-gt-state')).includes('bending') ? OK('2.2x thick at 2x bends') : FAIL('2.2 ' + await txt('.nc-gt-state'));
    await setRange('.nc-gt-th', 2.9); (await txt('.nc-gt-state')).includes('holds') ? OK('2.9x thick holds at 2x') : FAIL('2.9 ' + await txt('.nc-gt-state'));
    await click('.nc-gt-sz', 2); (await txt('.nc-gt-state')).includes('Snap') ? OK('3x snaps again') : FAIL('3x ' + await txt('.nc-gt-state'));
    await setRange('.nc-gt-th', 5.2); (await txt('.nc-gt-state')).includes('holds') ? OK('5.2x holds at 3x') : FAIL('5.2 ' + await txt('.nc-gt-state'));
    await click('.nc-gt-o', 1); (await txt('.nc-gt-afb')).includes('🤔') ? OK('giant wrong answer hints') : FAIL('no giant hint');
    await click('.nc-gt-o', 0); (await done('.nc-gt')) && !(await ev(() => document.querySelector('.nc-gt-gal').hidden)) ? OK('giant done, Galileo drawing shown') : FAIL('giant not done');
    await shot('.nc-gt', 'giant'); await closeNotes();

    // ── Part 2: Memory pairs (a wrong pair first)
    const order = (await S()).mp.order;
    const cards = JSON.parse(await ev(() => document.getElementById('nc-data').textContent)).pairs.cards;
    const pos = order.map(ci => cards[ci]);
    const firstPlant = pos.findIndex(c => c.kind === 'plant'), wrongAnimal = pos.findIndex(c => c.kind === 'animal' && c.p !== pos[firstPlant].p);
    await click('.nc-mp-card', firstPlant); await click('.nc-mp-card', wrongAnimal);
    (await txt('.nc-mp-fb')).includes('different jobs') ? OK('memory: wrong pair says so and flips back') : FAIL('memory wrong ' + await txt('.nc-mp-fb'));
    await p.waitForTimeout(RM ? 800 : 1400);
    const twoPlants = pos.map((c, i) => c.kind === 'plant' ? i : -1).filter(i => i > -1);
    await click('.nc-mp-card', twoPlants[0]); await click('.nc-mp-card', twoPlants[1]);
    (await txt('.nc-mp-fb')).includes('both plant') ? OK('memory: two plants explained') : FAIL('two plants ' + await txt('.nc-mp-fb'));
    await p.waitForTimeout(RM ? 800 : 1400);
    for (const job of ['support', 'sharp', 'cover', 'water', 'air', 'signal']) {
      const ii = pos.map((c, i) => c.p === job ? i : -1).filter(i => i > -1);
      await click('.nc-mp-card', ii[0]); await click('.nc-mp-card', ii[1]);
    }
    (await done('.nc-mp')) ? OK('memory: all 6 pairs, ' + await txt('.nc-mp-tries')) : FAIL('memory not done ' + await txt('.nc-mp-found'));
    await shot('.nc-mp', 'pairs'); await closeNotes();
    // footage
    await ev(() => { const d = document.querySelector('.nc-mp').nextElementSibling; d.open = true; });
    const v = await ev(async () => { const vid = document.querySelector('.nc-wx-video'); vid.muted = true; try { await vid.play(); } catch (e) {} await new Promise(r => setTimeout(r, 1200)); return { t: vid.currentTime, rs: vid.readyState }; });
    v.t > 0 ? OK('footage plays (t=' + v.t.toFixed(1) + ')') : FAIL('footage ' + JSON.stringify(v));

    // ── Part 3: Clue by clue
    await click('.nc-cl-o', 1); (await ev(() => document.querySelectorAll('.nc-cl-clues li').length)) === 2 ? OK('wrong skull guess shows clue 2 and a hint') : FAIL('clue count');
    await click('.nc-cl-o', 0); (await txt('.nc-cl-stars')).includes('2') ? OK('skull 1 solved with 2 stars') : FAIL('stars ' + await txt('.nc-cl-stars'));
    await click('.nc-cl-next-skull'); await click('.nc-cl-o', 0);
    (await done('.nc-cl')) ? OK('skull 2 solved first try, game done') : FAIL('clue not done');
    await shot('.nc-cl', 'clue'); await closeNotes();

    // ── Part 4: Roll the tube + case files
    await click('.nc-tb-load'); await p.waitForTimeout(RM ? 300 : 1200);
    (await txt('.nc-tb-fb')).includes('held 4') ? OK('solid rod held 4') : FAIL('solid ' + await txt('.nc-tb-fb'));
    (await ev(() => !document.querySelector('.nc-tb-off').hidden)) ? OK('"take the weights off" button is visible (no dead end)') : FAIL('dead end');
    await setRange('.nc-tb-r', 1.5); await click('.nc-tb-load'); await p.waitForTimeout(RM ? 300 : 1800);
    (await txt('.nc-tb-fb')).includes('Test the solid rod and a tube at least 2') || (await txt('.nc-tb-fb')).includes('held 9') ? OK('1.5x tube held 9, not done yet') : FAIL('1.5 ' + await txt('.nc-tb-fb'));
    await setRange('.nc-tb-r', 2.2); await click('.nc-tb-load'); await p.waitForTimeout(RM ? 300 : 2800);
    (await done('.nc-tb')) ? OK('bench done: ' + (await txt('.nc-tb-rows')).replace(/\s+/g, ' ')) : FAIL('bench not done');
    s = await S(); s.sw.revealed ? OK('warm-up guess locks after the test') : FAIL('not revealed');
    await shot('.nc-tb', 'bench'); await closeNotes();
    await click('.nc-cf-file:nth-child(1) .nc-cf-o', 1); (await txt('.nc-cf-file:nth-child(1) .nc-cf-fb')).includes('🤔') ? OK('case file wrong job hints') : FAIL('cf hint');
    const ok = JSON.parse(await ev(() => document.getElementById('nc-data').textContent)).cases.files.map(f => f.ok);
    for (let i = 0; i < 5; i++) await click(`.nc-cf-file:nth-child(${i + 1}) .nc-cf-o`, ok[i]);
    (await done('.nc-cf')) && !(await ev(() => document.querySelector('.nc-cf-wow').hidden)) ? OK('case files done, twist shows') : FAIL('cases');
    await closeNotes();
    // data
    await ev(() => { document.querySelectorAll('details.nc-wx').forEach(d => { if (/bone\?/.test(d.textContent)) d.open = true; }); });
    const bar = p.locator('.nc-bars .nc-dt-hit').first(); await bar.scrollIntoViewIfNeeded(); const bb = await bar.boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.9, bb.y + bb.height / 2);
    (await txt('.nc-dt-read')).includes('13.1') ? OK('graph readout: ' + await txt('.nc-dt-read')) : FAIL('readout ' + await txt('.nc-dt-read'));
    // cabinet
    await ev(() => { document.querySelectorAll('details.nc-wx').forEach(d => { if (/thigh bone/.test(d.textContent)) d.open = true; }); });
    await p.locator('.nc-cab-stage').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(9000);
    const mv = await ev(() => { const m = document.querySelector('model-viewer'); return m ? { loaded: m.loaded, src: m.getAttribute('src') } : null; });
    mv && mv.loaded ? OK('3D femur loads') : FAIL('model ' + JSON.stringify(mv));
    await shot('details.nc-wx[open] .nc-cab', 'cabinet');
    await click('.nc-cab-add'); (await txt('.nc-cab-add')).includes('In your cabinet') ? OK('cabinet saved') : FAIL('cabinet');

    // ── Assignment text
    await tab('assignment');
    await p.fill('#partb-1', 'The thick waxy stem holds water and the wax keeps it from drying out.');
    await p.fill('#nc-p1', 'asdf');
    const gath = await ev(() => { window.refreshGathered && window.refreshGathered(); return document.getElementById('gatheredOutput').value; });
    ['PART 1: GROW THE GIANT', 'MEMORY PAIRS', 'CLUE BY CLUE', 'ROLL THE TUBE', 'CASE FILES', 'solid rod 2, hollow tube 9'].forEach(k => gath.includes(k) ? OK('gathered has ' + k) : FAIL('gathered missing ' + k));

    // ── Reload: everything kept
    await p.reload(); await p.waitForTimeout(1000); await ev(() => window.__ncOpener && window.__ncOpener.finish());
    const kept = await ev(() => ['.nc-sw', '.nc-gt', '.nc-mp', '.nc-cl', '.nc-tb', '.nc-cf', '.nc-src'].map(s => s + ':' + document.querySelector(s).classList.contains('nc-done')).join(' '));
    /false/.test(kept) ? FAIL('after reload ' + kept) : OK('after reload all games still done');
    const dead = await ev(() => [...document.querySelectorAll('.nc-g button')].filter(b => b.offsetParent && b.disabled && !b.textContent.trim()).length);
    dead ? FAIL(dead + ' disabled unlabeled buttons') : OK('no unlabeled dead buttons');
    // resets
    await tab('lesson');
    await click('.nc-mp-reset'); (await txt('.nc-mp-found')).startsWith('0 of 6') ? OK('memory reset') : FAIL('memory reset');
    await click('.nc-gt-reset'); (await txt('.nc-gt-state')).includes('holds') && !(await done('.nc-gt')) ? OK('giant reset') : FAIL('giant reset');
    await click('.nc-cl-reset'); !(await done('.nc-cl')) ? OK('clue reset') : FAIL('clue reset');
    const failed = await ev(() => window.NC_FAILED);
    failed.length ? FAIL('NC_FAILED ' + failed) : OK('NC_FAILED empty');
    errs.length ? FAIL('page errors: ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall ok');
})();
