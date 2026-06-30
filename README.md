# ongki.pro

A professional, single-screen digital identity site — a "digital operating system for business growth."
Dark, futuristic, interactive, built with an abstract Three.js **Digital Core**.

**Core message:** Building Digital Growth Systems.

## Tech stack

- **Astro 5** — static output, zero-JS by default
- **Tailwind CSS v4** — single electric blue-violet accent
- **Three.js** — `ThreeCore.ts`, the AI Agent / Digital Core (all primitives, one light fresnel shader)
- **GSAP** — boot sequence, hero entrance, micro-interactions
- **TypeScript** — strict
- **Type**: Space Grotesk (display) · Inter (body) · JetBrains Mono (data) — self-hosted via Fontsource
- Lucide (icons), clsx + tailwind-merge (`cn()`), Prettier

## Features

- Premium boot screen with a staged 0–100% counter and status text
  (Initializing Infrastructure → Installing AI Agents → Loading Digital Core →
  Synchronizing Automation → Optimizing Interface → System Ready), fading smoothly into the hero.
- Interactive Three.js core: glowing orb, fresnel rim, wireframe shells, rotating rings, floating
  nodes, connecting lines, **data packets** traveling node → core, particle field with depth fog,
  slow rotation + float, and desktop mouse parallax that "wakes" the core on approach.
- **Capability ↔ core linking**: hover/tap a capability tag to light up its node cluster in the 3D
  core and reveal a one-line readout.
- Tiered performance: richest on desktop, reduced on tablet, minimal on mobile; the render loop is
  paused while the tab is hidden and rebuilt on breakpoint crossings.
- Hidden contact: **hold for ~2s** to pass human verification, then the email is assembled in JS
  (`get` + `@` + `ongki.pro`) — never present in static HTML — with copy-to-clipboard. On success the
  header status switches to **Channel Open**.
- Accessible: respects `prefers-reduced-motion`, keyboard-operable reveal (Space/Enter),
  semantic HTML, ARIA labels, readable contrast.

No external/paid assets — fonts are self-hosted, and textures, grid, noise, OG image, and the entire
3D scene are generated at build/runtime.

## Commands

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:4321)
npm run dev

# Type-aware Prettier formatting
npm run format        # write
npm run format:check  # check only

# Production build → ./dist
npm run build

# Preview the production build locally
npm run preview
```

## Structure

```
src/
├── pages/
│   └── index.astro         # head/SEO, background layers, header, canvas, GSAP orchestration
├── components/
│   ├── Hero.astro          # headline, subheadline, system line, tags, contact
│   ├── LoadingScreen.astro # staged boot screen
│   ├── ThreeCore.ts        # Three.js Digital Core (reusable class, public highlight() API)
│   ├── ContactReveal.astro # hold-to-reveal + copy
│   └── SystemTags.astro    # capability tags + readout
├── lib/
│   └── utils.ts            # cn() — clsx + tailwind-merge
└── styles/
    └── global.css          # tokens, @utility glass/hairline, background layers
public/
├── favicon.svg             # core-motif favicon
└── og.png                  # 1200×630 social card
```

## Adding a 3D character later

`ThreeCore.ts` documents where to load a GLB/GLTF model (e.g. a human agent) via `GLTFLoader`
and add it to `this.group` so it inherits the rotation, float, and parallax — gate it behind the
tier check to keep mobile light.
