'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { WishData } from './WishModal';

interface BalloonBouquetProps {
  wishes: WishData[];
  onSelectWish: (wish: WishData) => void;
}

interface BalloonBodyMeta {
  wish: WishData;
  radius: number;
  color: string;
  thumbnailUrl: string;
  stringLength: number;
  driftPhase: number;
}

export default function BalloonBouquet({ wishes, onSelectWish }: BalloonBouquetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const balloonBodiesRef = useRef<Map<string, { body: Matter.Body; meta: BalloonBodyMeta }>>(new Map());
  const thumbnailImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const handAnchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const onSelectWishRef = useRef(onSelectWish);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Keep callback reference updated without triggering re-initialization
  useEffect(() => {
    onSelectWishRef.current = onSelectWish;
  }, [onSelectWish]);

  // Preload thumbnail images with reliable caching
  const loadThumbnail = useCallback((wish: WishData) => {
    const key = String(wish.id);
    if (!thumbnailImagesRef.current.has(key)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = wish.imageData;
      thumbnailImagesRef.current.set(key, img);
    }
  }, []);

  // Sync wishes into Matter.js physics engine
  const syncWishes = useCallback(
    (currentWishes: WishData[], width: number, height: number) => {
      const engine = engineRef.current;
      if (!engine || width === 0 || height === 0) return;

      const { Bodies, World, Constraint } = Matter;
      const anchor = handAnchorRef.current;

      currentWishes.forEach((wish, index) => {
        const wishKey = String(wish.id || index);
        loadThumbnail(wish);

        if (!balloonBodiesRef.current.has(wishKey)) {
          // Natural size variation between 45px and 56px
          const radius = 46 + (index % 4) * 3.5;

          // Wide, natural spread across the top sky area
          const spreadRatio = ((index * 0.618033988749895) % 1) - 0.5;
          const spawnX = width / 2 + spreadRatio * (width * 0.75);
          const spawnY = height * 0.22 + ((index % 5) * 42) + Math.random() * 25;

          const balloon = Bodies.circle(spawnX, spawnY, radius, {
            restitution: 0.85,
            frictionAir: 0.045,
            density: 0.0005,
            collisionFilter: {
              group: 1,
            },
          });

          // Varied long strings allowing balloons to float freely across top sky
          const stringDistance = Math.min(height * 0.65, 480) + ((index % 7) - 3) * 35;

          const tether = Constraint.create({
            pointA: { x: anchor.x, y: anchor.y },
            bodyB: balloon,
            stiffness: 0.008,
            damping: 0.06,
            length: stringDistance,
          });

          World.add(engine.world, [balloon, tether]);

          balloonBodiesRef.current.set(wishKey, {
            body: balloon,
            meta: {
              wish,
              radius,
              color: wish.color || '#f43f5e',
              thumbnailUrl: wish.imageData,
              stringLength: stringDistance,
              driftPhase: Math.random() * Math.PI * 2,
            },
          });
        }
      });
    },
    [loadThumbnail]
  );

  // ResizeObserver for rock-solid viewport tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions((prev) => {
          if (prev.width === Math.round(rect.width) && prev.height === Math.round(rect.height)) {
            return prev;
          }
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Initialize & run Matter.js physics engine (only when dimensions change)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const { Engine, World, Bodies, Body, Runner, Events } = Matter;
    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // Hands position of the couple holding strings at bottom center
    const handX = width / 2;
    const handY = height - 110;
    handAnchorRef.current = { x: handX, y: handY };

    // Gentle upward helium buoyancy
    const engine = Engine.create({
      gravity: {
        x: 0,
        y: -0.06,
        scale: 0.001,
      },
    });
    engineRef.current = engine;

    // Viewport boundaries to keep all balloons floating freely inside visible sky
    const ceiling = Bodies.rectangle(width / 2, 30, width * 2, 60, { isStatic: true });
    const leftWall = Bodies.rectangle(15, height / 2, 40, height * 2, { isStatic: true });
    const rightWall = Bodies.rectangle(width - 15, height / 2, 40, height * 2, { isStatic: true });
    const floor = Bodies.rectangle(width / 2, height + 60, width * 2, 60, { isStatic: true });

    World.add(engine.world, [ceiling, leftWall, rightWall, floor]);

    // Populate existing wishes immediately on engine start
    balloonBodiesRef.current.clear();
    syncWishes(wishes, width, height);

    // Natural multi-layer floating breeze & gentle spreading across the sky
    Events.on(engine, 'beforeUpdate', () => {
      const time = Date.now() * 0.001;
      balloonBodiesRef.current.forEach(({ body, meta }) => {
        // Individual organic drift
        const swayX = Math.sin(time * 0.8 + meta.driftPhase) * 0.0002;
        const swayY = Math.cos(time * 0.5 + meta.driftPhase) * 0.0001;
        Body.applyForce(body, body.position, { x: swayX, y: -0.00015 + swayY });

        // Keep velocity gentle and smooth
        const maxV = 2.8;
        if (body.velocity.y < -maxV) Body.setVelocity(body, { x: body.velocity.x, y: -maxV });
        if (body.velocity.y > maxV) Body.setVelocity(body, { x: body.velocity.x, y: maxV });
        if (body.velocity.x < -maxV) Body.setVelocity(body, { x: -maxV, y: body.velocity.y });
        if (body.velocity.x > maxV) Body.setVelocity(body, { x: maxV, y: body.velocity.y });

        // Keep inside top visible zone
        if (body.position.y < meta.radius + 45) {
          Body.setPosition(body, { x: body.position.x, y: meta.radius + 48 });
          Body.setVelocity(body, { x: body.velocity.x, y: 0.1 });
        }
      });
    });

    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    // Render loop
    let animationFrameId: number;

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      const anchor = handAnchorRef.current;

      // 1. Draw Balloon Strings (Tethered down to couple's hands)
      balloonBodiesRef.current.forEach(({ body, meta }) => {
        const { x, y } = body.position;
        const radius = meta.radius;
        const balloonBottomY = y + radius * 0.9;

        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);

        // Smooth organic catenary curve for long strings
        const swayOffset = Math.sin(Date.now() * 0.0015 + meta.driftPhase) * 16;
        const ctrlX = (anchor.x + x) / 2 + swayOffset;
        const ctrlY = (anchor.y + balloonBottomY) / 2 + 10;

        ctx.quadraticCurveTo(ctrlX, ctrlY, x, balloonBottomY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Knot
        ctx.beginPath();
        ctx.arc(x, balloonBottomY, 3, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();
      });

      // 2. Draw Floating Balloons & Snapshots
      balloonBodiesRef.current.forEach(({ body, meta }) => {
        const { x, y } = body.position;
        const radius = meta.radius;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(body.angle * 0.15);

        // Soft outer glow
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = 20;

        // Balloon Body
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius * 1.15, 0, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();

        // Inner snapshot clipping
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.05, radius * 0.82, radius * 0.92, 0, 0, Math.PI * 2);
        ctx.clip();

        const img = thumbnailImagesRef.current.get(String(meta.wish.id));
        if (img && img.complete && img.naturalWidth !== 0) {
          ctx.drawImage(img, -radius * 0.82, -radius * 0.92, radius * 1.64, radius * 1.84);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.fill();
        }
        ctx.restore();

        // 3D Gloss highlight
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(-radius * 0.35, -radius * 0.45, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();

        // Balloon border
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius * 1.15, 0, 0, Math.PI * 2);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Click handler to open wish modal
    const handleCanvasClick = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      balloonBodiesRef.current.forEach(({ body, meta }) => {
        const dx = clickX - body.position.x;
        const dy = clickY - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= meta.radius * 1.2) {
          onSelectWishRef.current(meta.wish);
        }
      });
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);
      if (runnerRef.current) Runner.stop(runnerRef.current);
      if (engineRef.current) World.clear(engineRef.current.world, false);
      balloonBodiesRef.current.clear();
    };
  }, [dimensions.width, dimensions.height]); // Strictly only recreate on true window dimension changes

  // Update when new wishes arrive incrementally
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      syncWishes(wishes, dimensions.width, dimensions.height);
    }
  }, [wishes, syncWishes, dimensions]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* 2D Physics Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-pointer z-10" />

      {/* Central Couple Silhouette Illustration (Hands holding strings) */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
        <svg
          viewBox="0 0 280 200"
          className="w-48 md:w-64 h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Back Glow */}
          <circle cx="140" cy="140" r="100" fill="url(#coupleGlow)" opacity="0.15" />
          <defs>
            <radialGradient id="coupleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Groom Silhouette (Left) */}
          <path
            d="M 90 195 C 90 160, 100 130, 115 110 C 108 102, 106 90, 112 80 C 118 70, 130 68, 136 75 C 138 85, 134 98, 128 105 C 138 120, 142 145, 142 195 Z"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* Bride Silhouette (Right with dress & veil) */}
          <path
            d="M 140 195 C 140 150, 145 125, 155 105 C 150 98, 148 85, 154 75 C 160 65, 172 65, 178 72 C 182 82, 178 95, 170 102 C 185 120, 205 155, 215 195 Z"
            fill="#334155"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {/* Bride's Veil Highlight */}
          <path
            d="M 170 80 C 190 90, 210 130, 220 190"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 2"
          />

          {/* Hands holding the bouquet string anchor */}
          <circle cx="140" cy="90" r="5" fill="#f43f5e" />
          <circle cx="140" cy="90" r="9" stroke="#f43f5e" strokeWidth="1.5" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
