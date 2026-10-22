"use client";

import { useEffect, useRef } from "react";

/**
 * Three.js hero canvas — icosahedron wireframe + particle cloud + torus ring.
 * Matches the demo HTML exactly.
 */
export function AuthHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup = false;

    // Dynamically load three.js from CDN (keeps bundle size zero)
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => {
      if (cleanup || !canvas) return;
      const T = (window as any).THREE;
      if (!T) return;

      const W = canvas.clientWidth || 300;
      const H = canvas.clientHeight || 300;

      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H, false);

      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.z = 8;

      const group = new T.Group();
      scene.add(group);

      // Icosahedron wireframe
      group.add(
        new T.LineSegments(
          new T.WireframeGeometry(new T.IcosahedronGeometry(2, 2)),
          new T.LineBasicMaterial({ color: 0x090c0b, transparent: true, opacity: 0.4 }),
        ),
      );

      // Particle cloud
      const n   = 300;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1;
        const t = Math.random() * 6.283;
        const q = Math.sqrt(1 - u * u);
        const d = 2.4 + Math.random() * 1.6;
        pos.set([d * q * Math.cos(t), d * u, d * q * Math.sin(t)], i * 3);
      }
      const pg = new T.BufferGeometry();
      pg.setAttribute("position", new T.BufferAttribute(pos, 3));
      group.add(new T.Points(pg, new T.PointsMaterial({ color: 0x13826f, size: 0.09 })));

      // Torus ring
      const ring = new T.Mesh(
        new T.TorusGeometry(2.3, 0.025, 8, 64),
        new T.MeshBasicMaterial({ color: 0x1fa593 }),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      let mx = 0, my = 0, tick = 0;
      const onMove = (e: PointerEvent) => {
        mx = e.clientX / innerWidth  - 0.5;
        my = e.clientY / innerHeight - 0.5;
      };
      addEventListener("pointermove", onMove);

      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

      const animate = () => {
        if (cleanup || !document.body.contains(canvas)) {
          removeEventListener("pointermove", onMove);
          renderer.dispose();
          renderer.forceContextLoss();
          return;
        }
        tick += 0.01;
        group.rotation.y = tick * 0.6 + mx;
        group.rotation.x = 0.3 + my * 0.5;
        ring.position.y  = Math.sin(tick * 2) * 2;
        const s = Math.sqrt(Math.max(0.05, 1 - Math.pow(ring.position.y / 2.3, 2)));
        ring.scale.setScalar(s);
        renderer.render(scene, camera);
        if (!still) requestAnimationFrame(animate);
      };
      animate();
    };
    document.head.appendChild(script);

    return () => {
      cleanup = true;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
