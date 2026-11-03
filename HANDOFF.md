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
| Size | ~38 MB, of which 13 MB is the AR asset, 3.3 MB the decimated 3D mesh and ~3.5 MB the new 4D clips |
| Stack | plain HTML + CSS + JS. No framework, no build step, no dependencies, no network at runtime |

Run it by opening `index.html` from disk. Deploy by `git add -A && git commit && git push` — Pages rebuilds in about a minute.

**Cache trap, round two (2026-11-03).** `index.html` now links `styles.css?v=<stamp>` and `app.js?v=<stamp>`. Bump `20261103c` to a new stamp on every deploy, or the tablet will run the previous stylesheet against the new markup — which looks like a CSS bug and wasted several passes today. The old advice (hard reload) still applies, but versioning removes the trap for the stand.

**Cache trap:** after a push, the browser may keep serving the old `app.js`. A hard reload (or a `?v=` query on `index.html`) shows the new build immediately. This has bitten the stand twice; if the tablet looks stale, it is cache, not the deploy.

---

## 2. The two patients, and the argument

The station tells one night in an emergency department twice.

**Close.** An attributed statement: Smart Radiology augments patient care through new care pathways, validated technology, and clinician-builders who write the tools they use. Then the limitation, the pattern, and a one-page printable summary.

A persistent bar under the header names the programme on every screen, and the nav pips carry the same numbers: `1 films · 1 CT · 1 DECT · 2 3D Lab · 2 denoise · 2 4D · 3 MRI speed · 4 pRIMe · tools · summary`.

**v2 storyboard — four programmes (2026-11-03).** The station now shows four things the department has built, in the order the board plan prescribes (RbFracture owns the evidence budget, then breadth):

1. **RbFracture** (`#s-quiz`, `#s-pos`, `#s-neg`) — the fracture copilot for emergency radiology. Four ED films, then the CT that showed the fracture and the dual-energy case that excluded one. The 3D model on `#s-pos` is now presented as the lab's output, with a pointer to the lab rather than the old inline workflow block.
2. **3D + 4D Lab** (`#s-lab`, `#s-see`, `#s-move`) —
   - `#s-lab`: a cinematic-render gallery (foot, scapula, ribs) on the left, the digital-first triage rule and the service note on the right, and the three Rad-ART clinical clips in a **full-width row beneath both** (441×153 each at 1440 px, autoplaying) — they were a small side column before 2026-11-03. The volume/cost/carbon facts are prose in the service note, not display numerals. One line tells the visitor that the **printed models are on the table beside the station** (brought physically; deliberately no photographs of them).
   - `#s-see`: the dose ladder. Drag the dose down; CT noise rises against the pre-committed 115% gate. Tier 1 (−20%) and Tier 2 (−30%) pass, the −40% ceiling breaches the gate and the widget refuses to move. **The rungs and the gate are real; the noise curve is a model of them and the screen says so.**
   - `#s-move`: three de-identified 4D captures with a phase readout, plus the pilot block (dose targets, phases, added time, utility gates) — every figure a pre-committed target.
3. **MRI acceleration** (`#s-speed`) — unchanged: the scan simulator, the ~37% MSK evaluation, the labelled vendor example.
4. **pRIMe** (`#s-two`) — unchanged apart from the removal of the Telmi journey step.

**Who is on screen.** Two patients, and their stories are continuous.

- **Patient A** — the man who fell and could not bear weight — carries domains 1 and 2: his ED film (fracture), the CT, the dual-energy marrow map, the 3D render and the 4D motion. His portrait is a **supplied photograph**, mirrored so the bandaged knee reads as the right knee the films show.
- **Patient B** — the woman who fell, could walk, and whose knee film was the **negative** case — carries domains 3 and 4. Weeks later she returns with abdominal pain and a liver MRI; that scan is the acceleration demonstration, and her preparation (16/16 at one month, Hokkien, claustrophobia) is pRIMe.

The acceleration figure is **musculoskeletal only**; her scan is a liver, so the screen states that the 37% does not travel to her protocol, and the vendor comparison beside it is a liver example labelled as the vendor's. Each case's first slide carries a small portrait with one line of context, and the portrait switches with the patient: on `#s-quiz` the row is per-film (`#qPatientImg` / `#qPatientMeta`, set from the `FILMS` entries), so films 1–2 show Patient A and films 3–4 show Patient B. The attract screen carries the two faces side by side, captioned "Portraits are illustrative, not patients of this department."

Film 3 and 4 are the **left** knee — that is how the assets were originally labelled. Do not relabel them as her right knee.

**Removed:** the entire `#s-temi` screen and every Telmi reference (nav pip, journey step, takeaway line). The wayfinding pilot is no longer on the station.

## 3. Approved evidence — the only numbers allowed

1,102 consecutive ED radiographs audited (AI output withheld from the reporting radiologist during the audit) · sensitivity 96.6 % · NPV 99.2 % · 6 fractures caught that the initial reports missed · 7 missed by AI but caught by radiologists · 26 false positives (2.4 %) · turnaround 22 min office hours and 80 min overnight · dual-energy CT replaced MRI as first-line for occult fracture · MRI AI reconstruction about 37 % shorter across 8 musculoskeletal anatomies, **initial evaluation, MSK only** · preparation experience 16 of 16 patients positive at one month · limitation: double-negative studies were not re-read, so sensitivity is likely an overestimate.

### v2 additions — how each new claim is labelled

| Programme | Allowed | Never say |
|---|---|---|
| CT denoising (GE TrueFidelity on the Apex) | "service change with a pre-committed dose target": −20 % CTDIvol at Tier 1, −30 % cumulative at Tier 2, ceiling −40 % not entered by default, gate = median ROI noise ≤ 115 % of baseline, ≥30 cases per tier | "20–30 % dose saving", "we cut dose by 20 %", any past tense that implies a result |
| 3D Lab / cinematic rendering | Live service. Tier 0–5 spectrum; recon S$82–S$299; prints S$560–S$1,020; FY27 50–65 prints against a 100-unit target; ~80 % FDM / 20 % SLA; ortho ≈60 % of volume; 279 candidates; 0.73–1.33 kWh and 0.6–1.3 kg CO₂ avoided per print | "saves theatre time" unless measured |
| 4D dynamic CT | Pilot: feasibility and workflow, no outcome data yet, no additional patient charge. Dose targets wrist ≤0.1, elbow ≤1.0, ankle ≤0.1, shoulder ≤1.5 mSv; 10–15 phases; added workflow ≤20 min; ≥80 % diagnostic motion capture; added information ≥60 %; management impact ≥30 % — **all targets** | "replaces MRI", "replaces fluoroscopy", any result |

Sources: `~/apex-tf-dose-qip/00-PROJECT-PLAN.md`, `01-Active/4D CT Pilot WH/00-4DCT-PROJECT-PLAN.md`, `01-Active/3D Lab/3D_Lab_Service_Spectrum_and_Triage.md`, `03-QI-and-Clinical-Services/3D Cinematic Rendering/`.

The two illustrated patient portraits on the attract screen are **generated images, not real patients** and the screen says so. Do not present them as photographs of the department's patients.

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
index.html      eleven screens (attract + ten), the takeaway sheet, the print layout
styles.css      ~2,270 lines, many appended blocks — see §7
app.js          one IIFE: screens, quiz, windowing, 3D viewer, simulator, dose ladder, render gallery, 4D cine, reset
README.txt      operator-facing: how to run, what each screen does, the figure list
assets/cases/   12 de-identified clinical images (films, AI panels, CT, fusion, sagittal)
assets/photos/  two room stills from the video + the Siemens example
assets/models/  tibia-fracture.js (decimated mesh, 76k verts), tibia-fracture.usdz (AR), ar-glyph.svg
assets/cine/    three cinematic render stills (foot, scapula, ribs) from the 3D Lab case PDF
assets/img/     patient-a.jpg (supplied photograph, mirrored so the bandaged knee reads right), patient-a-mri.jpg and patient-b.jpg (generated illustrations), patient-b-mri.jpg (generated)
assets/videos/  three Rad-ART clips + posters, and four 4D clips: 4d-knee, 4d-surface, 4d-shoulder, 4d-hindfoot
assets/*.svg    audio placeholder, pathway icons
```

No asset is unreferenced, and every referenced path exists — checked mechanically. If you add an asset, run the same check before committing.

---

## 6. How it behaves (and why)

- **Screens** are absolutely positioned `.screen` elements; `#app[data-screen]` plus `.is-active` controls visibility. `visibility` and `opacity` are deliberately **not** transitioned — in a backgrounded tab transitions never tick and the screen would stay invisible. Only an 8 px rise animates.
- **Idle reset** is 180 s of no input *or scroll*, skipped on the takeaway and while the summary sheet is open. It was 30 s and threw visitors back to the start while reading.
- **Navigation** is a per-target double-tap guard (`lastGo`), not a global lock — a global lock swallowed legitimate fast clicks.
- **The dose ladder** is a number widget, not an image demo: no noisy/clean pair exists in the department, so nothing is faked. The curve is a model (`100 / sqrt(1 - r/100) * (1 - 0.0014r)`) checked against the 115 % gate; the rungs and the gate come from the QI plan. Reset returns it to baseline.
- **The 4D cine** plays on demand only. Each case sets `data-src` then `src` on first play (no preload), the phase readout is `currentTime / duration × 12`, and leaving `#s-move` pauses it. It is wired separately from `playVideos()`, which still belongs to the Rad-ART clips on `#s-lab`.
- **The Rad-ART clips** now live on `#s-lab` and autoplay there (`show("lab")` starts them); `#s-tools` no longer carries video.
- **The 3D model drag is direct-manipulation**: a rightward drag turns the near face right (`mv.yaw -= dx * 0.01`). It was inverted before 2026-11-03; do not flip it back.
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

1. All eleven screens activate from the pips and the forward buttons; no console errors on a fresh load. The chain is `quiz → pos → neg → lab → see → move → speed → two → tools → takeaway`.
2. Quiz: four films, right and wrong answers both reveal the AI panel and always offer a forward control; score reads "of 2 cases".
3. `#s-pos`: CT ↔ fusion tabs switch; windowing sliders and zoom work; 3D model renders and drags **with the surface following the finger**; AR link carries `rel="ar"`.
4. `#s-lab`: all three render tabs swap image, alt text and caption; the three Rad-ART clips play on entry; the metrics read 279 / 50–65 / 0.73–1.33.
5. `#s-see`: slider 0 → 20 → 30 → 40 sets the panel to `t0/t1/t2/fail`, noise reads 100/109/115/122 %, the gate reads baseline/passes/passes/fails, and 25 % reads "no rung here". Reset returns to 0.
6. `#s-move`: play loads and runs the clip, the phase readout climbs 1→12, pause holds, reset zeroes, each of the four tabs swaps clip and caption, leaving the screen pauses.
7. `#s-speed`: RUN THE SCAN reaches 100 % / 63 % and `data-state="done"`; pause holds the value; reset zeroes; leaving the screen pauses it.
8. `#s-two`: chips toggle with `aria-pressed`.
9. TAKEAWAY → View summary → Print: one A4 landscape page; the sheet carries eight fact rows.
10. RESTART clears score, windowing, simulator, dose ladder, gallery and cine.
11. Widths 1440×900, 1024×768, 390×844: no horizontal scroll; vertical overflow 0 on desktop, acceptable on phone.
12. Missing asset: rename any file in `assets/cases/` and confirm the app shows a labelled overlay and still navigates, then restore it.
13. `grep -rin "temi" index.html app.js styles.css README.txt` returns nothing except this file's own history notes.

---

## 9. What is not verified (say so rather than assume)

- **AR on a physical iPad.** The `.usdz` is generated and structurally valid; Apple Quick Look has never been opened on it. Test before the event; if it refuses, hide the button (`#arLink`).
- **Legibility at 1.5 m on the mirrored 55-inch display.** Type sizes were raised for large screens; the distance needs a human eye at the venue.
- **Touch gestures on hardware.** Drag, pinch and wheel were exercised by pointer emulation, not by a finger.
- **Pixel appearance in Safari on the stand device.** Screenshots in the test harness were unreliable; every claim above is a DOM/state assertion plus geometry measurements.
- **The generated patient illustrations.** Produced locally with FLUX.2 klein from text prompts; illustrative composites, not portraits of the department's patients, labelled as such on the cover. The MRI frame (seed 51) shows a wide-bore magnet, a knee brace on the patient and a sky-painted ceiling; it is close to the department's room but is not a photograph of it, and it must not be described as one.
- **Whether the four 4D clips read as motion from 1.5 m away.** They were cropped, trimmed and sped up (1.8–2.5×) for legibility on a screen; verify at the stand.
- **The 4D clips' provenance wording.** They are captures of a workstation during the pilot's test cases; confirm with the lead that showing them on a board stand is acceptable before the event.

---

## 10. If you have two hours

1. Consolidate `styles.css` (dedupe the appended blocks, one rule per selector) with the §8 gate after each step. It is now ~2,270 lines with three override layers from the v2 rework; the last occurrence of a selector still wins.
2. Delete `.metrics--quad`, `.flow3d__list`, `.flow3d__stat`, `.media__col` and the `.fork*` rules if nothing references them after the Telmi and Rad-ART moves.
3. Put the three Rad-ART clips behind a single "play" control instead of autoplay, so the stand is silent until touched.
4. Add a one-line "how to present" card for the two presenters (COO opens, radiologist owns the evidence) — the division is in `Smart Radiology station - board showcase plan.md` §6 in this folder's parent.
