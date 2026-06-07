# ML dice-recognition engine — feasibility findings

**Date:** 2026-06-07
**Verdict:** **Not viable this session.** Shipping an honest stub (`mlEngine`, `name: 'ML (unavailable)'`)
instead of a fake or known-bad model. This doc records what was evaluated and what a real
implementation would take.

## The bar
A neural object-detection model that runs fully in-browser (client-side only, no backend),
loadable from a CDN/host, that reliably reads 1–5 dice with face values 1–6. We have **no
dice dataset and no validated offline model on hand**, so any model used would have to come
pretrained *and* be trustworthy out of the box.

## Models / sources evaluated

### 1. skovy/tensorflow-dice-model + "dice tracker" web app — closest candidate, still not good enough
- **What it is:** Two-stage TFLite pipeline — a detector (`die_detection/model.tflite`, ~11.7 MB)
  and a 1–6 classifier (`die_classification/model.tflite`, ~24.4 MB), plus a combined
  detect+classify model (~20.6 MB). Built specifically for this problem and **deployed in a
  real browser app via `@tensorflow/tfjs-tflite`** — so the in-browser path technically exists.
- **License:** MIT (cleanly usable/hostable). Weights are directly downloadable from the GitHub repo.
- **Why it's not viable:** The author's own write-up states the classifier **"performs poorly in
  classifying die"** and **"isn't always correct,"** so the app makes every predicted die clickable
  for manual correction. Trained on a small, hand-collected webcam dataset. Adopting it would mean
  shipping a model we already know is unreliable, with **no validation data on hand** to confirm or
  tune it — exactly what the brief says not to do.
- **Format friction:** It's TFLite, not a tfjs graph model. `@tensorflow/tfjs-tflite` can run TFLite
  in-browser (WASM + XNNPACK), but it's a heavier/finicky path than tfjs/onnxruntime-web, and these
  are TF Object Detection API SSD models whose pre/post-processing (anchors, NMS, score decode) must
  be reimplemented by hand. Non-trivial within a timebox for a model that's known-bad anyway.

### 2. Roboflow Universe dice models/datasets — breaks the client-side-only constraint
- Multiple relevant projects exist: "6 Sided Dice" (359 imgs), "D6 dice with numbers on the sides"
  (~250 imgs, YOLOv8-ready), "D&D Dice Detection", and multi-die-type sets (d4–d20). Several ship a
  **pre-trained model**, and many *do* detect the face value, not just the die.
- **Why it's not viable here:** Universe fine-tuned/Universe models gate weights and inference behind
  a **Roboflow API key** and their `inference` runtime. Browser inference via roboflow.js calls a
  **hosted API** — that's a backend, which violates the project's client-side-only rule. Offline
  weight download exists but runs through their Python `inference` server/SDK, not a plain
  tfjs/onnx file you can `fetch()` and run. Licenses vary per project (often CC BY 4.0) and would
  need per-model checking.

### 3. General tfjs / Transformers.js / ONNX model zoos — no dice-specific model
- TF Hub / tfjs-models, Transformers.js (onnxruntime-web), and ONNX model zoo offer general object
  detectors (COCO-SSD, YOLO variants) but **none classify dice faces 1–6**. COCO has no "die" class.
  Using these would require fine-tuning — i.e. a training project, not an integration.

## In-browser runtime feasibility (separate from model availability)
The *runtime* is fine: `@tensorflow/tfjs-tflite`, `@tensorflow/tfjs` graph models, and
`onnxruntime-web` (WASM/WebGPU) all run object detection client-side, loadable from CDN with no
backend. Caveat: model download is the startup cost (e.g. COCO-SSD ~10s on good wifi), and a 20–25 MB
dice model would dominate first-load. The blocker is **not** the runtime — it's the absence of a
**validated, hostable, face-reading** model.

## What it would take to do this properly
1. **Get/build a labelled dataset** of dice as actually photographed in this app (top-down, 1–5 dice,
   varied lighting/backgrounds). Roboflow's d6 sets are a starting point but likely need augmenting
   with in-app captures to generalize.
2. **Train** a small detector that emits face value as the class — YOLOv8n or an SSD-Mobilenet — sized
   for the web (aim <= 5–10 MB).
3. **Convert** to a browser format: YOLO -> ONNX -> onnxruntime-web, or TF SavedModel -> tfjs_converter
   graph model. Reimplement pre-processing (letterbox/resize/normalize) and post-processing (decode +
   NMS) in TS.
4. **Host** the weights as a static asset (the repo is private; a few MB is fine to commit or serve)
   and load via dynamic CDN/asset import in `load()`.
5. **Validate** on a held-out set before trusting it in the bake-off — capture accuracy/latency the
   same way the other engines are measured.

Alternative (rejected): a hosted inference API (Roboflow, etc.) would get accuracy fast but **breaks
the client-side-only constraint**, so it's out for this project.

## Integration note
When a real model lands, replace the stub in `mlEngine.ts`: dynamic-import the runtime from a CDN
(avoid npm-installing heavy deps), fetch+init the model in `load()` (set `available = true` only on
success), implement preprocess -> infer -> decode in `recognize()` mapping detections to
`DieDetection { value, bbox, confidence }`, and set `approxBytes` to the real model size.
