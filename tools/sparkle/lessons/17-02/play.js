// 17.02 play script: plays every game by tap (and one by drag), wrong answers first, then reloads and checks nothing is lost.
// usage (repo root served on localhost:8765): NODE_PATH=$(npm root -g) node tools/sparkle/lessons/17-02/play.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'out', '17-02'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8765/lesson-17-02-argument-from-evidence-plant-growth-materials.html';
let fails = 0; const FAIL = m => { fails++; console.log('FAIL', m); }, OK = m => console.log('ok  ', m);

(async () => {
  const b = await chromium.launch();
  for (const W of [1150, 420]) {
    console.log(`\n=== ${W}px ===`);
    const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
    const ev = (f, a) => p.evaluate(f, a);
    const click = async sel => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.locator(sel).first().click(); await p.waitForTimeout(120); };

    // opener
    await click('.nc-op-start'); await p.waitForTimeout(2500);
    const op = await ev(() => window.__ncOpener.state());
    op.playing && op.z > 0 ? OK(`opener plays (z=${op.z.toFixed(2)})`) : FAIL('opener did not play ' + JSON.stringify(op));
    const cap = await ev(() => document.querySelector('.nc-op-cap-t').textContent);
    console.log('     caption now:', cap);
    await click('.nc-op-skip'); (await ev(() => window.__ncOpener.state().ended)) ? OK('skip ends the opener') : FAIL('skip');

    // warm-up: cups
    await ev(() => { const s = document.querySelector('.nc-cup-sl'); s.value = 4; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('.nc-cup-plus'); await click('.nc-cup-minus'); await click('.nc-cup-minus');
    (await ev(() => document.querySelector('.nc-cup-n').textContent)) === '3' ? OK('slider and +/- work (3 cups)') : FAIL('cups count');
    await click('.nc-cup-save');
    const seal = await ev(() => document.querySelector('.nc-cup-seal').textContent);
    /3 cups/.test(seal) ? OK('saved: ' + seal) : FAIL('seal ' + seal);
    await click('.nc-cup-edit'); (await ev(() => !document.querySelector('.nc-cup-sl').disabled)) ? OK('change my prediction unlocks') : FAIL('edit');
    await click('.nc-cup-save');
    await p.fill('#pred-1', 'I think it used up 3 cups because plants eat soil to grow.');
    // word lens
    for (let i = 0; i < 6; i++) await click(`.nc-wl-st[data-i="${i}"]`);
    (await ev(() => document.querySelector('.nc-wl-dots span').textContent)) === '6 of 6 words' ? OK('word lens 6 of 6') : FAIL('word lens');
    if (W === 1150) await p.screenshot({ path: path.join(OUT, `play-${W}-warmup.png`), fullPage: true });

    // lesson
    await ev(() => switchTab('lesson')); await p.waitForTimeout(300);
    for (let i = 0; i < 7; i++) await click(`.nc-src-hl[data-i="${i}"]`);
    (await ev(() => document.querySelector('.nc-src').classList.contains('nc-done'))) ? OK('source page: all 7 lines read, done') : FAIL('source done');
    console.log('     line 7 English:', await ev(() => document.querySelector('.nc-src-en-t').textContent.slice(0, 80)));
    // sort: wrong first
    const cards = await ev(() => D_CARDS = [...document.querySelectorAll('.nc-sort-pile .nc-sort-c')].map(e => e.textContent));
    await click('.nc-sort-pile .nc-sort-c[data-i="0"]'); await click('.nc-sort-bin[data-k="claim"]');
    console.log('     wrong sort hint:', await ev(() => document.querySelector('.nc-sort-fb').textContent));
    const data = await ev(() => JSON.parse(document.getElementById('nc-data').textContent).sort.cards.map(c => c.k));
    for (let i = 0; i < data.length; i++) {
      if (W === 1150 && i === 1) { // drag this one (at phone width the boxes sit below the screen, so tapping is the way)
        const c = p.locator(`.nc-sort-pile .nc-sort-c[data-i="${i}"]`); await c.scrollIntoViewIfNeeded();
        const bin = p.locator(`.nc-sort-bin[data-k="${data[i]}"]`);
        const cb = await c.boundingBox(), bb = await bin.boundingBox();
        await p.mouse.move(cb.x + 30, cb.y + 15); await p.mouse.down(); await p.mouse.move(cb.x + 60, cb.y + 40, { steps: 4 });
        await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
        (await ev(i => !!document.querySelector(`.nc-sort-in .nc-sort-c[data-i="${i}"]`), i)) ? OK('drag a sentence into its box') : FAIL('drag sort');
        continue;
      }
      if (!(await ev(i => { const e = document.querySelector(`.nc-sort-pile .nc-sort-c[data-i="${i}"]`); return e && e.classList.contains('sel'); }, i))) await click(`.nc-sort-pile .nc-sort-c[data-i="${i}"]`);
      await click(`.nc-sort-bin[data-k="${data[i]}"]`);
    }
    await click('.nc-sort-reason .nc-opt[data-i="2"]');
    console.log('     wrong reasoning hint:', await ev(() => document.querySelector('.nc-sort-rfb').textContent));
    await click('.nc-sort-reason .nc-opt[data-i="0"]');
    (await ev(() => document.querySelector('.nc-sort').classList.contains('nc-done'))) ? OK('sort done with reasoning') : FAIL('sort');
    // jars
    await click('.nc-jar-go'); await p.waitForTimeout(2900);
    await click('.nc-jar-opts .nc-opt[data-i="0"]'); // wrong: it will burn
    console.log('     relight verdict:', await ev(() => document.querySelector('.nc-jar-you').textContent));
    await click('.nc-jar-go[data-a="mint"]');
    await click('.nc-jar-opts .nc-opt[data-i="0"]');
    await click('.nc-jar-go[data-a="day"]'); await click('.nc-jar-go[data-a="day"]');
    console.log('     after 2 days:', await ev(() => document.querySelector('.nc-jar-date').textContent));
    await click('.nc-jar-go[data-a="skip"]'); await click('.nc-jar-go[data-a="test"]'); await p.waitForTimeout(1600);
    (await ev(() => !!document.querySelector('.nc-jar-quote') && document.querySelector('.nc-jar-a').classList.contains('lit') && document.querySelector('.nc-jar-b').classList.contains('fail'))) ? OK('jar test: A burns, B goes out, quote shows') : FAIL('jar test');
    await p.locator('.nc-jar-stage').screenshot({ path: path.join(OUT, `play-${W}-jars-end.png`) });
    // other side
    await click('.nc-os-play[data-i="0"]');
    await click('.nc-os-c[data-i="3"]'); console.log('     decoy hint:', await ev(() => document.querySelector('.nc-os-fb').textContent));
    await click('.nc-os-c[data-i="1"]'); console.log('     wrong-card hint:', await ev(() => document.querySelector('.nc-os-fb').textContent));
    await click('.nc-os-c[data-i="0"]'); await click('.nc-os-c[data-i="1"]'); await click('.nc-os-c[data-i="2"]');
    const rv = await ev(() => document.querySelector('.nc-os-reveal').innerText.replace(/\s+/g, ' '));
    /3 cups/.test(rv) && /0 cups/.test(rv) ? OK('cups reveal: ' + rv.slice(0, 90)) : FAIL('cups reveal ' + rv);
    (await ev(() => document.querySelector('.nc-os').classList.contains('nc-done'))) ? OK('other side: all three answered') : FAIL('other side');
    (await ev(() => document.querySelector('.nc-cup-edit').hidden)) ? OK('warm-up locked after the reveal (no change button)') : FAIL('cups not locked');
    // meter
    await click('.nc-mt-p1 .nc-opt[data-i="2"]');
    await click('.nc-mt-run'); await p.waitForTimeout(2900); await click('.nc-mt-light'); await p.waitForTimeout(2000); await click('.nc-mt-run');
    const m = await ev(() => ({ ppm: document.querySelector('.nc-mt-ppm').textContent, need: document.querySelector('.nc-mt-need').innerText, q: !document.querySelector('.nc-mt-q').hidden }));
    console.log('     meter:', JSON.stringify(m));
    m.q ? OK('meter question opens after light + dark') : FAIL('meter question hidden');
    await click('.nc-mt-q .nc-opt[data-i="0"]'); console.log('     meter wrong hint:', await ev(() => document.querySelector('.nc-mt-fb').textContent));
    await click('.nc-mt-q .nc-opt[data-i="1"]');
    console.log('     open button before predicting:', await ev(() => document.querySelector('.nc-mt-open').textContent));
    await click('.nc-mt-p2 .nc-opt[data-i="1"]'); await click('.nc-mt-open');
    const cmp = await ev(() => document.querySelector('.nc-mt-rows').innerText.replace(/\s+/g, ' '));
    console.log('     compare:', cmp);
    (await ev(() => !document.querySelector('.nc-mt-wow').hidden && !!document.querySelector('.nc-mt-wow .nc-k'))) ? OK('twist + Listen card show') : FAIL('twist');
    await p.locator('.nc-mt').screenshot({ path: path.join(OUT, `play-${W}-part4.png`) });
    // wonder extras
    const wx = p.locator('details.nc-wx'); const nwx = await wx.count();
    for (let i = 0; i < nwx; i++) { await wx.nth(i).locator('summary').scrollIntoViewIfNeeded(); await wx.nth(i).locator('summary').click(); await p.waitForTimeout(300); }
    const vid = await ev(async () => { const v = document.querySelector('.nc-wx-video'); v.muted = true; try { await v.play(); } catch (e) { return 'play failed ' + e.message; } await new Promise(r => setTimeout(r, 900)); return v.currentTime > 0.2 ? 'plays ' + v.currentTime.toFixed(1) + 's of ' + v.duration.toFixed(0) : 'stuck'; });
    /plays/.test(vid) ? OK('footage ' + vid) : FAIL('footage ' + vid);
    const hit = p.locator('.nc-dt-hit'); await hit.scrollIntoViewIfNeeded(); const hb = await hit.boundingBox();
    await p.mouse.move(hb.x + hb.width * 0.12, hb.y + hb.height / 2); await p.waitForTimeout(100);
    console.log('     data readout:', await ev(() => document.querySelector('.nc-dt-read').textContent));
    await click('.nc-wx .nc-opts .nc-opt[data-i="1"]'); await click('.nc-wx .nc-opts .nc-opt[data-i="0"]');
    console.log('     data answer:', (await ev(() => [...document.querySelectorAll('.nc-wx .nc-fb')].map(e => e.textContent).join(' | '))).slice(0, 120));
    if (W === 1150) await p.screenshot({ path: path.join(OUT, `play-${W}-lesson.png`), fullPage: true });
    // listen card with spotlight
    await ev(() => { window.__cues = []; new MutationObserver(ms => ms.forEach(m => { if (m.target.classList && m.target.classList.contains('nc-cue-now')) window.__cues.push((m.target.className.match(/nc-(?:src|sort|jar|os|mt|cup|wl)[\w-]*/) || [m.target.id || m.target.tagName])[0]); })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); });
    await p.locator('.nc-src').scrollIntoViewIfNeeded(); await p.locator('.nc-src .nc-k-play').click();
    await p.waitForTimeout(19500);
    console.log('     Listen k-part1 spotlight beats:', JSON.stringify(await ev(() => window.__cues)));
    // assignment
    await ev(() => switchTab('assignment')); await p.waitForTimeout(300);
    await p.fill('#partb-1', 'Both show the plant mass did not come from soil.'); await p.fill('#partb-2', 'Light powers the leaf.');
    await p.fill('#nc-p1', 'Van Helmont weighed and Priestley used candles, but both show the air matters for plants.');
    await p.locator('.nc-plan-c').nth(1).click();
    const ga = await ev(() => { window.refreshGathered(); return document.getElementById('gatheredOutput').value; });
    /Cups of soil I predicted the lettuce used up: 3/.test(ga) && /QUESTION 2 ---\nLight powers/.test(ga) && /candle burned in it again/.test(ga) ? OK('Gathered Answers has the cups line, both Part B answers, the planner card') : FAIL('gathered:\n' + ga);
    const hidden = await ev(() => ['partb-3', 'parta-1', 'revise-1'].map(id => { const e = document.getElementById(id); return id + ':' + (e && e.offsetParent ? 'VISIBLE' : 'hidden'); }).join(' '));
    console.log('     cut boxes:', hidden);
    // highlighter note closes
    const hl = p.locator('.nc-t-hl'); if (await hl.count()) { await hl.click(); await p.waitForTimeout(200); const n1 = await ev(() => document.querySelectorAll('.nc-note').length); await hl.click(); await p.waitForTimeout(200); const n2 = await ev(() => [...document.querySelectorAll('.nc-note')].filter(n => /highlight/i.test(n.textContent)).length); n2 === 0 ? OK(`highlighter note closes (notes ${n1} → highlight notes ${n2})`) : FAIL('highlighter note stays'); }
    // reload: everything kept, no dead ends
    await p.reload(); await p.waitForTimeout(900); await ev(() => switchTab('lesson')); await p.waitForTimeout(300);
    const st = await ev(() => ({
      cups: document.querySelector('.nc-cup-seal').textContent, sort: document.querySelector('.nc-sort').classList.contains('nc-done'),
      jar: !!document.querySelector('.nc-jar-quote'), os: document.querySelector('.nc-os').classList.contains('nc-done'),
      mt: !document.querySelector('.nc-mt-wow').hidden, pred: document.getElementById('pred-1').value.length > 10,
      dead: [...document.querySelectorAll('.nc-g button:disabled')].filter(b => b.offsetParent && !b.closest('.nc-sort-in') && !b.closest('.nc-opts')).map(b => b.textContent.trim())
    }));
    console.log('     after reload:', JSON.stringify(st));
    st.sort && st.jar && st.os && st.mt && st.pred ? OK('reload keeps every game') : FAIL('reload lost state');
    st.dead.every(t => t.length > 3) ? OK('visible disabled buttons are labeled: ' + JSON.stringify(st.dead)) : FAIL('dead-end button ' + JSON.stringify(st.dead));
    // try again buttons
    await click('.nc-jar-go[data-a="again"]'); (await ev(() => !!document.querySelector('.nc-jar-go[data-a="burn"]'))) ? OK('jars: run it again resets') : FAIL('jar again');
    await click('.nc-mt-reset'); (await ev(() => document.querySelector('.nc-mt-ppm').textContent)) === '420' ? OK('meter reset') : FAIL('meter reset');
    const failed = await ev(() => window.NC_FAILED);
    failed.length ? FAIL('NC_FAILED ' + failed) : OK('NC_FAILED empty');
    errs.length ? FAIL('page errors ' + errs.join(' | ')) : OK('no page errors');
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL` : '\nall play checks passed');
})();
