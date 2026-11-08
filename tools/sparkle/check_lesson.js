// Notebook Chain: the standard check for one sparkled G5 science lesson.
//
// usage (repo root served on localhost:8765, e.g. `python3 -m http.server 8765`):
//   NODE_PATH=$(npm root -g) node tools/sparkle/check_lesson.js 17-01
//
// Reports FAIL / WARN lines and writes screenshots + the student text to tools/sparkle/out/<WW-LL>/.
// It checks the things every lesson must get right; each lesson's own games still need a play script.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const key = process.argv[2]; if (!key) { console.log('usage: check_lesson.js WW-LL'); process.exit(2); }
const [w, l] = key.split('-');
const page = fs.readdirSync(ROOT).find(f => f.startsWith(`lesson-${+w}-${l}-`) && f.endsWith('.html'));
const OUT = path.join(__dirname, 'out', key); fs.mkdirSync(OUT, { recursive: true });
const URL = `http://localhost:8765/${page}`;
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons', key, 'data.json'), 'utf8'));
const BAD = [/\bbets?\b/i, /\bwager/i, /\bchips?\b/i, /\bkeeper\b/i, /investigate tab/i, /\bgo back to\b/i, /in your notebook\b(?! page)/i, /\bDutch\b/];
let fails = 0, warns = 0;
const FAIL = m => { fails++; console.log('FAIL', m); }, WARN = m => { warns++; console.log('WARN', m); }, OK = m => console.log('ok  ', m);

// media named in DATA + every clip
const files = new Set();
(function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  else if (typeof v === 'string' && /^(images|assets)\//.test(v)) files.add(v.split('?')[0]); })(D);
const clipKeys = new Set(Object.keys((D.keeper || {}).clips || {}));
((D.opener || {}).frames || []).forEach(f => f.clip && clipKeys.add(f.clip));
if (D.opener && D.opener.titleClip) clipKeys.add(D.opener.titleClip);
const cj = path.join(__dirname, 'lessons', key, 'clips.json');
if (fs.existsSync(cj)) Object.keys(JSON.parse(fs.readFileSync(cj, 'utf8')).clips).forEach(k => clipKeys.add(k));
clipKeys.forEach(k => files.add(`${D.audio}${D.prefix}-${k}.mp3`));
const missing = [...files].filter(f => !fs.existsSync(path.join(ROOT, f)) || fs.statSync(path.join(ROOT, f)).size < 2000);
missing.length ? FAIL('missing or empty media: ' + missing.join(', ')) : OK(`${files.size} media files (${clipKeys.size} clips) present`);
const big = [...files].filter(f => fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).size > 8e6);
if (big.length) WARN('files over 8 MB: ' + big.join(', '));

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const W of [1150, 760, 420, 375, 320]) {
    const p = await b.newPage({ viewport: { width: W, height: 860 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(900);
    await p.evaluate(() => window.__ncOpener && window.__ncOpener.finish()); await p.waitForTimeout(300);
    const tabs = await p.$$eval('.tab-btn', ts => ts.filter(t => getComputedStyle(t).display !== 'none').map(t => t.dataset.tab));
    let words = 0, writes = 0, text = '';
    for (const t of tabs) {
      await p.evaluate(t => switchTab(t), t); await p.waitForTimeout(350);
      const r = await p.evaluate(() => {
        const panel = document.querySelector('.tab-panel.active');
        const clone = panel.cloneNode(true);
        clone.querySelectorAll('details.nc-wx, script, style, svg, [hidden]').forEach(e => e.remove());
        // count only what is visible in the live panel
        const live = [...panel.querySelectorAll('*')].filter(e => e.offsetParent === null && e.children.length === 0 && e.textContent.trim());
        const txt = panel.innerText.replace(/\s+/g, ' ');
        const wx = [...panel.querySelectorAll('details.nc-wx')].map(d => d.innerText).join(' ').replace(/\s+/g, ' ');
        const wcount = s => (s.match(/[A-Za-z0-9’']+/g) || []).length;
        const ins = [...panel.querySelectorAll('textarea')].filter(e => e.offsetParent !== null && !e.readOnly && e.id !== 'gatheredOutput').length;
        return { words: wcount(txt) - wcount(wx), ins, txt, sw: document.documentElement.scrollWidth, iw: innerWidth };
      });
      words += r.words; writes += r.ins; text += `\n\n=== ${t} (${r.words} words) ===\n` + r.txt;
      if (r.sw > r.iw + 1) FAIL(`${W}px ${t}: sideways scroll (${r.sw} > ${r.iw})`);
      if (W === 1150 || W === 420) await p.screenshot({ path: path.join(OUT, `${W}-${t}.png`), fullPage: true });
    }
    // tools vs Back to Top
    await p.evaluate(() => window.scrollTo(0, 1600)); await p.waitForTimeout(600);
    const hit = await p.evaluate(() => { const a = document.querySelector('.back-to-top'); if (!a) return false; const A = a.getBoundingClientRect();
      return [...document.querySelectorAll('.nc-dock button, .nc-tool')].some(e => { const d = e.getBoundingClientRect(); return d.width && !(d.right < A.left || d.left > A.right || d.bottom < A.top || d.top > A.bottom); }); });
    if (hit) FAIL(`${W}px: a floating tool covers Back to Top`);
    const failed = await p.evaluate(() => window.NC_FAILED || []);
    if (failed.length) FAIL(`${W}px NC_FAILED: ${failed.join(', ')}`);
    if (errs.length) FAIL(`${W}px page errors: ${errs.join(' | ')}`);
    const brokenImg = await p.$$eval('img', is => is.filter(i => i.complete && i.offsetParent && !i.naturalWidth && !/^https?:/.test(i.getAttribute('src') || '')).map(i => i.getAttribute('src')));
    if (brokenImg.length) FAIL(`${W}px broken images: ${brokenImg.join(', ')}`);
    if (W === 1150) {
      fs.writeFileSync(path.join(OUT, 'student-text.txt'), text.trim());
      const listen = Object.values((D.keeper || {}).clips || {}).map(c => c.text || '').join(' ');
      const lw = (listen.match(/[A-Za-z0-9’']+/g) || []).length;
      const mins = Math.round((words / 130) + writes * 3 + 8);
      console.log(`info reading: ${words} words on the page (+${lw} spoken in Listen cards, not counted), ${writes} visible writing boxes (the 3 CER boxes count as 3)`);
      console.log(`info rough time: ${mins} min (130 wpm reading + 3 min per writing box + ~8 min opener, games, clips). Target about 45.`);
      if (words > 2600) WARN('over the lean budget (about 1,900–2,500 page words)');
      if (mins > 55 || mins < 35) WARN('rough time is outside 35–55 min: trim or add, then re-check');
      BAD.forEach(rx => { const m = text.match(rx); if (m) FAIL(`banned wording "${m[0]}" on the page`); });
      const top = await p.evaluate(() => { switchTab('vocab'); const h = document.querySelector('header h1, .lesson-header h1, h1'); const t = h ? h.textContent.trim() : '';
        const bq = [...document.querySelectorAll('.big-question, .bq-card')].filter(e => e.offsetParent).length; return { t, bq }; });
      if (D.opener && top.bq) FAIL('Big Question card shows on the first tab although the opener ends on it');
      const wx = await p.$$eval('details.nc-wx', ds => ds.map(d => d.open));
      if (wx.some(Boolean)) FAIL('a wonder extra is open by default');
      OK(`${wx.length} wonder extras, all folded`);
    }
    await p.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAIL, ${warns} WARN` : `\nno FAIL (${warns} WARN). Screenshots + student-text.txt in ${path.relative(ROOT, OUT)}`);
  process.exit(fails ? 1 : 0);
})();
