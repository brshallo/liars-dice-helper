# liars-dice-helper conventions

Browser app (PWA) to assist while playing Liar's Dice. See `README.md` for the full plan,
the verbatim original request, and the architecture. This file is the quick-reference for
working in this folder.

## Project facts
- **Variants: no-wilds (default) and 1s-wild**, chosen in New game. No-wilds: each face is
  itself, each unknown die 1/6. 1s-wild: 1s count as any face — a non-1 face is matched at 2/6
  (it OR a 1) and your held 1s float every non-1 face; a bid ON 1s stays 1/6. The engine is
  variant-aware via `TableContext.variant` (`src/lib/`); the active variant shows as a header badge.
- **Photo capture of your dice = stretch goal.** Prototyped on the `dice-capture` branch (engine
  bake-off in `src/capture/`, not wired into the app); manual entry is the shipped path.
- **Repo is private.**
- Core probability math is pure and lives in `src/lib/` — **build and unit-test it first**,
  before any UI.

## Stack
Vite + React + TypeScript, PWA. Client-side only (no backend). Tests with vitest.

## Key commands (once scaffolded)
- `npm run dev` — dev server
- `npm test` — unit tests
- `npm run build` — production build

## Working notes
- Verify UI changes with Playwright MCP (screenshot the player table at 2 / 5 / 8 players).
- Keep commits small and reviewable.
