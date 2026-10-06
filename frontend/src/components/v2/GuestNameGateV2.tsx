'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Sparkles } from 'lucide-react';
import CanvasV2 from './CanvasV2';
import { STRINGS, type Lang } from './strings';

export default function GuestNameGateV2() {
  const [nameDraft, setNameDraft] = useState<string>('');
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<boolean>(false);
  // Language lives here so it survives the gate -> canvas -> gate cycle
  const [lang, setLang] = useState<Lang>('en');

  const t = STRINGS[lang];
  const toggleLang = () => setLang((prev) => (prev === 'th' ? 'en' : 'th'));

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
    return (
      <CanvasV2
        initialGuestName={confirmedName}
        onFinished={handleFinished}
        lang={lang}
        onToggleLang={toggleLang}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-[#faf8f5] px-6"
      >
        {/* Language toggle, reachable before any name is entered */}
        <button
          onClick={toggleLang}
          className="absolute top-5 right-5 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
        >
          {t.langToggle}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-3xl bg-white border border-rose-100 shadow-2xl shadow-rose-200/40 px-8 py-9 text-center"
        >
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-300/40">
            <PenTool className="w-6 h-6 text-white" />
          </div>

          <h2 className="text-2xl font-serif font-bold text-slate-800">{t.gateTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{t.gateSubtitle}</p>

          <input
            type="text"
            autoFocus
            maxLength={40}
            placeholder={t.namePlaceholder}
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

          {nameError && <p className="mt-2 text-xs font-medium text-rose-600">{t.nameError}</p>}

          <button
            onClick={handleConfirmName}
            disabled={!nameDraft.trim()}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm shadow-md shadow-rose-500/30 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.gateStart}</span>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
