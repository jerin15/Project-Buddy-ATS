
# Enhancement Rollout Plan

Grouped into 4 shippable batches so we can land value fast and stop/adjust between rounds.

---

## Batch 1 — Time & productivity

- **Punch-in reminder** (browser notification + toast) at a user-configurable time (default 09:00). Stored per-user in `user_prefs` table.
- **Idle detection**: if no mouse/keyboard for 10 min while punched in, prompt "still working?" — auto-punch-out after 5 min silence, keeping the punch-out at last-active timestamp.
- **Pomodoro / focus mode**: 25/5 timer overlay on project page, optional.
- **Timesheet export**: CSV export of `time_entries` filtered by date range / project / user (client-side generation).
- **Auto-stop at custom cap**: optional daily hour cap per user; when reached, prompt to punch out.

## Batch 2 — Project intelligence

- **Burn-down chart** on project detail: budget hours vs cumulative logged hours over time (Recharts).
- **Forecast**: project completion date based on rolling 7-day pace vs remaining hours.
- **Overrun alerts**: dashboard banner + toast when a project crosses 80% / 100% of budget or hours.
- **Profitability view**: per project = `budget_cost − spent_cost − expenses`, and portfolio roll-up on dashboard.
- **Activity feed** on project detail (already have `project_activity` — surface it).

## Batch 3 — Expenses & invoicing

- **Receipt upload**: attach an image/PDF per expense via Lovable Cloud Storage (`expense-receipts` bucket, RLS).
- **Recurring expenses**: mark an expense as recurring monthly; scheduled server function auto-creates the next month's copy.
- **Expense categories**: add `category` column (Software, Travel, Contractor, Hardware, Other) with filter + per-category totals.
- **One-click invoice**: generate a printable HTML invoice from a project (client info + logged hours × rate + expenses), print-to-PDF.
- **Project hourly rate** field so invoices compute correctly.

## Batch 4 — Team & UX polish

- **Roles**: `user_roles` table + `has_role()` security-definer function. Roles: `admin`, `member`. Admins see all projects; members see projects they created or are assigned to.
- **Per-user dashboard tab**: "My hours this week", "My open projects", "My expenses this month".
- **Global command palette** (⌘K / Ctrl-K): jump to project, new project, punch in/out, new expense.
- **Keyboard shortcuts**: `P` new project, `T` punch toggle on project page, `E` new expense, `/` focus search.
- **Offline PWA**: service worker caching shell + last-viewed projects; queued punch/expense writes sync when back online.

---

## Recommended order

Batch 1 → Batch 2 → Batch 3 → Batch 4. Each batch is independently shippable and ~1–2 iterations.

## Technical notes

- New tables: `user_prefs` (punch-in reminder time, daily cap, timezone), `user_roles` (+ enum + `has_role()`), `expense_categories` values via enum column, `expense_receipts` storage bucket.
- New columns: `projects.hourly_rate numeric`, `expenses.category text`, `expenses.is_recurring boolean`, `expenses.recurring_day int`, `expenses.receipt_path text`.
- New server functions: `generate_invoice`, `run_recurring_expenses` (called by pg_cron daily).
- Realtime already enabled on `projects`, `time_entries`, `expenses`; extend to `project_activity`.
- All new client work stays in existing `src/routes/_authenticated/*` and `src/components/*`.

## What I'd like from you

Confirm the order above (Batch 1 first) or tell me which batch to start with. I'll ship one batch at a time so we can review each round.
