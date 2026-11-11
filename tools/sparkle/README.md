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

## One step at a time (`assets/sparkle/onestep.js` + `onestep.css`, 11 Nov 2026)

The ELA step walker, for science. On each tab the student sees ONE step, with **◂ Back · Step 3 of 27 · 👆 Next**; the last step's button opens the next tab. Nothing is removed: hidden steps keep their answers, so saving, the gathered answers and the checklists still work. The same two files sit in the G3, G4 and G5 science repos (the grade is detected from the page); change one, copy it to the other two.

- On only when the lesson's `data.json` says `"onestep": true` (17.01 and 17.02); the layer loads the files. Preview with `?steps=1`.
- Off for one visit: add `?steps=0` to the address.
- How a tab is cut: big cards are opened up and their header stays on screen; a heading, Opti/Dr. Reyes strip or short label line starts a step and pulls the next thing in; answer boxes, help ladders, buttons and anything hidden at load stay with the thing before; a game, lab or stage is one step; reading is cut at about 110 words. A step with nothing showing is skipped and not counted.
- Jumps: any script that scrolls to a part of the page calls `OneStep.reveal(element)` first (already done in the page's jump helper, so the Assignment map and "show me" buttons open the right step).
- Write for the steps: every step needs its own direction line; a direction never names something that only appears on a later step.
- Test: `node tools/sparkle/stepwalk.js http://localhost:<port>/<page>.html 1150` and again at `420` (serve the repo first). It walks every Next and Back and fails on an empty step, sideways scroll, a count that does not move, a last step that is not "Step N of N", or a page error. Add a third argument to save a picture of every step, and look at them.
- Target: about 20 to 27 steps a lesson.
- `check_lesson.js` opens the page with `?steps=0`, so word counts and answer-box checks see the whole page.
- The hidden Investigate tab is not walked or counted. The floating Back to Top is hidden while the walker is on.
