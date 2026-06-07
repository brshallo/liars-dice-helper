# liars-dice-helper conventions

Browser app (PWA) to assist while playing Liar's Dice. See `README.md` for the full plan,
the verbatim original request, and the architecture. This file is the quick-reference for
working in this folder.

## Project facts
- **Variant: no wilds** — each face counts only as itself; each unknown die has a 1/6 chance
  of a given face. Do NOT implement "ones are wild" unless explicitly asked.
- **Photo capture of your dice = stretch goal.** MVP uses manual entry; keep CV code isolated
  in `src/capture/`.
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
