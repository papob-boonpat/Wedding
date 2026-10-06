import GuestNameGateV2 from '@/components/v2/GuestNameGateV2';

export const metadata = {
  title: 'สมุดอวยพร | Wedding Guestbook',
  description:
    'ร่วมเขียนคำอวยพรแสดงความยินดีแด่คู่บ่าวสาวในวันสำคัญ — Write a wish for the newlyweds',
};

export default function GuestV2Page() {
  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-[#faf8f5]">
      <GuestNameGateV2 />
    </main>
  );
}
