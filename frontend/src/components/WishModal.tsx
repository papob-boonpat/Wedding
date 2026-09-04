'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Calendar, User, Loader2, ImageOff } from 'lucide-react';
import { getBackendUrl } from '@/lib/socket';

export interface WishData {
  id: number | string;
  imageData?: string;
  color: string;
  guestName?: string;
  createdAt?: string;
}

interface WishModalProps {
  wish: WishData | null;
  onClose: () => void;
}

export default function WishModal({ wish, onClose }: WishModalProps) {
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // Reset loading and error states whenever a new wish is selected
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [wish?.id]);

  if (!wish) return null;

  const formattedDate = wish.createdAt
    ? new Date(wish.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : 'เมื่อสักครู่';

  // Determine image source: memory data URL or relative endpoint via Next.js proxy
  const backendUrl = getBackendUrl();
  const imageSrc =
    wish.imageData && wish.imageData.startsWith('data:image')
      ? wish.imageData
      : `${backendUrl}/api/wishes/${wish.id}/image`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        {/* Soft Ambient Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Dialog (Light Luxury Wedding Aesthetic) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 25 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-2xl bg-white border border-rose-200/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-rose-100"
            style={{
              background: `linear-gradient(90deg, ${wish.color}22, rgba(255, 255, 255, 0.98))`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full shadow-md border-2 border-white"
                style={{ backgroundColor: wish.color }}
              />
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-800 flex items-center gap-2">
                  <span>ลูกบอลคำอวยพร #{wish.id}</span>
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500 inline" />
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 font-medium">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {wish.guestName || 'ผู้ร่วมงาน'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formattedDate}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              title="ปิด"
              className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Snapshot Image Loaded on Demand */}
          <div className="p-6 flex items-center justify-center bg-[#faf7f2]/60 overflow-hidden">
            <div className="relative w-full h-[360px] md:h-[480px] max-h-[60vh] rounded-2xl overflow-hidden border border-rose-100 shadow-inner flex items-center justify-center bg-[#fdfbf7]">
              {/* Loading Spinner */}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                  <span className="text-xs font-medium tracking-wide">กำลังเปิดลูกบอลคำอวยพร...</span>
                </div>
              )}

              {/* Error State */}
              {imageError ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-500 py-12">
                  <ImageOff className="w-10 h-10 text-slate-400" />
                  <p className="text-xs">ไม่สามารถโหลดรูปคำอวยพรได้</p>
                  <button
                    onClick={() => {
                      setImageError(false);
                      setImageLoaded(false);
                    }}
                    className="mt-2 text-xs text-rose-600 font-semibold underline"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              ) : (
                <img
                  key={`${wish.id}-${imageSrc}`}
                  src={imageSrc}
                  alt={`คำอวยพรจาก ${wish.guestName || 'ผู้ร่วมงาน'}`}
                  onLoad={() => {
                    console.log('[WishModal] Image loaded successfully:', imageSrc);
                    setImageLoaded(true);
                  }}
                  onError={(e) => {
                    console.error('[WishModal] Failed to load image from:', imageSrc, e);
                    setImageLoaded(true);
                    setImageError(true);
                  }}
                  className={`max-w-full max-h-full object-contain rounded-xl transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50/80 border-t border-rose-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>ขอให้ความรักและความสุขคงอยู่คู่บ่าวสาวตลอดไป ✨</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md shadow-rose-500/20 transition-all"
            >
              ปิด
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
