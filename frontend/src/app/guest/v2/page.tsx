import GuestNameGateV2 from '@/components/v2/GuestNameGateV2';

export const metadata = {
  title: 'Wedding Guestbook | สมุดอวยพร',
  description:
    'Write a wish for the newlyweds — ร่วมเขียนคำอวยพรแสดงความยินดีแด่คู่บ่าวสาวในวันสำคัญ',
};

export default function GuestV2Page() {
  return (
    <main className="fixed inset-0 w-full h-full overflow-hidden bg-[#faf8f5]">
      <GuestNameGateV2 />
    </main>
  );
}
