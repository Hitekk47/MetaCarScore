"use client";

import { useEffect, useRef } from "react";

/**
 * Animated "flowing strands" background.
 *
 * Dots are arranged along dense, parallel, independent lines that sweep
 * horizontally across the screen like ribbons of silk. Each strand follows a
 * smooth, organic wave built from layered sines with slightly different
 * frequencies and speeds, so strands drift in and out of phase — overlapping
 * one another to create a sense of 3D depth and volume. There are no
 * cross-connections and no mesh: only fluid, parallel lines.
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
    let animationId = 0;
    const startTime = performance.now();

    // ---- Strand configuration -------------------------------------------
    type Strand = {
      /** Base vertical position as a fraction of the band height (0..1). */
      baseV: number;
      /** Wave amplitude multiplier (organic variation between strands). */
      ampMul: number;
      /** Phase offset so strands drift in/out of sync. */
      phase: number;
      /** Speed multiplier for the travelling wave. */
      speedMul: number;
      /** Secondary-wave frequency multiplier (breaks mathematical rigidity). */
      freqMul: number;
      /** Depth 0 (far/faint) → 1 (near/bold). */
      depth: number;
      /** Per-strand dot size jitter, fixed at init. */
      dotJitter: number[];
    };

    let strands: Strand[] = [];
    let samples = 0; // dots per strand

    const build = () => {
      // Dense dots along each strand; capped for performance.
      samples = Math.min(160, Math.max(70, Math.round(width / 12)));
      const STRAND_COUNT = 26;
      strands = [];
      for (let s = 0; s < STRAND_COUNT; s++) {
        const t = s / (STRAND_COUNT - 1);
        const dotJitter = new Array(samples);
        for (let i = 0; i < samples; i++) {
          dotJitter[i] = 0.75 + Math.random() * 0.7;
        }
        strands.push({
          // Cluster strands into a loose band with slight random spread —
          // parallel but not perfectly even, like fibres in a ribbon.
          baseV: t + (Math.random() - 0.5) * 0.05,
          ampMul: 0.75 + Math.random() * 0.6,
          phase: t * 2.4 + Math.random() * 0.7,
          speedMul: 0.85 + Math.random() * 0.4,
          freqMul: 0.9 + Math.random() * 0.25,
          depth: Math.random(),
          dotJitter,
        });
      }
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
      build();
    };

    /**
     * Smooth organic wave: three layered travelling sines with incommensurate
     * frequencies so the motion never repeats visibly and reads as fluid,
     * not as a plotted sine curve. Returns a -1..1-ish value.
     */
    const wave = (u: number, strand: Strand, time: number) => {
      const t = time * strand.speedMul;
      const f = strand.freqMul;
      const p = strand.phase;
      return (
        Math.sin(u * Math.PI * 2.0 * f + t * 0.55 + p) * 0.55 +
        Math.sin(u * Math.PI * 3.7 * f - t * 0.38 + p * 1.6) * 0.3 +
        Math.sin(u * Math.PI * 1.3 * f + t * 0.24 - p * 0.8) * 0.35
      );
    };

    const draw = () => {
      const time = prefersReducedMotion
        ? 0
        : (performance.now() - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      // The strand band occupies the middle of the viewport and breathes
      // slowly as a whole, adding to the organic feel.
      const bandCenter =
        height * 0.55 + Math.sin(time * 0.1) * height * 0.03;
      const bandHalf = height * 0.28;
      const amp = height * 0.09; // generous amplitude → rolling silk

      // Far strands first so near strands overlap them (depth layering).
      const order = strands
        .map((s, i) => ({ s, i }))
        .sort((a, b) => a.s.depth - b.s.depth);

      for (const { s } of order) {
        const near = s.depth; // 0 far → 1 near
        const lineAlpha = 0.05 + near * 0.1;
        const dotAlpha = 0.14 + near * 0.3;
        const dotSize = 0.9 + near * 1.3;

        // Compute this strand's dot positions.
        const xs = new Array<number>(samples);
        const ys = new Array<number>(samples);
        for (let i = 0; i < samples; i++) {
          const u = i / (samples - 1);
          const baseY = bandCenter + (s.baseV - 0.5) * 2 * bandHalf;
          xs[i] = u * width;
          ys[i] = baseY + wave(u, s, time) * amp * s.ampMul;
        }

        // 1) Continuous silk line through the dots (smoothed with quadratic
        //    midpoint curves — no jagged segments).
        ctx.strokeStyle = `rgba(${BLUE}, ${lineAlpha})`;
        ctx.lineWidth = 0.8 + near * 0.5;
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let i = 1; i < samples - 1; i++) {
          const mx = (xs[i] + xs[i + 1]) / 2;
          const my = (ys[i] + ys[i + 1]) / 2;
          ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
        }
        ctx.lineTo(xs[samples - 1], ys[samples - 1]);
        ctx.stroke();

        // 2) Dense dots riding the strand.
        ctx.fillStyle = `rgba(${BLUE}, ${dotAlpha})`;
        for (let i = 0; i < samples; i++) {
          ctx.beginPath();
          ctx.arc(xs[i], ys[i], dotSize * s.dotJitter[i], 0, Math.PI * 2);
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
