"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ParticlesHandle {
  burst(x: number, y: number, colors: string[], count?: number, power?: number): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

/** Lightweight canvas particle bursts. The animation loop only runs while particles are alive. */
export const Particles = forwardRef<ParticlesHandle>(function Particles(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const c = canvas.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const loop = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "lighter";
    particles.current = particles.current.filter((p) => p.life < p.max);
    for (const p of particles.current) {
      p.life++;
      p.vy += 0.12;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frame.current = particles.current.length ? requestAnimationFrame(loop) : null;
  };

  useImperativeHandle(ref, () => ({
    burst(x, y, colors, count = 36, power = 7) {
      if (reduced.current) return;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = power * (0.35 + Math.random() * 0.8);
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 0,
          max: 38 + Math.random() * 26,
          size: 2 + Math.random() * 3,
          color: colors[i % colors.length] as string,
        });
      }
      if (!frame.current) frame.current = requestAnimationFrame(loop);
    },
  }));

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-40 h-full w-full" aria-hidden />;
});
