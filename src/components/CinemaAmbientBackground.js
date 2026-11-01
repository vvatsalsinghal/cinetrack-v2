"use client";

import { useEffect, useRef } from "react";

export default function CinemaAmbientBackground() {
  const canvasRef = useRef(null);
  const spotlightRef = useRef(null);
  const mousePosRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });
  const scrollRef = useRef({ lastY: 0, deltaY: 0 });

  useEffect(() => {
    // Respect user's accessibility reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;

    // Initialize 35 organic cinema dust motes
    const particleCount = 35;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 1.8 + 0.6,
      baseAlpha: Math.random() * 0.35 + 0.12,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.35 + 0.15), // Gentle upward drift like warm projector dust
      phase: Math.random() * Math.PI * 2,
    }));

    function handleMouseMove(e) {
      mousePosRef.current.targetX = e.clientX;
      mousePosRef.current.targetY = e.clientY;
    }

    function handleScroll() {
      const currentY = window.scrollY;
      scrollRef.current.deltaY = currentY - scrollRef.current.lastY;
      scrollRef.current.lastY = currentY;
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    function render() {
      // Smoothly interpolate spotlight towards cursor
      const mouse = mousePosRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      if (spotlightRef.current && mouse.x > -500) {
        spotlightRef.current.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Dampen scroll impulse
      scrollRef.current.deltaY *= 0.92;
      const scrollImpulse = scrollRef.current.deltaY * 0.12;

      // Draw and update floating motes
      for (const p of particles) {
        p.phase += 0.015;
        p.x += p.vx + Math.sin(p.phase) * 0.15;
        p.y += p.vy - scrollImpulse;

        // Subtle repulsion if cursor is near dust particle
        if (mouse.x > -500) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 0) {
            const force = (120 - dist) / 120;
            p.x += (dx / dist) * force * 1.5;
            p.y += (dy / dist) * force * 1.5;
          }
        }

        // Wrap particles smoothly around viewport boundaries
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Glowing dust mote
        const alpha = p.baseAlpha + Math.sin(p.phase * 2) * 0.08;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.04, alpha)})`;
        ctx.fill();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 35mm Projector Spotlight Cone following cursor */}
      <div
        ref={spotlightRef}
        style={{ willChange: "transform" }}
        className="absolute -left-[350px] -top-[350px] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.065)_0%,rgba(56,189,248,0.015)_45%,transparent_70%)] blur-2xl transition-opacity duration-500"
      />

      {/* Floating dust particles canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full opacity-75"
      />
    </div>
  );
}

