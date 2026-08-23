'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Wifi, WifiOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import BalloonBouquet from '@/components/BalloonBouquet';
import WishModal, { WishData } from '@/components/WishModal';
import { getSocket, getBackendUrl } from '@/lib/socket';

export default function DisplayPage() {
  const [wishes, setWishes] = useState<WishData[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('wedding_wishes_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [selectedWish, setSelectedWish] = useState<WishData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestArrival, setLatestArrival] = useState<WishData | null>(null);

  // Persist wishes in localStorage for instant 0ms first-load rendering
  useEffect(() => {
    if (wishes.length > 0 && typeof window !== 'undefined') {
      try {
        localStorage.setItem('wedding_wishes_cache', JSON.stringify(wishes));
      } catch (e) {}
    }
  }, [wishes]);

  // 1. Fetch initial wishes from PostgreSQL with multi-path fallback
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
                imageData: item.image_data || item.imageData,
                color: item.color || '#f43f5e',
                guestName: item.guest_name || item.guestName,
                createdAt: item.created_at || item.createdAt,
              }));
              setWishes(formatted);
              return;
            }
          }
        } catch (err: any) {
          console.warn(`[Display] Failed to fetch from ${url}:`, err.message);
        }
      }
    }

    loadWishes();

    // Background sync every 5 seconds for LAN stability
    const interval = setInterval(loadWishes, 5000);

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

      // Trigger wedding confetti celebration on the display screen
      confetti({
        particleCount: 70,
        spread: 90,
        origin: { y: 0.9 },
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
    <main className="fixed inset-0 w-full h-full bg-gradient-to-b from-[#0b0f19] via-[#0f172a] to-[#1e1b4b] overflow-hidden select-none">
      {/* Background Starry Glow Effects */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl animate-pulseGlow" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      {/* Header Overlay */}
      <header className="absolute top-6 left-0 right-0 z-30 flex items-center justify-between px-8 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-amber-300 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif tracking-wider bg-gradient-to-r from-rose-200 via-amber-100 to-rose-300 bg-clip-text text-transparent drop-shadow">
              Our Journey of Love
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Tap any balloon to read a guest wish
            </p>
          </div>
        </div>

        {/* Live Status & Wish Count */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg text-xs">
            <span className="text-slate-400">Total Wishes:</span>
            <span className="font-bold text-rose-400 text-sm">{wishes.length}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md ${
              isConnected
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span>Live LAN</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Reconnecting...</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Real-time Arrival Announcement Toast */}
      <AnimatePresence>
        {latestArrival && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="absolute top-24 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3 rounded-full bg-slate-900/90 backdrop-blur-xl border border-rose-500/50 shadow-2xl shadow-rose-500/20 pointer-events-auto cursor-pointer"
            onClick={() => setSelectedWish(latestArrival)}
          >
            <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="text-sm font-medium text-slate-200">
              New balloon added by{' '}
              <strong className="text-rose-400">{latestArrival.guestName || 'Guest'}</strong>!
            </span>
            <span className="text-xs underline text-slate-400 ml-2">Click to view</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Physics Balloon Bouquet Engine */}
      <BalloonBouquet
        wishes={wishes}
        onSelectWish={setSelectedWish}
      />

      {/* Full Resolution Wish Modal */}
      <WishModal
        wish={selectedWish}
        onClose={() => setSelectedWish(null)}
      />
    </main>
  );
}
