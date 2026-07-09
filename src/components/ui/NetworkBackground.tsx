"use client";

import { useEffect, useRef } from "react";

/**
 * Animated particle-grid background.
 *
 * Dots are placed on a strict evenly-spaced grid.
 * Lines connect only direct horizontal and vertical neighbours.
 * A large-amplitude travelling sine wave displaces each dot in Y
 * based on its column index and time, creating flowing 3-D terrain waves.
 *
 * Sits fixed behind all page content (-z-10, pointer-events-none).
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

    // ── tunable constants ──────────────────────────────────────────
    const SPACING   = 70;          // px between grid nodes (before wave)
    const AMPLITUDE = 55;          // max vertical displacement in px
    const WAVE_FREQ = 0.055;       // spatial frequency (cols per radian)
    const WAVE_SPEED = 0.018;      // radians per frame the wave travels
    // second, slower wave layered on top for depth
    const AMP2      = 25;
    const FREQ2     = 0.030;
    const SPEED2    = 0.010;
    // dot radii: each node gets a fixed random radius at build time
    const R_MIN = 1.2;
    const R_MAX = 3.2;
    // Brand colour rgb components
    const BRAND = "37, 99, 235";
    // ──────────────────────────────────────────────────────────────

    let width  = 0;
    let height = 0;
    let dpr    = 1;

    // Grid dimensions
    let cols = 0;
    let rows = 0;
    // Base (rest) positions — these never move
    let baseX: Float32Array;
    let baseY: Float32Array;
    // Per-node fixed radius
    let radii: Float32Array;

    let animationId = 0;
    let t = 0;

    const buildGrid = () => {
      // Add one extra column / row so lines reach the canvas edge
      cols = Math.ceil(width  / SPACING) + 1;
      rows = Math.ceil(height / SPACING) + 1;

      const total = cols * rows;
      baseX  = new Float32Array(total);
      baseY  = new Float32Array(total);
      radii  = new Float32Array(total);

      // Centre the grid horizontally and vertically
      const offsetX = (width  - (cols - 1) * SPACING) / 2;
      const offsetY = (height - (rows - 1) * SPACING) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          baseX[i] = offsetX + c * SPACING;
          baseY[i] = offsetY + r * SPACING;
          radii[i] = R_MIN + Math.random() * (R_MAX - R_MIN);
        }
      }
    };

    const resize = () => {
      dpr    = Math.min(window.devicePixelRatio || 1, 2);
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    // Pre-allocate rendered position arrays (filled each frame)
    const getRendered = (time: number) => {
      const total = cols * rows;
      const rx = new Float32Array(total);
      const ry = new Float32Array(total);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          // Two overlapping waves, each travelling left
          const wave1 = AMPLITUDE * Math.sin(c * WAVE_FREQ - time * WAVE_SPEED + r * 0.18);
          const wave2 = AMP2      * Math.sin(c * FREQ2     - time * SPEED2     + r * 0.32);
          rx[i] = baseX[i];
          ry[i] = baseY[i] + wave1 + wave2;
        }
      }
      return { rx, ry };
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      if (!prefersReducedMotion) t += 1;

      const { rx, ry } = getRendered(t);

      // ── horizontal lines (connect right neighbour) ──────────────
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const i  = r * cols + c;
          const i2 = i + 1;
          ctx.strokeStyle = `rgba(${BRAND}, 0.13)`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rx[i],  ry[i]);
          ctx.lineTo(rx[i2], ry[i2]);
          ctx.stroke();
        }
      }

      // ── vertical lines (connect down neighbour) ──────────────────
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const i  = r * cols + c;
          const i2 = i + cols;
          ctx.strokeStyle = `rgba(${BRAND}, 0.10)`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(rx[i],  ry[i]);
          ctx.lineTo(rx[i2], ry[i2]);
          ctx.stroke();
        }
      }

      // ── dots ─────────────────────────────────────────────────────
      for (let i = 0; i < cols * rows; i++) {
        const r = radii[i];
        // Slightly more opaque for larger dots
        const alpha = 0.20 + (r / R_MAX) * 0.22;
        ctx.fillStyle = `rgba(${BRAND}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(rx[i], ry[i], r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
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
