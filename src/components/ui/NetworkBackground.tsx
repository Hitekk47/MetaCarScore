"use client";

import { useEffect, useRef } from "react";

export default function TerrainWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false }); // alpha: false is a huge perf boost, we manually clear to white
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Brand Colors
    const R = 37, G = 99, B = 235;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = 0;
    let time = 0;

    // --- Terrain Settings ---
    const ROWS = 16;       // Number of horizontal lines (Z-depth)
    const COLS = 70;       // Resolution of the waves (X-axis)
    const WAVE_AMP = 60;   // How tall the waves get
    const WAVE_SPEED = 0.012; 
    const TILT = 0.6;      // Perspective tilt (how far back it stretches)

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      // Fast manual clear (better than clearRect when alpha: false)
      ctx.fillStyle = "#ffffff"; // Assuming a white/light background
      ctx.fillRect(0, 0, width, height);

      time += WAVE_SPEED;
      if (prefersReducedMotion) time = 0;

      const centerY = height * 0.65; // Position the terrain near the bottom

      // Draw back-to-front for proper 3D overlap
      for (let z = 0; z < ROWS; z++) {
        const depth = z / (ROWS - 1); // 0 (back) to 1 (front)
        
        // Depth variables
        const perspectiveScale = 0.3 + (0.7 * depth); // Back rows are smaller
        const rowOpacity = 0.05 + (0.35 * depth);     // Back rows fade into fog
        const yOffset = centerY - (ROWS - z) * (height * 0.04 * TILT); 

        // Set styles for this entire row (drastically reduces draw calls)
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${rowOpacity})`;
        ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${rowOpacity * 1.5})`;
        ctx.lineWidth = 1 * perspectiveScale;

        ctx.beginPath();

        // Arrays to store dot positions so we can draw them after the line
        const dotXs = [];
        const dotYs = [];

        for (let x = 0; x <= COLS; x++) {
          const xProgress = x / COLS;
          // Extend slightly off-screen so waves don't abruptly cut off
          const screenX = (width * -0.1) + (xProgress * width * 1.2); 

          // --- The Magic Organic Math ---
          // Combine 3 sine waves at different frequencies to create natural terrain
          const wave1 = Math.sin(xProgress * 8 + time + depth * 4) * 1.2;
          const wave2 = Math.cos(xProgress * 4 - time * 0.8 + depth * 2) * 0.8;
          const wave3 = Math.sin(xProgress * 12 + time * 1.5) * 0.4;
          
          const totalWave = (wave1 + wave2 + wave3) * WAVE_AMP * perspectiveScale;
          const screenY = yOffset + totalWave;

          if (x === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }

          dotXs.push(screenX);
          dotYs.push(screenY);
        }
        
        // Stroke the continuous horizontal wave line
        ctx.stroke();

        // Draw the dots for this row
        // Using rect instead of arc is visually identical for tiny dots but 5x faster
        const dotSize = 2.5 * perspectiveScale;
        ctx.beginPath();
        for (let i = 0; i < dotXs.length; i++) {
          ctx.rect(dotXs[i] - dotSize/2, dotYs[i] - dotSize/2, dotSize, dotSize);
        }
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
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-white"
    />
  );
}