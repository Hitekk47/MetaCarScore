"use client";

import { useEffect, useRef } from "react";

/**
 * Minimalist 3D-surface plexus background.
 *
 * Dots are placed on a tilted, gently-undulating surface (like a calm ocean
 * swell seen from a slight elevation). A slow, low-amplitude wave rolls across
 * it over time. Depth fog fades far dots to near-invisible. Faint connecting
 * lines (≤10 % opacity) are drawn only between the closest neighbours,
 * preserving the delicate geometric plexus feel.
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

    // Brand blue RGB
    const R = 37, G = 99, B = 235;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = 0;
    const t0 = performance.now();

    // ---- Grid params -------------------------------------------------------
    // Logical 3-D grid dimensions (columns × rows). Keep sparse.
    const COLS = 22;
    const ROWS = 14;

    // 3-D surface tilt: how much we compress the Y axis to fake perspective.
    // 0 = flat top-down, 1 = fully side-on.
    const TILT = 0.45;

    // Wave: very gentle, slow rolling swell.
    const WAVE_AMP   = 0.06;  // fraction of logical surface height
    const WAVE_FREQ  = 1.8;   // spatial frequency (cycles across surface)
    const WAVE_SPEED = 0.18;  // radians / second — very slow

    // Depth fog: dots at depth 0 (far edge) are almost invisible.
    const FOG_NEAR = 0.90;  // max alpha multiplier at nearest row
    const FOG_FAR  = 0.08;  // min alpha multiplier at farthest row

    // Visual style — ultra-minimal.
    const DOT_MIN_R  = 0.8;
    const DOT_MAX_R  = 2.2;
    const DOT_ALPHA  = 0.55;   // before fog
    const LINE_ALPHA = 0.10;   // before fog — always faint
    const LINE_MAX_D = 0;      // filled in after resize; neighbour distance

    // Per-dot random size jitter (fixed at init).
    type Dot = {
      col: number;   // 0..COLS-1
      row: number;   // 0..ROWS-1
      sizeT: number; // 0..1 random → mapped to DOT_MIN_R..DOT_MAX_R
    };

    let dots: Dot[] = [];

    const buildDots = () => {
      dots = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          dots.push({ col, row, sizeT: Math.random() });
        }
      }
    };

    // ---- Project a logical surface point to canvas 2-D ---------------------
    // surfU, surfV ∈ [0,1] are position on the logical surface.
    // waveZ ∈ [-1,1] is the height field displacement, already scaled.
    const project = (
      surfU: number,
      surfV: number,
      waveZ: number,
      w: number,
      h: number
    ): { x: number; y: number; depth: number } => {
      // Map U across the full width with a little padding.
      const padX = w * 0.05;
      const x = padX + surfU * (w - padX * 2);

      // The surface sits in the lower 75 % of the viewport.
      // V=0 is the far (top) edge, V=1 is the near (bottom) edge.
      // TILT compresses the vertical extent so far rows converge.
      const surfTop  = h * 0.18;
      const surfBase = h * 0.82;
      const surfH    = surfBase - surfTop;

      // Isometric-style tilt: far rows are placed higher and closer together.
      const perspScale = 0.45 + 0.55 * surfV; // smaller when far
      const baseY = surfTop + surfV * surfH;

      // Wave displaces Y (negative = upward lift).
      const waveOffsetY = waveZ * surfH * WAVE_AMP * perspScale;
      const y = baseY + waveOffsetY;

      // depth 0 = far, 1 = near
      const depth = surfV;

      return { x, y, depth };
    };

    // ---- Compute screen position for a dot at a given time -----------------
    const dotPosition = (
      d: Dot,
      t: number,
      w: number,
      h: number
    ) => {
      const surfU = d.col / (COLS - 1);
      const surfV = d.row / (ROWS - 1);

      // Two overlapping slow sine waves — different spatial & temporal freqs
      // so the swell never looks mechanical.
      const phase = surfU * Math.PI * 2 * WAVE_FREQ - t * WAVE_SPEED;
      const waveZ =
        Math.sin(phase) * 0.65 +
        Math.sin(surfU * Math.PI * 1.1 * WAVE_FREQ + surfV * Math.PI * 0.9 - t * WAVE_SPEED * 0.7) * 0.35;

      return project(surfU, surfV, waveZ, w, h);
    };

    let maxNeighbourDist = 0; // set in resize

    const resize = () => {
      dpr   = Math.min(window.devicePixelRatio || 1, 2);
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Approximate the distance between adjacent dots in screen space so we
      // can set a sensible neighbour threshold.
      const cellW = (width  * 0.9) / (COLS - 1);
      const cellH = (height * 0.64) / (ROWS - 1);
      maxNeighbourDist = Math.sqrt(cellW * cellW + cellH * cellH) * 1.6;

      buildDots();
    };

    // ---- Fog utility -------------------------------------------------------
    const fogAlpha = (depth: number, base: number) => {
      const fog = FOG_FAR + (FOG_NEAR - FOG_FAR) * depth;
      return base * fog;
    };

    // ---- Main draw loop ----------------------------------------------------
    const draw = () => {
      const t = prefersReducedMotion
        ? 0
        : (performance.now() - t0) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Pre-compute all screen positions for this frame.
      const pos = dots.map(d => dotPosition(d, t, width, height));

      // --- Lines: only between direct grid neighbours (right + below) -------
      // Draw lines first so dots sit on top.
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const { x: x1, y: y1, depth: dep1 } = pos[i];

        // Right neighbour
        if (d.col < COLS - 1) {
          const j = i + 1;
          const { x: x2, y: y2, depth: dep2 } = pos[j];
          const alpha = fogAlpha((dep1 + dep2) / 2, LINE_ALPHA);
          ctx.strokeStyle = `rgba(${R},${G},${B},${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Below neighbour
        if (d.row < ROWS - 1) {
          const j = i + COLS;
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
        const r   = DOT_MIN_R + d.sizeT * (DOT_MAX_R - DOT_MIN_R);
        // Near dots slightly larger due to perspective.
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
