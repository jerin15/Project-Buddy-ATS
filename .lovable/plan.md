# Light-mode default + theme toggle + fix AED logo visibility

## Problem
- The portal renders dark by default, but the dirham PNG is a black glyph. It only inverts inside `.dark` — since the app never sets that class, the logo stays black on the dark background and disappears.
- User wants a bright/white UI as default and the ability to toggle between light and dark.

## Changes

### 1. Light theme as default
`src/styles.css`
- Rewrite `:root` tokens for a bright, near-white glassmorphism scheme: off-white background, subtle cool-grey gradient wash, dark foreground text, white translucent glass panels with soft grey borders and gentle shadow.
- Move the current dark tokens under `.dark { … }` (unchanged look, just gated).
- Update `body` background so both modes swap cleanly.

### 2. Theme toggle
- Add a `ThemeToggle` control in the header next to the admin lock — sun/moon icon button styled with the existing `glass` utility.
- State stored in `localStorage` key `tracker.theme.v1` (`"light" | "dark"`); defaults to `"light"`.
- Applies by toggling the `dark` class on `document.documentElement`. Runs on mount, no flash concern for a client-only app.

### 3. Fix AED logo visibility (both modes)
`src/components/DirhamSymbol.tsx`
- Remove `dark:invert`. Instead invert in **light** mode too when the logo sits on a dark background is not needed — in light mode we want the black glyph (visible on white); in dark mode we want the white/inverted glyph.
- Correct rule: **default black** for light; **`dark:invert`** flips to white for dark mode. This already matches once `.dark` is actually applied. The fix is really "make `.dark` get applied" (item 2) plus ensuring the icon size renders (currently `1em`, but some usages force `h-3 w-3` which override to a small square — fine).

## Files touched
- `src/styles.css` — swap default palette to light; keep dark under `.dark`.
- `src/routes/index.tsx` — add theme toggle button and mount effect.
- No new deps.

## Out of scope
- System-preference auto-detection (can add if desired).
- Per-component color audit — palette stays monochrome as before.
