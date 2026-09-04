'use client';

import Link from 'next/link';
import { PenTool, Tv, Heart, Sparkles, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-[#fdfbf7] via-[#fff5f5] to-[#fef2f2] p-6 select-none">
      {/* Glow Effects */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative z-10"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 mb-4 shadow-xl shadow-rose-300/40">
          <Heart className="w-8 h-8 text-white fill-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-serif bg-gradient-to-r from-rose-900 via-rose-700 to-amber-700 bg-clip-text text-transparent drop-shadow-sm">
          สมุดอวยพรแต่งงาน
        </h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base max-w-md mx-auto font-medium">
          ตู้กาชาปองรวบรวมคำอวยพรแบบเรียลไทม์ ร่วมแสดงความยินดีในวันสำคัญของเรา
        </p>
      </motion.div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl relative z-10">
        {/* Guest Input Tablet Station */}
        <Link href="/guest" className="group">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full p-8 rounded-3xl bg-white/90 backdrop-blur-xl border border-rose-200/80 hover:border-rose-400 shadow-xl shadow-rose-500/5 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <PenTool className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2 font-serif">จุดเขียนคำอวยพร (สำหรับแขก)</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                สำหรับ iPad และแท็บเล็ตที่จุดลงทะเบียน ให้แขกผู้มีเกียรติเขียนหรือวาดคำอวยพรง่ายๆ ด้วยปากกา Apple Pencil หรือ สไตลัส
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-rose-600 font-semibold text-sm">
              <span>เปิดกระดานเขียนคำอวยพร</span>
              <span>→</span>
            </div>
          </motion.div>
        </Link>

        {/* Display Screen Stage */}
        <Link href="/display" className="group">
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="h-full p-8 rounded-3xl bg-white/90 backdrop-blur-xl border border-rose-200/80 hover:border-amber-400 shadow-xl shadow-amber-500/5 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Tv className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2 font-serif">จอแสดงผลตู้กาชาปอง (Live Display)</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                สำหรับจอโปรเจกเตอร์หรือทีวีขนาดใหญ่ แสดงลูกบอลคำอวยพรที่หล่นลงสู่ตู้กระจกกาชาปองแบบเรียลไทม์ และแตะเพื่อเปิดดูได้
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <span>เปิดหน้าจอแสดงผล</span>
              <span>→</span>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Footer Info */}
      <footer className="mt-12 text-xs text-slate-400 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>ระบบพร้อมใช้งานแบบออฟไลน์ผ่านเครือข่ายภายใน (LAN) • PostgreSQL + MinIO + Socket.io</span>
      </footer>
    </main>
  );
}
