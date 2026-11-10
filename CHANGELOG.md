# Changelog

## 1.1.0

- First-run guide: when the panel opens on an empty store, the client sends
  seven localized onboarding to-dos (one per interaction: add, drag, edit,
  quadrant split, settings, overdue coloring, date picker). The Host writes
  them once behind a new `seeded` flag, so deleting the guide never brings it
  back; an existing list is treated as already seeded (no duplicates for
  upgrades).
- New `seed` API action: idempotent, accepts localized titles from the client,
  validates them like any other create, and stamps their own creation order.

## 1.0.1

- Drop the module-level window guard so the client bundle re-registers after
  hot reload or after the plugin row is disabled and enabled again (the loader
  already de-duplicates by bundle URL).

## 1.0.0

First public release.

- Eisenhower-matrix panel: four importance × urgency quadrants (do first /
  schedule / delegate / drop), each auto-filling the panel with its own count
  and an inline "add here" row.
- One-click switch between the matrix and the completed view; completed items
  can be restored or removed, and clearing requires a second confirmation.
- Drag any to-do to reorder inside a quadrant or drop it into another quadrant
  (the important/urgent flags follow it); the order is persisted.
- The centre dot resizes the quadrants (20%–80%), snaps back to an even split,
  and a double click resets it.
- Per-item due dates with a hand-drawn picker (single click previews, double
  click commits and adds the item); due/overdue items are colour-marked and can
  show a countdown.
- Completing an item pops a random encouragement in the centre of the plugin
  panel, split into "on time" praise and "overdue" encouragement, never
  repeating the previous line.
- Double-click a to-do to edit its title in place; Enter saves, Escape cancels.
- Settings: urgent column side, frame style (cards / grid / cross), soft
  quadrant tint, corner radius, font size, text wrap or truncate, date or
  countdown, custom sidebar label, reset to defaults.
- Minimal styling built only on `--dsw-alias-*` theme tokens, so the panel
  follows light/dark appearance and the active skin.
- Bilingual UI (English / 简体中文) following the Harness language setting.
- Data and settings live in one JSON file under the profile (`data/dsh-matrix-todo/todos.json`),
  written atomically with a serialised queue; a corrupt file is backed up and
  replaced with an empty list.
- Settings footer links to GitHub feedback and the author's profile.