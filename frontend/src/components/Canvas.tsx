'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eraser,
  RotateCcw,
  Send,
  Sparkles,
  Palette,
  CheckCircle2,
  Brush,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getBackendUrl } from '@/lib/socket';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

const BALLOON_COLORS = [
  { name: 'Rose Red', hex: '#f43f5e', bg: 'bg-rose-500' },
  { name: 'Warm Gold', hex: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Sky Blue', hex: '#38bdf8', bg: 'bg-sky-400' },
  { name: 'Royal Purple', hex: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Emerald Mint', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Champagne Coral', hex: '#fb923c', bg: 'bg-orange-400' },
  { name: 'Soft Lavender', hex: '#c084fc', bg: 'bg-purple-400' },
];

const PEN_SIZES = [
  { label: 'Fine', value: 3 },
  { label: 'Medium', value: 6 },
  { label: 'Bold', value: 12 },
];

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);

  // State
  const [selectedColor, setSelectedColor] = useState<string>(BALLOON_COLORS[0].hex);
  const [selectedSize, setSelectedSize] = useState<number>(6);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [guestName, setGuestName] = useState<string>('');

  // Morphing animation state
  const [animatingSnapshot, setAnimatingSnapshot] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  const lastPointRef = useRef<Point | null>(null);
  const lastMidPointRef = useRef<Point | null>(null);

  // Resize canvas to fill viewport smoothly with high-DPI support
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      redrawAll();
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, [resizeCanvas]);

  // Redraw all strokes from memory with smooth continuous curves
  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (const stroke of strokesRef.current) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      let p1 = stroke.points[0];
      let p2 = stroke.points[1];
      let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(mid.x, mid.y);

      for (let i = 2; i < stroke.points.length; i++) {
        const nextP = stroke.points[i];
        const nextMid = { x: (p2.x + nextP.x) / 2, y: (p2.y + nextP.y) / 2 };
        ctx.quadraticCurveTo(p2.x, p2.y, nextMid.x, nextMid.y);
        p1 = p2;
        p2 = nextP;
        mid = nextMid;
      }

      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
  };

  // Pointer Event Handlers (Stylus + Touch + Mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    const startPoint: Point = { x, y, pressure };
    lastPointRef.current = startPoint;
    lastMidPointRef.current = startPoint;
    currentStrokeRef.current = [startPoint];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      const currentWidth = isEraser ? selectedSize * 4 : selectedSize;
      ctx.beginPath();
      ctx.arc(x, y, currentWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = isEraser ? '#0b0f19' : selectedColor;
      ctx.fill();
      ctx.restore();
    }

    if (!hasContent) setHasContent(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use coalesced events to capture all high-rate stylus points (Apple Pencil 120Hz/240Hz)
    const nativeEvent = e.nativeEvent as any;
    const events: PointerEvent[] =
      typeof nativeEvent.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [e.nativeEvent];

    ctx.save();
    ctx.strokeStyle = isEraser ? '#0b0f19' : selectedColor;
    ctx.lineWidth = isEraser ? selectedSize * 4 : selectedSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const ev of events) {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const pressure = ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5;
      const currentPoint: Point = { x, y, pressure };

      const lastPoint = lastPointRef.current || currentPoint;
      const lastMidPoint = lastMidPointRef.current || lastPoint;

      const currentMidPoint: Point = {
        x: (lastPoint.x + currentPoint.x) / 2,
        y: (lastPoint.y + currentPoint.y) / 2,
        pressure: (lastPoint.pressure + currentPoint.pressure) / 2,
      };

      ctx.beginPath();
      ctx.moveTo(lastMidPoint.x, lastMidPoint.y);
      ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, currentMidPoint.x, currentMidPoint.y);
      ctx.stroke();

      lastPointRef.current = currentPoint;
      lastMidPointRef.current = currentMidPoint;
      currentStrokeRef.current.push(currentPoint);
    }

    ctx.restore();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    const canvas = canvasRef.current;
    if (canvas && lastPointRef.current && lastMidPointRef.current) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.strokeStyle = isEraser ? '#0b0f19' : selectedColor;
        ctx.lineWidth = isEraser ? selectedSize * 4 : selectedSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
        ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push({
        points: [...currentStrokeRef.current],
        color: isEraser ? '#0b0f19' : selectedColor,
        size: isEraser ? selectedSize * 4 : selectedSize,
      });
      currentStrokeRef.current = [];
    }

    lastPointRef.current = null;
    lastMidPointRef.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerUp(e);
  };

  // Clear Canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
    strokesRef.current = [];
    currentStrokeRef.current = [];
    lastPointRef.current = null;
    lastMidPointRef.current = null;
    setHasContent(false);
  };

  // Undo Last Stroke
  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redrawAll();
    if (strokesRef.current.length === 0) {
      setHasContent(false);
    }
  };

  // Submit and morph into balloon with instant snappy launch
  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // 1. Create an optimized snapshot (scaled to crisp 1000px max dimension for fast ~10ms encoding)
      const maxDim = 1000;
      let targetW = canvas.width;
      let targetH = canvas.height;

      if (targetW > maxDim || targetH > maxDim) {
        const ratio = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = targetW;
      exportCanvas.height = targetH;
      const expCtx = exportCanvas.getContext('2d');

      if (expCtx) {
        // Dark background with subtle gradient
        const bgGrad = expCtx.createRadialGradient(
          targetW / 2,
          targetH / 2,
          50,
          targetW / 2,
          targetH / 2,
          targetW / 2
        );
        bgGrad.addColorStop(0, '#1e293b');
        bgGrad.addColorStop(1, '#0f172a');
        expCtx.fillStyle = bgGrad;
        expCtx.fillRect(0, 0, targetW, targetH);

        // Draw guest drawing onto composite
        expCtx.drawImage(canvas, 0, 0, targetW, targetH);

        // Guest name tag
        if (guestName.trim()) {
          expCtx.font = `${Math.round(20 * (targetW / 800))}px serif`;
          expCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          expCtx.textAlign = 'right';
          expCtx.fillText(`— ${guestName.trim()}`, targetW - 24, targetH - 24);
        }
      }

      // Fast encoding: webp is ~10x faster and lighter than PNG
      let base64Data = exportCanvas.toDataURL('image/webp', 0.85);
      if (!base64Data.startsWith('data:image/webp')) {
        base64Data = exportCanvas.toDataURL('image/png');
      }

      // Quick confetti pop
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#f43f5e', '#eab308', '#38bdf8', '#fb7185'],
      });

      // 2. Start fast balloon morph animation immediately
      setAnimatingSnapshot(base64Data);

      // Instantly clear the underlying canvas so there's zero UI lag
      handleClear();
      const currentGuestName = guestName.trim() || 'Guest';
      const currentColor = selectedColor;
      setGuestName('');
      setIsEraser(false);

      // 3. Parallelize network send with animation
      const backendUrl = getBackendUrl();
      const uploadPromise = fetch(`${backendUrl}/api/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: base64Data,
          color: currentColor,
          guestName: currentGuestName,
        }),
      });

      // Smooth 1.5s launch animation timer
      const animationTimer = new Promise((res) => setTimeout(res, 1500));

      await Promise.all([uploadPromise, animationTimer]);

      setAnimatingSnapshot(null);
      setShowSuccessToast(true);

      setTimeout(() => {
        setShowSuccessToast(false);
      }, 2500);
    } catch (err) {
      console.error('Submission error:', err);
      alert('Could not submit wish. Please check your connection.');
      setAnimatingSnapshot(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 select-none overflow-hidden touch-none canvas-container">
      {/* Top Header & Toolbar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif tracking-wide bg-gradient-to-r from-rose-200 via-amber-100 to-rose-300 bg-clip-text text-transparent">
              Wedding Guestbook
            </h1>
            <p className="text-xs text-slate-400">Draw your warm wish with stylus or finger</p>
          </div>
        </div>

        {/* Guest Name Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-slate-800/90 text-slate-100 placeholder-slate-500 rounded-full border border-slate-700 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-all w-44 md:w-56"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={!hasContent || isSubmitting}
            title="Undo"
            className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 border border-slate-700/60"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleClear}
            disabled={!hasContent || isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-800/90 hover:bg-red-950/40 text-slate-300 hover:text-red-300 disabled:opacity-40 disabled:pointer-events-none border border-slate-700/60 transition-all active:scale-95 text-sm font-medium"
          >
            <Eraser className="w-4 h-4 text-red-400" />
            <span>Clear</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={!hasContent || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-400 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-rose-500/30 disabled:opacity-40 disabled:pointer-events-none transition-all transform active:scale-95"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Wish</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Drawing Area */}
      <main className="relative flex-1 w-full h-full bg-[#0b0f19] overflow-hidden">
        {/* Subtle grid guidelines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className="drawing-canvas absolute inset-0 w-full h-full cursor-crosshair z-10"
        />

        {/* Empty Placeholder Helper */}
        {!hasContent && !animatingSnapshot && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 text-slate-600 opacity-60">
            <div className="p-6 rounded-full border border-dashed border-slate-700/60 mb-4 animate-bounce">
              <Brush className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-lg font-serif text-slate-400">Write or draw your blessings here</p>
            <p className="text-xs text-slate-600 mt-1">Supports Apple Pencil & stylus pressure</p>
          </div>
        )}

        {/* Morphing Balloon Submit Animation Overlay */}
        <AnimatePresence>
          {animatingSnapshot && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              {/* Balloon Container */}
              <motion.div
                initial={{
                  scale: 1,
                  y: 0,
                  opacity: 1,
                  borderRadius: '16px',
                  boxShadow: '0 0 0 rgba(0,0,0,0)',
                }}
                animate={{
                  scale: [1, 0.5, 0.35],
                  y: [0, -120, -1100],
                  opacity: [1, 1, 0.8],
                  borderRadius: [
                    '16px',
                    '50% 50% 50% 50% / 40% 40% 60% 60%',
                    '50% 50% 50% 50% / 40% 40% 60% 60%',
                  ],
                  boxShadow: [
                    '0 10px 30px rgba(0,0,0,0.5)',
                    `0 20px 50px ${selectedColor}99`,
                    `0 30px 80px ${selectedColor}ee`,
                  ],
                }}
                transition={{
                  duration: 1.5,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.35, 1],
                }}
                className="relative overflow-hidden border-4 border-white/60 bg-slate-900"
                style={{
                  width: '80%',
                  height: '75%',
                  backgroundColor: selectedColor,
                }}
              >
                {/* Embedded preview of canvas snapshot */}
                <img
                  src={animatingSnapshot}
                  alt="Wish Snapshot"
                  className="w-full h-full object-contain p-4"
                />

                {/* Balloon string attached to bottom */}
                <div
                  className="absolute left-1/2 -bottom-16 w-0.5 h-16 bg-white/70 transform -translate-x-1/2"
                  style={{
                    boxShadow: '0 0 4px rgba(255,255,255,0.8)',
                  }}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Tool Palette (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-3 rounded-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl">
          {/* Color Swatches */}
          <div className="flex items-center gap-2">
            {BALLOON_COLORS.map((col) => (
              <button
                key={col.hex}
                onClick={() => {
                  setSelectedColor(col.hex);
                  setIsEraser(false);
                }}
                className={`relative w-8 h-8 rounded-full transition-transform active:scale-95 ${
                  col.bg
                } ${
                  selectedColor === col.hex && !isEraser
                    ? 'ring-4 ring-white/80 scale-110 shadow-lg'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                title={col.name}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* Stroke Sizes */}
          <div className="flex items-center gap-2">
            {PEN_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => {
                  setSelectedSize(size.value);
                  setIsEraser(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedSize === size.value && !isEraser
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* Eraser Tool */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`p-2 rounded-full transition-all ${
              isEraser
                ? 'bg-rose-500 text-white shadow-lg ring-2 ring-white/50'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Success Notification Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-500 text-white font-medium shadow-xl shadow-emerald-500/20"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>Wish launched as a balloon! Thank you!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
