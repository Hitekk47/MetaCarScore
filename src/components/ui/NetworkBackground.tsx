"use client";

import { useEffect, useRef } from "react";

type Point = {
  // Base drift position (updated each frame by velocity).
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Wave parameters — each point oscillates independently.
  waveAmpX: number;   // horizontal wave amplitude in px
  waveAmpY: number;   // vertical wave amplitude in px
  waveFreqX: number;  // horizontal angular frequency
  waveFreqY: number;  // vertical angular frequency
  wavePhaseX: number; // per-point phase offset so they don't all sync
  wavePhaseY: number;
  // Visual variation.
  radius: number;     // dot size (px, varied per point)
};

/**
 * Animated "data network" background.
 * Points drift and undulate in waves, connected by straight lines.
 * Sits fixed behind all page content.
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

    let width = 0;
    let height = 0;
    let dpr = 1;
    let points: Point[] = [];
    let animationId = 0;
    let t = 0; // global time accumulator (increments each frame)

    // Brand palette (matches #2563eb) in rgb for alpha blending.
    const POINT_COLOR = "37, 99, 235";
    const LINE_COLOR = "37, 99, 235";
    const CONNECT_DISTANCE = 150;

    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);

    const buildPoints = () => {
      const area = width * height;
      const count = Math.min(90, Math.max(28, Math.round(area / 22000)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        // Wave: amplitude 8-28 px, slow frequency, random phase.
        waveAmpX: rand(8, 28),
        waveAmpY: rand(8, 28),
        waveFreqX: rand(0.004, 0.010),
        waveFreqY: rand(0.003, 0.009),
        wavePhaseX: rand(0, Math.PI * 2),
        wavePhaseY: rand(0, Math.PI * 2),
        // Dot radius: small range so variation is noticeable but subtle.
        radius: rand(1.2, 3.8),
      }));
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
      buildPoints();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      t += 1;

      // Update base position via drift velocity.
      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges with a soft margin.
        if (p.x < -40) p.x = width + 40;
        if (p.x > width + 40) p.x = -40;
        if (p.y < -40) p.y = height + 40;
        if (p.y > height + 40) p.y = -40;
      }

      // Compute rendered positions (base drift + wave offset).
      const rx = points.map(
        (p) => p.x + p.waveAmpX * Math.sin(t * p.waveFreqX + p.wavePhaseX)
      );
      const ry = points.map(
        (p) => p.y + p.waveAmpY * Math.cos(t * p.waveFreqY + p.wavePhaseY)
      );

      // Draw connecting lines using rendered positions.
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = rx[i] - rx[j];
          const dy = ry[i] - ry[j];
          const dist = Math.hypot(dx, dy);
          if (dist < CONNECT_DISTANCE) {
            const alpha = (1 - dist / CONNECT_DISTANCE) * 0.18;
            ctx.strokeStyle = `rgba(${LINE_COLOR}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(rx[i], ry[i]);
            ctx.lineTo(rx[j], ry[j]);
            ctx.stroke();
          }
        }
      }

      // Draw dots with per-point radius and a slight alpha variation by size.
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // Larger dots are slightly more opaque so big ones pop gently.
        const alpha = 0.22 + (p.radius / 3.8) * 0.2;
        ctx.fillStyle = `rgba(${POINT_COLOR}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(rx[i], ry[i], p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();

    if (prefersReducedMotion) {
      for (const p of points) {
        p.vx = 0;
        p.vy = 0;
        p.waveAmpX = 0;
        p.waveAmpY = 0;
      }
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
