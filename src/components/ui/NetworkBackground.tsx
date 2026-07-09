"use client";

import { useEffect, useRef } from "react";

export default function ParticleWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Brand Colors
    const R = 37, G = 99, B = 235;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = 0;
    let time = 0;

    // --- Particle Topography Settings ---
    const ROWS = 35;        // Depth of the grid
    const COLS = 80;        // Width of the grid
    const WAVE_SPEED = 0.015;
    const JITTER = 0.4;     // The "Chaos" factor - breaks the rigid grid look

    type Particle = {
      x: number;
      z: number;
      sizeOffset: number;
    };

    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
          // Base grid position (0 to 1)
          const baseX = x / (COLS - 1);
          const baseZ = z / (ROWS - 1);

          // Add random "chaos" to break up the perfect squares
          const jitterX = (Math.random() - 0.5) * (JITTER / COLS);
          const jitterZ = (Math.random() - 0.5) * (JITTER / ROWS);

          particles.push({
            x: baseX + jitterX,
            z: baseZ + jitterZ,
            sizeOffset: Math.random(), // For twinkling/size variation
          });
        }
      }
    };

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const draw = () => {
      // Fast manual clear
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      time += WAVE_SPEED;
      if (prefersReducedMotion) time = 0;

      const centerY = height * 0.6; // Vertical center of the terrain
      const fov = 350; // Camera field of view

      ctx.fillStyle = `rgb(${R}, ${G}, ${B})`;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // --- The "Chaos" Wave Math ---
        // Overlapping sine waves create an unpredictable, organic ocean-like swell
        let y = Math.sin(p.x * 12 + time) * 0.15;
        y += Math.sin(p.z * 8 - time * 0.8) * 0.15;
        y += Math.sin((p.x + p.z) * 5 + time * 1.2) * 0.1;

        // --- 3D Projection ---
        // Center X around 0 for projection
        const centeredX = (p.x - 0.5) * width * 1.5;

        // Z depth (1 is close, higher is further back)
        const zDepth = 1 + p.z * 4.5;
        const scale = fov / (fov + zDepth * 100);

        const screenX = (width / 2) + centeredX * scale;
        const screenY = centerY + (y * height * 0.6) * scale + (p.z * height * 0.3);

        // --- Rendering ---
        // Fade out dots that are further back, keep near dots crisp
        const opacity = Math.max(0, 0.9 - p.z * 0.8);

        // Skip rendering if practically invisible (huge performance boost)
        if (opacity < 0.05) continue;

        // Size decreases with depth, plus a little random twinkle
        const dotSize = (1.5 + p.sizeOffset * 1.5) * scale;

        ctx.globalAlpha = opacity;

        // Draw the particle
        ctx.beginPath();
        // Using arc for pure dots since we don't have lines dragging down performance
        ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1; // Reset alpha

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
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-white"
    />
  );
}