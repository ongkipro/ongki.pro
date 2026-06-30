/**
 * ThreeCore — abstract "AI Agent / Digital Core / Growth Engine"
 * built almost entirely from Three.js primitives.
 *
 * Composition:
 *   - faceted orb (icosahedron) + bright pulsing inner core
 *   - fresnel rim shell (single lightweight shader) for a premium edge glow
 *   - additive glow sprite halo
 *   - dual wireframe shells
 *   - rotating rings on independent axes / speeds
 *   - floating satellite nodes + live connecting lines (perf permitting)
 *   - data packets that travel node → core along the links
 *   - particle field with depth fog
 *
 * Public API:
 *   - start()              begin the render loop (or one static frame)
 *   - highlight(i|null)    light up the node cluster mapped to capability tag `i`
 *   - dispose()            tear everything down
 *
 * Performance:
 *   - tiered detail by viewport (desktop / tablet / mobile), rebuilt on breakpoint cross
 *   - capped pixel ratio, single RAF loop, paused when the tab is hidden
 *   - geometries / materials / textures disposed on teardown
 *   - prefers-reduced-motion → one static frame, no loop, no parallax
 *
 * ── Loading a real 3D character later ───────────────────────────────
 *     import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 *     new GLTFLoader().load('/models/agent.glb', (gltf) => {
 *       gltf.scene.scale.setScalar(1.2);
 *       this.group.add(gltf.scene); // inherits rotation / float / parallax
 *     });
 *   Gate it behind the tier check so mobile stays light.
 */

import * as THREE from 'three';

export type DeviceTier = 'desktop' | 'tablet' | 'mobile';

interface TierConfig {
  particleCount: number;
  nodeCount: number;
  connections: boolean;
  packetCount: number;
  pixelRatioCap: number;
  parallax: boolean;
  baseScale: number;
  /** world-space offset so the core can sit center-right of the text */
  offset: { x: number; y: number };
}

interface ThreeCoreOptions {
  reducedMotion?: boolean;
}

const BG = 0x04050a;
const ACCENT = new THREE.Color('#5d7bff');
const ACCENT_BRIGHT = new THREE.Color('#9fb4ff');

/** Capability tags are mapped to nodes by `nodeIndex % TAG_COUNT`. */
const TAG_COUNT = 6;

interface RingDef {
  mesh: THREE.Mesh;
  speed: THREE.Vector3;
  offset: THREE.Vector3;
}

interface NodeDef {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  phase: number;
  speed: number;
  hl: number; // current highlight 0..1
}

interface Packet {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  nodeIndex: number;
  t: number;
  dur: number;
  delay: number;
}

export class ThreeCore {
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private tier: DeviceTier;
  private config: TierConfig;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private startTime = 0;
  private lastTime = 0;
  private pausedAt = 0;

  private group!: THREE.Group;
  private innerCore!: THREE.Mesh;
  private innerMaterial!: THREE.MeshStandardMaterial;
  private fresnelMaterial!: THREE.ShaderMaterial;
  private glowSprite!: THREE.Sprite;
  private wireframes: THREE.Mesh[] = [];
  private rings: RingDef[] = [];
  private nodes: NodeDef[] = [];
  private lines: THREE.LineSegments | null = null;
  private lineMaterial: THREE.LineBasicMaterial | null = null;
  private packets: Packet[] = [];
  private particles!: THREE.Points;

  private glowTexture: THREE.Texture | null = null;
  private particleTexture: THREE.Texture | null = null;

  private raf = 0;
  private introProgress = 0;
  private disposed = false;
  private resizeTimer = 0;

  private highlightTag: number | null = null;
  private focus = 0; // 0..1 cursor-proximity "wake up"
  private readonly tmp = new THREE.Vector3();

  private readonly parallax = new THREE.Vector2(0, 0);
  private readonly parallaxTarget = new THREE.Vector2(0, 0);

  constructor(canvas: HTMLCanvasElement, options: ThreeCoreOptions = {}) {
    this.canvas = canvas;
    this.reducedMotion = options.reducedMotion ?? false;
    this.tier = ThreeCore.detectTier();
    this.config = ThreeCore.tierConfig(this.tier);

    this.initRenderer();
    this.buildScene();
    this.bindEvents();
  }

  /* ----------------------------- tiers ----------------------------- */

  private static detectTier(): DeviceTier {
    const w = window.innerWidth;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  }

  private static tierConfig(tier: DeviceTier): TierConfig {
    switch (tier) {
      case 'desktop':
        return {
          particleCount: 1300,
          nodeCount: 14,
          connections: true,
          packetCount: 5,
          pixelRatioCap: 2,
          parallax: true,
          baseScale: 1,
          offset: { x: 1.85, y: 0 },
        };
      case 'tablet':
        return {
          particleCount: 620,
          nodeCount: 12,
          connections: true,
          packetCount: 3,
          pixelRatioCap: 1.75,
          parallax: false,
          baseScale: 0.86,
          offset: { x: 0, y: 0.2 },
        };
      case 'mobile':
      default:
        return {
          particleCount: 240,
          nodeCount: 6,
          connections: false,
          packetCount: 0,
          pixelRatioCap: 1.5,
          parallax: false,
          baseScale: 0.66,
          offset: { x: 0, y: 0.9 },
        };
    }
  }

  /* --------------------------- bootstrap --------------------------- */

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.tier !== 'mobile',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.setSize();
  }

  private buildScene(): void {
    this.scene = new THREE.Scene();
    // Exponential fog matched to the page background → depth + hides far pop-in.
    this.scene.fog = new THREE.FogExp2(BG, 0.052);

    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.camera = new THREE.PerspectiveCamera(45, (w || 1) / (h || 1), 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const keyLight = new THREE.PointLight(ACCENT.getHex(), 60, 40);
    keyLight.position.set(4, 3, 6);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(ACCENT_BRIGHT.getHex(), 22, 40);
    rimLight.position.set(-5, -2, 3);
    this.scene.add(rimLight);

    this.build();
  }

  private build(): void {
    this.group = new THREE.Group();
    this.group.position.set(this.config.offset.x, this.config.offset.y, 0);
    this.group.scale.setScalar(this.config.baseScale);
    this.scene.add(this.group);

    // Outer stop MUST fade to zero alpha, else the additive sprite is a solid quad.
    this.glowTexture = ThreeCore.createRadialTexture([
      'rgba(255,255,255,0.95)',
      'rgba(140,165,255,0.32)',
      'rgba(93,123,255,0)',
    ]);
    this.particleTexture = ThreeCore.createRadialTexture([
      'rgba(255,255,255,1)',
      'rgba(159,180,255,0.5)',
      'rgba(159,180,255,0)',
    ]);

    this.buildCore();
    this.buildWireframes();
    this.buildRings();
    this.buildNodesAndLines();
    this.buildPackets();
    this.buildParticles();
  }

  private buildCore(): void {
    // Faceted outer shell.
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0a0e1f,
        emissive: ACCENT,
        emissiveIntensity: 0.6,
        metalness: 0.65,
        roughness: 0.3,
        flatShading: true,
      }),
    );
    this.group.add(shell);

    // Bright pulsing inner core.
    this.innerMaterial = new THREE.MeshStandardMaterial({
      color: ACCENT_BRIGHT,
      emissive: ACCENT_BRIGHT,
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.15,
      fog: false,
    });
    this.innerCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), this.innerMaterial);
    this.group.add(this.innerCore);

    // Fresnel rim shell — one cheap shader for a premium atmospheric edge.
    this.fresnelMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: ACCENT_BRIGHT },
        uPower: { value: 3.2 },
        uIntensity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uIntensity;
        void main() {
          float f = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
          gl_FragColor = vec4(uColor, f * uIntensity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 48, 48), this.fresnelMaterial));

    // Additive glow sprite halo.
    this.glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture!,
        color: ACCENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.glowSprite.scale.setScalar(6.5);
    this.group.add(this.glowSprite);
  }

  private buildWireframes(): void {
    const layers = [
      { r: 1.85, detail: 2, opacity: 0.12 },
      { r: 1.45, detail: 1, opacity: 0.07 },
    ];
    for (const l of layers) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(l.r, l.detail),
        new THREE.MeshBasicMaterial({
          color: ACCENT,
          wireframe: true,
          transparent: true,
          opacity: l.opacity,
        }),
      );
      this.group.add(mesh);
      this.wireframes.push(mesh);
    }
  }

  private buildRings(): void {
    const defs = [
      {
        r: 2.45,
        tube: 0.013,
        opacity: 0.5,
        rot: new THREE.Vector3(Math.PI / 2, 0, 0),
        speed: new THREE.Vector3(0, 0, 0.16),
      },
      {
        r: 2.95,
        tube: 0.008,
        opacity: 0.32,
        rot: new THREE.Vector3(Math.PI / 2.6, Math.PI / 5, 0),
        speed: new THREE.Vector3(0.04, 0, -0.11),
      },
      {
        r: 2.1,
        tube: 0.012,
        opacity: 0.36,
        rot: new THREE.Vector3(Math.PI / 3, -Math.PI / 4, 0),
        speed: new THREE.Vector3(-0.07, 0.05, 0),
      },
    ];

    for (const d of defs) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, d.tube, 16, 140),
        new THREE.MeshBasicMaterial({
          color: ACCENT_BRIGHT,
          transparent: true,
          opacity: d.opacity,
        }),
      );
      mesh.rotation.set(d.rot.x, d.rot.y, d.rot.z);
      this.group.add(mesh);
      this.rings.push({ mesh, speed: d.speed, offset: d.rot.clone() });
    }
  }

  private buildNodesAndLines(): void {
    const count = this.config.nodeCount;
    const radius = 2.25;
    const nodeGeo = new THREE.SphereGeometry(0.042, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: ACCENT_BRIGHT });
    const linePositions: number[] = [];

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere → even, organic spread.
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const base = new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi),
      );

      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(base);
      this.group.add(mesh);

      this.nodes.push({
        mesh,
        base,
        phase: (i / count) * Math.PI * 2,
        speed: 0.6 + (i % 3) * 0.18,
        hl: 0,
      });
      linePositions.push(base.x, base.y, base.z, 0, 0, 0);
    }

    if (this.config.connections) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(linePositions), 3),
      );
      this.lineMaterial = new THREE.LineBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.13,
      });
      this.lines = new THREE.LineSegments(lineGeo, this.lineMaterial);
      this.group.add(this.lines);
    }
  }

  /** Glowing pulses that travel node → core along the links. */
  private buildPackets(): void {
    for (let i = 0; i < this.config.packetCount; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture!,
        color: ACCENT_BRIGHT,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.32);
      this.group.add(sprite);
      this.packets.push({
        sprite,
        material,
        nodeIndex: this.pickPacketNode(),
        t: 0,
        dur: 0.9 + Math.random() * 0.8,
        delay: Math.random() * 1.5,
      });
    }
  }

  private pickPacketNode(): number {
    if (this.highlightTag !== null) {
      const matches: number[] = [];
      for (let i = 0; i < this.nodes.length; i++) {
        if (i % TAG_COUNT === this.highlightTag) matches.push(i);
      }
      if (matches.length) return matches[Math.floor(Math.random() * matches.length)];
    }
    return Math.floor(Math.random() * Math.max(1, this.nodes.length));
  }

  private buildParticles(): void {
    const count = this.config.particleCount;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 4.5;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(p) * Math.cos(t);
      positions[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      positions[i * 3 + 2] = r * Math.cos(p);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: ACCENT,
        size: this.tier === 'mobile' ? 0.05 : 0.038,
        map: this.particleTexture!,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.particles);
  }

  /* --------------------------- public API -------------------------- */

  /** Light up the node cluster mapped to a capability tag (null = clear). */
  highlight(tagIndex: number | null): void {
    this.highlightTag = tagIndex;
    if (this.reducedMotion) this.renderFrame();
  }

  /* ---------------------------- events ----------------------------- */

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.config.parallax) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    }
  }

  private onResize = (): void => {
    this.setSize();
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const next = ThreeCore.detectTier();
      if (next !== this.tier) {
        const hadParallax = this.config.parallax;
        this.tier = next;
        this.config = ThreeCore.tierConfig(next);
        this.rebuild();
        if (hadParallax !== this.config.parallax) {
          if (this.config.parallax) {
            window.addEventListener('pointermove', this.onPointerMove, { passive: true });
          } else {
            window.removeEventListener('pointermove', this.onPointerMove);
            this.parallaxTarget.set(0, 0);
          }
        }
      }
      if (this.reducedMotion) this.renderFrame();
    }, 250);
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.parallaxTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1,
    );
  };

  /** Pause the loop while the tab is hidden; resume without a time jump. */
  private onVisibility = (): void => {
    if (this.reducedMotion || this.disposed) return;
    if (document.hidden) {
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.pausedAt = performance.now();
      }
    } else if (this.raf === 0) {
      this.startTime += performance.now() - this.pausedAt;
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private setSize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.pixelRatioCap));
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Tear down scene contents and rebuild for the current tier. */
  private rebuild(): void {
    this.disposeSceneContents();
    this.wireframes = [];
    this.rings = [];
    this.nodes = [];
    this.lines = null;
    this.lineMaterial = null;
    this.packets = [];
    this.introProgress = 0;
    this.focus = 0;
    this.camera.position.set(0, 0, 9);
    this.buildScene();
    this.setSize();
  }

  /* ------------------------------ loop ----------------------------- */

  /** Begin animating. With reduced motion, render one static frame instead. */
  start(): void {
    if (this.reducedMotion) {
      this.group.scale.setScalar(this.config.baseScale);
      this.renderFrame();
      return;
    }
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const t = (now - this.startTime) / 1000;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp tab-switch spikes
    this.lastTime = now;
    this.update(t, dt);
    this.renderFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private update(t: number, dt: number): void {
    // Entrance scale-in (self-contained, no GSAP dependency).
    if (this.introProgress < 1) {
      this.introProgress = Math.min(1, this.introProgress + dt / 1.3);
      const e = 1 - Math.pow(1 - this.introProgress, 3); // easeOutCubic
      this.group.scale.setScalar(this.config.baseScale * (0.74 + 0.26 * e));
    }

    // Gentle float.
    this.group.position.y = this.config.offset.y + Math.sin(t * 0.55) * 0.13;

    // Slow base rotation + desktop parallax.
    const baseRotY = t * 0.045;
    const baseRotX = Math.sin(t * 0.22) * 0.05;
    if (this.config.parallax) {
      this.parallax.lerp(this.parallaxTarget, 0.05);
      this.group.rotation.y = baseRotY + this.parallax.x * 0.4;
      this.group.rotation.x = baseRotX - this.parallax.y * 0.24;
      // Subtle camera move adds parallax depth without recentering the core.
      this.camera.position.x += (this.parallax.x * 0.4 - this.camera.position.x) * 0.05;
      this.camera.position.y += (-this.parallax.y * 0.3 - this.camera.position.y) * 0.05;
      // Cursor proximity → the core "wakes up".
      this.tmp.copy(this.group.position).project(this.camera);
      const dist = Math.hypot(
        this.parallaxTarget.x - this.tmp.x,
        this.parallaxTarget.y - this.tmp.y,
      );
      this.focus += (Math.max(0, 1 - dist / 1.0) - this.focus) * 0.06;
    } else {
      this.group.rotation.y = baseRotY;
      this.group.rotation.x = baseRotX;
    }

    for (const ring of this.rings) {
      ring.mesh.rotation.x = ring.offset.x + t * ring.speed.x;
      ring.mesh.rotation.y = ring.offset.y + t * ring.speed.y;
      ring.mesh.rotation.z = ring.offset.z + t * ring.speed.z;
    }

    // Counter-rotating wireframe shells.
    this.wireframes[0].rotation.set(t * 0.03, -t * 0.07, 0);
    if (this.wireframes[1]) this.wireframes[1].rotation.set(-t * 0.05, t * 0.06, 0);

    // Inner core + fresnel + halo pulse (shared phase), boosted by focus.
    const s = Math.sin(t * 1.5);
    this.innerCore.scale.setScalar(1 + s * 0.05);
    this.innerMaterial.emissiveIntensity = 1.5 + s * 0.4 + this.focus * 0.6;
    this.fresnelMaterial.uniforms.uIntensity.value = 0.9 + s * 0.2 + this.focus * 0.5;
    this.glowSprite.scale.setScalar(6.5 + s * 0.25 + this.focus * 0.7);
    if (this.lineMaterial) this.lineMaterial.opacity = 0.13 + this.focus * 0.12;

    // Floating nodes + highlight + live connecting lines.
    const linePos = this.lines?.geometry.getAttribute('position') as
      THREE.BufferAttribute | undefined;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const x = n.base.x + Math.cos(t * n.speed * 0.7 + n.phase) * 0.08;
      const y = n.base.y + Math.sin(t * n.speed + n.phase) * 0.12;
      n.mesh.position.set(x, y, n.base.z);

      const target = this.highlightTag !== null && i % TAG_COUNT === this.highlightTag ? 1 : 0;
      n.hl += (target - n.hl) * Math.min(1, dt * 9);
      n.mesh.scale.setScalar(1 + n.hl * 1.6);

      if (linePos) {
        linePos.setXYZ(i * 2, x, y, n.base.z);
        linePos.setXYZ(i * 2 + 1, 0, 0, 0);
      }
    }
    if (linePos) linePos.needsUpdate = true;

    // Data packets traveling node → core.
    for (const p of this.packets) {
      if (p.delay > 0) {
        p.delay -= dt;
        p.material.opacity = 0;
        continue;
      }
      p.t += dt / p.dur;
      if (p.t >= 1) {
        p.t = 0;
        p.delay = 0.3 + Math.random() * 1.6;
        p.nodeIndex = this.pickPacketNode();
        p.material.opacity = 0;
        continue;
      }
      const node = this.nodes[p.nodeIndex];
      if (!node) continue;
      const te = p.t * p.t * (3 - 2 * p.t); // smoothstep
      p.sprite.position.copy(node.mesh.position).multiplyScalar(1 - te);
      p.material.opacity = Math.sin(p.t * Math.PI) * 0.9;
    }

    // Drifting particle field.
    this.particles.rotation.y = t * 0.018;
    this.particles.rotation.x = t * 0.009;
  }

  private renderFrame(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /* ---------------------------- teardown --------------------------- */

  private disposeSceneContents(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh> & { material?: THREE.Material | THREE.Material[] };
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.glowTexture?.dispose();
    this.particleTexture?.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.disposeSceneContents();
    this.renderer.dispose();
  }

  /* ----------------------------- utils ----------------------------- */

  /** Soft radial gradient texture generated on a canvas (no external asset). */
  private static createRadialTexture(stops: string[]): THREE.Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const n = stops.length;
    stops.forEach((color, i) => grad.addColorStop(i / (n - 1), color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
