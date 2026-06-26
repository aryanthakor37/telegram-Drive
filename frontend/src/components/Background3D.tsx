import React, { useEffect, useRef } from 'react';

interface Mote3D {
  x: number;
  y: number;
  z: number;
  baseSize: number;
  speed: number;
  hue: number;
}

interface FloatingOrb {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  hue: number;
  opacity: number;
  pulseSpeed: number;
}

interface Beacon {
  x: number;
  y: number;
  rings: { radius: number; maxRadius: number; alpha: number; speed: number }[];
  hue: number;
  nextSpawn: number;
}

export const Background3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    screenX: 0,
    screenY: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    mouseRef.current.screenX = width / 2;
    mouseRef.current.screenY = height / 2;

    // ── Starfield particles ──────────────────────────────────────
    const moteCount = 55;
    const motes: Mote3D[] = [];
    for (let i = 0; i < moteCount; i++) {
      motes.push({
        x: (Math.random() - 0.5) * width * 2.5,
        y: (Math.random() - 0.5) * height * 2.5,
        z: Math.random() * 1000,
        baseSize: Math.random() * 1.6 + 0.4,
        speed: 0.5 + Math.random() * 1.4,
        hue: 200 + Math.floor(Math.random() * 100)
      });
    }

    // ── Floating glow orbs (large, slow, ambient) ─────────────────
    const orbCount = 6;
    const orbs: FloatingOrb[] = [];
    for (let i = 0; i < orbCount; i++) {
      orbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 60 + Math.random() * 120,
        speed: 0.00015 + Math.random() * 0.0003,
        phase: Math.random() * Math.PI * 2,
        hue: [210, 230, 260, 190, 280, 200][i],
        opacity: 0.04 + Math.random() * 0.06,
        pulseSpeed: 0.003 + Math.random() * 0.005
      });
    }

    // ── Pulse beacons (ripple rings from random points) ───────────
    const beacons: Beacon[] = [];
    const spawnBeacon = () => {
      const x = width * 0.1 + Math.random() * width * 0.8;
      const y = height * 0.1 + Math.random() * height * 0.8;
      beacons.push({
        x, y,
        rings: [{ radius: 0, maxRadius: 80 + Math.random() * 60, alpha: 0.5, speed: 0.6 + Math.random() * 0.4 }],
        hue: 210 + Math.floor(Math.random() * 80),
        nextSpawn: 60 + Math.floor(Math.random() * 60)
      });
    };
    spawnBeacon();
    spawnBeacon();

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
      mouseRef.current.screenX = e.clientX;
      mouseRef.current.screenY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;

    // Grid settings
    const cols = 18;
    const rows = 14;
    const fov = 680;
    const cameraDistance = 950;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      time += 1;

      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.045;
      mouse.y += (mouse.targetY - mouse.y) * 0.045;

      const isDark = document.documentElement.classList.contains('dark');
      const baseOpacity = isDark ? 0.18 : 0.24;
      const spacing = Math.max(width, height) / 13;

      // ── 1. Background Fill ─────────────────────────────────────
      const gradientBg = ctx.createLinearGradient(0, 0, width, height);
      if (isDark) {
        gradientBg.addColorStop(0, '#070d1a');
        gradientBg.addColorStop(0.5, '#0b1120');
        gradientBg.addColorStop(1, '#0d1428');
      } else {
        gradientBg.addColorStop(0, '#f0f4ff');
        gradientBg.addColorStop(1, '#f8fafc');
      }
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, 0, width, height);

      // ── 2. Large Nebula Aurora blobs ───────────────────────────
      orbs.forEach((orb, i) => {
        orb.phase += orb.speed;
        const pulse = Math.sin(time * orb.pulseSpeed + i) * 0.3 + 1;
        const ox = orb.x + Math.sin(orb.phase * 0.7) * 80;
        const oy = orb.y + Math.cos(orb.phase * 0.5) * 60;
        const r = orb.radius * pulse;

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        const sat = isDark ? 85 : 75;
        const lit = isDark ? 60 : 55;
        grad.addColorStop(0, `hsla(${orb.hue}, ${sat}%, ${lit}%, ${isDark ? orb.opacity * 1.4 : orb.opacity * 0.7})`);
        grad.addColorStop(0.5, `hsla(${orb.hue + 20}, ${sat}%, ${lit}%, ${isDark ? orb.opacity * 0.6 : orb.opacity * 0.3})`);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── 3. Pulse beacon rings ──────────────────────────────────
      beacons.forEach((beacon) => {
        // Spawn new ring periodically
        beacon.nextSpawn--;
        if (beacon.nextSpawn <= 0) {
          beacon.rings.push({ radius: 0, maxRadius: 80 + Math.random() * 60, alpha: 0.45, speed: 0.55 + Math.random() * 0.4 });
          beacon.nextSpawn = 80 + Math.floor(Math.random() * 80);
        }

        beacon.rings = beacon.rings.filter(ring => ring.alpha > 0.005);
        beacon.rings.forEach(ring => {
          ring.radius += ring.speed;
          ring.alpha = (1 - ring.radius / ring.maxRadius) * 0.45;
          if (ring.radius < ring.maxRadius) {
            const sat = isDark ? 90 : 80;
            const lit = isDark ? 65 : 50;
            ctx.beginPath();
            ctx.arc(beacon.x, beacon.y, ring.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${beacon.hue}, ${sat}%, ${lit}%, ${ring.alpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        });

        // Center dot
        const dotAlpha = isDark ? 0.5 : 0.35;
        ctx.beginPath();
        ctx.arc(beacon.x, beacon.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${beacon.hue}, 95%, ${isDark ? 70 : 55}%, ${dotAlpha})`;
        ctx.fill();
      });

      // Occasionally relocate a beacon
      if (time % 480 === 0) {
        const idx = Math.floor(Math.random() * beacons.length);
        beacons[idx].x = width * 0.1 + Math.random() * width * 0.8;
        beacons[idx].y = height * 0.1 + Math.random() * height * 0.8;
        beacons[idx].hue = 210 + Math.floor(Math.random() * 80);
      }

      // ── 4. 3D Wireframe Wave Mesh ──────────────────────────────
      ctx.save();

      interface ProjectedNode {
        x: number; y: number;
        alpha: number; glow: number; hue: number; depth: number;
      }
      const nodes: ProjectedNode[][] = [];

      const pitch = 0.52 + mouse.y * 0.2;
      const yaw = 0.22 + mouse.x * 0.22;

      for (let c = 0; c < cols; c++) {
        nodes[c] = [];
        for (let r = 0; r < rows; r++) {
          const rawX = (c - (cols - 1) / 2) * spacing;
          const rawZ = (r - (rows - 1) / 2) * spacing;

          const dx = c - (cols - 1) / 2;
          const dz = r - (rows - 1) / 2;
          const dist = Math.sqrt(dx * dx + dz * dz);

          // Richer multi-layered wave equation
          let rawY = Math.sin(dist * 0.32 - time * 0.032) * 36;
          rawY += Math.cos(c * 0.42 + time * 0.018) * 18;
          rawY += Math.sin(r * 0.38 + time * 0.023) * 15;
          rawY += Math.sin((c + r) * 0.22 - time * 0.015) * 10;

          // Yaw rotation
          const x1 = rawX * Math.cos(yaw) - rawZ * Math.sin(yaw);
          const z1 = rawX * Math.sin(yaw) + rawZ * Math.cos(yaw);

          // Pitch rotation
          const y1 = rawY * Math.cos(pitch) - z1 * Math.sin(pitch);
          const z2 = rawY * Math.sin(pitch) + z1 * Math.cos(pitch);

          const scale = fov / (fov + z2 + cameraDistance);
          const projX = width / 2 + x1 * scale;
          const projY = height * 0.64 + y1 * scale;

          const depthPercentage = (z2 + cameraDistance) / 1900;
          const depthFade = Math.max(0, Math.min(1, 1.3 - depthPercentage));
          const edgeFadeC = Math.sin((c / (cols - 1)) * Math.PI);
          const edgeFadeR = Math.sin((r / (rows - 1)) * Math.PI);
          const nodeAlpha = depthFade * edgeFadeC * edgeFadeR * baseOpacity;

          const mouseDist = Math.hypot(projX - mouse.screenX, projY - mouse.screenY);
          const glow = mouseDist < 180 ? (1 - mouseDist / 180) * 1.1 : 0;

          // Gradient hue: cyan-blue to violet-purple
          const baseHue = isDark ? 195 : 210;
          const hue = Math.floor(baseHue + (c / cols) * 90 + Math.sin(time * 0.01 + r * 0.3) * 15);

          nodes[c][r] = { x: projX, y: projY, alpha: nodeAlpha, glow, hue, depth: depthFade };
        }
      }

      // Draw mesh lines (horizontal + vertical + diagonal)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const cur = nodes[c][r];
          const sat = isDark ? 88 : 90;
          const lit = isDark ? 62 : 50;

          // Horizontal
          if (c < cols - 1) {
            const nx = nodes[c + 1][r];
            const la = (cur.alpha + nx.alpha) / 2;
            if (la > 0.008) {
              ctx.beginPath();
              ctx.moveTo(cur.x, cur.y);
              ctx.lineTo(nx.x, nx.y);
              ctx.strokeStyle = `hsla(${Math.floor((cur.hue + nx.hue) / 2)}, ${sat}%, ${lit}%, ${la})`;
              ctx.lineWidth = isDark ? 0.9 : 1.1;
              ctx.stroke();
            }
          }

          // Vertical
          if (r < rows - 1) {
            const ny = nodes[c][r + 1];
            const la = (cur.alpha + ny.alpha) / 2;
            if (la > 0.008) {
              ctx.beginPath();
              ctx.moveTo(cur.x, cur.y);
              ctx.lineTo(ny.x, ny.y);
              ctx.strokeStyle = `hsla(${Math.floor((cur.hue + ny.hue) / 2)}, ${sat}%, ${lit}%, ${la})`;
              ctx.lineWidth = isDark ? 0.9 : 1.1;
              ctx.stroke();
            }
          }

          // Diagonal (top-right) — every other cell to reduce clutter
          if (c < cols - 1 && r < rows - 1 && (c + r) % 3 === 0) {
            const nd = nodes[c + 1][r + 1];
            const la = (cur.alpha + nd.alpha) / 2 * 0.55;
            if (la > 0.008) {
              ctx.beginPath();
              ctx.moveTo(cur.x, cur.y);
              ctx.lineTo(nd.x, nd.y);
              ctx.strokeStyle = `hsla(${Math.floor((cur.hue + nd.hue) / 2 + 30)}, ${sat}%, ${lit}%, ${la})`;
              ctx.lineWidth = 0.6;
              ctx.setLineDash([3, 5]);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      }

      // Draw nodes with glow halos
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const cur = nodes[c][r];
          if (cur.alpha < 0.015) continue;

          const nodeRadius = (isDark ? 1.4 : 1.7) + cur.glow * 3;

          if (cur.glow > 0.04) {
            // Outer halo
            const aura = 10 + cur.glow * 22;
            const grad = ctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, aura);
            grad.addColorStop(0, `hsla(${cur.hue}, 100%, ${isDark ? 70 : 55}%, ${cur.glow * (isDark ? 0.3 : 0.4)})`);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(cur.x, cur.y, aura, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.fillStyle = `hsla(${cur.hue}, 100%, ${isDark ? 72 : 48}%, ${cur.alpha * 1.6 + cur.glow * 0.9})`;
          ctx.arc(cur.x, cur.y, nodeRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // ── 5. Starfield particles ─────────────────────────────────
      ctx.save();
      motes.forEach((mote) => {
        mote.z -= mote.speed;
        if (mote.z <= -cameraDistance) {
          mote.z = 1100;
          mote.x = (Math.random() - 0.5) * width * 2.5;
          mote.y = (Math.random() - 0.5) * height * 2.5;
          mote.hue = 200 + Math.floor(Math.random() * 100);
        }

        const scale = fov / (fov + mote.z + cameraDistance);
        const projX = width / 2 + mote.x * scale - mouse.x * 28;
        const projY = height / 2 + mote.y * scale - mouse.y * 28;
        const size = mote.baseSize * scale;

        if (projX < -10 || projX > width + 10 || projY < -10 || projY > height + 10) return;

        const opacity = Math.max(0, Math.min(1, 1 - mote.z / 1100)) * (isDark ? 0.6 : 0.7);
        const speedBlur = mote.speed * scale * 3;

        ctx.beginPath();
        if (isDark) {
          // Colored star particles
          const showColor = mote.speed > 1.2;
          if (showColor) {
            ctx.fillStyle = `hsla(${mote.hue}, 80%, 75%, ${opacity * 0.8})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          }
          ctx.shadowBlur = size > 1 ? 5 : 2;
          ctx.shadowColor = showColor ? `hsla(${mote.hue}, 90%, 70%, 0.6)` : 'rgba(200,220,255,0.5)';
        } else {
          ctx.fillStyle = `rgba(37, 99, 235, ${opacity})`;
          ctx.shadowBlur = 0;
        }

        // Streak effect for fast particles
        if (speedBlur > 1.5 && isDark) {
          ctx.save();
          ctx.translate(projX, projY);
          const angle = Math.atan2(mote.y, mote.x);
          ctx.rotate(angle);
          ctx.fillRect(-speedBlur / 2, -size / 2, speedBlur, size);
          ctx.restore();
        } else {
          ctx.arc(projX, projY, size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
