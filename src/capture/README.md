# Dice Capture — recognition engine bake-off

Isolated R&D for the photo-capture stretch goal: read the user's own dice (face values 1–6) from
a camera/photo, fast and reliably across different dice, colours, and lighting, with a manual
fallback. **All of this lives on the `dice-capture` branch and is NOT wired into the app** — the
main app at `/` imports nothing from here. Two extra Vite entries drive it:

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
