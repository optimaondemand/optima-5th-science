# Notebook Chain kit (G5 science) — tools/sparkle/

Build one lesson: `python3 tools/sparkle/build_lesson.py 17-01` (from the repo root). The page = original.html + fixes.json (find/replace) + the layer links + data.json.

## Safety: the kit never silently loses a page edit (kit_guard.py, 10 Nov 2026)

Every build compares the live page with what the kit last wrote (`lessons/<key>/built.sha1`; `?v=` stamps are ignored).

- Page unchanged since the last build: the build overwrites it as usual.
- Page edited outside the kit (a standards pass, a typo fix, a find-and-replace across pages): the build **stops before writing** and shows what would be lost. Then:
  - `--check` shows the differences between the page and what the kit would build (writes nothing).
  - `--absorb` turns those differences into new entries at the end of the lesson's `fixes.json`, proves a rebuild now gives back the page exactly, and saves. Run the build again afterwards.
  - `--force` overwrites anyway (the outside edits are lost).
- Edits inside the DATA block can't be absorbed: change the lesson's data file instead.
- Habit: after any edit made straight to lesson pages, run every lesson with `--check` (then `--absorb`) before the next rebuild.
