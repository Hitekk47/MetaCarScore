"use client";

import { useEffect, useRef } from "react";

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

    // Brand blue
    const R = 37, G = 99, B = 235;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = 0;
    const t0 = performance.now();

    // ---- Dot count ---------------------------------------------------------
    const DOT_COUNT = 280; // sparse enough to stay minimal

    // ---- 3-D surface params ------------------------------------------------
    const TILT       = 0.45;
    const WAVE_AMP   = 0.06;
    const WAVE_FREQ  = 1.8;
    const WAVE_SPEED = 0.18;

    // ---- Depth fog ---------------------------------------------------------
    const FOG_NEAR = 0.90;
    const FOG_FAR  = 0.08;

    // ---- Visual style ------------------------------------------------------
    const DOT_MIN_R  = 0.8;
    const DOT_MAX_R  = 2.2;
    const DOT_ALPHA  = 0.55;
    const LINE_ALPHA = 0.10;
    const NEIGHBORS  = 3; // closest neighbors to connect per dot

    type Dot = {
      surfU: number;  // [0,1] random position along surface X
      surfV: number;  // [0,1] random position along surface Z (depth)
      sizeT: number;  // [0,1] random size jitter
    };

    let dots: Dot[] = [];

    const buildDots = () => {
      dots = [];
      for (let i = 0; i < DOT_COUNT; i++) {
        dots.push({
          surfU: Math.random(),
          surfV: Math.random(),
          sizeT: Math.random(),
        });
      }
    };

    // ---- Project surface UV + wave height to canvas XY --------------------
    const project = (
      surfU: number,
      surfV: number,
      waveZ: number,
      w: number,
      h: number
    ) => {
      const padX = w * 0.05;
      const x = padX + surfU * (w - padX * 2);

      const surfTop  = h * 0.18;
      const surfBase = h * 0.82;
      const surfH    = surfBase - surfTop;

      const perspScale = 0.45 + 0.55 * surfV;
      const baseY = surfTop + surfV * surfH;
      const waveOffsetY = waveZ * surfH * WAVE_AMP * perspScale;
      const y = baseY + waveOffsetY;

      return { x, y, depth: surfV };
    };

    // ---- Screen position for a dot at time t --------------------------------
    const dotPosition = (d: Dot, t: number, w: number, h: number) => {
      const phase =
        d.surfU * Math.PI * 2 * WAVE_FREQ - t * WAVE_SPEED;
      const waveZ =
        Math.sin(phase) * 0.65 +
        Math.sin(
          d.surfU * Math.PI * 1.1 * WAVE_FREQ +
          d.surfV * Math.PI * 0.9 -
          t * WAVE_SPEED * 0.7
        ) * 0.35;
      return project(d.surfU, d.surfV, waveZ, w, h);
    };

    // ---- Fog ---------------------------------------------------------------
    const fogAlpha = (depth: number, base: number) =>
      base * (FOG_FAR + (FOG_NEAR - FOG_FAR) * depth);

    // ---- Resize ------------------------------------------------------------
    const resize = () => {
      dpr    = Math.min(window.devicePixelRatio || 1, 2);
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    // ---- Draw loop ---------------------------------------------------------
    const draw = () => {
      const t = prefersReducedMotion ? 0 : (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Pre-compute all screen positions for this frame
      const pos = dots.map(d => dotPosition(d, t, width, height));

      // --- Lines: proximity rule — connect each dot to its NEIGHBORS closest --
      for (let i = 0; i < dots.length; i++) {
        const { x: x1, y: y1, depth: dep1 } = pos[i];

        // Compute squared screen-space distances to all other dots
        const dists: { j: number; d2: number }[] = [];
        for (let j = 0; j < dots.length; j++) {
          if (j === i) continue;
          const dx = pos[j].x - x1;
          const dy = pos[j].y - y1;
          dists.push({ j, d2: dx * dx + dy * dy });
        }

        // Sort by distance, take the N closest
        dists.sort((a, b) => a.d2 - b.d2);
        const nearest = dists.slice(0, NEIGHBORS);

        for (const { j } of nearest) {
          // Only draw each line once (when i < j)
          if (j <= i) continue;
          const { x: x2, y: y2, depth: dep2 } = pos[j];
          const alpha = fogAlpha((dep1 + dep2) / 2, LINE_ALPHA);
          ctx.strokeStyle = `rgba(${R},${G},${B},${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // --- Dots -------------------------------------------------------------
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const { x, y, depth } = pos[i];
        const r       = DOT_MIN_R + d.sizeT * (DOT_MAX_R - DOT_MIN_R);
        const rScaled = r * (0.6 + 0.4 * depth);
        const alpha   = fogAlpha(depth, DOT_ALPHA);

        ctx.fillStyle = `rgba(${R},${G},${B},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, rScaled, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
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
