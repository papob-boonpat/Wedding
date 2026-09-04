'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wifi, WifiOff, Box } from 'lucide-react';
import confetti from 'canvas-confetti';
import GachaponBox from '@/components/GachaponBox';
import WishModal, { WishData } from '@/components/WishModal';
import { getSocket, getBackendUrl } from '@/lib/socket';

export default function DisplayPage() {
  const [wishes, setWishes] = useState<WishData[]>([]);
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestArrival, setLatestArrival] = useState<WishData | null>(null);

  // 1. Fetch initial wishes from PostgreSQL (lightweight metadata: no base64 images!)
  useEffect(() => {
    let isMounted = true;

    async function loadWishes() {
      const backendUrl = getBackendUrl();
      const urlsToTry = [`${backendUrl}/api/wishes`, '/api/wishes'];

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && isMounted) {
              const formatted: WishData[] = json.data.map((item: any) => ({
                id: item.id,
                color: item.color || '#f43f5e',
                guestName: item.guest_name || item.guestName,
                createdAt: item.created_at || item.createdAt,
              }));
              setWishes((prev) => {
                if (
                  prev.length === formatted.length &&
                  (prev.length === 0 || prev[prev.length - 1]?.id === formatted[formatted.length - 1]?.id)
                ) {
                  return prev;
                }
                return formatted;
              });
              return;
            }
          }
        } catch (err: any) {
          console.warn(`[Display] Failed to fetch from ${url}:`, err.message);
        }
      }
    }

    loadWishes();

    // Background sync every 6 seconds for LAN stability
    const interval = setInterval(loadWishes, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Setup Socket.io real-time listener
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('request_all_wishes', (res: any) => {
        if (res?.success && Array.isArray(res.wishes)) {
          setWishes((prev) => {
            const map = new Map();
            prev.forEach((w) => map.set(String(w.id), w));
            res.wishes.forEach((w: any) => map.set(String(w.id), w));
            return Array.from(map.values());
          });
        }
      });
    };

    const onDisconnect = () => setIsConnected(false);

    const onNewWish = (newWish: WishData) => {
      console.log('[Display] New wish received in real-time:', newWish);
      setWishes((prev) => {
        if (prev.some((w) => String(w.id) === String(newWish.id))) {
          return prev;
        }
        return [...prev, newWish];
      });
      setLatestArrival(newWish);

      // Trigger celebration confetti on new wish drop
      confetti({
        particleCount: 50,
        spread: 85,
        origin: { y: 0.18, x: 0.25 + Math.random() * 0.5 },
        colors: [newWish.color || '#f43f5e', '#fb7185', '#ffd700', '#38bdf8'],
      });

      // Clear the banner notification after 5 seconds
      setTimeout(() => {
        setLatestArrival(null);
      }, 5000);
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('new_wish', onNewWish);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new_wish', onNewWish);
    };
  }, []);

  return (
    <main className="fixed inset-0 w-full h-full bg-gradient-to-b from-[#fdfbf7] via-[#fff5f5] to-[#fef2f2] overflow-hidden select-none">
      {/* Ambient Lighting & Romantic Wedding Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute top-1/6 left-1/2 transform -translate-x-1/2 w-[800px] h-[550px] bg-rose-200/40 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-amber-200/35 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-200/35 rounded-full blur-[100px]" />
      </div>

      {/* Header Overlay */}
      <header className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-8 pointer-events-none">
        {/* <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-400 via-pink-400 to-amber-300 flex items-center justify-center shadow-lg shadow-rose-300/40 border border-white/60">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif tracking-wider bg-gradient-to-r from-rose-900 via-rose-700 to-amber-700 bg-clip-text text-transparent drop-shadow-sm">
              ตู้กาชาปองคำอวยพรแต่งงาน
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              แตะที่ลูกบอลกาชาปองในตู้กระจกเพื่อเปิดดูคำอวยพร ✨
            </p>
          </div>
        </div> */}

        {/* Live Status & Wish Count */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/85 backdrop-blur-xl border border-rose-200/80 shadow-lg text-xs">
            <span className="text-slate-500 font-medium">จำนวนคำอวยพร:</span>
            <span className="font-bold text-rose-600 text-base">{wishes.length}</span>
          </div>

          {/* <div
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border backdrop-blur-md shadow-sm ${isConnected
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700'
                : 'bg-rose-50/90 border-rose-200 text-rose-700'
              }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                <span>เชื่อมต่อแล้ว (LAN)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span>กำลังเชื่อมต่อใหม่...</span>
              </>
            )}
          </div> */}
        </div>
      </header>

      {/* Real-time Arrival Announcement Toast */}
      <AnimatePresence>
        {latestArrival && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="absolute top-24 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3.5 rounded-full bg-white/95 backdrop-blur-xl border border-rose-300 shadow-2xl shadow-rose-400/20 pointer-events-auto cursor-pointer"
            onClick={() => setSelectedWish(latestArrival)}
          >
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
            <span className="text-sm font-medium text-slate-800">
              มีลูกบอลคำอวยพรใหม่หล่นลงมา โดย{' '}
              <strong className="text-rose-600">{latestArrival.guestName || 'ผู้ร่วมงาน'}</strong>!
            </span>
            <span className="text-xs font-semibold underline text-rose-500 ml-2">แตะเพื่อเปิดดู</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gachapon Glass Container Box (Light Theme Physics Engine) */}
      <GachaponBox
        wishes={wishes}
        onSelectWish={setSelectedWish}
      />

      {/* On-Demand Wish Modal (Light Theme) */}
      <WishModal
        wish={selectedWish}
        onClose={() => setSelectedWish(null)}
      />
    </main>
  );
}
