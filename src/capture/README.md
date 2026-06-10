# Dice Capture — recognition engine bake-off

Isolated R&D for the photo-capture stretch goal: read the user's own dice (face values 1–6) from
a camera/photo. **Lives on the `dice-capture` branch, NOT wired into the app** — the main app at `/`
imports nothing here.

---

## ⛔ OUTCOME: didn't work — branch set aside (2026-06-10)

On-device testing with real dice (Samsung S23 + iPhone, over LAN HTTPS) — **none of the recognition
approaches worked acceptably.** The classic-CV engines (hand-rolled pip-counting, OpenCV) and the
two-stage CNN + live multi-frame fusion all failed on real dice/lighting/angles — not close to usable.

**Decision:** parked. Manual entry stays the only capture path in the shipped app. Don't invest more
here without a materially different approach (e.g. a properly trained object detector — YOLO/Roboflow —
on a large, diverse, real-world dice dataset, accepting the heavier model + possible loss of offline).
The "RESUME HERE" notes below are kept only as a record of what was tried.

The main app and its **"Cheating Liar's Dice"** editorial look were merged into this branch (so the lab
matched the current UI during testing); that styling is fine — it's the **recognition** that failed.

---

## ▶ RESUME HERE — pick this up later & finalize the approach

**Goal of the next session:** test the live capture with real dice, compare the engines, and decide:
ship the **two-stage + live fusion** (built, lightweight) or invest in a **YOLO detector** (heavier,
more robust). See the [verdict](#verdict-revised-after-real-photo-testing) for the tradeoff.

**Run it**
```
git checkout dice-capture
npm install
npm run dev          # Mac testing — camera works at http://localhost:5173/ (localhost = secure)
npm run dev:https    # PHONE testing — https://<LAN-ip>:5173 (accept the self-signed cert once);
                     #   camera needs HTTPS on a LAN, plain http is blocked. Same Wi-Fi, no tunnel.
```

**Pages to try** (all dev-only, on the `dice-capture` branch):
| URL | What it is |
|---|---|
| `/capture-lab.html` | **The candidate UX.** Live guided camera scan (default = two-stage engine): point at dice, it guides + fuses many frames, auto-finishes, fills an editable grid. Switch the engine tabs to compare. Upload also works for no-camera testing. |
| `/kbench.html` | Quantitative benchmark on the **250 real Kaggle d6-dice photos** (two-stage vs hand-rolled, scored against YOLO labels). The reliable accuracy number. |
| `/realbench.html` | 8 hand-labelled real phone photos with overlays (a *different* dice style — the generalization test). |
| `/bench.html` | Synthetic-image benchmark of the classic engines. |
| `/train.html` | Re-train the tiny TF.js classifier in-browser (dev tool); it re-saves `public/models/dice-classifier/`. |

**What to look for when testing with dice:** does the live scan's **fusion** stabilize on the right
read across angles? On *your* dice (not the training set)? If yes → two-stage is enough. If the
per-die read is too wrong → go to the YOLO detector (the "PyTorch fallback", scoped below; torch is
already verified working on this machine).

**Local data needed** (gitignored — re-fetch if missing): `data/d6-dice/` (Kaggle, see its
`SOURCE.md` and `~/work/customize/kaggle-access.md`) and `src/capture/bench/samples/*.jpg` (a few real
photos). The trained model in `public/models/` IS committed. Milestone history: M1–M3 in git log.

---

Two extra Vite entries originally drove it:
- `/capture-lab.html` → live lab: camera/upload → recognise → overlay → editable dice grid.
- `/bench.html` → the benchmark: runs every engine over a synthetic labelled suite and scores it.

## How to run
```
npm run dev
# main app:  http://localhost:5173/
# lab:       http://localhost:5173/capture-lab.html
# benchmark: http://localhost:5173/bench.html   (auto-runs; "Re-run" + images/condition knob)
npm test     # engine + scoring unit tests (hand-rolled detector, benchmark scorer)
```

## The bake-off
Three engines behind one `DiceEngine` interface (`engines/types.ts`), all reading an image and
returning a multiset of face values + per-die boxes:

| Engine | What it is | Dep size |
|---|---|---|
| **Hand-rolled** | Pure TS: integral-image adaptive threshold → connected components → pip classify → spatial cluster → count. Both contrast polarities. | **0** |
| **OpenCV.js** | wasm: adaptive threshold → `findContours` (RETR_LIST) → circular pip blobs → cluster. | ~8 MB |
| **ML** | In-browser neural detector. | n/a |

### Scoring
A **synthetic generator** (`bench/synth.ts`) draws labelled dice — ground truth is exact because it
places the pips — across 8 deliberately adversarial conditions: clean, colours (7 palettes, both
polarities), rotation, lighting gradients, glare, blur, sensor noise, and "messy" (all at once).
Metrics: **per-die accuracy** (correctly-read dice / all dice), **exact-image rate** (whole image
perfect), **extra/img** (false dice), and **speed** (mean / p95 inference ms). Driven via Playwright.

### Results (synthetic suite, 8 images/condition)
| Engine | Per-die acc | Exact-image | Extra dice/img | Mean ms | Size |
|---|---|---|---|---|---|
| **Hand-rolled (pure TS)** | **97%** | **92%** | **0.14** | **4.2** | 0 |
| OpenCV.js pip-clustering | 76% | 42% | 14.4 | 5.3 | ~8 MB |
| ML | — (unavailable) | — | — | — | — |
| Manual (baseline) | 0% | 0% | 0 | 0 | 0 |

Per-die accuracy by condition (hand-rolled): clean / colours / rotation / lighting / glare / messy
all **100%**, blur 97%, **noise 69%** (its one weak spot — dense sensor speckle).

### ⚠️ Reality check: real photos are much harder than the synthetic suite
The synthetic numbers were **over-optimistic** — flat, perfectly-rendered dice. Tested on real
photos (`realbench.html` = 8 hand-labelled phone shots; `kbench.html` = the 250-image Kaggle
**d6-dice** set, YOLO labels, `data/d6-dice`, gitignored — see its `SOURCE.md`):

| Test set | Scenario | Hand-rolled per-die | Exact-image | Notes |
|---|---|---|---|---|
| Synthetic | flat, clean | **97%** | 92% | best case, not representative |
| Real, few dice | ~2–7 dice filling the frame, on felt | **~80%** | 50% | the actual use case; ~1 in 5 dice misread |
| Real, dense | Kaggle trays of dozens of tiny dice | **37%** | 3% | under-detects — pips too small after downscale |

So **classic CV does not generalise to arbitrary real photos.** It's *okay* (~80%) when you shoot a
handful of well-lit dice that fill the frame, and poor when dice are small/dense/dim. OpenCV was no
better (≈44% on the Kaggle subset, with many false dice).

## Verdict (revised after real-photo testing)
- **Of the classic-CV engines, hand-rolled is still the best** — zero dependency, fast, far fewer
  false dice than OpenCV (0.14 vs 14 per image on synthetic; lower on real too), no 8 MB wasm.
  OpenCV is the same pip-clustering idea but noisier and heavier; not worth it.
- **But classic CV is not reliable enough to trust hands-off on real photos** (~80% per-die on
  good shots, far worse on hard ones). It's an *assist*, not an oracle.
- **The honest path forward depends on how good "good enough" is:**
  1. **Ship hand-rolled as a confirm-first assist (cheapest).** Auto-detect → pre-fill the editable
     grid → the user glances and fixes. At ~80% on a clean shot of your own ~5 dice that's a few
     taps saved; the manual grid (already built) catches the rest. Near-zero cost.
  2. **Constrain the capture to lift accuracy.** A guide box + "spread your dice, good light, shoot
     top-down" keeps dice large in frame (the regime where it does well) and would push the good
     case higher. Cheap, worth trying before anything heavier.
  3. **Go ML for real robustness (bigger investment).** A small detector (YOLO/SSD) trained on a
     set like Kaggle **d6-dice** — which we now have locally — is the real fix for unconstrained
     real photos, at the cost of a ~5–20 MB model download + a training/conversion step. This is the
     "other option" if confirm-first isn't good enough. See `engines/ml/FINDINGS.md`.

## Chosen approach: in-browser two-stage (being built)
Classic-CV die **localizer** + a tiny **top-face classifier** (TF.js CNN, ~95K params / ~370 KB),
trained in the browser on ~1795 die crops harvested from d6-dice (`train.html`). Held-out per-face
accuracy **~94%** *per single crop*; a live multi-frame camera flow fuses reads across frames/angles
to lift end-to-end accuracy and guide the user. No Python, fully offline, tiny model.

### PyTorch fallback — cost, if the two-stage disappoints
Local training **is** feasible here (verified: torch 2.12 on Python 3.14, CPU build + **MPS/Metal**
GPU — no CUDA, since that's Linux/NVIDIA-only). The fallback would be: train a small detector
(YOLOv8n) on d6-dice in PyTorch (MPS-accelerated, ~30–60 min on ~250 imgs w/ transfer learning) →
export to the browser. Rough client cost:
- **ONNX + onnxruntime-web:** model ~6–12 MB + the ort-web wasm runtime ~3–10 MB → **~10–20 MB** added,
  lazy-loaded only in capture.
- **or TF.js graph model:** similar model size, reusing the TF.js runtime already pulled in for the
  classifier (~2–3 MB) → a bit lighter.
Versus the two-stage's ~370 KB model. Only worth it if M1/M2 can't be made reliable enough — decide
with the user before building it.

## How real photos were tested
- `realbench.html` — 8 hand-labelled phone photos (a few dice on felt) with overlays.
- `kbench.html` — the 250-image Kaggle **d6-dice** set; parses the YOLO `.txt` labels (class 0–5 =
  face 1–6) for exact ground truth and scores every engine. Data lives in `data/d6-dice/`
  (gitignored, third-party; see `data/d6-dice/SOURCE.md`). Both run in-browser, driven via Playwright.

## If/when integrating into the app
Capture → `faceCounts(dice)` → dispatch the existing `SET_HELD` actions (`src/state/reducer.ts`).
Use the **confirm-first** flow (already prototyped in the lab): auto-detect, show the read in the
editable grid, let the user fix it before it becomes their held dice. Keep the engine lazy-loaded so
the main bundle is unaffected.

## Files
- `engines/types.ts` · `util.ts` · `index.ts` — interface, helpers, roster
- `engines/handrolled/` — the winner (threshold / components / pips / engine) + unit tests
- `engines/opencv/` — OpenCV.js engine
- `engines/ml/` — stub + `FINDINGS.md`
- `bench/synth.ts` — labelled image generator · `bench/runner.ts` — scoring (unit-tested) ·
  `bench/main.ts` — benchmark page
- `lab/CaptureLab.tsx` — live camera/upload lab
