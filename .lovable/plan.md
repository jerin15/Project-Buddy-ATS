# Project Tracker — Pro Glass UI + AED Refresh

## Goals
1. Elevate the UI to a professional **glassmorphism** aesthetic across the whole portal.
2. Switch default currency to **AED** using the new **د.إ** dirham symbol (the redesigned "D" logo).
3. Add an **at-a-glance overview** showing every project, its timeline, and cost spent so far — visible on load without drilling in.
4. Give an **admin** full CRUD (create / read / update / delete) on projects at any time.

---

## 1. Visual system — Glassmorphism

Refresh `src/styles.css` tokens:
- New backdrop: deep gradient mesh background (indigo → slate → cyan blobs) with subtle noise, fixed behind all content.
- Glass surface tokens: `--glass-bg` (semi-transparent white/dark), `--glass-border` (1px inner highlight), `--glass-shadow` (soft elevated shadow), `--glass-blur` (backdrop-filter blur 20–28px).
- Reusable utility `.glass` and `.glass-strong` in `@utility` form (Tailwind v4).
- Typography: keep Inter, tighten tracking on headings; numeric values use tabular-nums + JetBrains Mono for AED amounts.
- Light + dark both supported; dark is primary (reads best with glass).

Applied to: header bar, summary cards, project rows, dialog, buttons (secondary/ghost get frosted variant), progress bars (translucent track, gradient fill; red gradient on overflow).

## 2. Currency → AED

- Replace `fmtMoney` USD formatter with AED formatter using `Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`, rendering as `د.إ 12,000`.
- Dialog labels change `Budget ($)` / `Spent ($)` → `Budget (AED)` / `Spent (AED)`.
- Replace `DollarSign` lucide icon with a small inline **د.إ** glyph component (`<DirhamSymbol />`) — the new dirham "D" mark — used in summary cards, row metrics, and dialog affordances.
- Migration: existing localStorage numbers are treated as AED going forward (no conversion — same numeric values, new label).

## 3. At-a-glance dashboard

Top of page, above the project list:
- **KPI strip (4 glass cards):** Total Budget (AED), Total Spent (AED), Total Hours spent / budgeted, Projects Overflowing.
- **Timeline panel:** compact horizontal timeline listing every project as a row — project name, status pill, start → today bar showing elapsed days vs. estimated duration (derived from `createdAt` + a new optional `dueDate`), and inline cost-spent chip. One scannable view of everything.
- **Portfolio spend meter:** single wide progress bar showing spent vs. total budget across all projects, with overflow highlighted.

Project cards below remain for detail + editing.

## 4. Admin CRUD

- Add lightweight local "admin mode" toggle in the header (padlock icon). Default: **on** (single-user localStorage app), gated by a simple passcode stored in localStorage (`tracker.admin.v1`) — first launch prompts user to set it; unlocks Create/Edit/Delete controls.
- When locked: read-only view (no New/Edit/Delete buttons, dialog disabled).
- When unlocked: full CRUD on every project at any time via existing dialog + row actions, plus a new **duplicate** action and **due date** field.
- Note: this is client-side gating suitable for a personal tracker; real auth would require Lovable Cloud (can be offered as a follow-up).

---

## Technical details

Files touched:
- `src/styles.css` — new tokens, gradient background, `.glass` utilities, dirham font tweaks.
- `src/routes/index.tsx` — currency formatter, `DirhamSymbol` component, timeline panel, KPI strip refactor, admin-mode gating, dueDate field on `Project` type, duplicate action.
- `src/routes/__root.tsx` — set app title/description to "Project Tracker — AED Portfolio", add background layer.
- New: `src/components/DirhamSymbol.tsx` (SVG dirham mark), `src/components/GlassCard.tsx` (wrapper), `src/components/TimelinePanel.tsx`.

Data model additions to `Project`:
- `dueDate?: number` (ms epoch) — optional end date used by timeline.
- Backward compatible: `load()` fills missing fields with defaults.

No backend, no new deps. Pure frontend/presentation change plus one new field.

---

## Out of scope (ask if you want these)
- Real authentication / multi-user admin (needs Lovable Cloud).
- Multi-currency support / FX conversion.
- Exporting reports (PDF/CSV).
