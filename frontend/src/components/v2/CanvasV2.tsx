'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eraser,
  RotateCcw,
  Send,
  Sparkles,
  CheckCircle2,
  Brush,
  PenTool,
  Hand,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getBackendUrl } from '@/lib/socket';
import { STRINGS, type Lang } from './strings';

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

const CANVAS_BG_COLOR = '#faf8f5';

const CAPSULE_COLORS = [
  { hex: '#e11d48', bg: 'bg-rose-600' },
  { hex: '#d97706', bg: 'bg-amber-600' },
  { hex: '#0284c7', bg: 'bg-sky-600' },
  { hex: '#7c3aed', bg: 'bg-purple-600' },
  { hex: '#059669', bg: 'bg-emerald-600' },
  { hex: '#ea580c', bg: 'bg-orange-600' },
  { hex: '#db2777', bg: 'bg-pink-600' },
];

const PEN_SIZES = [{ value: 3 }, { value: 6 }, { value: 12 }];

interface CanvasV2Props {
  /** Name collected by the gate before this page is shown */
  initialGuestName?: string;
  /** Called once a wish has been sent, so the gate can ask the next guest for their name */
  onFinished?: () => void;
  /** Display language, owned by the gate so it persists between guests */
  lang: Lang;
  /** Flip the display language */
  onToggleLang: () => void;
}

export default function CanvasV2({
  initialGuestName = '',
  onFinished,
  lang,
  onToggleLang,
}: CanvasV2Props) {
  const t = STRINGS[lang];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokesRef = useRef<Stroke[]>([]);

  // State: Random initial color so every new wish gets a delightful varied palette
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    return CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)].hex;
  });
  const [selectedSize, setSelectedSize] = useState<number>(6);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [hasContent, setHasContent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [guestName, setGuestName] = useState<string>(initialGuestName);
  // Input mode: stylus/mouse only by default, finger drawing opt-in
  const [allowFinger, setAllowFinger] = useState<boolean>(false);
  // const [touchRejectedNotice, setTouchRejectedNotice] = useState<boolean>(false);

  // Morphing animation state
  const [animatingSnapshot, setAnimatingSnapshot] = useState<{ image: string; color: string } | null>(null);
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

  // Pointer Event Handlers (Stylus + Mouse Only, Reject Finger Touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm Rejection: reject finger touch unless finger mode is on
    if (!allowFinger && e.pointerType === 'touch') {
      // setTouchRejectedNotice(true);
      // setTimeout(() => setTouchRejectedNotice(false), 2500);
      return;
    }

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
      ctx.fillStyle = isEraser ? CANVAS_BG_COLOR : selectedColor;
      ctx.fill();
      ctx.restore();
    }

    if (!hasContent) setHasContent(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!allowFinger && e.pointerType === 'touch') return;
    // Finger mode: only the first contact draws, so a resting palm cannot
    // hijack the stroke or end it early
    if (!e.isPrimary) return;
    if (!isDrawingRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nativeEvent = e.nativeEvent as any;
    const events: PointerEvent[] =
      typeof nativeEvent.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [e.nativeEvent];

    ctx.save();
    ctx.strokeStyle = isEraser ? CANVAS_BG_COLOR : selectedColor;
    ctx.lineWidth = isEraser ? selectedSize * 4 : selectedSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const ev of events) {
      if (!allowFinger && ev.pointerType === 'touch') continue;
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
    if (!allowFinger && e.pointerType === 'touch') return;
    // Finger mode: only the first contact draws, so a resting palm cannot
    // hijack the stroke or end it early
    if (!e.isPrimary) return;
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
        ctx.strokeStyle = isEraser ? CANVAS_BG_COLOR : selectedColor;
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
        color: isEraser ? CANVAS_BG_COLOR : selectedColor,
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

  // Submit and morph into capsule ball with instant snappy launch
  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent || isSubmitting || !guestName.trim()) return;

    try {
      setIsSubmitting(true);

      // 1. Create an optimized snapshot (warm ivory background)
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
        // Light warm ivory background
        expCtx.fillStyle = '#faf8f5';
        expCtx.fillRect(0, 0, targetW, targetH);

        // Draw guest drawing onto composite
        expCtx.drawImage(canvas, 0, 0, targetW, targetH);

        // Guest name tag in elegant dark charcoal
        if (guestName.trim()) {
          expCtx.font = `600 ${Math.round(20 * (targetW / 800))}px serif`;
          expCtx.fillStyle = 'rgba(51, 65, 85, 0.85)';
          expCtx.textAlign = 'right';
          expCtx.fillText(`— ${guestName.trim()}`, targetW - 28, targetH - 28);
        }
      }

      // Fast encoding
      let base64Data = exportCanvas.toDataURL('image/webp', 0.85);
      if (!base64Data.startsWith('data:image/webp')) {
        base64Data = exportCanvas.toDataURL('image/png');
      }

      const currentGuestName = guestName.trim();
      const currentColor = selectedColor;

      // 2. Start fast capsule morph animation with current wish color
      setAnimatingSnapshot({ image: base64Data, color: currentColor });

      // Clear underlying canvas and reset guest name
      handleClear();
      setGuestName('');
      setIsEraser(false);

      // 3. Wait until the capsule finishes packing and starts shooting upward (~950ms)
      const launchDelay = 950;
      await new Promise((res) => setTimeout(res, launchDelay));

      // Send request at the exact moment the capsule shoots upward
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

      // Wait for remaining upward flight animation (~650ms) and upload response
      const remainingFlight = new Promise((res) => setTimeout(res, 650));
      await Promise.all([uploadPromise, remainingFlight]);

      // 4. Clean up animation, show success toast, and apply new random color AFTER ball is sent
      setAnimatingSnapshot(null);
      setShowSuccessToast(true);

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: [currentColor, '#f43f5e', '#eab308', '#38bdf8'],
      });

      const remainingColors = CAPSULE_COLORS.filter((c) => c.hex !== currentColor);
      const nextRandomColor = remainingColors[Math.floor(Math.random() * remainingColors.length)].hex;
      setSelectedColor(nextRandomColor);

      setTimeout(() => {
        setShowSuccessToast(false);
        // Hand control back to the name gate for the next guest
        onFinished?.();
      }, 2500);
    } catch (err) {
      console.error('Submission error:', err);
      alert(t.submitError);
      setAnimatingSnapshot(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#faf8f5] select-none overflow-hidden touch-none canvas-container">
      {/* Top Header & Toolbar (Light Theme) */}
      <header className="relative z-20 flex flex-wrap gap-y-2 items-center justify-center md:justify-between px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-rose-100 shadow-sm">
        {/* <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-300/40">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif tracking-wide bg-gradient-to-r from-rose-900 via-rose-700 to-amber-700 bg-clip-text text-transparent">
              สมุดอวยพรแต่งงาน
            </h1>
            <p className="text-xs text-slate-500">เขียนหรือวาดคำอวยพรด้วย Apple Pencil หรือ ปากกา Stylus</p>
          </div>
        </div> */}

        {/* Guest Name Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t.namePlaceholder}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-slate-50 text-slate-800 placeholder-slate-400 rounded-full border border-slate-200 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-all w-44 md:w-56 shadow-sm"
          />
        </div>

        {/* Input Mode + Language Toggles */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 p-1 rounded-full bg-slate-100 border border-slate-200 shadow-sm"
            title={t.inputModeLabel}
          >
            <button
              onClick={() => setAllowFinger(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !allowFinger ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{t.stylusMode}</span>
            </button>
            <button
              onClick={() => setAllowFinger(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                allowFinger ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{t.fingerMode}</span>
            </button>
          </div>

          <button
            onClick={onToggleLang}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 shadow-sm transition-all active:scale-95"
          >
            {t.langToggle}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={!hasContent || isSubmitting}
            title={t.undo}
            className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 border border-slate-200 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            disabled={!hasContent || isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 disabled:opacity-40 disabled:pointer-events-none border border-slate-200 shadow-sm transition-all active:scale-95 text-sm font-medium"
          >
            <Eraser className="w-4 h-4 text-rose-500" />
            <span>{t.clear}</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={!hasContent || isSubmitting || !guestName.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm shadow-md shadow-rose-500/30 disabled:opacity-40 disabled:pointer-events-none transition-all transform active:scale-95"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t.submitting}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{t.submit}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Drawing Paper Area */}
      <main className="relative flex-1 w-full h-full bg-[#faf8f5] overflow-hidden">
        {/* Subtle romantic paper grid guideline dots */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(225, 29, 72, 0.4) 1px, transparent 0)',
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 text-slate-400 opacity-60">
            <div className="p-6 rounded-full border border-dashed border-rose-200 mb-4 animate-bounce">
              <Brush className="w-10 h-10 text-rose-400" />
            </div>
            <p className="text-lg font-serif text-slate-600">{t.emptyPrompt}</p>
            {allowFinger && (
              <p className="mt-2 max-w-sm px-6 text-center text-xs font-medium text-rose-500">
                {t.fingerHint}
              </p>
            )}
            {/* <p className="text-xs text-rose-500 font-medium mt-1">
              ✍️ รองรับเฉพาะ Apple Pencil & ปากกา Stylus • ป้องกันฝ่ามือสัมผัส
            </p> */}
          </div>
        )}

        {/* Touch Rejection Notice Toast */}
        {/* <AnimatePresence>
          {touchRejectedNotice && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium shadow-2xl pointer-events-none border border-white/20"
            >
              <PenTool className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>โหมดปากกาทำงานอยู่ — กรุณาใช้ Apple Pencil หรือ ปากกา Stylus</span>
            </motion.div>
          )}
        </AnimatePresence> */}

        {/* Morphing & Launching 3D Gachapon Capsule Submit Animation */}
        <AnimatePresence>
          {animatingSnapshot && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden">
              <motion.div
                initial={{
                  scale: 1,
                  y: 0,
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  scale: [1, 0.65, 0.45, 0.38],
                  y: [0, -30, -100, -1200],
                  opacity: [1, 1, 1, 0.9],
                  rotate: [0, -3, 4, -8],
                }}
                transition={{
                  duration: 1.55,
                  ease: [0.22, 1, 0.36, 1],
                  times: [0, 0.3, 0.58, 1],
                }}
                className="relative flex items-center justify-center"
                style={{
                  width: '72vw',
                  height: '72vw',
                  maxWidth: '460px',
                  maxHeight: '460px',
                }}
              >
                {/* 1. Initial Drawing Card that morphs into a folded note */}
                <motion.div
                  initial={{ opacity: 1, scale: 1, borderRadius: '24px' }}
                  animate={{
                    opacity: [1, 0.95, 0.9, 0.85],
                    scale: [1, 0.55, 0.4, 0.38],
                    y: [0, -15, -45, -45],
                    borderRadius: ['24px', '16px', '12px', '12px'],
                  }}
                  transition={{
                    duration: 1.55,
                    times: [0, 0.3, 0.58, 1],
                    ease: 'easeInOut',
                  }}
                  className="absolute z-20 w-full h-full bg-[#fffdf7] border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center p-3"
                  style={{
                    boxShadow: `0 15px 40px ${animatingSnapshot.color}55`,
                  }}
                >
                  <img
                    src={animatingSnapshot.image}
                    alt="Wish Snapshot"
                    className="w-full h-full object-contain"
                  />
                  {/* Miniature cute seal tag */}
                  <div className="absolute bottom-2 right-4 px-2 py-0.5 rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-md flex items-center gap-1 border border-amber-300">
                    <span>💖</span>
                    <span>{t.sealTag}</span>
                  </div>
                </motion.div>

                {/* 2. The 3D Gachapon Capsule Ball wrapping around it as it shrinks */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: [0, 1, 1, 1],
                    scale: [0.8, 1, 1, 1],
                  }}
                  transition={{
                    duration: 1.55,
                    times: [0, 0.25, 0.58, 1],
                  }}
                  className="absolute z-10 w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    filter: `drop-shadow(0 20px 45px ${animatingSnapshot.color}88)`,
                  }}
                >
                  {/* Outer Crisp Contour Stroke Ring */}
                  <div className="absolute inset-0 rounded-full border-[4px] border-slate-900/35 z-30 pointer-events-none" />

                  {/* TOP HEMISPHERE: Crystal Translucent Dome with color tint & gloss reflections */}
                  <div
                    className="absolute inset-x-0 top-0 h-1/2 rounded-t-full overflow-hidden z-25 pointer-events-none"
                    style={{
                      background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.94) 0%, rgba(248, 250, 252, 0.55) 45%, ${animatingSnapshot.color}35 100%)`,
                    }}
                  >
                    {/* Primary curved specular gloss highlight */}
                    <div className="absolute top-5 left-9 w-32 h-16 rounded-full bg-white/90 blur-[0.5px] -rotate-45" />
                    {/* Secondary rim reflex */}
                    <div className="absolute top-10 right-8 w-14 h-7 rounded-full bg-white/65 blur-[0.5px] rotate-35" />
                  </div>

                  {/* BOTTOM HEMISPHERE: Vibrant 3D Shaded Colored Base */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full overflow-hidden z-10"
                    style={{
                      backgroundColor: animatingSnapshot.color,
                    }}
                  >
                    {/* 3D Spherical shading */}
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          'radial-gradient(circle at 40% 25%, rgba(255,255,255,0.45) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.28) 80%, rgba(0,0,0,0.52) 100%)',
                      }}
                    />
                    {/* Bottom-edge soft rim reflex */}
                    <div className="absolute bottom-3 inset-x-16 h-4 bg-white/30 rounded-full blur-[1px]" />
                  </div>

                  {/* CENTER SEAM: Metallic Gold Dividing Ring */}
                  <div
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 z-25 flex items-center justify-center pointer-events-none"
                    style={{
                      background: 'linear-gradient(to right, #d97706, #fef08a, #f59e0b, #b45309)',
                      borderRadius: '9999px',
                      boxShadow: '0 3px 8px rgba(15, 23, 42, 0.4), inset 0 1px 2px rgba(255,255,255,0.8)',
                      borderTop: '1.5px solid rgba(255,255,255,0.8)',
                      borderBottom: '1.5px solid rgba(15, 23, 42, 0.4)',
                    }}
                  >
                    <div className="w-full h-1 bg-amber-900/30" />
                  </div>

                  {/* CENTER SEAL CLASP: High-Contrast Gold Medallion with Heart */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    transition={{ delay: 0.35, duration: 0.35, type: 'spring' }}
                    className="absolute z-30 w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-1 shadow-2xl flex items-center justify-center"
                  >
                    <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center shadow-inner border border-amber-300">
                      <span className="text-rose-500 text-2xl font-bold">♥</span>
                      <span className="text-[10px] font-black text-slate-800 tracking-tighter uppercase -mt-1">
                        WISH
                      </span>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Sparkling Upward Thrust Trail */}
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{
                    opacity: [0, 0, 0.8, 0],
                    scaleY: [0, 0, 1.5, 2.2],
                    y: [0, 0, 80, 180],
                  }}
                  transition={{
                    duration: 1.55,
                    times: [0, 0.45, 0.7, 1],
                  }}
                  className="absolute -bottom-16 w-20 h-40 bg-gradient-to-t from-transparent via-amber-300/60 to-rose-400/80 rounded-full blur-md z-0 pointer-events-none"
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Tool Palette (Bottom Center, Light Theme) */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-3 rounded-full bg-white/95 backdrop-blur-xl border border-rose-200/80 shadow-2xl">
          {/* Color Swatches */}
          <div className="flex items-center gap-2.5">
            {CAPSULE_COLORS.map((col) => (
              <button
                key={col.hex}
                onClick={() => {
                  setSelectedColor(col.hex);
                  setIsEraser(false);
                }}
                className={`relative w-8 h-8 rounded-full transition-transform active:scale-95 shadow-sm ${col.bg
                  } ${selectedColor === col.hex && !isEraser
                    ? 'ring-4 ring-rose-400/50 scale-110 shadow-md'
                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                  }`}
                title={t.colorNames[col.hex]}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Stroke Sizes */}
          <div className="flex items-center gap-2">
            {PEN_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => {
                  setSelectedSize(size.value);
                  setIsEraser(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedSize === size.value && !isEraser
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
              >
                {t.penSizes[size.value]}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* Eraser Tool */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`p-2 rounded-full transition-all ${isEraser
              ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-300'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            title={t.eraser}
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
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-600 text-white font-medium shadow-xl shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>{t.successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
