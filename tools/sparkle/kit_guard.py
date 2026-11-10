"""kit_guard: keep the sparkle kit and the live lesson pages in step, so a rebuild never loses an edit.

Every build compares the page on disk with what the kit last wrote (tools/sparkle/lessons/<key>/built.sha1).
  * Page unchanged since the last build  -> the build overwrites it as usual.
  * Page edited outside the kit (a hand fix, a standards pass, a find-and-replace across pages)
    -> the build STOPS before writing, shows what would be lost, and tells you what to run:
       --check   show the differences between the page and what the kit would build (writes nothing)
       --absorb  turn those differences into new entries in the lesson's fixes.json, check that a rebuild
                 now gives back the page exactly, then save (writes fixes.json + the stamp, not the page)
       --force   overwrite the page anyway (the outside edits are lost)
The ?v= version stamps on the layer files are ignored when comparing (they change with every engine edit).
Python 3 standard library only.
"""
import sys as _s; _s.dont_write_bytecode = True
import difflib, hashlib, json, os, re, sys


def norm(html, layer):
    # layer is a file-name pattern: 'fs-sparkle', 'nc-sparkle', or 'wf-[a-z]+' for the G3 Wonder Films files
    return re.sub(r'(assets/sparkle/(?:%s)\.(?:js|css)\?v=)[0-9a-f]+' % layer, r'\1V', html)


def sha(t):
    return hashlib.sha1(t.encode('utf-8')).hexdigest()


def _hunks(a, b):
    """Changed spans between two texts as (a_start, a_end, b_start, b_end), line-level then trimmed to characters."""
    al, bl = a.splitlines(keepends=True), b.splitlines(keepends=True)
    apos, p = [], 0
    for l in al: apos.append(p); p += len(l)
    apos.append(p)
    bpos, p = [], 0
    for l in bl: bpos.append(p); p += len(l)
    bpos.append(p)
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, al, bl, autojunk=False).get_opcodes():
        if op == 'equal': continue
        x1, x2, y1, y2 = apos[i1], apos[i2], bpos[j1], bpos[j2]
        sa, sb = a[x1:x2], b[y1:y2]
        if sa and sb:  # trim the common start and end so the fix is as small as it can be
            k = 0
            while k < min(len(sa), len(sb)) and sa[k] == sb[k]: k += 1
            e = 0
            while e < min(len(sa), len(sb)) - k and sa[-1 - e] == sb[-1 - e]: e += 1
            x1, y1, x2, y2 = x1 + k, y1 + k, x2 - e, y2 - e
        out.append((x1, x2, y1, y2))
    return out


def report(built, page, layer, limit=12):
    hs = _hunks(norm(built, layer), norm(page, layer))
    B, P = norm(built, layer), norm(page, layer)
    for x1, x2, y1, y2 in hs[:limit]:
        print('  - kit builds: %r' % B[max(0, x1 - 30):x2 + 30][:220])
        print('    page has:   %r' % P[max(0, y1 - 30):y2 + 30][:220])
    if len(hs) > limit: print('  … and %d more' % (len(hs) - limit))
    return len(hs)


def absorb(pre, built, page, layer, inject, keys):
    """Return new fix entries that turn `pre` (the lesson after its fixes, before the layer is injected) into the page.
    keys = (old_key, new_key) of this kit's fixes.json format. Raises if a difference can't be expressed as a fix."""
    B, P = norm(built, layer), norm(page, layer)
    fixes, cur = [], pre
    for x1, x2, y1, y2 in _hunks(B, P):
        old, new = B[x1:x2], P[y1:y2]
        # grow the span until the old text sits exactly once in the pre-injection lesson
        lo, hi, nlo, nhi = x1, x2, y1, y2
        for _ in range(200):
            o = B[lo:hi]
            if o and cur.count(o) == 1: break
            lo, hi, nlo, nhi = max(0, lo - 20), min(len(B), hi + 20), max(0, nlo - 20), min(len(P), nhi + 20)
        o, n = B[lo:hi], P[nlo:nhi]
        if not o or cur.count(o) != 1:
            raise ValueError('cannot place this difference inside the lesson body (is it in the DATA block? edit data.json instead): %r' % B[x1:x2][:120])
        cur = cur.replace(o, n, 1)
        fixes.append({keys[0]: o, keys[1]: n, 'why': 'absorbed: page edited outside the kit'})
    if norm(inject(cur), layer) != P:
        raise ValueError('absorbed fixes do not rebuild the page exactly; nothing saved')
    return fixes


def write(page_path, html, kit_dir, layer, pre, inject, fixes_path, keys, flags):
    """The one place a builder writes a page. Returns True if it wrote the page."""
    stamp = os.path.join(kit_dir, 'built.sha1')
    cur = open(page_path, encoding='utf-8', newline='').read() if os.path.exists(page_path) else ''
    last = open(stamp).read().strip() if os.path.exists(stamp) else None
    same = norm(cur, layer) == norm(html, layer)
    outside = bool(cur) and not same and (last is None or sha(norm(cur, layer)) != last)
    if '--check' in flags:
        if same: print('check: the page matches what the kit builds')
        else:
            print('check: %s differs from what the kit builds%s:' % (os.path.basename(page_path), ' (page was edited outside the kit)' if outside else ' (kit changed since the last build)'))
            report(html, cur, layer)
        return False
    if '--absorb' in flags:
        if same: print('absorb: nothing to absorb')
        else:
            new = absorb(pre, html, cur, layer, inject, keys)
            F = json.load(open(fixes_path, encoding='utf-8')) if os.path.exists(fixes_path) else []
            raw = open(fixes_path, encoding='utf-8').read() if os.path.exists(fixes_path) else '[\n '
            ind = 2 if raw.startswith('[\n  ') else 1
            with open(fixes_path, 'w', encoding='utf-8', newline='') as f:
                f.write(json.dumps(F + new, ensure_ascii=False, indent=ind) + '\n')
            print('absorb: added %d fix(es) to %s; a rebuild now gives back the page exactly' % (len(new), os.path.relpath(fixes_path)))
        open(stamp, 'w').write(sha(norm(cur, layer)) + '\n')
        return False
    if outside and '--force' not in flags:
        print('STOP: %s was edited outside the kit since the last build. Rebuilding would lose this:' % os.path.basename(page_path))
        report(html, cur, layer)
        print('Run again with --absorb to keep those edits (they go into fixes.json), or --force to throw them away.')
        sys.exit(2)
    with open(page_path, 'w', encoding='utf-8', newline='') as f: f.write(html)
    open(stamp, 'w').write(sha(norm(html, layer)) + '\n')
    return True
