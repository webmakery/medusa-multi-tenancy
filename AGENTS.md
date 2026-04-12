# AGENTS.md

## Purpose

This repository already has an established admin dashboard UI. All new UI work must extend the existing system and remain visually consistent with the current product.

The default behavior is reuse, not invention.

Any page, section, component, or screen added or updated in the admin area must look like it already belonged to the product before the change.

---

## Core rule

When working on UI, always reuse the existing admin dashboard design language, component patterns, spacing, typography, borders, buttons, form controls, tables, cards, and layout conventions already present in the codebase.

Do not create a new design interpretation.
Do not redesign existing product behavior.
Do not introduce one-off visual decisions.

The correct solution is almost always to compose from existing admin UI building blocks.

---

## Non-negotiable UI principles

- Reuse existing admin dashboard components before creating anything new.
- Reuse existing page layout patterns before creating a new layout.
- Reuse existing button styles, card styles, section styles, table styles, filter bars, headers, forms, empty states, and status treatments.
- Keep new pages visually indistinguishable from the rest of the admin dashboard.
- Match the current UI system exactly in feel, density, spacing, hierarchy, and interaction style.

Any implementation that looks custom, isolated, or stylistically different from the rest of the admin dashboard is incorrect.

---

## Strict design constraints

### Buttons
- Use only existing button components and existing button variants already present in the admin dashboard.
- Do not create new button sizes, shapes, radii, colors, font treatments, shadows, or interaction styles.
- Do not restyle buttons locally.
- Do not create page-specific CTA styling.

### Borders and containers
- Reuse existing border treatments, border colors, card wrappers, panel styles, divider patterns, and container structures.
- Do not introduce new border thickness, new radius values, new shadow styles, or new card appearances.
- Do not create flat text-only sections where the admin dashboard normally uses cards, panels, toolbars, or structured containers.

### Fonts and typography
- Use only the existing typography system already used in the admin dashboard.
- Reuse current font family, font sizes, font weights, line heights, and text hierarchy.
- Do not introduce new typography scales.
- Do not make headings, labels, or body text visually different from the existing dashboard.
- Do not use custom emphasis styling that is not already part of the system.

### Spacing and layout
- Reuse the existing spacing scale and layout rhythm from the admin dashboard.
- Keep alignment, gaps, paddings, margins, and section spacing consistent with nearby admin screens.
- Do not invent new page density or spacing behavior.
- Do not create page-specific layout rules unless matching an existing pattern already present in the repo.

### Inputs, tables, and filters
- Reuse existing form fields, selects, dropdowns, toggles, search bars, filter bars, table layouts, badges, tabs, and pagination patterns.
- Do not introduce custom field styling or alternative table structure unless the same pattern already exists in the codebase.
- Keep data presentation consistent with the rest of the admin UI.

---

## Reuse-first implementation rule

Before writing code for any admin UI task:

1. Inspect the existing admin dashboard implementation.
2. Identify which shared components, wrappers, patterns, and styles are already used for similar screens.
3. Build the requested UI by composing those same existing parts.
4. Only add new code when no reusable internal pattern exists.
5. Even when adding new code, make it visually identical to the current system.

Never start by inventing markup and styling from scratch when a similar admin pattern already exists.

---

## Forbidden behavior

The following are not allowed unless explicitly requested and clearly supported by an existing pattern in the repository:

- introducing a new visual style
- inventing a new layout pattern
- inventing a new card style
- inventing a new button variant
- inventing a new form treatment
- inventing a new typography hierarchy
- inventing a new spacing system
- inventing a new border, radius, or shadow style
- using raw inline styles for page-specific design decisions
- creating text-only placeholder-looking pages
- adding decorative UI that does not already exist in the admin dashboard
- making a screen look “more modern” or “cleaner” by redesigning it

Matching the existing product is more important than novelty.

---

## Readability and labels

- Never render internal translation keys, config keys, or developer-facing identifiers in the UI.
- All visible text must be user-readable and production-ready.
- Replace raw labels with proper user-facing labels.
- Treat any visible key-like string as a bug.
- Keep naming and wording aligned with the rest of the admin dashboard.

Examples of incorrect output:
- `admin.apps.menuLabel`
- `admin.analytics.menuLabel`
- internal enum names shown directly to users

Examples of correct output:
- `Apps`
- `Analytics`
- `Team Members`

---

## Existing admin dashboard as source of truth

The existing admin dashboard implementation is the design system.

That means:
- existing components define the valid UI language
- existing layouts define the valid page structure
- existing button usage defines valid button behavior
- existing cards and borders define valid surface treatment
- existing typography defines valid text hierarchy
- existing forms and tables define valid data-entry and data-display patterns

When uncertain, inspect nearby admin code and follow the already-established pattern.

Do not guess.
Do not improvise.
Do not “improve” the design by changing its language.

---

## New component rule

Create a new component only if both conditions are true:

1. No suitable existing shared admin component or composition already solves the problem.
2. The new component can be implemented in a way that is fully visually consistent with the current admin dashboard.

Even when a new component is necessary, it must feel like an internal extension of the existing system, not a new design language.

New components must not introduce:
- new tokens
- new stylistic rules
- new visual hierarchy
- new interaction patterns
- new decorative treatments

---

## Styling rule

Prefer existing shared styling mechanisms already used in the repo.

- Reuse current design tokens, utility classes, shared component props, theme variables, and established style patterns.
- Avoid custom CSS for one-off visual behavior.
- Avoid inline styles unless required by an already-established pattern.
- Avoid local overrides that make a screen drift away from the rest of the admin dashboard.

If the same visual result can be achieved with an existing internal component or pattern, that approach must be used.

---

## Screen quality standard

An admin page is only acceptable if it satisfies all of the following:

- it looks like it belongs to the current admin dashboard
- it uses the same visual language as the rest of the product
- it does not feel text-only when comparable screens are structured
- it uses proper containers, spacing, and hierarchy
- it uses existing admin buttons and controls
- it uses the same border, card, and typography treatment seen across the dashboard
- it contains readable user-facing labels
- it does not reveal internal system keys
- it does not contain invented styling

If any of the above is false, the implementation is incomplete.

---

## Required validation before finishing UI work

Before completing any admin UI task, verify:

- existing admin components were reused wherever possible
- no new visual pattern was introduced unnecessarily
- buttons match existing admin buttons
- borders and cards match existing admin surfaces
- fonts and text hierarchy match existing admin typography
- spacing and alignment match the surrounding dashboard
- forms, tables, filters, and actions follow current admin patterns
- no raw translation keys or internal labels are visible
- the result feels native to the existing product

---

## Code review expectations

A UI change must be revised or rejected if it does any of the following:

- looks visually different from the established admin dashboard
- introduces custom styling where existing shared UI should have been reused
- adds a new visual pattern without a codebase-backed reason
- renders developer-facing or untranslated label keys
- uses inconsistent spacing, typography, borders, or buttons
- feels like a redesign instead of an extension of the existing product

Consistency is the review standard.

---

## Default behavior for all admin UI tasks

For every admin dashboard UI task, assume the following:

- reuse existing admin UI
- reuse existing buttons
- reuse existing borders and cards
- reuse existing fonts and typography
- reuse existing spacing and layout
- reuse existing forms, filters, and tables
- keep labels readable
- do not invent new design

The output must match the existing admin dashboard, not a newly imagined version of it.

---

## Final instruction

When implementing admin UI:
match the existing dashboard exactly,
reuse instead of invent,
and make every new screen feel like it was already part of the product.
