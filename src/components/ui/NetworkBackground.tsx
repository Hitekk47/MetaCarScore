"use client";

import { useEffect, useRef } from "react";

/**
 * Animated 3D "digital terrain" background.
 *
 * Dots are laid out on a structured grid (parallel rows and columns) and
 * connected only to their immediate neighbours, forming a clean mesh — not a
 * sparse plexus. A layered sine height-field displaces each node vertically,
 * and a simple perspective projection makes the surface undulate and flow like
 * 3D terrain / digital waves. Sits fixed behind all page content.
 */
export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Brand palette (matches #2563eb).
    const BLUE = "37, 99, 235";

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let animationId = 0;
    let startTime = performance.now();

    // Per-node static data (size jitter) indexed [j * cols + i].
    let sizeJitter: number[] = [];

    // Reused per-frame projection buffers.
    let sx: number[] = [];
    let sy: number[] = [];
    let sScale: number[] = [];

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const buildGrid = () => {
      // Density scales with viewport, capped for performance.
      cols = Math.min(64, Math.max(26, Math.round(width / 26)));
      rows = 34;
      sizeJitter = new Array(cols * rows);
      for (let n = 0; n < cols * rows; n++) {
        sizeJitter[n] = 0.7 + Math.random() * 0.8; // 0.7 - 1.5
      }
      sx = new Array(cols * rows);
      sy = new Array(cols * rows);
      sScale = new Array(cols * rows);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    // Layered sine height-field → the terrain "waves".
    const terrain = (u: number, v: number, time: number) => {
      const px = u * Math.PI * 4; // ~2 wave crests across the width
      const pz = v * Math.PI * 3; // depth-wise variation
      return (
        Math.sin(px * 1.0 + time * 0.6 + pz * 0.8) +
        0.6 * Math.sin(px * 1.7 - time * 0.9 + pz * 1.3) +
        0.4 * Math.sin(px * 0.5 + time * 0.4 - pz * 2.1)
      );
    };

    const draw = () => {
      const time = prefersReducedMotion
        ? 0
        : (performance.now() - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Projection tunables (all derived from viewport for responsiveness).
      const overscan = 1.3; // near-edge grid spans 130% of width
      const halfSpan = (width * overscan) / 2;
      const scaleNear = 1.0;
      const scaleFar = 0.5;
      const bandBottom = height * 0.98; // near row baseline (bottom)
      const bandTop = height * 0.16; // far row baseline (near horizon)
      const amp = height * 0.06; // wave amplitude in px
      const cx = width / 2;

      // 1) Project every node into screen space.
      for (let j = 0; j < rows; j++) {
        const v = j / (rows - 1); // 0 near → 1 far
        const eased = Math.pow(v, 1.7); // perspective compression toward horizon
        const scale = lerp(scaleNear, scaleFar, v);
        const baseY = lerp(bandBottom, bandTop, eased);
        for (let i = 0; i < cols; i++) {
          const u = i / (cols - 1); // 0 → 1 across
          const gx = (u - 0.5) * 2 * halfSpan; // centered world x
          const h = terrain(u, v, time) * amp;
          const idx = j * cols + i;
          sx[idx] = cx + gx * scale;
          sy[idx] = baseY - h * scale;
          sScale[idx] = scale;
        }
      }

      // 2) Draw neighbour connections (rows + columns) → grid mesh.
      ctx.lineWidth = 0.8;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const fade = lerp(0.16, 0.03, j / (rows - 1)); // depth fog
          // Horizontal segment → right neighbour.
          if (i < cols - 1) {
            const r = idx + 1;
            ctx.strokeStyle = `rgba(${BLUE}, ${fade})`;
            ctx.beginPath();
            ctx.moveTo(sx[idx], sy[idx]);
            ctx.lineTo(sx[r], sy[r]);
            ctx.stroke();
          }
          // Vertical segment → row behind.
          if (j < rows - 1) {
            const d = idx + cols;
            ctx.strokeStyle = `rgba(${BLUE}, ${fade})`;
            ctx.beginPath();
            ctx.moveTo(sx[idx], sy[idx]);
            ctx.lineTo(sx[d], sy[d]);
            ctx.stroke();
          }
        }
      }

      // 3) Draw dots with depth-scaled size and fog alpha.
      for (let j = 0; j < rows; j++) {
        const dotFade = lerp(0.55, 0.12, j / (rows - 1));
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const radius = (1.1 + sizeJitter[idx]) * sScale[idx];
          ctx.fillStyle = `rgba(${BLUE}, ${dotFade})`;
          ctx.beginPath();
          ctx.arc(sx[idx], sy[idx], radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReducedMotion) {
        animationId = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
