# Oggi (Daily View) - Increment 1

Branch: `feature/oggi`, based on `dev` at `021d552` (excludes `feature/oauth`).
Sources: Master Prompt v2.3.7 > UI/UX spec > boards `Agenda - bozze tavole-selection.pdf` (3 pages) > existing ui-shell.

## Board mapping

| Board element | Implementation |
|---|---|
| Header: Oggi + date, subtitle, Calendario, menu | Shared `.cal-header` / `.cal-back-btn` (Menu back link kept on the left, as in Calendario) |
| Il focus del giorno | `FocusCard` - Task with `isFocus`, max one open per day |
| La tua giornata | `DayTimeline` - calendar items (same ids as Calendario) + flexible blocks |
| Da fare e fatto | `TaskList` - open / done groups, archive and delete are separate actions |
| Cattura un pensiero | `QuickCapture` -> shared `InboxRepository` |
| Altro per oggi | `ExpandablePanel` x4, state remembered in sessionStorage (UI preference only) |
| Board 3 notice | `OggiView` + `decideDayChange` |

Surfaces: paper cards (`--paper*` tokens) on the active palette gradient; handwriting accent via Caveat (`--font-hand`).

## Data

| Entity | Repository | Notes |
|---|---|---|
| Calendar event / reminder / PostIt | `lib/calendar-mock.ts` (existing) | Fixtures; labelled as sample data in Oggi via `CALENDAR_SOURCE_IS_FIXTURE` |
| Task (incl. focus), TimeBlock, EnergyActivity, CheckIn | `lib/oggi/daily-repository.ts` | |
| JournalEntry (one per day) | `lib/journal/journal-repository.ts` | Quaderno "Diario" must read `listEntries()` |
| InboxItem | `lib/inbox/inbox-repository.ts` | Single capture store for the app |

All new repositories are in-memory only (`PERSISTENCE_MODE = 'memory'`). Data survives client
navigation, not reload, and the UI says so. A durable implementation must sit behind the same
interfaces and use the encrypted vault - never plaintext localStorage / IndexedDB.

## Midnight rule

A day change while a text field is focused, or while any `[data-draft]` field holds unsubmitted
text, keeps the displayed day and shows the notice once. Otherwise Oggi quietly follows the new day.
Day-bound components are keyed by day so drafts never move between dates.
Dev only: `window.__oggiDev.setClockOffsetMinutes(n)` shifts the clock.

## Flexible time blocks

Model: `TimeBlock` (`lib/oggi/types.ts`) - id, local `day`, wall-clock `start` and `duration` in
minutes, optional `taskId`, `timeZone`, `createdAt`, `updatedAt`. Never a calendar event or reminder.
Rules live in `lib/oggi/time-blocks.ts`; gestures in `lib/oggi/press-gesture.ts`.

| Rule | Decision |
|---|---|
| Snapping | Gestures snap to 15 min; the "Cambia orario" editor accepts exact minutes |
| Default | 60 min, title "Blocco di concentrazione" |
| Fixed appointments | Protected; no overlap. An appointment without an end protects its drawn 30 min |
| Reminders, PostIts | Overlap allowed (no duration) |
| Block vs block | Overlap allowed, drawn side by side (user's choice, not an error) |
| Day bounds | A block never crosses local midnight; DST-skipped wall times are rejected |
| Invalid drop | Block stays at the last valid proposal; cancel restores the stored slot |
| Writes | `createTimeBlock` / `updateTimeBlock` validate and return a result; failures change nothing |
| Past blocks | Subdued, never red, never removed; "Sposta più tardi" pre-fills the next free slot |
| Timer | "Avvia timer" loads the shared timer store; never started by moving, never completes tasks |

Gestures (Pointer Events, mouse / touch / pen): 500 ms long press on an empty slot creates, on a
block moves; the grip and the resize handles act immediately. Movement over 8 px before
activation is treated as scrolling. Keyboard: grip + arrows moves 15 min, Shift + arrows resizes;
the "..." menu offers Cambia orario, Modifica titolo, Avvia timer, Elimina blocco.

Interaction suite: `pnpm --filter ui-shell test:e2e` with a running dev server (`BASE_URL`, `CHROME_PATH`).
It simulates input through Chrome DevTools; physical touch and Apple Pencil checks remain manual.

## Task workflow (Da fare e fatto)

Boards: `Agenda - bozze tavole-selection (1).pdf` (Nuova attività, task actions, inline delete confirmation).
UI in `components/oggi/TaskDialogs.tsx`; the shared draft and error copy in `lib/oggi/task-form.ts`.

| Rule | Decision |
|---|---|
| Fields | Title (required, not whitespace), optional deadline "entro le" (a due time, never an appointment or block), optional priority |
| Writes | `addTask` / `updateTask` / `setTaskDone` / `archiveTask` / `deleteTask` return a result; failures change nothing and keep the form values |
| Duplicate submit | Single flight per form; a second submit is ignored until the first one fails |
| Edit | Same form as creation, writes the same task id; unchanged fields, status, timestamps and block links kept |
| Delete | A task belongs to exactly one day, so "tolta da Oggi" equals permanent deletion; the copy says so. Archive (hide, keep) stays a separate action for done tasks |
| Linked blocks | Never deleted or changed by task delete / completion; the confirmation says they stay |
| Completion | Moves to Fatto with the same id; reversible; never archives or deletes |
| Focus | Opening focuses the title (`[data-autofocus]`); closing returns to the opener, or to a neighbouring row after a delete; Escape steps back from edit / confirmation |

Interaction suite: `e2e/oggi-tasks.mjs` (also run by `pnpm --filter ui-shell test:e2e`).

## Flexible block actions and deletion

Boards: `Agenda - bozze tavole-selection (2).pdf` (block actions, delete confirmation).
UI in `BlockActionsDialog` (`components/oggi/TimeBlockDialogs.tsx`): one native modal with internal
views (actions, schedule editor, title editor, delete confirmation) - never nested dialogs.

| Rule | Decision |
|---|---|
| Opening | Click / tap / pen tap on the block body, or "..." (keyboard). A long press, drag or resize never opens it (the click after a gesture is swallowed) |
| Content | Title, day (visible when not today, screen-reader text otherwise), start - end and duration, all from the stored block |
| Cambia orario | Existing schedule editor; same validation as dragging (fixed appointments, min 15 min, day bounds, DST); same block id |
| Modifica titolo | Renames the block only; a linked task keeps its title |
| Avvia timer | Loads the shared timer with the block's real duration; never moves the block or completes a task. If a timer is running, the action says it replaces it |
| Delete | `deleteTimeBlock` is a hard delete of that one block and returns a result; a refused write changes nothing |
| Delete scope | Tasks (state, priority, deadline), appointments, reminders, PostIts, other blocks and the timer are untouched. A task holds no back reference to blocks, so there is nothing to clean up |
| Timer after delete | The timer has its own lifecycle and keeps running with its label |
| Confirmation | Entering it writes nothing; Annulla / Escape step back; Elimina is single flight; the dialog closes and success is announced only after the repository confirms; failure keeps the block and offers "Riprova" |
| Focus | Safe default on Annulla; after a delete focus moves to a neighbouring block, or to "Aggiungi blocco" |

Interaction suite: `e2e/oggi-block-actions.mjs` (also run by `pnpm --filter ui-shell test:e2e`).

## Destructive actions (app-wide guidance)

Every section of Agenda ADHD follows these rules; Oggi tasks and blocks are the reference implementations.

1. Destructive actions need explicit intent and a confirmation step; entering the confirmation changes nothing.
2. The confirmation names the entity (title, and time when it has one) and states the real consequence.
3. Cancel, Escape and closing are always non-destructive; the safe choice gets the initial focus.
4. Deletion, removal from a date, archiving and completion are different operations with different copy.
5. Related entities are never removed or modified implicitly; no cascade is inferred from a link or from layout.
6. Success is shown only after the repository confirms; a failure keeps the data, says so plainly and allows a retry.
7. The confirmation lives inside the same dialog as the actions, with focus trap, Escape, labels and reduced motion.
8. After a deletion focus moves to a surviving neighbour or to the section's add action.

## Not in this increment

- Durable / encrypted persistence (no vault API on any integrated branch).
- Handwriting input (needs the vector-ink architecture) and voice capture: no buttons shown.
- Notebook links (Quaderno not implemented): panel omitted.
- Energy recommendations: only user-defined activities per level, no inference.
- Task checklists; Inbox triage UI; Calendario deep link to a date.
