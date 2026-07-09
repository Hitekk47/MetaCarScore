"use client";

import { useEffect, useRef } from "react";

/**
 * Animated grid-wave background.
 * Nodes sit on an evenly-spaced grid and undulate like a cloth surface
 * via a 2-D travelling sinusoidal wave. Neighbours are connected by
 * straight lines. Sits fixed behind all page content.
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

    // Brand blue (#2563eb) expressed as r,g,b for alpha compositing.
    const COLOR = "37, 99, 235";

    // Grid spacing in logical pixels.
    const SPACING = 80;

    // Wave parameters — tweak to taste.
    const WAVE_AMP   = 14;   // max displacement in px
    const WAVE_FREQ  = 0.016; // spatial frequency (rad / grid-unit)
    const WAVE_SPEED = 0.018; // how fast the wave travels (rad / frame)
    // A secondary wave at a slightly different angle/speed adds richness.
    const WAVE2_AMP   = 8;
    const WAVE2_FREQ  = 0.022;
    const WAVE2_SPEED = 0.011;

    // Visual — dots vary in radius so the grid has subtle texture.
    const BASE_RADIUS = 1.8;
    const RADIUS_VAR  = 1.4; // added per-node randomly, stays constant

    type Node = {
      // Fixed grid origin.
      ox: number;
      oy: number;
      // Column / row indices drive per-node wave phase.
      col: number;
      row: number;
      // Random size jitter (constant throughout animation).
      radiusJitter: number;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let cols = 0;
    let rows = 0;
    let animationId = 0;
    let t = 0;

    const buildGrid = () => {
      nodes = [];
      // Add half-spacing margin so the grid extends slightly beyond edges.
      const marginX = SPACING / 2;
      const marginY = SPACING / 2;
      cols = Math.ceil((width + SPACING) / SPACING);
      rows = Math.ceil((height + SPACING) / SPACING);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          nodes.push({
            ox: -marginX + c * SPACING,
            oy: -marginY + r * SPACING,
            col: c,
            row: r,
            radiusJitter: Math.random() * RADIUS_VAR,
          });
        }
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width  = window.innerWidth;
      height = window.innerHeight;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    /**
     * For node (col, row) at time t, return the displaced [x, y] position.
     * Two overlapping waves travelling in slightly different diagonal
     * directions produce the undulating cloth effect.
     */
    const displaced = (n: Node): [number, number] => {
      const phase1 = n.col * WAVE_FREQ + n.row * WAVE_FREQ * 0.6 - t * WAVE_SPEED;
      const phase2 = n.col * WAVE2_FREQ * 0.7 - n.row * WAVE2_FREQ - t * WAVE2_SPEED;

      const dx = WAVE_AMP  * Math.sin(phase1) + WAVE2_AMP * Math.cos(phase2);
      const dy = WAVE_AMP  * Math.cos(phase1) + WAVE2_AMP * Math.sin(phase2);

      return [n.ox + dx, n.oy + dy];
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      t += 1;

      // Pre-compute all displaced positions.
      const pos: [number, number][] = nodes.map(displaced);

      // Draw lines only between direct grid neighbours (right + down).
      ctx.lineWidth = 0.7;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // Right neighbour.
        if (n.col < cols - 1) {
          const j = i + 1;
          const [ax, ay] = pos[i];
          const [bx, by] = pos[j];
          // Fade lines that are stretched far (wave tension feel).
          const stretch = Math.hypot(bx - ax, by - ay) / SPACING;
          const alpha = Math.max(0, 0.14 - (stretch - 1) * 0.12);
          ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }

        // Down neighbour.
        if (n.row < rows - 1) {
          const j = i + cols;
          const [ax, ay] = pos[i];
          const [bx, by] = pos[j];
          const stretch = Math.hypot(bx - ax, by - ay) / SPACING;
          const alpha = Math.max(0, 0.14 - (stretch - 1) * 0.12);
          ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      // Draw dots on top of lines.
      for (let i = 0; i < nodes.length; i++) {
        const [x, y] = pos[i];
        const r = BASE_RADIUS + nodes[i].radiusJitter;
        // Slightly more opaque for larger dots.
        const alpha = 0.22 + (nodes[i].radiusJitter / RADIUS_VAR) * 0.18;
        ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();

    if (prefersReducedMotion) {
      // Render one static frame with no displacement.
      draw();
      cancelAnimationFrame(animationId);
    } else {
      draw();
    }

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
