"use client";

import { useEffect, useRef } from "react";

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false }); // Minor perf boost if background is solid, but left as default transparent below
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Brand blue (stored as strings for faster rendering)
    const COLOR_RGB = "37,99,235";

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = 0;
    const t0 = performance.now();

    // ---- Parameters --------------------------------------------------------
    const DOT_COUNT = 280;
    const TILT = 0.45;
    const WAVE_AMP = 0.06;
    const WAVE_FREQ = 1.8;
    const WAVE_SPEED = 0.18;
    const FOG_NEAR = 0.90;
    const FOG_FAR = 0.08;
    const DOT_MIN_R = 0.8;
    const DOT_MAX_R = 2.2;
    const DOT_ALPHA = 0.55;
    const LINE_ALPHA = 0.10;
    const NEIGHBORS = 3;

    type Dot = {
      surfU: number;
      surfV: number;
      sizeT: number;
    };

    type Connection = {
      a: number;
      b: number;
    };

    let dots: Dot[] = [];
    let connections: Connection[] = [];

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

      const surfTop = h * 0.18;
      const surfBase = h * 0.82;
      const surfH = surfBase - surfTop;

      const perspScale = 0.45 + 0.55 * surfV;
      const baseY = surfTop + surfV * surfH;
      const waveOffsetY = waveZ * surfH * WAVE_AMP * perspScale;
      const y = baseY + waveOffsetY;

      return { x, y, depth: surfV };
    };

    // ---- Screen position for a dot at time t --------------------------------
    const dotPosition = (d: Dot, t: number, w: number, h: number) => {
      const phase = d.surfU * Math.PI * 2 * WAVE_FREQ - t * WAVE_SPEED;
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

    // ---- Initialize --------------------------------------------------------
    const buildDotsAndConnections = () => {
      // 1. Generate random dots
      dots = [];
      for (let i = 0; i < DOT_COUNT; i++) {
        dots.push({
          surfU: Math.random(),
          surfV: Math.random(),
          sizeT: Math.random(),
        });
      }

      // 2. Pre-calculate connections based on initial positions (t=0)
      // This happens ONCE per resize, not 60 times a second!
      const initialPos = dots.map((d) => dotPosition(d, 0, width, height));
      const connectionSet = new Set<string>();

      for (let i = 0; i < dots.length; i++) {
        const { x: x1, y: y1 } = initialPos[i];
        const dists: { j: number; d2: number }[] = [];

        for (let j = 0; j < dots.length; j++) {
          if (j === i) continue;
          const dx = initialPos[j].x - x1;
          const dy = initialPos[j].y - y1;
          dists.push({ j, d2: dx * dx + dy * dy });
        }

        // Sort just this once to find neighbors
        dists.sort((a, b) => a.d2 - b.d2);
        const nearest = dists.slice(0, NEIGHBORS);

        // Deduplicate lines (so A->B and B->A only generate one line)
        for (const { j } of nearest) {
          const min = Math.min(i, j);
          const max = Math.max(i, j);
          connectionSet.add(`${min},${max}`);
        }
      }

      connections = Array.from(connectionSet).map((str) => {
        const [a, b] = str.split(",").map(Number);
        return { a, b };
      });
    };

    // ---- Resize ------------------------------------------------------------
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      buildDotsAndConnections(); // Rebuild web on resize
    };

    // ---- Draw loop ---------------------------------------------------------
    const draw = () => {
      const t = prefersReducedMotion ? 0 : (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, width, height);

      // Calculate positions for this frame
      const pos = dots.map((d) => dotPosition(d, t, width, height));

      // --- Draw Pre-calculated Lines ---
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = `rgb(${COLOR_RGB})`;

      for (let i = 0; i < connections.length; i++) {
        const { a, b } = connections[i];
        const p1 = pos[a];
        const p2 = pos[b];

        const alpha = fogAlpha((p1.depth + p2.depth) / 2, LINE_ALPHA);

        ctx.globalAlpha = alpha; // Faster than recreating RGBA strings per line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // --- Draw Dots ---
      ctx.fillStyle = `rgb(${COLOR_RGB})`;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const { x, y, depth } = pos[i];

        const r = DOT_MIN_R + d.sizeT * (DOT_MAX_R - DOT_MIN_R);
        const rScaled = r * (0.6 + 0.4 * depth);
        const alpha = fogAlpha(depth, DOT_ALPHA);

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, rScaled, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset global alpha just in case
      ctx.globalAlpha = 1;

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