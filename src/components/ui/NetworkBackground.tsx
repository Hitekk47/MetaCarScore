"use client";

import { useEffect, useRef } from "react";

/**
 * Animated ribbon-wave background.
 *
 * Several horizontal rows of evenly-spaced dots travel across the screen.
 * Each row is a flowing ribbon: dot Y-positions are displaced by a large-
 * amplitude travelling sine wave so the whole ribbon rises and falls
 * dramatically. Dots in the same row are connected by horizontal lines;
 * adjacent rows connect vertically — giving a clear mesh structure that
 * ripples like the reference image.
 *
 * No diagonal connections, no polygon artefacts.
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

    const COLOR = "37, 99, 235"; // brand blue r,g,b

    // ── Layout ─────────────────────────────────────────────────────────────
    const COL_SPACING = 55;   // px between dots horizontally
    const ROW_COUNT   = 9;    // number of ribbon rows
    const ROW_BAND    = 80;   // vertical px between ribbon centre-lines at rest

    // ── Wave ───────────────────────────────────────────────────────────────
    // Primary wave — large amplitude, travels left → right.
    const AMP1   = 70;    // px — large so the ribbon really rises and falls
    const FREQ1  = 0.038; // spatial frequency (radians per column-step)
    const SPD1   = 0.018; // temporal speed (radians per frame)

    // Secondary wave — adds complexity, slightly different freq/speed.
    const AMP2   = 30;
    const FREQ2  = 0.065;
    const SPD2   = 0.011;

    // Each row has its own phase offset so they look independent.
    const ROW_PHASE_STEP = 0.55; // radians — shift between successive rows

    // ── Dots ───────────────────────────────────────────────────────────────
    const BASE_R = 1.3;
    const VAR_R  = 1.6; // random extra radius per dot, fixed at build time

    type Dot = {
      col: number;
      row: number;
      bx: number; // base x (changes only on resize)
      by: number; // base y (rest-position of the row centre-line)
      r: number;  // dot radius
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let dots: Dot[] = [];
    // grid[row][col] → index in dots[]
    let grid: number[][] = [];
    let t = 0;
    let animId = 0;

    // ── Build dots ─────────────────────────────────────────────────────────
    const buildDots = () => {
      dots = [];
      grid = [];

      cols = Math.ceil(width / COL_SPACING) + 3;

      // Spread rows evenly across the full canvas height, with one row above
      // and one below the visible area so the wave never shows a bare edge.
      const totalBand = ROW_COUNT * ROW_BAND;
      const yStart = (height - totalBand) / 2;

      for (let row = 0; row < ROW_COUNT; row++) {
        grid.push([]);
        const by = yStart + row * ROW_BAND;
        for (let col = 0; col < cols; col++) {
          grid[row].push(dots.length);
          dots.push({
            col,
            row,
            bx: (col - 1) * COL_SPACING,
            by,
            r: BASE_R + Math.random() * VAR_R,
          });
        }
      }
    };

    // ── Resize ─────────────────────────────────────────────────────────────
    const resize = () => {
      dpr   = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDots();
    };

    // ── Displaced position of a dot ────────────────────────────────────────
    // Phase is driven by column index (spatial) and t (temporal) so the wave
    // travels horizontally. A per-row phase offset makes each ribbon
    // independent.
    const getPos = (d: Dot): [number, number] => {
      const rowPhase = d.row * ROW_PHASE_STEP;
      const phase1   = d.col * FREQ1 - t * SPD1 + rowPhase;
      const phase2   = d.col * FREQ2 - t * SPD2 + rowPhase * 1.3;

      const dy = AMP1 * Math.sin(phase1) + AMP2 * Math.sin(phase2);
      // Tiny horizontal wobble so lines don't look perfectly mechanical.
      const dx = 4 * Math.cos(phase1 * 0.7);

      return [d.bx + dx, d.by + dy];
    };

    // ── Draw ───────────────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      t += 1;

      const pos = dots.map(getPos);

      ctx.lineWidth = 0.7;

      for (let row = 0; row < ROW_COUNT; row++) {
        for (let col = 0; col < cols; col++) {
          const i  = grid[row][col];
          const [ax, ay] = pos[i];

          // Horizontal line → right neighbour (within same ribbon row).
          if (col + 1 < cols) {
            const j = grid[row][col + 1];
            const [bx, by] = pos[j];
            // Alpha based on natural rest distance so stretched segments fade.
            const stretch = Math.hypot(bx - ax, by - ay) / COL_SPACING;
            const alpha   = Math.max(0, 0.22 - (stretch - 1) * 0.18);
            ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }

          // Vertical line ↓ down neighbour (connects adjacent ribbons).
          if (row + 1 < ROW_COUNT) {
            const j = grid[row + 1][col];
            const [bx, by] = pos[j];
            const stretch = Math.hypot(bx - ax, by - ay) / ROW_BAND;
            const alpha   = Math.max(0, 0.14 - (stretch - 1) * 0.14);
            ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      // Dots on top.
      for (let i = 0; i < dots.length; i++) {
        const [x, y] = pos[i];
        const d = dots[i];
        const alpha = 0.25 + (d.r - BASE_R) / VAR_R * 0.25;
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
