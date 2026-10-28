# HANDOFF — Smart Radiology station app

Last updated: 2026-10-28 · Owner of record: Dr Alexander Yap (Department of Radiology)
Purpose of this file: let another engineer or agent (e.g. Hermes) take over with no prior conversation and no guesswork.

---

## 1. What this is

A single-page, offline-capable interactive exhibit for a hospital board visit. Eight screens, about 90 seconds per visitor, shown on a tablet and mirrored to a 55-inch display.

| | |
|---|---|
| Local folder | `/Users/alexyap/My Drive/20_Projects/Radiology/01-Active/Workforce Transformation/smart-radiology-station-app` |
| GitHub | `https://github.com/alexyap89/smart-radiology-station` (public, branch `main`) |
| Live | `https://alexyap89.github.io/smart-radiology-station/` (GitHub Pages, branch `main`, path `/`) |
| Size | ~34 MB, of which 13 MB is the AR asset and 3.3 MB the decimated 3D mesh |
| Stack | plain HTML + CSS + JS. No framework, no build step, no dependencies, no network at runtime |

Run it by opening `index.html` from disk. Deploy by `git add -A && git commit && git push` — Pages rebuilds in about a minute.

**Cache trap:** after a push, the browser may keep serving the old `app.js`. A hard reload (or a `?v=` query on `index.html`) shows the new build immediately. This has bitten the stand twice; if the tablet looks stale, it is cache, not the deploy.

---

## 2. The two patients, and the argument

The station tells one night in an emergency department twice.

**Patient A — fracture or not (amber).** Four de-identified knee radiographs, one at a time. The visitor calls fracture / no fracture; the RbFracture overlay is revealed afterwards with the radiologist's reading. Then case 1: coronal CT plus the dual-energy marrow-oedema fusion, an interactive 3D model of the same CT, an AR button, and the 3D Lab workflow (render → cut-plane → share or print). Then case 2: fusion with no oedema and a sagittal reformat.

**Patient B — a first MRI (cyan).** An anxious Hokkien-speaking patient and her journey before the scanner: a **Telmi robot** walks her to imaging, then pRIMe on her own phone, then a room she has already seen. Also on this screen: a photograph of the real scanner room taken from the department's own preparation video, a live link to pRIMe-MRI, then an interactive scan-time simulator: press RUN THE SCAN and the standard lane fills to 100 % over six seconds while the AI lane stops at 63 %, with a bore-time tube. Beside it, an attributed Siemens liver-MRI example (conventional 14 s versus Deep Resolve 7 s at the same voxel size).

**Close.** An attributed statement: Smart Radiology augments patient care through new care pathways, validated technology, and clinician-builders who write the tools they use. Then the limitation, the pattern, and a one-page printable summary.

A persistent bar under the header names the patient on every screen (amber A, cyan B, neutral for tools/summary), and the nav pips carry the same letters: `A films · A CT · A DECT · B pRIME · B SPEED · tools · summary`.

---

## 3. Approved evidence — the only numbers allowed

1,102 consecutive ED radiographs audited (AI output withheld from the reporting radiologist during the audit) · sensitivity 96.6 % · NPV 99.2 % · 6 fractures caught that the initial reports missed · 7 missed by AI but caught by radiologists · 26 false positives (2.4 %) · turnaround 22 min office hours and 80 min overnight · dual-energy CT replaced MRI as first-line for occult fracture · MRI AI reconstruction about 37 % shorter across 8 musculoskeletal anatomies, **initial evaluation, MSK only** · preparation experience 16 of 16 patients positive at one month · limitation: double-negative studies were not re-read, so sensitivity is likely an overestimate.

**Do not add** cost figures, length-of-stay claims, workforce savings, patient quotations or published-outcome language. The manuscript is in preparation, not published.

A reviewer once flagged "AI output withheld from the reporting radiologist" as unapproved — it *is* approved, in the nomination document; the README's condensed list had dropped it. Check the primary documents in `Workforce Transformation/` (`award_submission_form.md`, `AI Award Nomination - RbFracture.docx`) before deleting any claim that looks strong.

---

## 4. Governance constraints that must not regress

- **No patient identifiers.** All clinical images were rebuilt from departmental originals with burnt-in side markers and initials redacted, PACS chrome cropped, and metadata stripped on save.
- **No fabricated clinical comparisons.** A "standard versus AI reconstruction" wipe was built and then **removed**: it compared one file against a CSS-softened copy of itself. The screen now states plainly that our paired reconstructions are not on the station. Do not reintroduce a synthetic comparison.
- **Vendor material is labelled.** `assets/photos/siemens-deepresolve-liver.jpg` is a Siemens marketing image, captioned "Vendor example, not our data", with a link. It carries the vendor's own study-ID watermark and no patient identifiers. The Philips SmartSpeed page was checked and rejected: its only asset is a conference photograph of identifiable people.
- **The room photographs** (`room-preparation.jpg`, `bore-view.jpg`) are stills from the department's preparation video and show a masked radiographer. **Confirm she is content for them to be shown**, or crop her out (`object-position` on `.photo img`).
- **The radiologist remains the final interpreter** in every sentence about the tool.

---

## 5. Files

```
index.html      all eight screens, the takeaway sheet, the print layout
styles.css      ~1,800 lines, many appended blocks — see §7
app.js          one IIFE: screens, quiz, windowing, 3D viewer, simulator, reset
README.txt      operator-facing: how to run, what each screen does, the figure list
assets/cases/   12 de-identified clinical images (films, AI panels, CT, fusion, sagittal)
assets/photos/  two room stills from the video + the Siemens example
assets/models/  tibia-fracture.js (decimated mesh, 76k verts), tibia-fracture.usdz (AR), ar-glyph.svg
assets/videos/  three Rad-ART clips + poster frames
assets/*.svg    audio placeholder, pathway icons
```

No asset is unreferenced, and every referenced path exists — checked mechanically. If you add an asset, run the same check before committing.

---

## 6. How it behaves (and why)

- **Screens** are absolutely positioned `.screen` elements; `#app[data-screen]` plus `.is-active` controls visibility. `visibility` and `opacity` are deliberately **not** transitioned — in a backgrounded tab transitions never tick and the screen would stay invisible. Only an 8 px rise animates.
- **Idle reset** is 180 s of no input *or scroll*, skipped on the takeaway and while the summary sheet is open. It was 30 s and threw visitors back to the start while reading.
- **Navigation** is a per-target double-tap guard (`lastGo`), not a global lock — a global lock swallowed legitimate fast clicks.
- **The simulator** is timer-driven (50 ms), not `requestAnimationFrame`, because rAF is throttled in background tabs and stalled the run at 17 %. It pauses when you leave the screen and zeroes on RESTART.
- **Windowing** on films and scans: brightness, contrast, zoom, pan, reset. Keyboard: `+ - 0` and arrows once the pane has focus.
- **The 3D viewer** is hand-rolled WebGL (no library). It needs `OES_element_index_uint` for a mesh this size; without it the app shows a labelled fallback instead of a blank canvas.
- **Print** is a single A4 landscape page; the sheet's entry animation is disabled in print, otherwise it prints blank at `opacity: 0`.

---

## 7. Known issues and traps

1. **`styles.css` is append-heavy** (~15 appended blocks). Several rules are later overrides of earlier ones — e.g. `.screen.is-active`, `.model`, `.viewer__stage`, `.vendor img`. Before changing a layout value, grep for the selector and find the **last** occurrence; that is the one that wins. This file deserves a consolidation pass, carefully, with the fit gate below after every change.
2. **Residual overflow** at 1440×900 is 0–6 px on `#s-pos`, `#s-neg`, `#s-speed` depending on content; phone widths scroll by design (a 390 px portrait screen cannot hold a film, a question and a decision at once). If you need true zero, reduce `.model`/`.viewer__stage` caps rather than type sizes.
3. **Nav labels** have long and short variants (`.lbl-full` / `.lbl-short`). Long labels appear ≥1500 px; below that the short ones prevent wrapping. `white-space: nowrap` on `.steps__item` is load-bearing.
4. **The local subagent swarm is unreliable for this codebase.** In this build: one implementation agent overwrote `index.html` with its own app; another returned analysis instead of code; a reviewer edited `styles.css` despite a read-only brief; and `mtplx-worker` currently resolves to the wrong lane. If you dispatch, verify the diff yourself and revert anything outside the brief.
5. **The pRIMe tour cannot be embedded alone.** It is a wizard step inside a single-page React app with no route. The station therefore links out (`primemri.netlify.app`) and keeps a local room photograph plus a breath-coach mock for offline. Do not spend time trying to iframe the tour.

---

## 7a. Two incidents that will happen again if you are not careful

**1. A truncated stylesheet broke the live site.** During a refinement pass `styles.css` was overwritten with a 610-byte fragment (from 67 KB) and committed; Pages published it and the station rendered unstyled. Repair: `git checkout HEAD~1 -- styles.css`, then verify every recent rule survived (`vendor__flag`, `journey__list`, `stage > .main`, `.sim__track`, `lbl-short`).

**Because of this, the deploy check must assert asset *sizes*, not just HTTP 200:**

```bash
curl -sS -o /dev/null -w "%{size_download}
" https://alexyap89.github.io/smart-radiology-station/styles.css
# expect ~68 KB, not ~600 bytes
```

**2. Read-only reviewers edit files anyway.** A reviewer briefed "findings only" wrote to `styles.css`; another overwrote `index.html` with its own app in an earlier build. After every swarm run, do `git status --short` and `git diff --stat` before committing, and revert anything outside the brief.

## 8. Verification gate — run this before any deploy

Open the app, then check in order:

1. All eight screens activate; no console errors on a fresh load.
2. Quiz: four films, right and wrong answers both reveal the AI panel and always offer a forward control; score reads "of 2 cases".
3. `#s-pos`: CT ↔ fusion tabs switch; windowing sliders and zoom work; 3D model renders and orbits; AR link carries `rel="ar"`.
4. `#s-speed`: RUN THE SCAN reaches 100 % / 63 % and `data-state="done"`; pause holds the value; reset zeroes; leaving the screen pauses it.
5. `#s-two`: chips toggle with `aria-pressed`.
6. TAKEAWAY → View summary → Print: one A4 landscape page.
7. RESTART clears score, windowing, simulator and clock.
8. Widths 1440×900, 1024×768, 390×844: no horizontal scroll; vertical overflow 0 on desktop, acceptable on phone.
9. Missing asset: rename any file in `assets/cases/` and confirm the app shows a labelled overlay and still navigates, then restore it.

---

## 8a. Telmi — integrated as a placeholder, awaiting departmental detail

Telmi wayfinding robots now appear as step 1 of Patient B's journey on `#s-two` ("A Telmi robot in the department walks her to the right door"). This is deliberately the only claim on the station about Telmi, because it is the only one that is sourced: the department's value-based-innovation deck lists "Telmi robot for wayfinding".

**Fill in when the department supplies it** — each of these is currently absent rather than guessed:
- how many robots, and where they are deployed (entrance only, or imaging corridor);
- languages the robot speaks (the patient is Hokkien-speaking; if Telmi cannot speak Hokkien, the copy must not imply continuity);
- usage figures (patients guided, time saved at the counter);
- whether it hands over to the department or to a human.

Add them to `.journey__list li:first-child` on `#s-two` and to §3 above, in the same plain register. Do not let this become a vendor-claim paragraph: one sentence, one source.

## 9. What is not verified (say so rather than assume)

- **AR on a physical iPad.** The `.usdz` is generated and structurally valid; Apple Quick Look has never been opened on it. Test before the event; if it refuses, hide the button (`#arLink`).
- **Legibility at 1.5 m on the mirrored 55-inch display.** Type sizes were raised for large screens; the distance needs a human eye at the venue.
- **Touch gestures on hardware.** Drag, pinch and wheel were exercised by pointer emulation, not by a finger.
- **Pixel appearance in Safari on the stand device.** Screenshots in the test harness were unreliable; every claim above is a DOM/state assertion plus geometry measurements.

---

## 10. If you have two hours

1. Consolidate `styles.css` (dedupe the appended blocks, one rule per selector) with the §8 gate after each step.
2. Fix the residual 0–6 px overflow by trimming the media caps, not the type.
3. Put the three Rad-ART clips behind a single "play" control instead of autoplay, so the stand is silent until touched.
4. Add a one-line "how to present" card for the two presenters (COO opens, radiologist owns the evidence) — the division is in `Smart Radiology station - board showcase plan.md` §6 in this folder's parent.
