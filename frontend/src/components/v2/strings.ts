export type Lang = 'th' | 'en';

export interface Strings {
  // Name gate
  gateTitle: string;
  gateSubtitle: string;
  namePlaceholder: string;
  nameError: string;
  gateStart: string;
  // Canvas chrome
  undo: string;
  clear: string;
  eraser: string;
  submit: string;
  submitting: string;
  emptyPrompt: string;
  sealTag: string;
  successToast: string;
  submitError: string;
  // Input mode toggle
  inputModeLabel: string;
  // Draw vs type mode
  writeModeLabel: string;
  drawMode: string;
  typeMode: string;
  typePlaceholder: string;
  typeHint: string;
  stylusMode: string;
  fingerMode: string;
  fingerHint: string;
  // Tool labels
  colorNames: Record<string, string>;
  penSizes: Record<number, string>;
  // Language toggle
  langToggle: string;
}

export const STRINGS: Record<Lang, Strings> = {
  th: {
    gateTitle: 'ก่อนเขียนคำอวยพร',
    gateSubtitle: 'กรุณาระบุชื่อของคุณ เพื่อให้คู่บ่าวสาวรู้ว่าคำอวยพรนี้มาจากใคร',
    namePlaceholder: 'ชื่อของคุณ',
    nameError: 'กรุณากรอกชื่อของคุณก่อนเริ่มเขียน',
    gateStart: 'เริ่มเขียนคำอวยพร',
    undo: 'เลิกทำ',
    clear: 'ล้างหน้าจอ',
    eraser: 'ยางลบ',
    submit: 'ส่งคำอวยพร',
    submitting: 'กำลังส่ง...',
    emptyPrompt: 'เขียนหรือวาดคำอวยพรของคุณที่นี่',
    sealTag: 'คำอวยพร',
    successToast: 'ส่งคำอวยพรลงตู้กาชาปองเรียบร้อยแล้ว ขอบคุณมากครับ/ค่ะ! ✨',
    submitError: 'ไม่สามารถส่งคำอวยพรได้ กรุณาตรวจสอบการเชื่อมต่อเครือข่าย',
    inputModeLabel: 'โหมดการเขียน',
    writeModeLabel: 'วิธีเขียนคำอวยพร',
    drawMode: 'วาด',
    typeMode: 'พิมพ์',
    typePlaceholder: 'พิมพ์คำอวยพรของคุณ...',
    typeHint: 'พิมพ์ข้อความ แล้วคำอวยพรจะปรากฏบนกระดาษด้านบน',
    stylusMode: 'ปากกา',
    fingerMode: 'นิ้วมือ',
    fingerHint: 'โหมดนิ้วมือ: วางมือบนหน้าจอน้อยที่สุดเพื่อไม่ให้เกิดเส้นที่ไม่ต้องการ',
    colorNames: {
      '#e11d48': 'ชมพูกุหลาบ',
      '#d97706': 'ทองอบอุ่น',
      '#0284c7': 'ฟ้าสดใส',
      '#7c3aed': 'ม่วงรอยัล',
      '#059669': 'เขียวมรกต',
      '#ea580c': 'ส้มซันเซ็ต',
      '#db2777': 'ชมพูเบอร์รี่',
    },
    penSizes: { 3: 'เส้นเล็ก', 6: 'ปานกลาง', 12: 'เส้นใหญ่' },
    langToggle: 'EN',
  },
  en: {
    gateTitle: 'Before you write',
    gateSubtitle: 'Please tell us your name, so the couple knows who this wish is from.',
    namePlaceholder: 'Your name',
    nameError: 'Please enter your name before you start writing',
    gateStart: 'Start writing',
    undo: 'Undo',
    clear: 'Clear',
    eraser: 'Eraser',
    submit: 'Send wish',
    submitting: 'Sending...',
    emptyPrompt: 'Write or draw your wish here',
    sealTag: 'Wish',
    successToast: 'Your wish is safely in the gachapon machine. Thank you! ✨',
    submitError: 'Could not send your wish. Please check your network connection.',
    inputModeLabel: 'Drawing mode',
    writeModeLabel: 'How to write your wish',
    drawMode: 'Draw',
    typeMode: 'Type',
    typePlaceholder: 'Type your wish...',
    typeHint: 'Type your message and it will appear on the paper above',
    stylusMode: 'Stylus',
    fingerMode: 'Finger',
    fingerHint: 'Finger mode: rest as little of your hand on the screen as you can to avoid stray marks',
    colorNames: {
      '#e11d48': 'Rose',
      '#d97706': 'Warm gold',
      '#0284c7': 'Sky blue',
      '#7c3aed': 'Royal purple',
      '#059669': 'Emerald',
      '#ea580c': 'Sunset orange',
      '#db2777': 'Berry pink',
    },
    penSizes: { 3: 'Thin', 6: 'Medium', 12: 'Thick' },
    langToggle: 'ไทย',
  },
};
