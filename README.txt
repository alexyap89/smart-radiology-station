SMART RADIOLOGY — IS THERE A FRACTURE?
An interactive station for a hospital board visit. Static, offline-first, touch-first.

--------------------------------------------------------------------------------
1. HOW TO RUN
--------------------------------------------------------------------------------
1. Copy the "smart-radiology-station-app" folder to the tablet or laptop.
2. Open "index.html" (double-click, or open it in Safari / Chrome).
3. No build, no server, no login, no network needed for anything except the
   "Open pRIMe in Hokkien" link, which launches the live external tool.

RESTART (top right) resets everything, including the score, the windowing and
any embedded media. The app returns to the attract screen after 180 seconds with
no input or scroll, except on the final takeaway screen, so a visitor can read a
screen without being thrown back to the start.

--------------------------------------------------------------------------------
2. THE WALK (about 90 seconds per visitor)
--------------------------------------------------------------------------------
0  ATTRACT          Two patients. Four films. Is there a fracture?
1  THE FILMS        Scenario A. Four de-identified knee radiographs, one at a
                    time: the visitor calls fracture / no fracture, the score
                    chips fill, and the AI overlay is revealed afterwards with
                    the radiologist's reading.
2  THE CT           Scenario A, case 1. Coronal CT and the dual-energy
                    marrow-oedema fusion (tab switch), each windowable and
                    zoomable, plus an interactive 3D model of the same CT and an
                    AR button for iPad/iPhone.
3  DUAL-ENERGY      Scenario A, case 2. Fusion map with no oedema and a sagittal
                    reformat. A negative film still needs a plan.
4  SCENARIO B       Priming and speed. An anxious Hokkien-speaking patient, the
                    clinician-built 360° preparation, and AI-accelerated MRI
                    reconstruction with a time comparison.
5  SCENARIO B (a)   Before the scan: the anxious Hokkien-speaking patient, a
                    photograph of the actual scanner room taken from the
                    department's own preparation video, the phone breath coach,
                    and the live pRIMe link. Forward control to the next screen.
6  SCENARIO B (b)   In the scanner: interactive scan-time simulator (#scanSim).
                    Press RUN THE SCAN: the standard lane fills to 100% over six
                    seconds while the AI lane stops at 63%, and the bore tube
                    fills with the time still spent inside the scanner. Pause,
                    resume and reset work; leaving the screen pauses the run.
                    Below it: the ~37% MSK initial evaluation and why shorter
                    time in the bore matters for a claustrophobic patient. The
                    screen states plainly that paired standard/reconstructed
                    images are not on the station — the difference is in scan
                    time, not in a picture.
7  BUILT HERE       pRIMe-MRI launch card (Hokkien tour), DECT BME, Rad-ART,
                    DIXON spine, and three Rad-ART 3D clips playing locally.
8  TAKEAWAY         The overarching claim: Smart Radiology augments patient care
                    through new care pathways, validated technology and
                    clinician-builders. Then one short list per scenario, the
                    pattern behind both, and a one-page printable summary that
                    carries the same thesis.

--------------------------------------------------------------------------------
3. INTERACTION
--------------------------------------------------------------------------------
- Simulator: RUN THE SCAN / PAUSE / CONTINUE / RESET. Timer-driven, so the run
  completes even if the browser throttles frames; it pauses when you leave the
  screen and resets with RESTART.
- Films and scans: BRIGHTNESS and CONTRAST sliders, zoom in/out, RESET, drag to
  pan, wheel or pinch to zoom, and on a keyboard: +/- zoom, arrows pan, 0 reset.
  This is display windowing for teaching, not diagnostic workstation software.
- 3D model: drag to orbit, wheel to zoom, WIREFRAME toggle, RESET VIEW.
- Answers: immediate feedback (correct / not this one), a filled score chip, and
  the AI reveal. Nothing can dead-end; every screen has a forward control.

--------------------------------------------------------------------------------
4. FILES AND ASSETS
--------------------------------------------------------------------------------
index.html, styles.css, app.js, README.txt
assets/cases/       12 de-identified clinical images (films, AI overlays, CT,
                    dual-energy fusion, sagittal)
assets/models/      tibia-fracture.js (decimated mesh for the WebGL viewer),
                    tibia-fracture.usdz (Apple Quick Look AR), ar-glyph.svg
assets/videos/      three Rad-ART 3D clips plus poster frames
assets/photos/      room-preparation.jpg and bore-view.jpg — stills from the
                    department's own 360° preparation video (1,600 px wide).
assets/*.svg        audio placeholder, pathway icons

Every referenced file exists; the unused illustrative plates from the first
build have been removed. Images were rebuilt from the department's originals:
burnt-in side markers and initials redacted, PACS chrome and colour-scale bars
cropped, dead margins trimmed, then padded to a fixed aspect (4:5 films, 4:3 AI
panels, 3:4 cross-sections) so the whole knee is visible in every pane.

--------------------------------------------------------------------------------
5. APPROVED FIGURES (the only numbers used anywhere)
--------------------------------------------------------------------------------
  1,102 consecutive ED radiographs audited, with the AI output withheld from
  the reporting radiologist (blinded audit, per the nomination document)
  96.6% sensitivity · 99.2% negative predictive value
  6 fractures caught that the initial reports missed
  7 fractures missed by the AI that radiologists caught
  26 false-positive studies (2.4%)
  turnaround 22 minutes in office hours · 80 minutes overnight
  dual-energy CT replaced MRI as first-line for occult fracture
  MRI AI reconstruction about 37% shorter across 8 musculoskeletal anatomies
  preparation experience: 16 of 16 patients positive at one month
  limitation: studies negative on both AI and report were not re-read, so
  sensitivity is likely overestimated (printed in the takeaway summary)

--------------------------------------------------------------------------------
6. RESPONSIVE BEHAVIOUR
--------------------------------------------------------------------------------
The 3D model has a square frame: 601x412 on a 1440 laptop, 830x418 at 1080p,
480x228 on a 1024x768 tablet. Radiographs sit inside the plate with a 10-12 px
matte so a tight capture reads as framed film rather than a cropped image.

Two columns at 1440x900 and 1920x1080, and down to 901 px wide on tablets.
Single column below 900 px. Phone layout from 390 px with stacked controls.
Measured overflow after the fit passes: 0 px at 1440x900, 1920x1080, 1280x800 and
1024x768 (a 3 px remnant on one desktop screen, harmless); phone widths scroll by
design. Primary buttons are 56 px high; secondary controls (zoom, reset) are 48 px.

--------------------------------------------------------------------------------
7. REVIEWER CHECKLIST — what was tested
--------------------------------------------------------------------------------
  [x] Attract to takeaway on all four answer combinations, including wrong calls.
  [x] Immediate feedback: toast, score chip, verdict copy for right and wrong.
  [x] Both AI tabs on both case screens; windowing and zoom applied and reset.
  [x] 3D model renders, orbits, wireframe toggles, resets; missing-mesh fallback.
  [x] AR link carries rel="ar" and points at assets/models/tibia-fracture.usdz.
  [x] Scenario B chips toggle; the acceleration bars render; the clips autoplay.
  [x] Wrong answers never block progress; every screen has a forward control.
  [x] Restart mid-flow clears screen, score chips, choices, clock and toast.
  [x] Idle return: 180 s of no input or scroll (verified that 40 s of reading does
      NOT reset the app, which was the cause of being "booted to the main page").
  [x] Missing image shows a labelled overlay and the flow continues.
  [x] Zero non-file requests across a full pass (offline proof).
  [x] Print: A4 landscape, one page, limitation included, tool blocks hidden.
  [x] Five viewports measured: 0 px overflow at 1440x900 and 1920x1080; 17-39 px
      at 1024x768; phone portrait and phone landscape scroll by design.
  [x] No patient identifiers: side markers and initials redacted on the images.

  NOT VERIFIED HERE
  [!] AR Quick Look on a physical iPad: the .usdz is generated and structurally
      valid, but it has never been opened on iOS. Test it before the event; if
      Quick Look refuses it, hide the AR button (one line in index.html).
  [!] Legibility at 1.5 m on a mirrored 55-inch display: type sizes were raised
      for large screens, but physical distance needs a human eye at the venue.
  [!] Screenshots could not be captured in the test browser after it wedged;
      every assertion above is a DOM/state check, not a pixel diff.
  [!] Touch gestures on real hardware: pointer events, pinch and drag were tested
      with mouse emulation in Chromium and Safari, not on a finger.

--------------------------------------------------------------------------------
8. PRIVACY AND LIMITS
--------------------------------------------------------------------------------
De-identified teaching images only. No analytics, cookies, storage, runtime AI,
network calls (other than the external links you choose to open) or patient data
capture. The 3D mesh is decimated for on-stand display and is not for diagnostic
use. Patient stories in the copy are composites; the images are real de-identified
cases used for teaching. Department branding only: no hospital or cluster branding
is applied at this stage.
