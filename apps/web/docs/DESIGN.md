# Neema — design system

## World

**Soft lavender glass.** Pale lavender-white backgrounds with blurred colour behind frosted white cards, one periwinkle brand colour, large friendly radii, and a single rounded sans. Borrowed from the reference mock the team chose (greeting header, stat tiles, gradient hero card, check-in list, bottom bar with a centre add button).

## Brand signal

The **Neema** mark (a crescent keeping watch, one small light beside it) and wordmark sit top-left on every screen. No marketing landing page: the app opens into care.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg-deep` | `#F4F3FD` / `#E9E7FB` | App background |
| `--glass` / `--glass-strong` | white 62% / 88% | Cards, nav, sheets (with blur) |
| `--tint` | `#EBE9FE` | Icon bubbles, active nav |
| `--primary` | `#6558F5` | Brand, active states |
| `--primary-deep` → `--primary-mid` | `#5246DD` → `#6A5CF0` | Primary button gradient (white text passes 4.5:1) |
| `--ink` / `--ink-muted` | `#1B1A33` / `#5F5E7A` | Text |
| `--calm` | `#1F9D74` | GREEN status dot and orb |
| `--warn-soft` → `--warn` | `#FFD27A` → `#F7A93B` | YELLOW card and orb, always with `--warn-ink` text |
| `--danger-deep` → `--danger` | `#BF2346` → `#D83452` | RED card, orb, danger button |

## Status rules

- The home hero card carries the status. GREEN is the brand gradient with a green dot and the word "Okay"; YELLOW turns the whole card amber; RED turns it red.
- UNKNOWN is never a filled card. It is a dashed, empty-looking glass card so "waiting" cannot be mistaken for "okay".
- Every status also has a word (Okay / Check / Go now / Waiting). Colour is never the only signal.

## Type

Warm and friendly: **Nunito** for UI body/controls and soft **Fraunces** for display titles (both variable, self-hosted through `@fontsource-variable` so they work offline). Headings ~550 with gentle tracking, body 400–600, numbers tabular.

## Layout

- Phone: single column, floating bottom bar with a raised centre "+".
- Tablet (≥768px): wider column, the add sheet becomes a centred dialog.
- Laptop (≥1100px): the bar becomes a left side rail and home splits into two columns (status and numbers on the left, today's check-ins on the right).

## Components

- Hero status card: status pill, headline, one sentence, optional progress (recheck countdown or pregnancy week), one white action button.
- Stat tiles: heart rate, last blood pressure, skin temperature.
- Check-in rows: tick when done today, otherwise an empty ring.
- Tap targets are at least 44px; primary actions 54px.
- Icons come from one authored SVG set (`src/ui/icons.tsx`). No emoji.

## Motion

Screen rise on enter, sheet slide-up, breathing orb on the alert screen, gentle pulse on the danger button. All honour `prefers-reduced-motion`.
