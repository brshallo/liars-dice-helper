# Liar's Dice Helper

A browser app (installable PWA) to assist while playing Liar's Dice: track every player's dice
count around a table and see the live probability that a bid ("at least *q* of a face") is true —
sharpened once you enter the dice in your own hand.

> **Status:** Built and working. Manual dice entry, the probability engine (no-wilds **and**
> 1s-wild), the 2–10 player table, and the probability panel are all live, installable as a PWA.
> Camera capture of your dice was prototyped separately — see [Photo capture](#photo-capture-experiment).

## Features
- **2–10 players, 1–10 dice each.** New game opens a dialog (players / dice / variant).
- **Two variants, toggleable mid-game.** Tap the header badge to flip **No wilds ⇄ 1s wild**; all
  probabilities recompute. (1s-wild: 1s count as any face.)
- **Poker-style table.** Players sit around an oval felt that scales from 2 to 10 without clipping.
  Drag your own seat to match where you sit; double-click a name to rename; +/- adjusts each
  player's dice; a player at 0 dice drops to a faded "OUT" chip.
- **Your dice (optional).** Enter what you're holding to turn your dice into a guaranteed floor and
  sharpen every probability.
- **Probability matrix.** Faces (grouped when they share odds) × bid quantities, coloured red→green.
  The quantity columns **auto-window** to the decision zone and start centred on the expected count;
  the face/exp column stays frozen while the numbers scroll.
- **Tap a cell → inspector.** Opens a focused readout for that exact bid plus the safest alternative
  bids. An **(i)** button explains how to read it all.
- Installable PWA (offline, add-to-home-screen).

## How to run
```
npm install
npm run dev      # dev server (prints a localhost URL)
npm test         # engine + state unit tests (vitest)
npm run build    # production build (static PWA files in dist/)
npm run preview  # serve the production build locally
```
Open `/phone.html` in the dev server to preview the app inside a phone frame at common device sizes.

## Architecture
Vite + React + TypeScript, **client-side only** — the probability math is pure functions, so the
app is just static files. The engine is built and unit-tested before any UI.

```
src/
  lib/                 # pure, variant-aware probability engine (no React) — unit-tested
    binomial.ts        # exact binomial pmf/cdf/atLeast
    probability.ts     # matchProb, effectiveFloor, probabilityOfBid, expectedCount, nextBids
    grouping.ts        # collapse faces into groups that share a distribution
    window.ts          # auto-window: the band of bid quantities worth showing
  state/               # reducer (players, dice, held dice, bid, variant) + derivePanel() selector
  ui/                  # probability colour scale, formatting helpers, dark theme tokens
  components/
    PlayerTable/       # oval table: drag-your-seat, rename, +/- dice, elimination
    Controls/          # NewGameButton (dialog) + YourDice entry
    ProbabilityPanel/  # the matrix + the (i) info and bid-inspector modals
    displays/          # MatrixView (heatmap) + InspectorView (focused single bid)
    Modal/             # reusable dialog
public/phone.html      # device-frame preview for testing the mobile layout
```

### Core math
`U` = unknown dice = total dice − the dice you hold. For a bid "at least *q* of face *f*":

```
P(≥ q of f) = 1 − BinomialCDF(q − floor − 1 ; U , matchProb)
```
- **No wilds:** `matchProb = 1/6`; `floor` = how many of *f* you hold.
- **1s wild:** a non-1 face is matched by showing *f* OR a 1, so `matchProb = 2/6`, and your held 1s
  add to the `floor` of every non-1 face. A bid *on* 1s stays `1/6`. (So even before you enter any
  dice, 1s-wild shows two rows: the 1s, and everything else.)

Faces that share the same `(floor, matchProb)` collapse into one matrix row.

## Photo capture (experiment)
The original stretch goal — read your dice from a photo — was prototyped on the **`dice-capture`
branch** (not merged, not wired into the app). It's an isolated bake-off of three recognition
engines against a synthetic labelled benchmark; the dependency-free hand-rolled detector won. See
`src/capture/README.md` on that branch.

