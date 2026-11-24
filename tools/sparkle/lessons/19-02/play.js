// 19.02 play script: plays every game by tap and by drag, wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/19-02/play.js [1150|420]
// At 420 px it runs with reduced motion and touch (buttons, taps); at 1150 px with motion (drags, real waits).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '19-02'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-19-02-model-human-body-systems-working-together.html?steps=0';
const KEY = 'oao.nc.g5sci-19-2';
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
    const click = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(140); };
    const txt = sel => ev(s => (document.querySelector(s) || {}).textContent || '', sel);
    const done = sel => ev(s => !!document.querySelector(s) && document.querySelector(s).classList.contains('nc-done'), sel);
    const closeNotes = () => ev(() => document.querySelectorAll('.nc-note button').forEach(b => b.click()));
    const shot = async (sel, name) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `play-${W}-${name}.png`) }); };
    const tab = async id => { await ev(i => window.switchTab(i), id); await p.waitForTimeout(250); };
    const box = async sel => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); return l.boundingBox(); };
    const tapAt = async (x, y) => { if (RM) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };

    if (!RM) {
      await click('.nc-op-start'); await p.waitForTimeout(2600);
      const op = await ev(() => window.__ncOpener && window.__ncOpener.state());
      op && op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
      await p.screenshot({ path: path.join(OUT, `play-${W}-opener-mid.png`) });
      console.log('     caption now:', await txt('.nc-op-cap-t'), '|', await txt('.nc-op-sub'));
      await click('.nc-op-skip');
    }

    // ── Warm-Up: tap the beat
    (await ev(() => document.querySelector('.nc-bt-save').disabled)) ? OK('Save waits for a beat') : FAIL('save enabled early');
    const hb = await box('.nc-bt-heart');
    for (let i = 0; i < 2; i++) { await tapAt(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(500); }
    console.log('     after 2 taps:', await txt('.nc-bt-hint'));
    for (let i = 0; i < 6; i++) { await tapAt(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.waitForTimeout(500); }
    let bt = (await S()).bt || {};
    bt.bpm >= 90 && bt.bpm <= 150 ? OK(`tapping every 0.5 s reads ${bt.bpm} bpm`) : FAIL('bpm ' + JSON.stringify(bt));
    await click('.nc-bt-nudge [data-d="5"]'); bt = (await S()).bt; console.log('     +5 ->', bt.bpm);
    await click('.nc-bt-save');
    (await txt('.nc-bt-seal')).indexOf('Saved') > -1 ? OK('beat saved: ' + await txt('.nc-bt-seal')) : FAIL('save');
    (await ev(() => !document.querySelector('.nc-bt-edit').hidden && document.querySelector('.nc-bt-heart').disabled)) ? OK('heart locks, Change my beat offered') : FAIL('edit button');
    await p.fill('#pred-1', 'I think my heart will beat faster because my muscles need more oxygen. My heart and lungs work together.');
    await shot('.nc-bt', 'beat');
    const st = await p.locator('.nc-wl-st').count(); for (let i = 0; i < st; i++) await click(`.nc-wl-st[data-i="${i}"]`);
    console.log('     word lens:', await txt('.nc-wl-dots'));
    await closeNotes();

    // ── Part 1: source + clock
    await tab('lesson');
    await shot('.nc-src', 'source');
    await click('.nc-src-hl[data-i="0"]'); console.log('     hunt 1 miss:', (await txt('.nc-src-asks')).slice(0, 140));
    await click('.nc-src-hl[data-i="3"]'); await click('.nc-src-hl[data-i="2"]'); await click('.nc-src-hl[data-i="4"]');
    (await done('.nc-src')) ? OK('both hunts found') : FAIL('hunts ' + await txt('.nc-src-asks'));
    for (const i of [1, 5]) await click(`.nc-src-hl[data-i="${i}"]`);
    console.log('     lines read:', await txt('.nc-src-read'));
    await closeNotes();
    // clock: face before an amount is picked, then smallest guess (stays under), then a real heart (passes)
    const fb0 = await box('.nc-ck-face'); await tapAt(fb0.x + fb0.width * 0.9, fb0.y + fb0.height * 0.5);
    (await txt('.nc-ck-fb')).indexOf('First pick') > -1 ? OK('clock asks for an amount first') : FAIL('no pick-first hint');
    await click('.nc-ck-amts .nc-opt[data-i="0"]');
    if (!RM) {
      const fb = await box('.nc-ck-face'), cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2, r = fb.width * 0.38;
      await p.mouse.move(cx, cy - r); await p.mouse.down();
      for (let a = 0; a <= 180; a += 15) { const t = a * Math.PI / 180; await p.mouse.move(cx + r * Math.sin(t), cy - r * Math.cos(t)); }
      await p.mouse.up(); await p.waitForTimeout(200);
      console.log('     dragged hand to', await txt('.nc-ck-time'));
    } else { await click('.nc-ck-run'); await p.waitForTimeout(300); }
    if (!RM) { await click('.nc-ck-run'); await p.waitForTimeout(4200); }
    console.log('     smallest guess:', await txt('.nc-ck-count'), '|', await txt('.nc-ck-fb'));
    (await ev(() => document.querySelector('.nc-ck-ask').hidden)) ? OK('question waits until the jugs pass the line') : FAIL('ask shown early');
    await click('.nc-ck-beats .nc-opt[data-k="real"]'); await click('.nc-ck-run'); await p.waitForTimeout(RM ? 300 : 4200);
    console.log('     real heart:', await txt('.nc-ck-count'), '|', await txt('.nc-ck-fb'));
    await shot('.nc-ck', 'clock-ran');
    await click('.nc-ck-o[data-i="0"]'); console.log('     wrong answer:', await txt('.nc-ck-afb'));
    await click('.nc-ck-o[data-i="1"]');
    (await done('.nc-ck')) ? OK('clock done: ' + (await txt('.nc-ck-wow')).slice(0, 80)) : FAIL('clock not done');
    await closeNotes();

    // ── Part 2: gauges
    await p.locator('.nc-gg').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
    console.log('     sitting at the start:', await txt('.nc-gg-state'));
    const setR = async (sel, v) => { await ev(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]); };
    await setR('.nc-gg-hrs', 75); await setR('.nc-gg-brs', 16); await p.waitForTimeout(4500);
    console.log('     sitting calm:', await txt('.nc-gg-state'));
    await click('.nc-gg-act[data-k="sprint"]'); await setR('.nc-gg-hrs', 180); await p.waitForTimeout(1500);
    console.log('     sprint, heart only:', await txt('.nc-gg-state'));
    await setR('.nc-gg-hrs', 90); await setR('.nc-gg-brs', 50); await p.waitForTimeout(1500);
    console.log('     sprint, lungs only:', await txt('.nc-gg-state'));
    await setR('.nc-gg-hrs', 180); await p.waitForTimeout(4500);
    await click('.nc-gg-act[data-k="walk"]'); await setR('.nc-gg-hrs', 110); await setR('.nc-gg-brs', 26); await p.waitForTimeout(4500);
    console.log('     score:', await txt('.nc-gg-score'));
    await click('.nc-gg-blow'); console.log('     blow before guess:', await txt('.nc-gg-jfb'));
    await setR('.nc-gg-gs', 2); await click('.nc-gg-blow');
    console.log('     jar:', (await txt('.nc-gg-jfb')).slice(0, 110));
    (await done('.nc-gg')) ? OK('gauges done') : FAIL('gauges not done ' + await txt('.nc-gg-score'));
    await shot('.nc-gg', 'gauge');
    await click('.nc-gg ~ details.nc-wx summary');
    await p.waitForTimeout(800);
    const vid = await ev(() => { const v = document.querySelector('.nc-wx-video'); return v ? { pre: v.preload, src: v.querySelector('source').getAttribute('src') } : null; });
    vid ? OK('footage folded with preload ' + vid.pre) : FAIL('no footage');
    if (vid) { const r = await ev(async () => { const v = document.querySelector('.nc-wx-video'); try { await v.play(); await new Promise(r => setTimeout(r, 800)); return v.currentTime; } catch (e) { return 'err ' + e.message; } }); typeof r === 'number' && r > 0 ? OK('footage plays (t=' + r.toFixed(2) + ')') : FAIL('footage ' + r); }

    // ── Part 3: peek under the box
    const boxes = p.locator('.nc-pk-box');
    for (let i = 0; i < 4; i++) {
      const bb = await (async () => { const l = boxes.nth(i); await l.scrollIntoViewIfNeeded(); return l.boundingBox(); })();
      if (!RM && i < 2) { await p.mouse.move(bb.x - 30, bb.y + bb.height / 2); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 5 }); }
      else await tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await p.waitForTimeout(700);
    }
    console.log('     peek:', await txt('.nc-pk-score'), '|', (await txt('.nc-pk-k')));
    await shot('.nc-pk', 'peek');
    await click('.nc-pk-o[data-i="0"]'); console.log('     wrong:', await txt('.nc-pk-afb'));
    await click('.nc-pk-o[data-i="1"]');
    (await done('.nc-pk')) ? OK('peek done') : FAIL('peek not done');
    await closeNotes();

    // ── Part 4: lab (one real timer, then typed counts) and cargo
    await click('.nc-lb-ct[data-k="hr0"] .nc-lb-go');
    const tp = await box('.nc-lb-ct[data-k="hr0"] .nc-lb-tap');
    for (let i = 0; i < 3; i++) { await tapAt(tp.x + tp.width / 2, tp.y + tp.height / 2); await p.waitForTimeout(150); }
    console.log('     tapped 3 beats -> input', await ev(() => document.querySelector('.nc-lb-ct[data-k="hr0"] .nc-lb-in').value));
    const fillN = async (k, v) => { const l = p.locator(`.nc-lb-ct[data-k="${k}"] .nc-lb-in`); await l.scrollIntoViewIfNeeded(); await l.fill(String(v)); await p.waitForTimeout(100); };
    await fillN('hr0', 20); await fillN('br0', 8); await fillN('hr1', 18); await fillN('br1', 14);
    console.log('     no rise:', await txt('.nc-lb-fb'));
    await fillN('hr1', 32);
    console.log('     table/feedback:', await txt('.nc-lb-fb'));
    (await done('.nc-lb')) ? OK('lab done') : FAIL('lab not done');
    (await txt('.nc-bt-seal')).indexOf('Part 4 shows') > -1 ? OK('warm-up beat now locked with the real pulse') : FAIL('warm-up not revealed: ' + await txt('.nc-bt-seal'));
    await shot('.nc-lb', 'lab');
    await closeNotes();
    await click('.nc-cg-slot[data-i="0"]'); console.log('     slot before tag:', await txt('.nc-cg-fb'));
    // wrong first: carbon dioxide on lungs -> blood
    await click('.nc-cg-tag[data-t="co2"]'); await click('.nc-cg-slot[data-i="0"]');
    await click('.nc-cg-check'); console.log('     wrong cargo:', await txt('.nc-cg-fb'));
    await click('.nc-cg-slot[data-i="0"] .nc-cg-chip');  // unload it
    const loadTap = async (t, i) => { await click(`.nc-cg-tag[data-t="${t}"]`); await click(`.nc-cg-slot[data-i="${i}"]`); };
    if (!RM) {
      const from = await box('.nc-cg-tag[data-t="o2"]'), to = await box('.nc-cg-slot[data-i="0"]');
      await p.mouse.move(from.x + 20, from.y + 10); await p.mouse.down(); await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(200);
    } else await loadTap('o2', 0);
    await loadTap('food', 1); await loadTap('o2', 2);
    await click('.nc-cg-check'); console.log('     missing:', await txt('.nc-cg-fb'));
    await loadTap('food', 2); await loadTap('co2', 3); await loadTap('co2', 4); await loadTap('sig', 5);
    await click('.nc-cg-check');
    (await done('.nc-cg')) ? OK('model checked: ' + (await txt('.nc-cg-fb')).slice(0, 60)) : FAIL('cargo ' + await txt('.nc-cg-fb'));
    console.log('     compare:', (await txt('.nc-cg-rows')).replace(/\s+/g, ' '));
    await shot('.nc-cg', 'cargo');
    await closeNotes();
    // data + cabinet
    await click('.nc-cg-wow ~ details.nc-wx summary');
    const sv = await box('.nc-cg-wow ~ details.nc-wx .nc-bars'); await p.mouse.move(sv.x + sv.width * 0.5, sv.y + sv.height * 0.6); await p.mouse.click(sv.x + sv.width * 0.5, sv.y + sv.height * 0.6);
    console.log('     data readout:', await txt('.nc-cg-wow ~ details.nc-wx .nc-dt-read'));
    await click('.nc-cg-wow ~ details.nc-wx .nc-opt[data-i="1"]'); await click('.nc-cg-wow ~ details.nc-wx .nc-opt[data-i="0"]');
    console.log('     data answer:', (await txt('.nc-cg-wow ~ details.nc-wx .nc-fb')).slice(0, 70));
    await click('details.nc-wx:has(.nc-cab) summary'); await p.waitForTimeout(6000);
    const mv = await ev(() => { const m = document.querySelector('model-viewer'); return m ? { loaded: m.loaded, src: m.getAttribute('src') } : null; });
    mv && mv.loaded ? OK('3D model loaded: ' + mv.src) : FAIL('3D ' + JSON.stringify(mv));
    if (mv) await shot('.nc-cab', 'cabinet');
    await click('.nc-cab-add'); console.log('     cabinet:', await txt('.nc-cab-n'));
    await closeNotes();

    // ── Assignment
    await tab('assignment');
    console.log('     pulse chip:', (await txt('.nc-lb-saved')).replace(/\s+/g, ' '));
    await p.fill('#partb-2', 'If the lungs take in less air, the blood carries less oxygen, so the muscles get tired fast and the heart beats faster.');
    await p.fill('#partb-3', 'My model leaves out cells and capillaries. It is still useful because it shows the whole team at once.');
    await p.fill('#nc-p1', 'asdf');
    console.log('     junk answer count:', await txt('#nc-p1-c'));
    await p.fill('#nc-p1', 'My heart went from 80 to 128 beats per minute. It sped up because my muscles needed more oxygen, and the blood brings it.');
    await p.fill('#nc-p3', 'Harvey multiplied the blood in one beat by the beats in half an hour. It was more than 8 liters, more than the whole body holds, so the blood goes around.');
    await click('.nc-plan-c[data-i="0"]'); await click('.nc-plan-c[data-i="2"]');
    await p.fill('#cer-claim', 'The respiratory and circulatory systems work together to bring oxygen to my muscles.');
    await p.fill('#cer-reasoning', 'The lungs put oxygen in the blood and the heart pumps it to the muscles, so both speed up together.');
    const ga = await ev(() => { window.refreshGathered(); return document.getElementById('gatheredOutput').value; });
    ['MY PREDICTION', 'HARVEY\'S HALF HOUR', 'KEEP THE GAUGES UP', 'MY PULSE DATA', 'BOX-AND-ARROW MODEL', 'PART B — QUESTION 1', 'MY PULSE CARD', 'CLAIM'].forEach(h => ga.indexOf(h) > -1 ? null : FAIL('gathered missing ' + h));
    OK('gathered answers: ' + ga.split('\n').length + ' lines');
    if (W === 1150) fs.writeFileSync(path.join(OUT, 'gathered.txt'), ga);
    await shot('.nc-np', 'notebook-page');

    // ── highlighter note closes itself; snap
    const hl = p.locator('.nc-t-hl'); await hl.click(); await p.waitForTimeout(200);
    const n1 = await ev(() => document.querySelectorAll('.nc-note').length);
    await hl.click(); await p.waitForTimeout(200);
    const n2 = await ev(() => [...document.querySelectorAll('.nc-note')].filter(n => /Highlight/i.test(n.textContent)).length);
    n2 === 0 ? OK(`highlighter note goes away (${n1} -> ${n2})`) : FAIL('highlighter note stays');

    // ── reload: everything kept, nothing a dead end
    await p.reload(); await p.waitForTimeout(1200); await ev(() => window.__ncOpener && window.__ncOpener.finish());
    const after = await ev(() => ({
      bt: document.querySelector('.nc-bt-seal').textContent, ck: document.querySelector('.nc-ck').classList.contains('nc-done'),
      gg: document.querySelector('.nc-gg').classList.contains('nc-done'), pk: document.querySelector('.nc-pk').classList.contains('nc-done'),
      lb: document.querySelector('.nc-lb').classList.contains('nc-done'), cg: document.querySelector('.nc-cg').classList.contains('nc-done'),
      p1: document.getElementById('nc-p1').value.length, failed: window.NC_FAILED,
      dead: [...document.querySelectorAll('.nc-bt button, .nc-ck button, .nc-gg button, .nc-pk button, .nc-lb button, .nc-cg button')].filter(b => b.offsetParent && b.disabled && !b.textContent.trim() && !b.getAttribute('aria-label')).map(b => b.className + '|' + b.getAttribute('aria-label')).join(', ')
    }));
    after.ck && after.gg && after.pk && after.lb && after.cg && after.p1 > 20 && /Part 4/.test(after.bt) ? OK('reload keeps every game and answer') : FAIL('reload lost ' + JSON.stringify(after));
    after.dead ? FAIL(after.dead + ' unlabeled disabled buttons') : OK('no unlabeled dead buttons');
    after.failed.length ? FAIL('NC_FAILED ' + after.failed) : OK('NC_FAILED empty');
    // resets
    await tab('lesson');
    await click('.nc-ck-reset'); await click('.nc-pk-reset'); await click('.nc-cg-wow');
    (await ev(() => !document.querySelector('.nc-pk').classList.contains('nc-done'))) ? OK('peek reset works') : FAIL('peek reset');
    await click('.nc-gg-jreset'); (await ev(() => !document.querySelector('.nc-gg-jreset').offsetParent && !!document.querySelector('.nc-gg-blow').offsetParent)) ? OK('jar reset offers Breathe out again') : FAIL('jar reset');
    errs.length ? FAIL('page errors: ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  // the real 15-second timer, with a fake clock
  {
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 } }); const p = await ctx.newPage();
    await p.clock.install(); await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.clock.runFor(1500);
    await p.evaluate(() => { window.__ncOpener && window.__ncOpener.finish(); switchTab('lesson'); });
    await p.locator('.nc-lb-ct[data-k="br0"] .nc-lb-go').click();
    for (let i = 0; i < 4; i++) { await p.locator('.nc-lb-ct[data-k="br0"] .nc-lb-tap').dispatchEvent('pointerdown'); }
    await p.clock.runFor(31000);
    const t = await p.evaluate(() => [document.querySelector('.nc-lb-ct[data-k="br0"] .nc-lb-left').textContent, document.querySelector('.nc-lb-ct[data-k="br0"] .nc-lb-tap').disabled]);
    /Time!.*4/.test(t[0]) && t[1] ? OK('30-second timer ends and locks the tap button: ' + t[0]) : FAIL('timer ' + t);
    await p.locator('.nc-lb-mv').click(); await p.clock.runFor(61000);
    const m = await p.evaluate(() => document.querySelector('.nc-lb-mv').closest('.nc-lb-step').textContent);
    /One minute done/.test(m) ? OK('1-minute move timer finishes') : FAIL('move timer');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall ok');
  process.exit(fails ? 1 : 0);
})();
