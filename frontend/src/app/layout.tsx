import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'สมุดอวยพรแต่งงาน | Wedding Guestbook',
  description: 'ตู้กาชาปองคำอวยพรและกระดานวาดเขียนสำหรับงานแต่งงาน',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased bg-[#faf8f5] text-slate-800 overflow-hidden">{children}</body>
    </html>
  );
}