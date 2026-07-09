"use client";

import { useEffect, useRef } from "react";

/**
 * Animated network background.
 * Dots drift with a sinusoidal wave motion. Connections are only drawn
 * between dots that are roughly axis-aligned (horizontal or vertical),
 * so the links form a loose, flowing grid rather than small polygons.
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

    const COLOR = "37, 99, 235";

    // Grid spacing — dots start on a grid but move freely via wave.
    const SPACING = 90;

    // Wave parameters.
    const WAVE_AMP   = 18;    // max displacement in px
    const WAVE_FREQ  = 0.014; // spatial frequency
    const WAVE_SPEED = 0.016; // temporal speed

    // Connection rules.
    const MAX_DIST   = SPACING * 1.55; // max distance to attempt a connection
    // A pair is "axis-aligned" if the angle is within this many degrees of
    // horizontal or vertical. Tighter = stricter grid look.
    const ALIGN_DEG  = 28;
    const ALIGN_RAD  = (ALIGN_DEG * Math.PI) / 180;

    const BASE_RADIUS = 1.6;
    const RADIUS_VAR  = 1.6;

    type Dot = {
      ox: number; oy: number; // resting grid position
      col: number; row: number;
      r: number; // radius (fixed jitter)
    };

    let width = 0, height = 0, dpr = 1;
    let dots: Dot[] = [];
    let t = 0;
    let animationId = 0;

    const buildDots = () => {
      dots = [];
      const marginX = SPACING / 2;
      const marginY = SPACING / 2;
      const cols = Math.ceil((width + SPACING) / SPACING);
      const rows = Math.ceil((height + SPACING) / SPACING);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          dots.push({
            ox: -marginX + col * SPACING,
            oy: -marginY + row * SPACING,
            col,
            row,
            r: BASE_RADIUS + Math.random() * RADIUS_VAR,
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
      buildDots();
    };

    /** Compute the wave-displaced position of a dot at time t. */
    const getPos = (d: Dot): [number, number] => {
      // Primary wave — travels diagonally.
      const p1 = d.col * WAVE_FREQ + d.row * WAVE_FREQ * 0.55 - t * WAVE_SPEED;
      // Secondary wave — perpendicular direction, slower.
      const p2 = -d.col * WAVE_FREQ * 0.6 + d.row * WAVE_FREQ - t * WAVE_SPEED * 0.65;

      const dx = WAVE_AMP * Math.sin(p1) + (WAVE_AMP * 0.45) * Math.sin(p2 + 1.2);
      const dy = WAVE_AMP * Math.cos(p1) + (WAVE_AMP * 0.45) * Math.cos(p2 + 0.8);

      return [d.ox + dx, d.oy + dy];
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      t += 1;

      const pos = dots.map(getPos);

      // Draw axis-aligned connections only.
      ctx.lineWidth = 0.65;
      for (let i = 0; i < dots.length; i++) {
        const [ax, ay] = pos[i];
        for (let j = i + 1; j < dots.length; j++) {
          const [bx, by] = pos[j];
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DIST) continue;

          // Angle of the segment from horizontal.
          const angle = Math.abs(Math.atan2(dy, dx));
          // Keep only near-horizontal (≈0 or ≈π) and near-vertical (≈π/2).
          const isHorizontal = angle <= ALIGN_RAD || angle >= Math.PI - ALIGN_RAD;
          const isVertical   = Math.abs(angle - Math.PI / 2) <= ALIGN_RAD;
          if (!isHorizontal && !isVertical) continue;

          // Fade as distance grows.
          const alpha = 0.13 * (1 - dist / MAX_DIST);
          ctx.strokeStyle = `rgba(${COLOR}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      // Draw dots on top.
      for (let i = 0; i < dots.length; i++) {
        const [x, y] = pos[i];
        const d = dots[i];
        const alpha = 0.20 + (d.r - BASE_RADIUS) / RADIUS_VAR * 0.18;
        ctx.fillStyle = `rgba(${COLOR}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();

    if (prefersReducedMotion) {
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
