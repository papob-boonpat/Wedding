'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Calendar, User } from 'lucide-react';

export interface WishData {
  id: number | string;
  imageData: string;
  color: string;
  guestName?: string;
  createdAt?: string;
}

interface WishModalProps {
  wish: WishData | null;
  onClose: () => void;
}

export default function WishModal({ wish, onClose }: WishModalProps) {
  if (!wish) return null;

  const formattedDate = wish.createdAt
    ? new Date(wish.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-white/10"
            style={{
              background: `linear-gradient(90deg, ${wish.color}22, rgba(15, 23, 42, 0.95))`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full shadow-md"
                style={{ backgroundColor: wish.color }}
              />
              <div>
                <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                  <span>Wish #{wish.id}</span>
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400 inline" />
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {wish.guestName || 'Guest'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Snapshot Image */}
          <div className="flex-1 p-6 flex items-center justify-center bg-slate-950/60 overflow-hidden">
            <div className="relative w-full h-full max-h-[60vh] rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center bg-slate-950">
              <img
                src={wish.imageData}
                alt={`Wish from ${wish.guestName || 'Guest'}`}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-900 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span>May this lovely wish accompany the bride and groom forever ✨</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
