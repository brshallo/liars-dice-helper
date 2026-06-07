# Liar's Dice Helper

A browser app to assist while playing Liar's Dice: track each player's dice count and see
the live probability that a called quantity of a given face exists across all dice — with
conditional probabilities once you tell it what's in your own hand.

> **Status:** planning / not yet built. This README is the record a future build session
> works from. See [Setup before building](#setup-before-building) for what to install first.

### Decisions made during planning
- **Variant: no wilds.** Every face counts only as itself; each unknown die has a 1/6 chance
  of showing a given face. (Not the "ones are wild" variant.)
- **Photo capture is a stretch goal.** The MVP uses fast manual entry of your own dice;
  camera-based dice recognition comes later (it's feasible in-browser but fragile to
  lighting/angle).
- **Repo is private** for now.

---

## Setup before building

A future Claude Code build session needs two things in place first:

1. **Git identity** (one-time, machine-wide):
   ```
   git config --global user.name "Bryan Shalloway"
   git config --global user.email "brshallo@gmail.com"
   ```
2. **Playwright MCP** so Claude can open the running app in a real browser, click the +/−
   buttons, and screenshot the layout to verify it:
   ```
   claude mcp add playwright npx @playwright/mcp@latest
   ```
   (Restart Claude Code after; browser binaries auto-download on first use.)

Already in place: Node 26, npm 11, git, and an authenticated `gh` CLI. Optional extra:
`context7` MCP for up-to-date library docs.

---

## Planned architecture

**Stack:** Vite + React + TypeScript, built as a **PWA** (installable on a phone home
screen). Everything runs client-side — the probability math is pure functions, so the app
is just static files (free to host on GitHub Pages or Vercel). A native wrap (Capacitor for
Android, Tauri for Mac) stays a clean future option because all logic lives in portable TS.

```
liars-dice-helper/
  README.md            # this file
  CLAUDE.md            # project conventions
  src/
    lib/               # pure probability engine (no React) — unit-tested
      probability.ts   # P(>= k of face f among N unknown dice), no wilds
    state/             # game state: players, dice counts, your captured dice
    components/
      PlayerTable/      # poker-table clock layout (responsive: few vs many players)
      ProbabilityPanel/ # distribution display; groups faces with identical conditionals
      Controls/         # +/- dice buttons, new-game setup
    capture/           # STRETCH: camera + dice recognition (TF.js), isolated here
  tests/               # vitest unit tests for the probability engine
```

### Core math (no-wilds)
Let `N` = total number of *unknown* dice on the table (everyone's dice minus the dice you
can see, including your own captured dice). For a call of `k` dice showing face `f`:

```
P(at least k showing f) = 1 - BinomialCDF(k - 1; N, 1/6)
```

Knowing your own dice (a) removes them from `N` and (b) adds your matching count as a
guaranteed floor. Build and unit-test this engine first.

### "Smart real-estate" for probabilities
With no wilds, all six faces are symmetric **until** you capture your own dice. After
capture, faces group by how many of that face you already hold — e.g. holding one 2 and one
3 means faces 2 and 3 share an identical conditional distribution, and 1/4/5/6 share another.
The probability panel should render **one row per distinct group** (labeled with the faces it
covers) instead of six redundant rows.

---

## How to run / rebuild

> Not scaffolded yet. Once built, expect:
> ```
> npm install
> npm run dev      # start the Vite dev server, open the printed localhost URL
> npm test         # run the probability-engine unit tests (vitest)
> npm run build    # production build (static files)
> ```
