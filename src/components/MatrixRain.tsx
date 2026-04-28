"use client";

import { useEffect, useRef } from "react";

const CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const FONT_SIZE = 16;
// Base tick interval in ms. Each column moves every TICK * its speed multiplier.
const TICK = 60;

interface Column {
  row: number;       // current head row (can be negative = above screen)
  speed: number;     // steps per TICK (1 = move every tick, 2 = every 2 ticks, …)
  counter: number;   // ticks until next step
}

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let lastTime = 0;
    let cols: Column[] = [];

    function makeColumn(rows: number): Column {
      return {
        row: -Math.floor(Math.random() * rows),
        speed: Math.floor(Math.random() * 4) + 1, // 1–4 ticks per step
        counter: 0,
      };
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const numCols = Math.floor(canvas.width / FONT_SIZE);
      const rows = Math.floor(canvas.height / FONT_SIZE);
      // grow or shrink the column array, preserve existing
      while (cols.length < numCols) cols.push(makeColumn(rows));
      if (cols.length > numCols) cols.length = numCols;
    }

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;
      animationId = requestAnimationFrame(draw);

      if (timestamp - lastTime < TICK) return;
      lastTime = timestamp;

      // Very transparent overlay = long, slow-fading trails (cinematic look)
      ctx.fillStyle = "rgba(9, 10, 11, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px monospace`;

      const rows = Math.floor(canvas.height / FONT_SIZE);

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        col.counter++;

        // Only this column steps forward when its personal counter fires
        if (col.counter < col.speed) continue;
        col.counter = 0;

        const x = i * FONT_SIZE;
        const y = col.row * FONT_SIZE;

        // White-green head — brightest point
        const headChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillStyle = "rgba(220, 255, 230, 0.95)";
        ctx.fillText(headChar, x, y);

        // One cell behind: vivid green
        if (col.row > 0) {
          const c2 = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillStyle = "rgba(57, 255, 120, 0.85)";
          ctx.fillText(c2, x, y - FONT_SIZE);
        }

        // Advance head
        col.row++;

        // Once completely off screen, restart above with a new random speed
        if (col.row * FONT_SIZE > canvas.height + FONT_SIZE * 2) {
          col.row = -Math.floor(Math.random() * rows * 0.5);
          col.speed = Math.floor(Math.random() * 4) + 1;
        }
      }
    }

    resize();
    window.addEventListener("resize", resize);
    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.55,
      }}
      aria-hidden="true"
    />
  );
}
