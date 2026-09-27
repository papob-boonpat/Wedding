'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { WishData } from './WishModal';

interface GachaponBoxProps {
  wishes: WishData[];
  onSelectWish: (wish: WishData) => void;
  newWishId?: string | number | null;
}

interface BallMeta {
  wish: WishData;
  radius: number;
  color: string;
  angleOffset: number;
  highlightAngle: number;
}

type DrawPhase = 'idle' | 'churn' | 'spotlight';

interface DrawState {
  phase: DrawPhase;
  winnerKey: string | null;
  highlightKey: string | null;
  startedAt: number;
}

interface CapsuleSprite {
  canvas: HTMLCanvasElement;
  cx: number;
  cy: number;
}

const spriteCache = new Map<string, CapsuleSprite>();

// Lucky draw choreography (ms)
const CHURN_MS = 2400;
const SPOTLIGHT_MS = 2100;
const SHAKE_INTERVAL_MS = 420;
const HIGHLIGHT_CYCLE_MS = 90;
const WINNER_RISE_MS = 900;

function getCapsuleSprite(color: string, radius: number): CapsuleSprite {
  const key = `${color}_${radius}`;
  const existing = spriteCache.get(key);
  if (existing) return existing;

  const pad = 14;
  const size = (radius + pad) * 2;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  const cx = radius + pad;
  const cy = radius + pad;

  if (!ctx) {
    return { canvas: offscreen, cx, cy };
  }

  ctx.save();
  ctx.translate(cx, cy);

  // 1. Ambient Occlusion / Contact Drop Shadow beneath ball
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.32)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fill();
  ctx.restore();

  // 2. Base Colored Hemisphere (Bottom Half)
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // 3D Spherical shading on colored half (light source from top-left)
  const shadeGrad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.1, radius * 0.1, 0, 0, radius);
  shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  shadeGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  shadeGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
  shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
  ctx.fillStyle = shadeGrad;
  ctx.fill();

  // 3. Crystal / Translucent Top Dome (Top Half)
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, 0);
  const domeGrad = ctx.createLinearGradient(0, -radius, 0, 0);
  domeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  domeGrad.addColorStop(0.35, 'rgba(250, 250, 252, 0.7)');
  domeGrad.addColorStop(0.7, 'rgba(241, 245, 249, 0.45)');
  domeGrad.addColorStop(1, 'rgba(226, 232, 240, 0.65)');
  ctx.fillStyle = domeGrad;
  ctx.fill();

  // Jewel candy color tint over crystal dome
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, 0);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.26;
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Subtle interior glass tint for realistic acrylic refraction
  ctx.beginPath();
  ctx.arc(0, 0, radius - 1, Math.PI, 0);
  const tintGrad = ctx.createRadialGradient(0, -radius * 0.4, 1, 0, 0, radius);
  tintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  tintGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.0)');
  tintGrad.addColorStop(1, 'rgba(15, 23, 42, 0.15)');
  ctx.fillStyle = tintGrad;
  ctx.fill();

  // 4. Miniature Folded Wedding Wish Scroll / Golden Ticket inside top dome
  ctx.save();
  ctx.translate(0, -radius * 0.42);
  const ticketW = radius * 0.74;
  const ticketH = radius * 0.42;
  ctx.beginPath();
  ctx.roundRect(-ticketW / 2, -ticketH / 2, ticketW, ticketH, 3);
  ctx.fillStyle = '#fffdf7';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e2d3b3';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cute Little Heart Ribbon Seal on the scroll
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = '#e11d48';
  ctx.fill();
  ctx.restore();

  // 5. Center Seam Ring (Gold Metallic Band with Interlocking Latch)
  ctx.beginPath();
  ctx.ellipse(0, 0, radius + 0.5, radius * 0.18, 0, 0, Math.PI * 2);
  const seamGrad = ctx.createLinearGradient(-radius, 0, radius, 0);
  seamGrad.addColorStop(0, '#d97706');
  seamGrad.addColorStop(0.3, '#fef08a');
  seamGrad.addColorStop(0.7, '#f59e0b');
  seamGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = seamGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 6. Specular High-Gloss Highlights on Crystal Dome
  // Primary curved shine
  ctx.beginPath();
  ctx.ellipse(-radius * 0.34, -radius * 0.48, radius * 0.34, radius * 0.16, -Math.PI / 4.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();

  // Secondary rim reflex
  ctx.beginPath();
  ctx.ellipse(radius * 0.42, -radius * 0.3, radius * 0.14, radius * 0.08, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fill();

  // Bottom-edge soft rim reflex
  ctx.beginPath();
  ctx.arc(0, 0, radius - 1.5, Math.PI * 0.2, Math.PI * 0.8);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 7. Crisp Outer Contour Outline (Critical for separation and contrast against neighbors)
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();

  const sprite: CapsuleSprite = { canvas: offscreen, cx, cy };
  spriteCache.set(key, sprite);
  return sprite;
}

export default function GachaponBox({ wishes, onSelectWish }: GachaponBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballBodiesRef = useRef<Map<string, { body: Matter.Body; meta: BallMeta }>>(new Map());
  const onSelectWishRef = useRef(onSelectWish);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Lucky draw ("gacha pickup") state. The canvas render loop closes over its
  // initial scope, so every value it needs lives in a ref, never in useState.
  const drawStateRef = useRef<DrawState>({
    phase: 'idle',
    winnerKey: null,
    highlightKey: null,
    startedAt: 0,
  });
  const drawTimeoutsRef = useRef<number[]>([]);
  const drawIntervalsRef = useRef<number[]>([]);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>('idle');
  const [winnerWish, setWinnerWish] = useState<WishData | null>(null);

  useEffect(() => {
    onSelectWishRef.current = onSelectWish;
  }, [onSelectWish]);

  // Stop any running draw and restore the engine to its idle state
  const cancelDraw = useCallback(() => {
    drawTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    drawIntervalsRef.current.forEach((t) => window.clearInterval(t));
    drawTimeoutsRef.current = [];
    drawIntervalsRef.current = [];

    const winnerKey = drawStateRef.current.winnerKey;
    if (winnerKey) {
      const entry = ballBodiesRef.current.get(winnerKey);
      if (entry) {
        entry.body.isSensor = false;
        // Held motionless through the spotlight, the winner has fallen asleep by now
        // and would hang in mid-air ignoring gravity. Wake it and drop it back home.
        Matter.Sleeping.set(entry.body, false);
        Matter.Body.setVelocity(entry.body, { x: (Math.random() - 0.5) * 1.5, y: 1.5 });
        Matter.Body.setAngularVelocity(entry.body, (Math.random() - 0.5) * 0.12);
      }
    }

    drawStateRef.current = { phase: 'idle', winnerKey: null, highlightKey: null, startedAt: 0 };
  }, []);

  // Turn the dial: shake the capsules, then spotlight one at random
  const startLuckyDraw = useCallback(() => {
    if (drawStateRef.current.phase !== 'idle') return;
    if (ballBodiesRef.current.size === 0) return;

    setWinnerWish(null);
    drawStateRef.current = {
      phase: 'churn',
      winnerKey: null,
      highlightKey: null,
      startedAt: performance.now(),
    };
    setDrawPhase('churn');

    // Sleeping bodies ignore forces, so wake each capsule before tossing it
    const shake = () => {
      ballBodiesRef.current.forEach(({ body }) => {
        if (body.isSleeping) Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * 0.06,
          y: -0.045 - Math.random() * 0.035,
        });
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
      });
    };

    shake();
    drawIntervalsRef.current.push(window.setInterval(shake, SHAKE_INTERVAL_MS));

    // Suspense: flick the highlight ring between random capsules
    drawIntervalsRef.current.push(
      window.setInterval(() => {
        const keys = Array.from(ballBodiesRef.current.keys());
        drawStateRef.current.highlightKey =
          keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : null;
      }, HIGHLIGHT_CYCLE_MS)
    );

    drawTimeoutsRef.current.push(
      window.setTimeout(() => {
        drawIntervalsRef.current.forEach((t) => window.clearInterval(t));
        drawIntervalsRef.current = [];

        // Pick from the bodies (not the wishes array) so the winner always has
        // something to animate, and snapshot the wish before the next poll
        // replaces the array underneath us.
        const keys = Array.from(ballBodiesRef.current.keys());
        const winnerKey = keys[Math.floor(Math.random() * keys.length)];
        const entry = winnerKey ? ballBodiesRef.current.get(winnerKey) : undefined;

        if (!entry) {
          cancelDraw();
          setDrawPhase('idle');
          return;
        }

        const winner = entry.meta.wish;

        drawStateRef.current = {
          phase: 'spotlight',
          winnerKey,
          highlightKey: winnerKey,
          startedAt: performance.now(),
        };
        setDrawPhase('spotlight');
        setWinnerWish(winner);

        // Let the winning capsule rise free of the pile
        entry.body.isSensor = true;
        Matter.Sleeping.set(entry.body, false);
        Matter.Body.setVelocity(entry.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(entry.body, 0);

        drawTimeoutsRef.current.push(
          window.setTimeout(() => {
            cancelDraw();
            setDrawPhase('idle');
            onSelectWishRef.current(winner);
          }, SPOTLIGHT_MS)
        );
      }, CHURN_MS)
    );
  }, [cancelDraw]);

  // Compute container boundaries inside the glass box
  const getGlassBounds = useCallback((width: number, height: number) => {
    // Center the gachapon glass chamber - generously sized for stage display
    const boxWidth = Math.min(width * 0.88, 1180);
    const boxHeight = Math.min(height * 0.73, 760);
    const left = (width - boxWidth) / 2;
    const right = left + boxWidth;
    const top = Math.max(68, height * 0.095);
    const bottom = top + boxHeight;

    return { boxWidth, boxHeight, left, right, top, bottom };
  }, []);

  // Sync wishes with physics bodies
  const syncWishes = useCallback(
    (currentWishes: WishData[], width: number, height: number) => {
      const engine = engineRef.current;
      if (!engine || width === 0 || height === 0) return;

      const { Bodies, World } = Matter;
      const bounds = getGlassBounds(width, height);
      const isInitialSync = ballBodiesRef.current.size === 0 && currentWishes.length > 0;

      currentWishes.forEach((wish, index) => {
        const wishKey = String(wish.id);

        if (!ballBodiesRef.current.has(wishKey)) {
          // Ball radius tailored for screen
          const radius = width < 640 ? 24 : 32;

          let spawnX: number;
          let spawnY: number;

          if (isInitialSync) {
            // Distribute pre-existing balls evenly across the floor area so they settle smoothly
            const margin = radius + 20;
            const innerLeft = bounds.left + margin;
            const innerRight = bounds.right - margin;
            const span = Math.max(120, innerRight - innerLeft);

            const cols = Math.max(4, Math.floor(span / (radius * 2.1)));
            const col = index % cols;
            const row = Math.floor(index / cols);

            // Stagger alternate rows to form a natural ball pile
            const colWidth = span / cols;
            const stagger = (row % 2) * (colWidth * 0.5);
            spawnX = innerLeft + ((col * colWidth + stagger) % span) + radius * 0.2;
            const floorY = bounds.bottom - radius - 10;
            spawnY = Math.max(bounds.top + radius + 15, floorY - row * (radius * 1.6));
          } else {
            // New incoming wish drops from a random position across the width of the box
            const margin = radius + 35;
            const minX = bounds.left + margin;
            const maxX = bounds.right - margin;
            spawnX = minX + Math.random() * (maxX - minX);
            spawnY = bounds.top + radius + 15;
          }

          const ball = Bodies.circle(spawnX, spawnY, radius, {
            restitution: 0.45, // Soft bounciness so balls settle quickly without jitter
            friction: 0.35,
            frictionAir: 0.025,
            density: 0.002,
            sleepThreshold: 25, // Fall asleep quickly when resting to save CPU
            angle: Math.random() * Math.PI * 2,
          });

          // Give a natural random initial velocity downwards with horizontal drift and spin
          if (!isInitialSync) {
            Matter.Body.setVelocity(ball, {
              x: (Math.random() - 0.5) * 3.5,
              y: 4 + Math.random() * 3,
            });
            Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.15);
          }

          World.add(engine.world, ball);

          ballBodiesRef.current.set(wishKey, {
            body: ball,
            meta: {
              wish,
              radius,
              color: wish.color || '#f43f5e',
              angleOffset: Math.random() * Math.PI * 2,
              highlightAngle: -Math.PI / 4,
            },
          });
        }
      });
    },
    [getGlassBounds]
  );

  // ResizeObserver for tracking dimensions
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

  // Initialize Matter.js engine & setup boundaries
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const { Engine, World, Bodies, Runner } = Matter;
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

    const engine = Engine.create({
      enableSleeping: true,
      positionIterations: 4,
      velocityIterations: 2,
      constraintIterations: 1,
      gravity: {
        x: 0,
        y: 0.95, // Realistic gravity for dropping balls
        scale: 0.001,
      },
    });
    engineRef.current = engine;

    const bounds = getGlassBounds(width, height);
    const wallThickness = 60;

    // Glass Chamber Interior Walls
    const leftWall = Bodies.rectangle(
      bounds.left - wallThickness / 2,
      bounds.top + bounds.boxHeight / 2,
      wallThickness,
      bounds.boxHeight + 100,
      { isStatic: true, friction: 0.3, restitution: 0.5 }
    );

    const rightWall = Bodies.rectangle(
      bounds.right + wallThickness / 2,
      bounds.top + bounds.boxHeight / 2,
      wallThickness,
      bounds.boxHeight + 100,
      { isStatic: true, friction: 0.3, restitution: 0.5 }
    );

    const floor = Bodies.rectangle(
      (bounds.left + bounds.right) / 2,
      bounds.bottom + wallThickness / 2,
      bounds.boxWidth + wallThickness * 2,
      wallThickness,
      { isStatic: true, friction: 0.4, restitution: 0.4 }
    );

    // Top Ceiling of glass chamber
    const ceiling = Bodies.rectangle(
      (bounds.left + bounds.right) / 2,
      bounds.top - wallThickness / 2,
      bounds.boxWidth + wallThickness * 2,
      wallThickness,
      { isStatic: true, friction: 0.3, restitution: 0.4 }
    );

    World.add(engine.world, [leftWall, rightWall, floor, ceiling]);

    // Populate existing wishes
    ballBodiesRef.current.clear();
    syncWishes(wishes, width, height);

    const runner = Runner.create({
      isFixed: true,
      delta: 1000 / 60,
    });
    Runner.run(runner, engine);
    runnerRef.current = runner;

    // Canvas Render Loop
    let animationFrameId: number;

    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      const b = getGlassBounds(width, height);

      // --- 1. Draw Glass Box Background / Luminous Crystal Shading ---
      ctx.save();
      const glassCornerRadius = 32;
      ctx.beginPath();
      ctx.roundRect(b.left, b.top, b.boxWidth, b.boxHeight, [glassCornerRadius, glassCornerRadius, 18, 18]);

      // Warm champagne & rose quartz depth backing (rich contrast against white and light spheres)
      const glassBgGrad = ctx.createLinearGradient(b.left, b.top, b.left, b.bottom);
      glassBgGrad.addColorStop(0, 'rgba(255, 250, 246, 0.94)');
      glassBgGrad.addColorStop(0.4, 'rgba(255, 242, 244, 0.92)');
      glassBgGrad.addColorStop(1, 'rgba(253, 230, 235, 0.96)');
      ctx.fillStyle = glassBgGrad;
      ctx.fill();

      // Interior 3D Cabinet Ambient Shadow Vignette
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.18)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Floor Shadow & Depth Grille inside chamber
      const floorGrad = ctx.createLinearGradient(b.left, b.bottom - 45, b.left, b.bottom);
      floorGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      floorGrad.addColorStop(1, 'rgba(15, 23, 42, 0.12)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(b.left + 4, b.bottom - 45, b.boxWidth - 8, 45);

      ctx.restore();

      // --- 2. Draw Wish Balls (Hardware-accelerated pre-cached capsule sprites) ---
      const draw = drawStateRef.current;
      const now = performance.now();
      const isSpotlight = draw.phase === 'spotlight' && !!draw.winnerKey;
      const winnerEntry = draw.winnerKey ? ballBodiesRef.current.get(draw.winnerKey) : undefined;

      // Float the winning capsule up to the centre of the chamber
      if (isSpotlight && winnerEntry) {
        const rise = Math.min(1, (now - draw.startedAt) / WINNER_RISE_MS);
        const ease = 1 - Math.pow(1 - rise, 3);
        const targetX = (b.left + b.right) / 2;
        const targetY = b.top + b.boxHeight * 0.36;
        const pos = winnerEntry.body.position;
        Matter.Body.setPosition(winnerEntry.body, {
          x: pos.x + (targetX - pos.x) * (0.05 + 0.13 * ease),
          y: pos.y + (targetY - pos.y) * (0.05 + 0.13 * ease),
        });
        Matter.Body.setVelocity(winnerEntry.body, { x: 0, y: 0 });
        Matter.Body.setAngle(winnerEntry.body, winnerEntry.body.angle + 0.035);
        if (winnerEntry.body.isSleeping) Matter.Sleeping.set(winnerEntry.body, false);
      }

      const drawCapsule = (
        body: Matter.Body,
        meta: BallMeta,
        opts: { alpha: number; scale: number; halo: number; ring: string | null }
      ) => {
        const { x, y } = body.position;
        const radius = meta.radius;
        const sprite = getCapsuleSprite(meta.color, radius);

        ctx.save();
        ctx.globalAlpha = opts.alpha;
        ctx.translate(x, y);

        // Radiant winner halo (drawn unrotated so it stays a steady glow)
        if (opts.halo > 0) {
          const haloR = radius * (2.2 + opts.halo * 0.9);
          const haloGrad = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, haloR);
          haloGrad.addColorStop(0, `rgba(253, 224, 71, ${0.55 * opts.halo})`);
          haloGrad.addColorStop(0.55, `rgba(251, 113, 133, ${0.28 * opts.halo})`);
          haloGrad.addColorStop(1, 'rgba(251, 113, 133, 0)');
          ctx.beginPath();
          ctx.arc(0, 0, haloR, 0, Math.PI * 2);
          ctx.fillStyle = haloGrad;
          ctx.fill();

          // Pulsing sparkle rays
          ctx.save();
          ctx.rotate((now / 1400) % (Math.PI * 2));
          ctx.strokeStyle = `rgba(253, 224, 71, ${0.5 * opts.halo})`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 12; i += 1) {
            const a = (i / 12) * Math.PI * 2;
            const inner = radius * 1.35 * opts.scale;
            const outer = inner + radius * (0.35 + 0.25 * Math.sin(now / 180 + i));
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
            ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.scale(opts.scale, opts.scale);
        ctx.save();
        ctx.rotate(body.angle);

        // Blit pre-cached capsule sprite
        ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy);

        // High-contrast Wish ID Medallion (Center Seal Clasp)
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1.5;

        // Outer gold bezel ring
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = '#d97706';
        ctx.fill();

        // Inner crisp white enamel face
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Sharp dark text
        ctx.fillStyle = '#0f172a';
        ctx.font = `900 ${Math.round(radius * 0.38)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${meta.wish.id}`, 0, 1);
        ctx.restore();

        ctx.restore();

        // Selection ring (suspense highlight / locked winner), unrotated
        if (opts.ring) {
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.22, 0, Math.PI * 2);
          ctx.strokeStyle = opts.ring;
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        ctx.restore();
      };

      // Everyone but the winner
      ballBodiesRef.current.forEach(({ body, meta }, key) => {
        if (isSpotlight && key === draw.winnerKey) return;
        const highlighted = draw.phase === 'churn' && key === draw.highlightKey;
        drawCapsule(body, meta, {
          alpha: 1,
          scale: 1,
          halo: 0,
          ring: highlighted ? 'rgba(251, 191, 36, 0.95)' : null,
        });
      });

      // --- 3. Draw Crystal Glass Reflection & Metallic Rim Overlays ---
      ctx.save();

      // Glass Outer Metallic Bezel (Rose Gold + Champagne Gold)
      ctx.beginPath();
      ctx.roundRect(b.left, b.top, b.boxWidth, b.boxHeight, [32, 32, 18, 18]);
      ctx.lineWidth = 5;
      const borderGrad = ctx.createLinearGradient(b.left, b.top, b.right, b.bottom);
      borderGrad.addColorStop(0, '#f43f5e');
      borderGrad.addColorStop(0.25, '#fb7185');
      borderGrad.addColorStop(0.5, '#f59e0b');
      borderGrad.addColorStop(0.75, '#fb7185');
      borderGrad.addColorStop(1, '#e11d48');
      ctx.strokeStyle = borderGrad;
      ctx.stroke();

      // Inner Glass Bevel Highlight Line
      ctx.beginPath();
      ctx.roundRect(b.left + 3, b.top + 3, b.boxWidth - 6, b.boxHeight - 6, [29, 29, 15, 15]);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.stroke();

      // 4 Metallic Corner Brackets with gold rivets
      const drawRivet = (x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      };
      drawRivet(b.left + 24, b.top + 24);
      drawRivet(b.right - 24, b.top + 24);
      drawRivet(b.left + 24, b.bottom - 24);
      drawRivet(b.right - 24, b.bottom - 24);

      // Angled Specular Reflection Sweeps across the glass chamber (scaled dynamically)
      const refW1 = Math.min(220, b.boxWidth * 0.2);
      ctx.beginPath();
      ctx.moveTo(b.left + 35, b.top + 2);
      ctx.lineTo(b.left + 35 + refW1, b.top + 2);
      ctx.lineTo(b.left + 35 + refW1 * 0.45, b.bottom - 2);
      ctx.lineTo(b.left + 15, b.bottom - 2);
      ctx.closePath();
      const streakGrad = ctx.createLinearGradient(b.left + 35, b.top, b.left + 140, b.bottom);
      streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
      streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0.35)');
      ctx.fillStyle = streakGrad;
      ctx.fill();

      // Second thin reflection streak
      const refW2 = Math.min(60, b.boxWidth * 0.05);
      const refOffset2 = Math.min(320, b.boxWidth * 0.28);
      ctx.beginPath();
      ctx.moveTo(b.left + refOffset2, b.top + 2);
      ctx.lineTo(b.left + refOffset2 + refW2, b.top + 2);
      ctx.lineTo(b.left + refOffset2 * 0.65, b.bottom - 2);
      ctx.lineTo(b.left + refOffset2 * 0.65 - refW2, b.bottom - 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();

      ctx.restore();

      // --- 4. Spotlight: dim the chamber, then stage the winning capsule above
      // the glass overlays (drawing it before them turned the specular
      // streaks into grey smears across the darkened chamber).
      // Dim the chamber behind the winner, then draw it on top
      if (isSpotlight && winnerEntry) {
        const fade = Math.min(1, (now - draw.startedAt) / 450);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(b.left, b.top, b.boxWidth, b.boxHeight, [32, 32, 18, 18]);
        ctx.clip();
        ctx.fillStyle = `rgba(15, 23, 42, ${0.5 * fade})`;
        ctx.fillRect(b.left, b.top, b.boxWidth, b.boxHeight);

        // Warm stage beam from the drop chute down onto the winner
        const beam = ctx.createLinearGradient(0, b.top, 0, winnerEntry.body.position.y + 40);
        beam.addColorStop(0, `rgba(253, 224, 71, ${0.3 * fade})`);
        beam.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.beginPath();
        ctx.moveTo((b.left + b.right) / 2 - 40, b.top);
        ctx.lineTo((b.left + b.right) / 2 + 40, b.top);
        ctx.lineTo(winnerEntry.body.position.x + 150, winnerEntry.body.position.y + 40);
        ctx.lineTo(winnerEntry.body.position.x - 150, winnerEntry.body.position.y + 40);
        ctx.closePath();
        ctx.fillStyle = beam;
        ctx.fill();
        ctx.restore();

        const pop = Math.min(1, (now - draw.startedAt) / WINNER_RISE_MS);
        drawCapsule(winnerEntry.body, winnerEntry.meta, {
          alpha: 1,
          scale: 1 + 0.75 * (1 - Math.pow(1 - pop, 3)),
          halo: fade,
          ring: 'rgba(253, 224, 71, 0.95)',
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Click/Tap handling on wish balls
    const handleCanvasClick = (e: MouseEvent | TouchEvent) => {
      // The draw owns the stage while it runs
      if (drawStateRef.current.phase !== 'idle') return;

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      let clickedWish: WishData | null = null;
      let minDistance = Infinity;

      ballBodiesRef.current.forEach(({ body, meta }) => {
        const dx = clickX - body.position.x;
        const dy = clickY - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Generous tap hit area
        if (dist <= meta.radius * 1.3 && dist < minDistance) {
          minDistance = dist;
          clickedWish = meta.wish;
          // Wake up sleeping body and apply a gentle joyful bounce to the clicked ball
          if (body.isSleeping) {
            Matter.Sleeping.set(body, false);
          }
          Matter.Body.applyForce(body, body.position, {
            x: (Math.random() - 0.5) * 0.04,
            y: -0.06,
          });
        }
      });

      if (clickedWish) {
        onSelectWishRef.current(clickedWish);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);
      cancelDraw();
      setDrawPhase('idle');
      if (runnerRef.current) Runner.stop(runnerRef.current);
      if (engineRef.current) World.clear(engineRef.current.world, false);
      ballBodiesRef.current.clear();
    };
  }, [dimensions.width, dimensions.height, getGlassBounds, syncWishes, cancelDraw]);

  // Never leave timers running behind an unmounted display
  useEffect(() => cancelDraw, [cancelDraw]);

  // Sync new incoming wishes incrementally
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      syncWishes(wishes, dimensions.width, dimensions.height);
    }
  }, [wishes, syncWishes, dimensions]);

  const bounds = getGlassBounds(dimensions.width || 800, dimensions.height || 600);
  const isDrawing = drawPhase !== 'idle';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden flex items-center justify-center">
      {/* 2D Physics Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-pointer z-10" />

      {/* Interactive Layer: the turn dial lives above the canvas (z-10) so it can be clicked */}
      {dimensions.width > 0 && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: `${bounds.left - 36}px`,
            top: `${bounds.top - 68}px`,
            width: `${bounds.boxWidth + 72}px`,
            height: `${bounds.boxHeight + 168}px`,
          }}
        >
          <div className="absolute bottom-0 inset-x-0 h-28 flex items-center justify-center">
            {/* `relative` + an absolutely placed label keeps the knob itself dead centre
                on the pedestal, whatever the label text is */}
            <div className="relative flex items-center">
              <div className="absolute right-full mr-4 flex flex-col items-end whitespace-nowrap">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  LUCKY DRAW
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isDrawing ? 'กำลังสุ่มลูกบอล...' : 'หมุนสุ่มรับพร'}
                </span>
              </div>

            <button
              type="button"
              onClick={startLuckyDraw}
              disabled={isDrawing || wishes.length === 0}
              title={wishes.length === 0 ? 'ยังไม่มีคำอวยพรให้สุ่ม' : 'หมุนสุ่มคำอวยพร'}
              aria-label="หมุนสุ่มคำอวยพร"
              className={`pointer-events-auto relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-yellow-100 border-4 border-amber-600 shadow-[0_10px_24px_rgba(217,119,6,0.45)] flex items-center justify-center transition-transform duration-300 ${
                wishes.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : isDrawing
                    ? 'cursor-wait animate-spin'
                    : 'cursor-pointer hover:rotate-45 hover:scale-105 active:scale-95'
              }`}
            >
              {/* Outer knurled dial ring */}
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-amber-700/40" />
              {/* Center 3D Rotary Knob Handle */}
              <div className="w-7 h-16 bg-gradient-to-b from-rose-800 via-rose-600 to-rose-900 rounded-full shadow-lg border-2 border-rose-950/30 flex items-center justify-center">
                <div className="w-1.5 h-9 bg-amber-300/80 rounded-full" />
              </div>
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw status banner over the glass chamber */}
      {isDrawing && dimensions.width > 0 && (
        <div
          className="absolute z-20 pointer-events-none flex justify-center"
          style={{ left: `${bounds.left}px`, width: `${bounds.boxWidth}px`, top: `${bounds.top + 18}px` }}
        >
          <div className="px-6 py-2.5 rounded-full bg-rose-950/75 backdrop-blur-md border border-amber-300/70 shadow-2xl text-center">
            {drawPhase === 'churn' ? (
              <span className="text-sm font-serif font-bold text-amber-200 tracking-widest">
                ✦ กำลังสุ่มลูกบอลคำอวยพร ✦
              </span>
            ) : (
              <>
                <div className="text-sm font-serif font-bold text-amber-200 tracking-widest">
                  ✦ ลูกบอลนำโชค #{winnerWish?.id} ✦
                </div>
                <div className="text-[11px] text-rose-100/90 font-medium mt-0.5">
                  คำอวยพรจาก {winnerWish?.guestName || 'ผู้ร่วมงาน'}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Decorative Gachapon Machine Structure Backdrop & Frame */}
      {dimensions.width > 0 && (
        <div
          className="absolute pointer-events-none z-0 transition-all"
          style={{
            left: `${bounds.left - 36}px`,
            top: `${bounds.top - 68}px`,
            width: `${bounds.boxWidth + 72}px`,
            height: `${bounds.boxHeight + 168}px`,
          }}
        >
          {/* Main Chassis Drop Shadow Frame */}
          <div
            className="absolute inset-0 rounded-[44px] pointer-events-none"
            style={{
              boxShadow:
                '0 30px 80px -15px rgba(225, 29, 72, 0.3), 0 15px 35px -8px rgba(15, 23, 42, 0.18), 0 0 0 3px rgba(244, 63, 94, 0.35)',
            }}
          />

          {/* Left Vertical Architectural Pillar */}
          <div className="absolute top-16 bottom-24 left-0 w-9 bg-gradient-to-r from-rose-400 via-pink-300 to-rose-400 rounded-l-2xl shadow-lg border-y-2 border-amber-300 flex flex-col justify-between py-6 items-center">
            <div className="w-4 h-4 rounded-full bg-amber-400 shadow-inner border border-amber-200" />
            <div className="w-1.5 h-3/4 bg-white/40 rounded-full blur-[0.5px]" />
            <div className="w-4 h-4 rounded-full bg-amber-400 shadow-inner border border-amber-200" />
          </div>

          {/* Right Vertical Architectural Pillar */}
          <div className="absolute top-16 bottom-24 right-0 w-9 bg-gradient-to-r from-rose-400 via-pink-300 to-rose-400 rounded-r-2xl shadow-lg border-y-2 border-amber-300 flex flex-col justify-between py-6 items-center">
            <div className="w-4 h-4 rounded-full bg-amber-400 shadow-inner border border-amber-200" />
            <div className="w-1.5 h-3/4 bg-white/40 rounded-full blur-[0.5px]" />
            <div className="w-4 h-4 rounded-full bg-amber-400 shadow-inner border border-amber-200" />
          </div>

          {/* Top Marquee Canopy (Luxe 3D Curved Roof with Golden Trim & Marquee Bulbs) */}
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 rounded-t-[40px] shadow-2xl border-t-2 border-rose-300 border-b-4 border-amber-400 flex flex-col items-center justify-center overflow-hidden">
            {/* Glossy Roof Curved Specular Shine */}
            <div className="absolute top-1.5 inset-x-12 h-3 bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-full blur-[1px]" />

            {/* Glowing Marquee Jewel Bulbs */}
            <div className="flex items-center gap-3.5 mb-1.5 flex-wrap justify-center px-6">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-amber-200 shadow-[0_0_8px_#fde047] border border-amber-400"
                />
              ))}
            </div>

            {/* Center Gachapon Title Sign */}
            <div className="flex items-center gap-2 px-6 py-1 rounded-full bg-rose-950/40 backdrop-blur-md border border-amber-300/60 shadow-inner">
              <span className="text-xs font-serif font-bold text-amber-200 tracking-widest uppercase flex items-center gap-1.5">
                ✦ WEDDING GACHAPON ✦
              </span>
            </div>

            {/* Top Drop Chute Funnel (Balls entry portal) */}
            <div className="absolute -bottom-4 w-32 h-6 bg-gradient-to-b from-amber-300 via-rose-200 to-amber-100 border-x-2 border-b-2 border-amber-400 rounded-b-xl shadow-md flex items-center justify-center">
              <div className="w-16 h-1.5 bg-rose-900/30 rounded-full" />
            </div>
          </div>

          {/* Pedestal Base (Sculpted Luxury Mechanical Console) */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-b from-white via-[#faf6f0] to-[#f3eae0] rounded-b-[40px] border-t-4 border-amber-400 shadow-2xl flex items-center justify-between px-10">
            {/* Left: Interactive Instruction / Wedding Status Badge */}
            <div className="flex items-center gap-3.5 bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-rose-200/90 shadow-sm">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
              <div>
                <div className="text-xs font-serif font-bold text-slate-800 tracking-wide">
                  แตะที่ลูกบอลในตู้กระจก
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  เพื่อเปิดอ่านคำอวยพรงานแต่งงาน ✨
                </div>
              </div>
            </div>

            {/* Center: spacer reserving room for the turn dial, which is rendered in the
                overlay above the canvas so it can receive clicks. Keep this width in sync
                with the dial's size, or the pedestal's neighbours will crowd it. */}
            <div className="w-28 h-24" />

            {/* Right: Recessed Capsule Dispenser Chute / Collection Pocket */}
            <div className="flex flex-col items-center">
              <div className="w-36 h-14 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 rounded-t-2xl border-2 border-rose-300/80 shadow-inner flex flex-col items-center justify-end pb-1.5 overflow-hidden relative">
                {/* Soft Interior Gold Glow from inside the dispenser */}
                <div className="absolute top-0 w-24 h-5 bg-amber-400/25 rounded-full blur-md" />
                <div className="w-20 h-2 bg-rose-500/50 rounded-full" />
                <span className="text-[9px] font-bold text-amber-200/80 tracking-widest uppercase mt-0.5">
                  DISPENSER
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
