# BallotCard — Design Implementation Brief

The approved visual design lives in two interactive HTML mockups at the project root.
Open them in a browser to see the full intent before touching any code.

- **Primary (light mode):** `design-mockup-v4-light.html`
- **Dark mode:** `design-mockup-v3.html`

Implement the light mode design first. The dark mode follows the same logic with inverted
chrome variables — it can be wired to `prefers-color-scheme: dark` once light mode is solid.

---

## The core concept

There are **two distinct visual worlds** on every page. Keep them separate in code and in mind:

| Layer | World | Feel |
|---|---|---|
| Nav, page background, page header, footer | **Digital chrome** — 2026 iPad OS | Frosted glass, Inter, cool gradient, dark/light glass |
| Ballot card and everything inside it | **Paper ballot** — 1990s printed document | Off-white paper, Libre Baskerville, ink-on-cream rows |

The ballot card is a physical document floating on a modern screen. The contrast between
the two worlds is the design.

---

## Typography

Add **Inter** and **IBM Plex Sans** alongside the existing Libre Baskerville and Open Sans.

```ts
// src/app/layout.tsx
import { Libre_Baskerville, Open_Sans, Inter, IBM_Plex_Sans } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-ui',     // chrome layer (nav links, page header, footer)
  weight: ['400', '500', '600'],
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-wordmark',    // wordmark only
  weight: ['500'],
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  variable: '--font-serif',       // existing
  weight: ['400', '700'],
  style: ['normal', 'italic'],
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',        // existing — used inside ballot card
  weight: ['400', '500', '600'],
})
```

Apply all four variables to `<html>`. The chrome layer uses `--font-sans-ui` (Inter).
The wordmark uses `--font-wordmark` (IBM Plex Sans). The ballot card uses `--font-serif`
(Libre Baskerville) for office names and `--font-sans` (Open Sans) for body/meta text.

---

## CSS design tokens

Add these to `src/app/globals.css` (or wherever global CSS variables live).
These are the exact values from the approved mockup.

```css
:root {
  /* ── Paper world (ballot card interior) ── */
  --paper:              #f9f8f3;
  --paper-warm:         #f2ede0;
  --ballot-navy:        #1c2b4a;   /* section header bands: FEDERAL, STATE, COUNTY */

  /* ── Chrome layer (light mode) ── */
  --glass-bg:           rgba(168, 188, 220, 0.52);
  --glass-border:       rgba(0, 0, 0, 0.07);
  --glass-text:         rgba(0, 0, 0, 0.45);
  --glass-active:       rgba(0, 0, 0, 0.88);
  --glass-hover-bg:     rgba(0, 0, 0, 0.05);
  --glass-active-bg:    rgba(0, 0, 0, 0.07);

  /* ── Page background (light mode) ── */
  /* Applied to <body> — simulates an iPad-light wallpaper */
  --page-bg: /* see gradient below */;
}

body {
  background:
    radial-gradient(ellipse at 20% 0%,   rgba(195, 215, 255, 0.55) 0%,  transparent 50%),
    radial-gradient(ellipse at 85% 85%,  rgba(215, 195, 255, 0.30) 0%,  transparent 50%),
    radial-gradient(ellipse at 55% 50%,  rgba(235, 240, 255, 0.20) 0%,  transparent 65%),
    #eceef5;
  background-attachment: fixed;
}

@media (prefers-color-scheme: dark) {
  :root {
    --glass-bg:      rgba(12, 15, 22, 0.55);
    --glass-border:  rgba(255, 255, 255, 0.07);
    --glass-text:    rgba(255, 255, 255, 0.55);
    --glass-active:  #ffffff;
    --glass-hover-bg:  rgba(255, 255, 255, 0.08);
    --glass-active-bg: rgba(255, 255, 255, 0.11);
  }

  body {
    background:
      radial-gradient(ellipse at 35% 0%,   #1e3a5f 0%,  transparent 55%),
      radial-gradient(ellipse at 80% 90%,  #0f2240 0%,  transparent 55%),
      radial-gradient(ellipse at 60% 50%,  #0a1428 0%,  transparent 70%),
      #070b12;
  }
}
```

---

## Nav component

The nav is a **frosted glass bar** that sticks to the top.
It lives in the chrome/digital layer — uses Inter, glass background, backdrop-filter.

```tsx
// Tailwind equivalent of the nav styling:
<nav className="
  sticky top-0 z-10
  h-[52px] px-8
  flex items-center justify-between
  border-b
  font-[var(--font-sans-ui)]
"
style={{
  background: 'var(--glass-bg)',
  borderColor: 'var(--glass-border)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
}}
>
```

**Brand/wordmark:** `BallotCard` followed by a ballot checkbox icon — IBM Plex Sans 500,
`letter-spacing: -0.01em`, `var(--glass-active)` color. The checkbox sits 7px to the right
of the text at 60% opacity, so it reads as a mark rather than competing with the letterforms.

```tsx
// Wordmark component
<span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
  <span style={{
    fontFamily: 'var(--font-wordmark)',
    fontWeight: 500,
    fontSize: '17px',
    letterSpacing: '-0.01em',
    color: 'var(--glass-active)',
  }}>
    BallotCard
  </span>
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
       style={{ flexShrink: 0, opacity: 0.55 }}>
    <rect x="1" y="1" width="13" height="13" rx="2.5"
          stroke="currentColor" strokeWidth="1.4"/>
    <path d="M4.5 7.5l2 2 4-4"
          stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</span>
```

**Nav links:** Inter 400, `0.8125rem`, `var(--glass-text)` color. On hover/active: `var(--glass-active)` + `var(--glass-hover-bg)` background, `border-radius: 7px`.

Active link ("My ballot" on the card page): `var(--glass-active-bg)` background, Inter 500.

---

## Page layout and ballot header

The page wrapper is `max-width: 760px`, centered, `padding: 3rem 1.25rem 5rem`.

The ballot header (above the card) lives in the **digital/chrome world**:

```tsx
// Page header structure
<div>
  {/* Eyebrow — Inter 500, uppercase, tight tracking */}
  <p style={{ color: 'rgba(0,0,0,0.52)' }} className="text-[0.6875rem] font-medium tracking-[0.08em] uppercase mb-1.5 font-[var(--font-sans-ui)]">
    {state} · {date}
  </p>

  {/* Title — Libre Baskerville (the bridge between worlds) */}
  <h1 className="font-[var(--font-serif)] text-[2rem] font-bold leading-[1.15]"
      style={{ color: 'rgba(0,0,0,0.85)' }}>
    My ballot
  </h1>

  {/* Subtitle — Inter, muted */}
  <p className="mt-1 text-[0.9375rem] font-[var(--font-sans-ui)]"
     style={{ color: 'rgba(0,0,0,0.62)' }}>
    Everyone who represents you — federal to local.
  </p>
</div>
```

Note: the `<h1>` stays in Libre Baskerville even though it's outside the card —
this is deliberate. It bridges the two worlds and anchors the document feel.

**"Saved to My ballot" button:** frosted glass pill.
```css
background: rgba(0, 0, 0, 0.06);
backdrop-filter: blur(12px);
color: rgba(0, 0, 0, 0.70);
border: 1px solid rgba(0, 0, 0, 0.10);
border-radius: 9px;
padding: 0.5rem 0.9375rem;
font-family: var(--font-sans-ui);
font-size: 0.8125rem;
font-weight: 500;
```

---

## Ballot card

The card is a **physical paper document** floating on the screen.

```tsx
<div style={{
  background: 'var(--paper)',
  border: '1px solid #cec9b9',
  borderRadius: '4px',
  boxShadow: `
    0 0 0 1px rgba(0,0,0,0.06),
    0 2px 6px rgba(0,0,0,0.08),
    0 10px 36px rgba(0,0,0,0.10),
    0 28px 64px rgba(0,0,0,0.07)
  `,
  overflow: 'hidden',
  /* Optional: subtle ruled-paper texture */
  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,0,0,0.018) 24px)',
}}>
```

### Section header bands (FEDERAL / STATE / COUNTY)

```css
background: #1c2b4a;        /* --ballot-navy */
color: rgba(255,255,255,0.90);
padding: 0.4375rem 1.125rem;
font-family: var(--font-serif);   /* Libre Baskerville */
font-size: 0.75rem;
font-weight: 700;
letter-spacing: 0.1em;
text-transform: uppercase;
```

A thin horizontal rule (`rgba(255,255,255,0.18)`) fills the space between the label
and the office count on the right.

### Ballot rows

Each row is split into **two independently clickable zones**:

```
[  Left zone (office + officeholder)  ▶ | Next election ▼ ]
                                         [  Right zone   ]
```

- Left click → expands **activity panel** (recent votes, statements, hearings)
- Right click → expands **challengers panel** (who's running next election)
- The two zones are mutually exclusive — opening one closes the other

**Row layout:**
```css
display: grid;
grid-template-columns: 1fr auto;
min-height: 54px;
border-bottom: 1px solid #e3ddd1;
```

**Left zone:**
```css
padding: 0.6875rem 0.625rem 0.6875rem 1.125rem;
border-right: 1px solid #e3ddd1;
```

Office name — Libre Baskerville 400, `0.9375rem`, `#1a1a1a`
Officeholder name — Open Sans 400, `0.8125rem`, `#717171`
Party affiliation inline: D=`#1d4ed8` (blue), R=`#b91c1c` (red), I/L=`#6d28d9` (purple)

Expand indicator (▶): `opacity: 0.45` at rest, `1.0` on hover, rotates 90° when open,
color shifts to `#3d4fa8` (the activity blue).

**Right zone** (`min-width: 118px`, right-aligned):
```
NEXT ELECTION    ← Open Sans 600, 0.625rem, uppercase, tracking 0.06em, color #717171
Nov 2026         ← Libre Baskerville 400, 0.875rem, color #3c3c3c
▼                ← expand indicator, rotates 180° when open, color shifts to #854d0e
```

**Hover state** for both zones: `background: #f2ede0` (--paper-warm)
**Open state** left: `background: #eef2ff` (activity blue tint)
**Open state** right: `background: #fefce8` (challenger yellow tint)

### Activity panel (left accordion)

Background: `#eef2ff`, top border: `1px solid #b8c5ef`

Header row: `0.625rem`, Inter 600, uppercase, tracking 0.07em, color `#3d4fa8`.
"View all →" link right-aligned, Inter 400, `0.75rem`, same color at 75% opacity.

Each activity item is a 3-column grid: `[tag] [description] [date]`

Activity tag colors (small pill, `border-radius: 2px`):
| Type | Background | Text |
|---|---|---|
| Vote | `#dbeafe` | `#1e40af` |
| Floor | `#e0e7ff` | `#3730a3` |
| Hearing | `#ede9fe` | `#6d28d9` |
| Signed | `#d1fae5` | `#065f46` |
| Press | `#fce7f3` | `#9d174d` |
| Statement | `#e0e7ff` | `#3730a3` |

These tag types correspond to the `FeedItem` contract in `src/lib/feed/`.

### Challengers panel (right accordion)

Background: `#fefce8`, top border: `1px solid #e8d88a`

Header row color: `#854d0e`

Each challenger row: name + party color, italic meta text below,
badge on the right (`Incumbent` = green `#d1fae5`/`#065f46`,
`Challenger` = yellow `#fef9c3`/`#854d0e`).

### Honest empty rows

Offices with no data source yet render at full opacity but with:
- Office name in italic, color `#717171`
- Officeholder slot: `"No data source yet — checking back"`, color `#cec9b9`
- No expand indicators; cursor: default
- Right zone at 40% opacity

This is load-bearing to the product's epistemic honesty principle —
every office the voter actually votes for must appear, even without data.

### Ballot footer (inside the card)

```css
background: #f2ede0;       /* --paper-warm */
border-top: 1px solid #cec9b9;
padding: 0.875rem 1.125rem;
font-size: 0.8125rem;
color: #717171;
```

Text: `"Data as of [date]. Offices we don't yet have a data source for appear as honest
empty rows — your ballot is shown in full."`

---

## Site footer

Matches the nav: same glass background, same `backdrop-filter`, `border-top` instead of
`border-bottom`. Uses Inter throughout.

Left: "BallotCard" wordmark (IBM Plex Sans 500, `--glass-active`) + checkbox icon + "open source · github" sub-line.
Right: Principles · Privacy · Terms · Support links, `--glass-text` color.

---

## What to leave alone

The `--font-serif` / Libre Baskerville and `--font-sans` / Open Sans variables in
`globals.css` are existing and used throughout. Do not rename or remove them — only add
`--font-sans-ui` / Inter alongside them.

The ballot card's internal color palette (`--paper`, `#cec9b9`, `#e3ddd1`, party colors,
accordion tints) is completely independent of the chrome palette. Keep them separate.

---

## Reference files

Both mockup files in the project root are self-contained interactive HTML — open in a
browser to click rows and see the accordions in action. The CSS in those files is the
ground truth for every specific value in this document.
