// Canlı 3D veri sahnesi (three.js): ağ, bar, yörünge, piramit, döngü, akış.
// Marka dili: düz (flat) yüzey + ince kenar çizgisi, gradient/gölge yok. Sürükleyerek döndürülebilir.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SSlide } from './types';
import Figure from './Figure';

type Visual = SSlide['visual'];

function css(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function labelSprite(text: string, colors: { bg: string; fg: string; line: string }, scale = 1) {
  const s = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const fs = 44;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(s).width) + 56;
  const h = fs + 34;
  c.width = w; c.height = h;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const r = h / 2;
  ctx.fillStyle = colors.bg;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, r - 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = colors.fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, 28, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const k = 0.0065 * scale;
  sp.scale.set(w * k, h * k, 1);
  sp.renderOrder = 10;
  return sp;
}

function withEdges(mesh: THREE.Mesh, color: string, opacity = 0.55) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  mesh.add(e);
  return mesh;
}

function arrow(from: THREE.Vector3, to: THREE.Vector3, color: string) {
  const g = new THREE.Group();
  const dir = to.clone().sub(from);
  const len = dir.length();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to.clone().sub(dir.clone().normalize().multiplyScalar(0.22))]), new THREE.LineBasicMaterial({ color }));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 12), new THREE.MeshBasicMaterial({ color }));
  cone.position.copy(to.clone().sub(dir.clone().normalize().multiplyScalar(0.12)));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.add(line, cone);
  if (len < 0.01) g.visible = false;
  return g;
}

export default function Scene3D({ visual, themeKey, className }: { visual: Visual; themeKey: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return;
    }
    const C = {
      brand: css('--c-brand', '#4338CA'), gold: css('--c-gold', '#DCA037'), ink: css('--c-ink', '#121619'),
      night: css('--c-night', '#0D1A26'), surface: css('--c-surface', '#FFFFFF'), line: css('--c-line-strong', '#C4CCC8'), ink3: css('--c-ink-3', '#7C8891'),
    };
    const lbl = { bg: C.surface, fg: C.ink, line: C.line };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 2.4, 9);
    camera.lookAt(0, 0.2, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1);
    dl.position.set(3, 6, 5);
    scene.add(dl);

    const root = new THREE.Group();
    scene.add(root);
    const labels = visual.labels.slice(0, 7);
    const n = labels.length;
    const flat = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const anim: ((t: number) => void)[] = [];

    switch (visual.type) {
      case 'bars': {
        const vals = visual.values?.length ? visual.values : labels.map((_, i) => 40 + ((i * 37) % 55));
        const span = Math.min(7, n * 1.25);
        const grid = new THREE.GridHelper(span + 1.5, 8, C.line, C.line);
        (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.5;
        root.add(grid);
        labels.forEach((l, i) => {
          const h = 0.4 + ((vals[i] ?? 50) / 100) * 3.2;
          const m = withEdges(new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), flat(i === 0 ? C.gold : C.brand)), C.ink, 0.35);
          const x = -span / 2 + (i + 0.5) * (span / n);
          m.position.set(x, h / 2, 0);
          root.add(m);
          const sp = labelSprite(l, lbl, 0.8); sp.position.set(x, -0.45, 0.6); root.add(sp);
          const v = labelSprite(`${Math.round(vals[i] ?? 50)}`, { bg: C.night, fg: '#F5D9A0', line: C.night }, 0.6); v.position.set(x, h + 0.35, 0); root.add(v);
          anim.push((t) => { const k = Math.min(1, t / 900 - i * 0.08); m.scale.y = Math.max(0.01, 1 - Math.pow(1 - Math.max(0, k), 3)); m.position.y = (h * m.scale.y) / 2; });
        });
        root.position.y = -1.2;
        break;
      }
      case 'pyramid': {
        const k = Math.min(5, n);
        for (let i = 0; i < k; i++) {
          const r0 = 2.6 - i * (2.0 / k), r1 = 2.6 - (i + 1) * (2.0 / k);
          const m = withEdges(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 0.62, 4, 1), flat(i === k - 1 ? C.gold : i % 2 ? C.surface : C.brand)), C.ink, 0.4);
          m.rotation.y = Math.PI / 4;
          m.position.y = -1.6 + i * 0.68;
          root.add(m);
          const sp = labelSprite(labels[i], lbl, 0.85); sp.position.set(r0 + 1.1, m.position.y, 0); root.add(sp);
        }
        break;
      }
      case 'orbit': {
        const sun = withEdges(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), flat(C.gold)), C.ink, 0.3);
        root.add(sun);
        const t0 = labelSprite(visual.title, { bg: C.night, fg: '#F5D9A0', line: C.night }, 0.8); t0.position.set(0, 1.15, 0); root.add(t0);
        labels.forEach((l, i) => {
          const R = 1.6 + i * 0.55;
          const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos((k / 96) * Math.PI * 2) * R, 0, Math.sin((k / 96) * Math.PI * 2) * R))), new THREE.LineBasicMaterial({ color: C.line }));
          root.add(ring);
          const p = new THREE.Group();
          const planet = withEdges(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 0), flat(C.brand)), C.ink, 0.3);
          const sp = labelSprite(l, lbl, 0.7); sp.position.y = 0.45;
          p.add(planet, sp);
          root.add(p);
          const speed = 0.00035 / (1 + i * 0.35), ph = (i / n) * Math.PI * 2;
          anim.push((t) => { const a = ph + t * speed; p.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); });
        });
        root.rotation.x = 0.35;
        break;
      }
      case 'cycle': {
        const R = 2.4;
        const pts = labels.map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R * 0.75, 0); });
        pts.forEach((p, i) => {
          const m = withEdges(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24), flat(i === 0 ? C.gold : C.surface)), C.ink, 0.5);
          m.rotation.x = Math.PI / 2; m.position.copy(p); root.add(m);
          const sp = labelSprite(labels[i], lbl, 0.75); sp.position.copy(p.clone().multiplyScalar(1.38)); root.add(sp);
          const q = pts[(i + 1) % n];
          const mid = p.clone().add(q).multiplyScalar(0.5).multiplyScalar(1.18);
          const curve = new THREE.QuadraticBezierCurve3(p, mid, q);
          const cp = curve.getPoints(24);
          root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cp.slice(3, 21)), new THREE.LineBasicMaterial({ color: C.brand })));
          root.add(arrow(cp[19], cp[21], C.brand));
        });
        const token = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: C.gold }));
        root.add(token);
        anim.push((t) => { const u = (t * 0.00018) % 1; const a = u * Math.PI * 2 - Math.PI / 2; token.position.set(Math.cos(a) * R * 1.0, Math.sin(a) * R * 0.75, 0.2); });
        break;
      }
      case 'flow': {
        const step = Math.min(1.9, 8 / Math.max(1, n));
        const pts = labels.map((_, i) => new THREE.Vector3(-((n - 1) * step) / 2 + i * step, i % 2 ? -0.5 : 0.5, i % 2 ? 0.6 : -0.6));
        pts.forEach((p, i) => {
          const m = withEdges(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.55), flat(i === 0 ? C.gold : i === n - 1 ? C.night : C.surface)), C.ink, 0.5);
          m.position.copy(p); root.add(m);
          const sp = labelSprite(labels[i], lbl, 0.75); sp.position.set(p.x, p.y + (i % 2 ? -0.75 : 0.75), p.z); root.add(sp);
          if (i < n - 1) root.add(arrow(p.clone().add(new THREE.Vector3(0.5, 0, 0)), pts[i + 1].clone().add(new THREE.Vector3(-0.5, 0, 0)), C.brand));
        });
        const token = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: C.gold }));
        root.add(token);
        anim.push((t) => { const u = ((t * 0.00025) % 1) * (n - 1); const i = Math.floor(u); const f = u - i; if (pts[i + 1]) token.position.lerpVectors(pts[i], pts[i + 1], f); });
        break;
      }
      default: { // network
        const center = withEdges(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), flat(C.night)), C.gold, 0.6);
        root.add(center);
        const c0 = labelSprite(labels[0], { bg: C.night, fg: '#F5D9A0', line: C.night }, 0.85); c0.position.set(0, 0.95, 0); root.add(c0);
        const rest = labels.slice(1);
        const pts = rest.map((_, i) => {
          const y = 1 - (i / Math.max(1, rest.length - 1)) * 2;
          const r = Math.sqrt(1 - y * y);
          const th = i * 2.399963;
          return new THREE.Vector3(Math.cos(th) * r * 2.2, y * 1.4, Math.sin(th) * r * 2.2);
        });
        const lm = new THREE.LineBasicMaterial({ color: C.line });
        pts.forEach((p, i) => {
          root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]), lm));
          if (i > 0) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[i - 1], p]), new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: 0.45 })));
          const m = withEdges(new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), flat(i % 2 ? C.brand : C.gold)), C.ink, 0.3);
          m.position.copy(p); root.add(m);
          const sp = labelSprite(rest[i], lbl, 0.75); sp.position.copy(p).add(new THREE.Vector3(0, 0.45, 0)); root.add(sp);
          anim.push((t) => { m.scale.setScalar(1 + Math.sin(t * 0.002 + i) * 0.06); });
        });
      }
    }

    // Etkileşim: sürükle → döndür; bırakınca yavaş otomatik dönüş
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let drag: { x: number; y: number; ry: number; rx: number } | null = null;
    let idleSince = performance.now();
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, ry: root.rotation.y, rx: root.rotation.x }; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      root.rotation.y = drag.ry + (e.clientX - drag.x) * 0.008;
      root.rotation.x = Math.max(-0.6, Math.min(0.9, drag.rx + (e.clientY - drag.y) * 0.005));
    };
    const up = () => { drag = null; idleSince = performance.now(); };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.position.z = w / h < 0.8 ? 14 : w / h < 1.1 ? 12.5 : 9.5;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = now - t0;
      if (!reduce) anim.forEach((f) => f(t));
      else anim.forEach((f) => f(100000));
      if (!drag && !reduce && now - idleSince > 1200) root.rotation.y += 0.0022;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => { (mt as THREE.SpriteMaterial).map?.dispose(); mt.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [visual, themeKey]);

  if (failed) return <div className={className}><Figure v={visual} /></div>;
  return <div ref={host} className={className} aria-label={visual.title} role="img" />;
}
