#!/usr/bin/env python3
"""Notebook Chain sparkle: inject the layer into one G5 science lesson.

usage: python3 tools/sparkle/build_lesson.py 17-01

Reads tools/sparkle/lessons/<WW-LL>/data.json, saves the untouched page as original.html the first
time, then rebuilds lesson-<W>-<LL>-*.html from that original + the layer links + the DATA block.
"""
import glob, hashlib, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap">'


def main(key):
    w, l = key.split('-')
    kit = os.path.join(ROOT, 'tools', 'sparkle', 'lessons', key)
    pages = glob.glob(os.path.join(ROOT, 'lesson-%d-%s-*.html' % (int(w), l)))
    if len(pages) != 1:
        sys.exit('expected one page for %s, found %s' % (key, pages))
    page = pages[0]
    orig = os.path.join(kit, 'original.html')
    if not os.path.exists(orig):
        with open(page, encoding='utf-8') as f, open(orig, 'w', encoding='utf-8') as g:
            g.write(f.read())
    with open(orig, encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(kit, 'data.json'), encoding='utf-8') as f:
        data = json.load(f)
    # repair: a stray </div> right after the intro-video slot closes the first tab early, so the
    # warm-up and word wall show on every tab and later tabs fall outside .page-wrap
    import re
    a = html.find('<div class="video-placeholder-wrap">')
    b = html.find('<!-- Activity 1', a)
    if a > -1 and b > -1:
        seg = html[a:b]
        extra = len(re.findall(r'</div>', seg)) - len(re.findall(r'<div[\s>]', seg))
        if extra == 1:
            k = seg.rfind('</div>')
            html = html[:a] + seg[:k] + seg[k + 6:] + html[b:]
            print('repaired the stray </div> after the intro-video slot')
    fx = os.path.join(kit, 'fixes.json')
    if os.path.exists(fx):
        with open(fx, encoding='utf-8') as f:
            for x in json.load(f):
                n = html.count(x['find'])
                assert n == 1, 'fix must match once (%d): %s' % (n, x['find'][:60])
                html = html.replace(x['find'], x['replace'])

    def ver(p):
        with open(os.path.join(ROOT, p), 'rb') as f:
            return hashlib.sha1(f.read()).hexdigest()[:8]
    css, js = 'assets/sparkle/nc-sparkle.css', 'assets/sparkle/nc-sparkle.js'
    head = '%s\n<link rel="stylesheet" href="%s?v=%s">\n' % (FONT, css, ver(css))
    blob = json.dumps(data, ensure_ascii=False, indent=1).replace('</', '<\\/')
    tail = '<script type="application/json" id="nc-data">\n%s\n</script>\n<script src="%s?v=%s"></script>\n' % (blob, js, ver(js))

    assert html.count('</head>') == 1, 'head'
    html = html.replace('</head>', head + '</head>', 1)
    i = html.rfind('</body>')
    assert i > 0, 'body'
    html = html[:i] + tail + html[i:]
    with open(page, 'w', encoding='utf-8') as f:
        f.write(html)
    print('built', os.path.relpath(page, ROOT))


if __name__ == '__main__':
    main(sys.argv[1])
