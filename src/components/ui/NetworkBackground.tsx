"use client";

import { useEffect, useRef } from "react";

/**
 * Animated grid-wave background.
 *
 * Dots sit on a regular grid. Each dot's position is displaced by a
 * travelling sine wave based on its column and row indices, so the whole
 * mesh ripples smoothly like a cloth or data-surface wave.
 *
 * Lines are drawn only between direct grid neighbours (right / down),
 * so the connections always form a clean grid — never triangles or polygons.
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

    // Brand blue in r,g,b form so we can vary opacity cheaply.
    const COLOR = "37, 99, 235";

    // ── Grid ───────────────────────────────────────────────────────────────
    const SPACING = 80; // px between grid points at rest

    // ── Wave ───────────────────────────────────────────────────────────────
    // Primary wave — travels horizontally across columns.
    const WAVE_AMP_Y   = 22;   // vertical displacement amplitude (px)
    const WAVE_AMP_X   = 6;    // slight horizontal wobble
    const WAVE_FREQ    = 0.055; // spatial frequency (radians per grid column)
    const WAVE_SPEED   = 0.022; // temporal speed (radians per frame)
    // Secondary wave — different direction / phase, adds depth.
    const WAVE2_AMP_Y  = 10;
    const WAVE2_FREQ   = 0.035;
    const WAVE2_SPEED  = 0.014;

    // ── Dots ───────────────────────────────────────────────────────────────
    const BASE_RADIUS = 1.4;
    const RADIUS_VAR  = 1.8; // random extra radius per dot (fixed at build time)

    type Dot = {
      col: number;
      row: number;
      // base grid position (screen coords)
      bx: number;
      by: number;
      // fixed per-dot radius jitter
      r: number;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let dots: Dot[] = [];
    // 2-D lookup: grid[row][col] → index into dots[]
    let grid: number[][] = [];
    let t = 0;
    let animId = 0;

    // ── Build the grid ─────────────────────────────────────────────────────
    const buildGrid = () => {
      dots = [];
      grid = [];

      // Extend one cell beyond each edge so the mesh always fills the canvas.
      const extraCols = Math.ceil(width  / SPACING) + 2;
      const extraRows = Math.ceil(height / SPACING) + 2;
      cols = extraCols;
      rows = extraRows;

      const offsetX = -SPACING * 0.5;
      const offsetY = -SPACING * 0.5;

      for (let row = 0; row < rows; row++) {
        grid.push([]);
        for (let col = 0; col < cols; col++) {
          grid[row].push(dots.length);
          dots.push({
            col,
            row,
            bx: offsetX + col * SPACING,
            by: offsetY + row * SPACING,
            r: BASE_RADIUS + Math.random() * RADIUS_VAR,
          });
        }
      }
    };

    // ── Resize handler ─────────────────────────────────────────────────────
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

    // ── Wave displacement for a dot ────────────────────────────────────────
    //
    // The phase is driven by (col * WAVE_FREQ - t * WAVE_SPEED) so the
    // wave travels horizontally across the grid (left → right).
    // A row-based term adds the vertical "ribbon" tilt seen in the reference.
    const getPos = (d: Dot): [number, number] => {
      const phase1 = d.col * WAVE_FREQ + d.row * WAVE_FREQ * 0.4 - t * WAVE_SPEED;
      const phase2 = d.col * WAVE2_FREQ - d.row * WAVE2_FREQ * 0.3 - t * WAVE2_SPEED + 1.5;

      const dy = WAVE_AMP_Y  * Math.sin(phase1) + WAVE2_AMP_Y  * Math.sin(phase2);
      const dx = WAVE_AMP_X  * Math.cos(phase1);

      return [d.bx + dx, d.by + dy];
    };

    // ── Main draw loop ─────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      t += 1;

      // Cache all displaced positions.
      const pos = dots.map(getPos);

      // Draw grid lines — right neighbour and down neighbour only.
      ctx.lineWidth = 0.6;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = grid[row][col];
          const [ax, ay] = pos[i];

          // → right
          if (col + 1 < cols) {
            const j = grid[row][col + 1];
            const [bx, by] = pos[j];
            const dist = Math.hypot(bx - ax, by - ay);
            // Fade as the wave stretches the segment.
            const alpha = Math.max(0, 0.13 - (dist - SPACING) * 0.004);
            ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }

          // ↓ down
          if (row + 1 < rows) {
            const j = grid[row + 1][col];
            const [bx, by] = pos[j];
            const dist = Math.hypot(bx - ax, by - ay);
            const alpha = Math.max(0, 0.11 - (dist - SPACING) * 0.003);
            ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      // Draw dots on top of the lines.
      for (let i = 0; i < dots.length; i++) {
        const [x, y] = pos[i];
        const d = dots[i];
        // Larger dots get a touch more opacity.
        const alpha = 0.18 + (d.r - BASE_RADIUS) / RADIUS_VAR * 0.20;
        ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    if (prefersReducedMotion) {
      cancelAnimationFrame(animId);
    }

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
