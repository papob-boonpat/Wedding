'use client';

import Link from 'next/link';
import { PenTool, Tv, Heart, Sparkles, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      {/* Glow Effects */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative z-10"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 mb-4 shadow-xl shadow-rose-500/30">
          <Heart className="w-8 h-8 text-white fill-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-serif bg-gradient-to-r from-rose-200 via-amber-100 to-rose-300 bg-clip-text text-transparent">
          Wedding Guestbook
        </h1>
        <p className="text-slate-400 mt-2 text-sm md:text-base max-w-md mx-auto">
          Local Real-Time Balloon Bouquet for our Special Day
        </p>
      </motion.div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl relative z-10">
        {/* Guest Input Tablet Station */}
        <Link href="/guest" className="group">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-rose-500/50 shadow-2xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
                <PenTool className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Guest Drawing Station</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                For iPads and Android tablets at the reception desk. Guests can write blessings with stylus and launch balloons.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <span>Open Guest Canvas</span>
              <span>→</span>
            </div>
          </motion.div>
        </Link>

        {/* Display Screen Stage */}
        <Link href="/display" className="group">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-amber-500/50 shadow-2xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Tv className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Live Stage Display</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                For projectors and large screens. Renders the interactive balloon bouquet simulation floating above the couple in real time.
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <span>Open Live Screen</span>
              <span>→</span>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Footer Info */}
      <footer className="mt-12 text-xs text-slate-500 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Self-Hosted & Offline LAN Ready (k3s + PostgreSQL + Socket.io)</span>
      </footer>
    </main>
  );
}
