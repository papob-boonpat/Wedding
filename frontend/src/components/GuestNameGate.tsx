'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Sparkles } from 'lucide-react';
import Canvas from '@/components/Canvas';

export default function GuestNameGate() {
  const [nameDraft, setNameDraft] = useState<string>('');
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<boolean>(false);

  const handleConfirmName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setConfirmedName(trimmed);
  };

  // Back to the name modal so the next guest introduces themselves too
  const handleFinished = () => {
    setNameDraft('');
    setConfirmedName(null);
  };

  if (confirmedName) {
    return <Canvas initialGuestName={confirmedName} onFinished={handleFinished} />;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-[#faf8f5] px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-3xl bg-white border border-rose-100 shadow-2xl shadow-rose-200/40 px-8 py-9 text-center"
        >
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-300/40">
            <PenTool className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-2xl font-serif font-bold text-slate-800">ก่อนเขียนคำอวยพร</h2>
          <p className="mt-2 text-sm text-slate-500">
            กรุณาระบุชื่อของคุณ เพื่อให้คู่บ่าวสาวรู้ว่าคำอวยพรนี้มาจากใคร
          </p>

          <input
            type="text"
            autoFocus
            maxLength={40}
            placeholder="ชื่อของคุณ"
            value={nameDraft}
            onChange={(e) => {
              setNameDraft(e.target.value);
              if (nameError) setNameError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmName();
            }}
            className={`mt-6 w-full px-5 py-3 text-center text-base bg-slate-50 text-slate-800 placeholder-slate-400 rounded-full border transition-all focus:outline-none focus:ring-1 ${
              nameError
                ? 'border-rose-400 ring-1 ring-rose-300'
                : 'border-slate-200 focus:border-rose-400 focus:ring-rose-400'
            }`}
          />

          {nameError && (
            <p className="mt-2 text-xs font-medium text-rose-600">
              กรุณากรอกชื่อของคุณก่อนเริ่มเขียน
            </p>
          )}

          <button
            onClick={handleConfirmName}
            disabled={!nameDraft.trim()}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm shadow-md shadow-rose-500/30 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>เริ่มเขียนคำอวยพร</span>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
