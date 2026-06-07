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

## Verdict: ship the hand-rolled engine
- **It wins on every axis that matters** — highest accuracy, near-zero false dice (0.14/img vs
  OpenCV's 14), fastest, and **zero added download** (vs OpenCV's ~8 MB, which is a lot for a PWA).
- **OpenCV works but isn't worth it.** It's the *same* classic-CV pip-clustering approach; it
  over-detects because die-edge fragments survive as false pips, and it costs 8 MB. (Note: a one-line
  bug — `RETR_EXTERNAL` masking pips behind the die-edge ring — was the difference between 15% and
  76%; see `opencv/opencvEngine.ts`. Not pursued further since hand-rolled already wins.)
- **ML is not viable this session.** No validated, hostable, offline dice-face model exists, and
  there's no dataset on hand to train/tune one. The closest (skovy/tensorflow-dice-model, MIT) is
  self-described as unreliable; Roboflow models need an API key + hosted runtime (breaks
  client-side-only). The *runtime* (tfjs/onnxruntime-web) isn't the blocker — the model is. Full
  detail and a "what it would take" plan in `engines/ml/FINDINGS.md`.

## Important caveats
- **Synthetic ≠ real.** These numbers are on generated images. Real glare, optics, odd dice, and
  cluttered backgrounds are messier. Treat this as relative ranking, not an absolute accuracy promise.
- **Make real dice the real benchmark:** drop real photos + a `labels.json` into `bench/samples/`
  (loader hook is the place to wire `import.meta.glob`) and re-run `bench.html` to score on them.
  The lab is also there to point a real camera at real dice and eyeball it.
- Tunables (pip size floors, thresholds, cluster spacing) are named constants at the top of each
  engine's files — sweep them if real images shift the regime (e.g. very high-res photos).

## If/when integrating into the app
Capture → `faceCounts(dice)` → dispatch the existing `SET_HELD` actions (`src/state/reducer.ts`).
Recommended flow (already prototyped in the lab): auto-detect, show the read in the editable grid,
let the user confirm/correct before it becomes their held dice. Keep the engine lazy-loaded so the
main bundle is unaffected.

## Files
- `engines/types.ts` · `util.ts` · `index.ts` — interface, helpers, roster
- `engines/handrolled/` — the winner (threshold / components / pips / engine) + unit tests
- `engines/opencv/` — OpenCV.js engine
- `engines/ml/` — stub + `FINDINGS.md`
- `bench/synth.ts` — labelled image generator · `bench/runner.ts` — scoring (unit-tested) ·
  `bench/main.ts` — benchmark page
- `lab/CaptureLab.tsx` — live camera/upload lab
