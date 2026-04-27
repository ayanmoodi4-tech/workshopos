# Design Brief

## Tone & Purpose
Utilitarian professional dashboard for internal workshop management. Information-dense, scannable, trustworthy. Status-driven visual hierarchy.

## Palette (OKLCH)
| Token           | Value             | Use                |
|-----------------|-------------------|--------------------|
| Primary         | 0.45 0.13 252     | Buttons, links     |
| Success         | 0.62 0.25 142     | Completed badge    |
| Warning         | 0.7 0.22 65       | Paused badge       |
| Destructive     | 0.58 0.28 30      | Cancelled badge    |
| Pending (Grey)  | 0.65 0.04 250     | Pending badge      |
| In Progress     | 0.5 0.15 254      | Active badge (blue)|

## Typography
Display: General Sans (headers, badges) | Body: DM Sans (copy, tables) | Mono: Geist Mono (timers, IDs)

## Zones
| Zone          | Treatment                           | Purpose                    |
|---------------|-------------------------------------|----------------------------|
| Header        | bg-card, border-b, subtle shadow    | User profile, notifications|
| Sidebar       | bg-sidebar, border-r, persistent   | Navigation anchor          |
| Main Content  | bg-background, grid layout          | Job cards, tables          |
| Card          | bg-card, border, minimal radius     | Job/worker info            |
| Footer        | bg-muted/30 (optional)              | Footer content             |

## Component Patterns
- Badge system (6 states): grey, blue, orange, green, red, + muted
- Job cards: title, status badge, timer, assign button, quick view
- Timers: monospace, bold, right-aligned, high contrast
- Tables: sortable headers, search/filter bar, pagination, zebra striping optional
- Buttons: solid primary (primary-blue), secondary (subtle), danger (destructive)
- Inputs: border-input, focus:ring-ring, rounded-md
- Modals: bg-popover, border, shadow-md

## Motion
- Hover: 0.3s smooth transition on borders, shadows, colors
- Transitions: cubic-bezier(0.4, 0, 0.2, 1) for all interactive elements
- No decorative animations; interaction-driven only

## Shape Language
- Cards & inputs: rounded-md (0.5rem)
- Badges: rounded-md
- Buttons: rounded-sm (0.375rem) for primary, no radius for icon-only
- Modal/dialog: rounded-lg

## Constraints
- Light mode only; no dark mode toggle
- High-contrast text on all backgrounds (AA+)
- Sidebar persistent on desktop; collapsible on mobile
- Print stylesheet for job cards, reports, incentive statements
- No decorative gradients, full-bleed backgrounds, or animations beyond transitions
- Use semantic badge tokens exclusively; no arbitrary colors

## Signature Detail
Status badges are the visual language. Every entity (job, worker, action) communicates state via colour + label. Headers have subtle elevation (border + shadow) to anchor the page. Sidebar is persistent navigation anchor.
