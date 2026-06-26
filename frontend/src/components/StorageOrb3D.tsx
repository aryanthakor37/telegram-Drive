import React, { useEffect, useRef } from 'react';

interface StorageOrb3DProps {
  percentage: number;
  size?: number;
  showPercentage?: boolean;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
  hue: number;
}

export const StorageOrb3D: React.FC<StorageOrb3DProps> = ({
  percentage,
  size: sizeProp = 64,
  showPercentage = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    mouseRef.current.targetX = x;
    mouseRef.current.targetY = y;
    hoverRef.current = true;
  };

  const handleMouseLeave = () => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
    hoverRef.current = false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const size = sizeProp;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let offset = 0;
    let ringAngle = 0;
    let currentPct = 0;
    let time = 0;

    // Bubble particles inside orb
    const bubbles: Bubble[] = [];
    const bubbleCount = 8;
    for (let i = 0; i < bubbleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (size * 0.3);
      bubbles.push({
        x: size / 2 + Math.cos(angle) * dist,
        y: size * 0.7 + Math.random() * size * 0.2,
        r: 1 + Math.random() * 2.5,
        speed: 0.3 + Math.random() * 0.6,
        alpha: 0.2 + Math.random() * 0.5,
        hue: 200 + Math.floor(Math.random() * 60)
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      currentPct += (percentage - currentPct) * 0.05;
      time++;

      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      const isDark = document.documentElement.classList.contains('dark');
      const radius = size / 2;
      const fillHeight = size - (currentPct / 100) * size;

      const waveSpeed = hoverRef.current ? 0.09 : 0.04;
      const waveAmp = hoverRef.current ? 1.6 : 1.0;

      // ── Outer glow corona ────────────────────────────────────
      const coronaGrad = ctx.createRadialGradient(radius, radius, radius * 0.7, radius, radius, radius * 1.3);
      coronaGrad.addColorStop(0, 'transparent');
      coronaGrad.addColorStop(0.6, `rgba(59,130,246, ${isDark ? 0.06 : 0.04})`);
      coronaGrad.addColorStop(1, `rgba(99,102,241, ${isDark ? 0.12 : 0.07})`);
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(radius, radius, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // ── Main clipped sphere ──────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1.5, 0, Math.PI * 2);
      ctx.clip();

      // Sphere background
      const bgGrad = ctx.createRadialGradient(radius * 0.7, radius * 0.6, 0, radius, radius, radius);
      if (isDark) {
        bgGrad.addColorStop(0, 'rgba(20, 35, 65, 0.9)');
        bgGrad.addColorStop(1, 'rgba(10, 18, 40, 0.95)');
      } else {
        bgGrad.addColorStop(0, 'rgba(219, 234, 254, 0.9)');
        bgGrad.addColorStop(1, 'rgba(191, 219, 254, 0.8)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Wave 1 — deep back (slowest)
      ctx.fillStyle = isDark ? 'rgba(29, 78, 216, 0.35)' : 'rgba(59,130,246,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, size);
      for (let x = 0; x <= size; x++) {
        const y = Math.sin(x * 0.08 + offset * 0.6) * 4 * waveAmp + fillHeight + 4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(size, size);
      ctx.closePath();
      ctx.fill();

      // Wave 2 — mid (medium)
      ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(96,165,250,0.5)';
      ctx.beginPath();
      ctx.moveTo(0, size);
      for (let x = 0; x <= size; x++) {
        const y = Math.sin(x * 0.11 + offset) * 3.5 * waveAmp + fillHeight + 1;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(size, size);
      ctx.closePath();
      ctx.fill();

      // Wave 3 — front (fastest, brightest)
      ctx.fillStyle = isDark ? 'rgba(96, 165, 250, 0.82)' : 'rgba(147,197,253,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, size);
      for (let x = 0; x <= size; x++) {
        const y = Math.cos(x * 0.13 - offset * 1.2) * 2.8 * waveAmp + fillHeight - 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(size, size);
      ctx.closePath();
      ctx.fill();

      // ── Bubble particles rising inside ───────────────────────
      bubbles.forEach(b => {
        b.y -= b.speed;
        b.alpha *= 0.998;
        // Reset bubble when it escapes top of fill area
        if (b.y < fillHeight - 5 || b.alpha < 0.05) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (size * 0.28);
          b.x = size / 2 + Math.cos(angle) * dist;
          b.y = size - 2;
          b.r = 1 + Math.random() * 2;
          b.alpha = 0.15 + Math.random() * 0.35;
          b.speed = 0.3 + Math.random() * 0.5;
        }
        // Only draw bubble if it's inside the water level
        if (b.y > fillHeight - 2) {
          ctx.beginPath();
          ctx.strokeStyle = `hsla(${b.hue}, 80%, ${isDark ? 75 : 60}%, ${b.alpha})`;
          ctx.lineWidth = 0.8;
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.stroke();
          // Tiny highlight
          ctx.beginPath();
          ctx.fillStyle = `hsla(${b.hue}, 60%, 90%, ${b.alpha * 0.5})`;
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.restore();

      // ── Sphere rim stroke ────────────────────────────────────
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
      const rimGrad = ctx.createLinearGradient(0, 0, size, size);
      rimGrad.addColorStop(0, isDark ? 'rgba(96,165,250,0.5)' : 'rgba(59,130,246,0.4)');
      rimGrad.addColorStop(1, isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // ── Spinning orbit ring ──────────────────────────────────
      ringAngle += hoverRef.current ? 0.04 : 0.018;
      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(ringAngle);
      ctx.scale(1, 0.28); // flatten to ellipse
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.08, 0, Math.PI * 2);
      const ringColor = isDark ? 'rgba(96,165,250,' : 'rgba(59,130,246,';
      ctx.strokeStyle = `${ringColor}0.2)`;
      ctx.lineWidth = 1.5 / 0.28;
      ctx.stroke();

      // Bright bead on the ring
      const beadX = Math.cos(ringAngle * 0) * radius * 1.08;
      const beadY = 0;
      ctx.beginPath();
      ctx.arc(beadX, beadY, 3.5 / 0.28, 0, Math.PI * 2);
      const beadGrad = ctx.createRadialGradient(beadX, beadY, 0, beadX, beadY, 5 / 0.28);
      beadGrad.addColorStop(0, isDark ? 'rgba(147,197,253,0.95)' : 'rgba(59,130,246,0.9)');
      beadGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = beadGrad;
      ctx.fill();
      ctx.restore();

      // ── Lens highlight ───────────────────────────────────────
      const lightSourceX = radius - 9 + mouse.x * 6;
      const lightSourceY = radius - 9 + mouse.y * 6;
      const lensGrad = ctx.createRadialGradient(
        lightSourceX, lightSourceY, 1,
        radius + mouse.x * 3, radius + mouse.y * 3,
        radius
      );
      lensGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
      lensGrad.addColorStop(0.35, 'rgba(255,255,255,0.08)');
      lensGrad.addColorStop(0.75, 'transparent');
      lensGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Mirror gloss shine
      const shineX = radius - 6 + mouse.x * 8;
      const shineY = radius - 13 + mouse.y * 8;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(shineX, shineY, 9, 3.5, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Tiny secondary shine
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(shineX + 10, shineY + 8, 4, 1.5, -Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();

      offset += waveSpeed;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [percentage, sizeProp]);

  return (
    <div
      className="relative group flex items-center justify-center shrink-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{ width: `${sizeProp}px`, height: `${sizeProp}px` }}
        className="cursor-pointer drop-shadow-[0_0_16px_rgba(59,130,246,0.45)] transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_24px_rgba(59,130,246,0.65)]"
      />
      {showPercentage && (
        <span
          style={{ fontSize: `${sizeProp * 0.17}px` }}
          className="absolute font-extrabold text-white pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] select-none tracking-tight"
        >
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};
