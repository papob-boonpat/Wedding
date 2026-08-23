import Canvas from '@/components/Canvas';

export const metadata = {
  title: 'Guestbook | Draw Your Wishes',
  description: 'Draw your wedding wishes and watch them float into the balloon bouquet in real-time.',
};

export default function GuestPage() {
  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950">
      <Canvas />
    </main>
  );
}
