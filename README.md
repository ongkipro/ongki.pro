<div align="center">

<img src="public/og.png" alt="ongki.pro — Building Digital Growth Systems" width="860" />

<br/>
<br/>

# ongki.pro

### Building Digital Growth Systems.

A single-screen digital identity — a **premium operating system for business growth**.
Dark, futuristic, and interactive, anchored by an abstract Three.js **Digital Core**.

<br/>

![Astro](https://img.shields.io/badge/Astro_5-0b0c14?style=for-the-badge&logo=astro&logoColor=5d7bff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-0b0c14?style=for-the-badge&logo=tailwindcss&logoColor=5d7bff)
![Three.js](https://img.shields.io/badge/Three.js-0b0c14?style=for-the-badge&logo=threedotjs&logoColor=ffffff)
![GSAP](https://img.shields.io/badge/GSAP-0b0c14?style=for-the-badge&logo=greensock&logoColor=88ce02)
![TypeScript](https://img.shields.io/badge/TypeScript-0b0c14?style=for-the-badge&logo=typescript&logoColor=3178c6)

<a href="https://ongki.pro"><b>↗ Live site</b></a>

</div>

---

## ✦ The idea

> Innovation without structure is just expensive chaos.

Most personal sites are a list of links. This one is a **system**: it boots like an OS, renders a
living growth engine, and treats every interaction as part of one operating layer — no menus, no
buttons begging for clicks, just signal.

---

## ◆ Highlights

| | |
|---|---|
| ⚡ **Boot sequence** | Staged `0 → 100%` loader (`Initializing Infrastructure → … → System Ready`) that fades into the hero. |
| 🪐 **Digital Core** | A reusable Three.js engine: fresnel-lit orb, wireframe shells, orbiting rings, satellite nodes, traveling **data packets**, and a fogged particle field. |
| 🔗 **Capability ↔ core** | Hover a capability tag → its node cluster ignites in the 3D core + a one-line readout. |
| 🛰 **Cursor-aware** | Desktop parallax + the core "wakes up" (glows brighter) as your cursor approaches. |
| 🔒 **Hidden contact** | Press-and-hold 2s to pass human verification → the email is assembled in JS, never in static HTML. Copy in one tap. Header flips to **Channel Open**. |
| 🎛 **Tiered performance** | Richest on desktop, lighter on tablet, minimal on mobile; loop pauses when the tab is hidden. |
| ♿ **Accessible** | `prefers-reduced-motion`, keyboard-operable reveal, semantic HTML, ARIA, readable contrast. |

> **No external/paid assets.** Fonts are self-hosted; textures, grid, noise, the OG card, and the
> entire 3D scene are generated at build/runtime.

---

## 🌀 Anatomy of the Digital Core

```
                      ◌  ·   data packets travel node → core
                  ·        ◍ ─────────╮
            ╭───────── orbiting rings ─┴──────────╮
            │      ◌  wireframe shells  ◌          │
            │          ╭───────────╮               │
            │   ◍──────│   ◉ orb    │  fresnel rim  │
            │          │ inner core │  ◜ glow ◝     │
            │          ╰───────────╯               │
            │      ◌      ◍      ◌      ◍           │
            ╰──────────────────────────────────────╯
               ·   ·   particle field + depth fog   ·   ·
```

A premium rim glow with **one** lightweight shader (no post-processing):

```glsl
// fresnel rim — bright at glancing angles, transparent head-on
float f = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
gl_FragColor = vec4(uColor, f * uIntensity);
```

Drive it from anywhere:

```ts
import { ThreeCore } from './components/ThreeCore';

const core = new ThreeCore(canvas, { reducedMotion });
core.start();
core.highlight(2); // light up the "SEO Infrastructure" cluster
core.dispose();    // cancels RAF, frees all GPU resources
```

---

## 🚀 Boot sequence

```
[ 000% ] ▸ Initializing Infrastructure
[ 016% ] ▸ Installing AI Agents
[ 038% ] ▸ Loading Digital Core
[ 058% ] ▸ Synchronizing Automation
[ 077% ] ▸ Optimizing Interface
[ 100% ] ▸ System Ready ───────────────▶ hero entrance
```

---

## 🔐 Hidden contact

The address is **never** shipped in the HTML — it only exists after a verified hold:

```ts
// assembled in JS, post-verification — bots scraping markup find nothing
const email = 'get' + '@' + 'ongki.pro';
```

---

## 🧪 Quick start

```bash
npm install        # install dependencies
npm run dev        # dev server → http://localhost:4321
npm run build      # production build → ./dist
npm run preview    # preview the build
npm run format     # Prettier (write)
```

**Requirements:** Node 22.12+ (see `engines`) · a WebGL-capable browser.

---

## 🗂 Structure

```
src/
├─ pages/
│  └─ index.astro          # head/SEO · background layers · header · canvas · GSAP orchestration
├─ components/
│  ├─ Hero.astro           # headline · subheadline · system line · tags · contact
│  ├─ LoadingScreen.astro  # staged boot screen
│  ├─ ThreeCore.ts         # the Digital Core engine (public highlight() API)
│  ├─ ContactReveal.astro  # hold-to-verify + copy
│  └─ SystemTags.astro     # capability tags + readout
├─ lib/
│  └─ utils.ts             # cn() — clsx + tailwind-merge
└─ styles/
   └─ global.css           # tokens · @utility glass/hairline · ambient layers
public/
├─ favicon.svg             # core-motif favicon
└─ og.png                  # 1200×630 social card
```

---

## 📐 Responsive tiers

| Tier | Particles | Nodes | Data packets | Mouse parallax |
|------|:---------:|:-----:|:------------:|:--------------:|
| **Desktop** | 1300 | 14 | 5 | ✓ |
| **Tablet**  |  620 | 12 | 3 | — |
| **Mobile**  |  240 |  6 | 0 | — |

The core rebuilds itself when the viewport crosses a breakpoint, and the render loop pauses while the
tab is hidden.

---

## 🎨 Design system

| Token | Value |
|-------|-------|
| Background | `#04050a` |
| Accent | `#5d7bff` → `#9fb4ff` (single electric blue-violet) |
| Display | Space Grotesk |
| Body | Inter |
| Data / labels | JetBrains Mono |

---

## 🧬 Extending — drop in a 3D character later

`ThreeCore.ts` documents exactly where to load a GLB/GLTF model:

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

new GLTFLoader().load('/models/agent.glb', (gltf) => {
  gltf.scene.scale.setScalar(1.2);
  this.group.add(gltf.scene); // inherits rotation, float, and parallax for free
});
```

---

<div align="center">
<sub><code>DEPLOY_STATUS: SUCCESS</code> · <code>BUILD_REF: 4299X.PRO</code> · © ongki.pro</sub>
</div>
