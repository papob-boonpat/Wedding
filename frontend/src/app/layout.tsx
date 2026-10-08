import './globals.css';
import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'สมุดอวยพรแต่งงาน | Wedding Guestbook',
  description: 'ตู้กาชาปองคำอวยพรและกระดานวาดเขียนสำหรับงานแต่งงาน',
  manifest: '/manifest.webmanifest',
  applicationName: 'Wedding Guestbook',
  appleWebApp: {
    capable: true,
    title: 'Guestbook',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f43f5e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased bg-[#faf8f5] text-slate-800 overflow-hidden">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}