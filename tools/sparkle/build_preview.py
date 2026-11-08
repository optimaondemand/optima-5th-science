#!/usr/bin/env python3
"""Notebook Chain: one self-contained preview file for Bethany (everything inlined).

usage: python3 tools/sparkle/build_preview.py 17-01 [out.html]

Run after build_lesson.py. Inlines the layer CSS/JS, every local image in the page, every local file
named in the DATA block (photos, video, 3D model, vendor scripts) and every Listen/opener clip.
Default output: preview-g5sci-<WW-LL>-notebook-chain.html in the repo root's parent "previews" folder
when it exists, else next to this script. Never commit the preview (it is 20+ MB).
"""
import base64, glob, json, mimetypes, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MIME = {'.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.js': 'text/javascript',
        '.webp': 'image/webp', '.svg': 'image/svg+xml'}


def uri(rel):
    p = os.path.join(ROOT, rel.split('?')[0])
    ext = os.path.splitext(p)[1].lower()
    mt = MIME.get(ext) or mimetypes.guess_type(p)[0] or 'application/octet-stream'
    with open(p, 'rb') as f:
        return 'data:%s;base64,%s' % (mt, base64.b64encode(f.read()).decode())


def local(s):
    return isinstance(s, str) and not s.startswith(('http', 'data:', '#')) and '/' in s and \
        os.path.isfile(os.path.join(ROOT, s.split('?')[0]))


def main(key, out=None):
    w, l = key.split('-')
    page = glob.glob(os.path.join(ROOT, 'lesson-%d-%s-*.html' % (int(w), l)))[0]
    html = open(page, encoding='utf-8').read()
    m = re.search(r'(<script type="application/json" id="nc-data">\n)(.*?)(\n</script>)', html, re.S)
    data = json.loads(m.group(2).replace('<\\/', '</'))

    def walk(v):
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        return uri(v) if local(v) else v
    data = walk(data)
    clips = {}
    for f in glob.glob(os.path.join(ROOT, data['audio'], data['prefix'] + '-*.mp3')):
        k = os.path.basename(f)[len(data['prefix']) + 1:-4]
        clips[k] = uri(os.path.relpath(f, ROOT))
    blob = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
    html = html[:m.start()] + m.group(1) + blob + m.group(3) + html[m.end():]

    def css(mo):
        return '<style>%s</style>' % open(os.path.join(ROOT, mo.group(1)), encoding='utf-8').read()
    html = re.sub(r'<link rel="stylesheet" href="(assets/sparkle/[^"?]+)\?v=[^"]*">', css, html)

    def js(mo):
        code = open(os.path.join(ROOT, mo.group(1)), encoding='utf-8').read()
        code = code.replace("function src(key) { return (D.audio",
                            "function src(key) { return (window.NC_AUDIO_MAP || {})[key] || ((D.audio", 1)
        code = code.replace("+ '-' + key + '.mp3'; }", "+ '-' + key + '.mp3'); }", 1)
        amap = json.dumps(clips).replace('</', '<\\/')
        return '<script>window.NC_AUDIO_MAP=%s;</script>\n<script>%s</script>' % (amap, code.replace('</script', '<\\/script'))
    html = re.sub(r'<script src="(assets/sparkle/nc-sparkle\.js)\?v=[^"]*"></script>', js, html)
    html = re.sub(r'(src|href)="((?:images|assets)/[^"]+)"',
                  lambda mo: '%s="%s"' % (mo.group(1), uri(mo.group(2)) if local(mo.group(2)) else mo.group(2)), html)
    out = out or os.path.join(ROOT, 'tools', 'sparkle', 'out', 'preview-g5sci-%s-notebook-chain.html' % key)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    print('preview', out, '%.1f MB' % (os.path.getsize(out) / 1e6), '%d clips' % len(clips))


if __name__ == '__main__':
    main(*sys.argv[1:])
