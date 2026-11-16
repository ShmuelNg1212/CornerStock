---
name: Cornerstock
description: Bowling ball stock for Bowlers Corner.
colors:
  ink-navy: "#172A3A"
  warm-ivory: "#F6F3EC"
  maple-gold: "#D7A55B"
  signal-orange: "#D45A32"
  action-orange: "#B94A25"
  slate-text: "#5A6369"
  card-white: "#FFFFFF"
  sand-muted: "#ECE7DC"
  sand-border: "#E0D9CA"
  sand-input: "#C9C1B0"
  ok-green: "#1F6B3A"
  ok-surface: "#E3EFE3"
  warn-brown: "#7A5200"
  warn-surface: "#F7EBCB"
  danger-red: "#8A2A1A"
  danger-surface: "#F6E1DC"
typography:
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  serial:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 600
rounded:
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-action:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "0 20px"
  button-primary:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    height: "48px"
  button-quiet:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.lg}"
    height: "48px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.lg}"
    height: "48px"
  badge-in-stock:
    backgroundColor: "{colors.ok-surface}"
    textColor: "{colors.ok-green}"
    rounded: "{rounded.full}"
---

# Design System: Cornerstock

<!-- This file records the interface as built on 2026-11-16, before the "Find first" redesign. The redesign plan regenerates it from the finished build. The qualitative wording here is the agent's description. The human did not review it. -->

## Overview

**Creative North Star: "The shelf label"**

The interface reads like a printed shelf label: an ivory ground, navy ink, one clear name, one clear number. Orange marks the one thing to do next. Gold marks a small detail, such as the location pin.

The current build is a single centered column (768px maximum) on every device. A navy top bar holds the logo, the location selector, and sign-out. Phones get a bottom tab bar. There is no motion except a small press scale on buttons.

**Key Characteristics:**
- Mostly ivory and navy. Orange and gold are selective.
- White cards with a thin sand border. No shadows.
- Tabular numerals for each count, weight, and price.
- A status shows an icon and a label.

## Colors

A warm neutral ground with navy ink and two selective accents.

### Primary
- **Ink Navy** (`ink-navy`): text, the top bar, the primary button, the focus ring.

### Secondary
- **Action Orange** (`action-orange`): the main action button. It is a darker variant of Signal Orange, because white text on Signal Orange has a contrast of 4.0 only.
- **Signal Orange** (`signal-orange`): the ball in the logo only.

### Tertiary
- **Maple Gold** (`maple-gold`): small highlights: the location pin, the rule on the sign-in screen.

### Neutral
- **Warm Ivory** (`warm-ivory`): the page ground.
- **Card White** (`card-white`): cards, inputs, the phone tab bar.
- **Sand Muted / Sand Border / Sand Input**: hover fills, card borders, input borders.
- **Slate Text** (`slate-text`): secondary text. Contrast on ivory is 5.5.
- **OK / Warn / Danger pairs**: status badges and messages. Each has a text color and a surface color.

**The Selective Accent Rule.** Orange is for the one main action on a screen. Gold is never a text color on ivory.

## Typography

**Display Font:** Space Grotesk (h1, h2, h3, the wordmark)
**Body Font:** Inter
**Label/Mono Font:** the system monospace, for serial numbers

### Hierarchy
- **Headline** (700, 1.5rem): one page title on each screen.
- **Title** (600, 1.125rem): card and section headings.
- **Body** (400, 1rem): text and form values. Inputs are 16px so iOS does not zoom.
- **Label** (500, 0.875rem): field labels, secondary lines, badges.
- **Serial** (600, 1rem, monospace): serial numbers.

**The Tabular Rule.** Each quantity, weight, and price uses tabular numerals.

## Layout

One column, `max-width: 768px`, 16px side padding, 20px top padding. Sections are 20 to 24px apart. Lists are cards with divided rows. Rows and controls are 48px high. The top bar is 56px and sticky. On phones a 56px tab bar is fixed at the bottom, above the safe area. From 640px the tabs move into the top bar.

## Elevation & Depth

Flat. No shadows. A card is white on ivory with a 1px sand border.

## Shapes

Rounded rectangles: 10px on controls, 14px on cards. Badges are full pills. The logo is the only hard geometry: a square corner bracket and a circle.

## Components

### Buttons
- **Shape:** 10px radius, 48px high, 16px semibold text.
- **Action:** Action Orange with white text. **Primary:** Ink Navy with white text. **Quiet:** white with a sand border.
- **States:** hover darkens by 10%. Press scales to 0.98. Focus shows a 3px navy ring. Disabled is 60% opacity.

### Cards / Containers
- **Corner Style:** 14px. **Background:** white. **Border:** 1px sand. **Shadow:** none. **Padding:** 12 to 16px.

### Inputs / Fields
- **Style:** 48px high, white, 1px sand-input border, 10px radius.
- **Focus:** navy border and a 3px ring. **Error:** dark red border, ring, and a message line below.

### Navigation
- Navy top bar with the logo and controls. Phone: bottom tabs with icon and label. The current tab is navy text; the others are slate.

### Status badge
- A pill with an icon and a label: In stock (green), Sold (sand), Removed (red).

## Do's and Don'ts

### Do:
- **Do** keep a 48px minimum height for each control.
- **Do** show a status with an icon and a label.
- **Do** use Action Orange for the one main action on a screen.

### Don't:
- **Don't** put white text on Signal Orange `#D45A32`.
- **Don't** use neon effects, heavy gradients, or dense dashboards (brand kit handoff).
