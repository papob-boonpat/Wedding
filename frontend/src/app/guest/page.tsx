import Canvas from '@/components/Canvas';

export const metadata = {
  title: 'สมุดอวยพร | วาดและส่งคำอวยพร',
  description: 'ร่วมเขียนคำอวยพรแสดงความยินดีแด่คู่บ่าวสาวในวันสำคัญ',
};

export default function GuestPage() {
  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-[#faf8f5]">
      <Canvas />
    </main>
  );
}
