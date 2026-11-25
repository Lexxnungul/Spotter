export interface LocalChatReply {
  title: string;
  answer: string;
  record: string;
}

interface LocalChatRule {
  patterns: RegExp[];
  reply: LocalChatReply;
}

const LOCAL_CHAT_RULES: LocalChatRule[] = [
  {
    patterns: [/saturday|class|timetable|schedule/i],
    reply: {
      title: 'Gym Timetable & Classes',
      answer: 'Morning sessions run 06:00 - 12:00. Saturday classes run at 08:00 (HIIT & Strength) and 10:30 (Cardio & Core).',
      record: 'Saturday: 08:00 (HIIT & Strength), 10:30 (Cardio & Core)\nMon - Fri: 06:00 - 12:00, 16:00 - 21:00\nSunday: 12:00 - 18:00',
    },
  },
  {
    patterns: [/guest|visitor|bring someone/i],
    reply: {
      title: 'Guest Policy',
      answer: 'Premium members receive one complimentary guest pass per month. Additional guest day passes are 2,500 naira at the desk.',
      record: 'Premium: 1 guest pass / month\nBasic: no complimentary guest pass\nDay pass: 2,500 naira\nGuest registration required at desk before entry',
    },
  },
  {
    patterns: [/hours|open|close|time|early|before six/i],
    reply: {
      title: 'Access Hours',
      answer: 'Doors open at 06:00 and close at 21:00 Monday through Saturday. Sunday hours are 12:00 - 18:00.',
      record: 'Mon - Sat: 06:00 - 21:00\nSunday: 12:00 - 18:00\nTurnstiles activate at 06:00 for safety compliance',
    },
  },
  {
    patterns: [/price|cost|fee|subscription|plan|membership|payment|pay|renew/i],
    reply: {
      title: 'Approved Price List',
      answer: 'Basic Membership is 15,000 naira per month. Premium with trainer guidance is 25,000 naira per month. Daily passes are 2,500 naira.',
      record: 'Basic: 15,000 naira / month\nPremium: 25,000 naira / month\nDaily pass: 2,500 naira',
    },
  },
  {
    patterns: [/pause|freeze|cancel|refund/i],
    reply: {
      title: 'Pause & Cancellation Terms',
      answer: 'Memberships may be paused for up to 30 days per calendar year with 7 days written notice to the desk. Cancellations are handled in person.',
      record: 'Pause limit: 30 days / year\nNotice: 7 days before next billing cycle\nRefunds and cancellations: in-person desk authorization required',
    },
  },
  {
    patterns: [/training|workout|exercise|routine|coach/i],
    reply: {
      title: 'Training Plans & Coaching',
      answer: 'Spotter offers three approved routines: Full-Body Conditioning, Push/Pull/Legs, and Hypertrophy & Athletic Track. See the member portal for details.',
      record: '1. 3-Day Full Body\n2. 4-Day Push/Pull/Legs\n3. 5-Day Hypertrophy & Athletic Track',
    },
  },
  {
    patterns: [/trainer|duty|supervisor|reception|staff/i],
    reply: {
      title: 'Duty Staff & Trainer Guidance',
      answer: 'Coach Femi is the floor trainer on duty and Chioma Okeke is at the front desk. Visit the desk for customized coaching.',
      record: 'Floor supervisor: Coach Femi\nDesk reception: Chioma Okeke\nDuty shift: 06:00 - 14:00',
    },
  },
  {
    patterns: [/check.?in|qr|code|turnstile|card|access/i],
    reply: {
      title: 'Check-In & Access',
      answer: 'Generate a check-in code from the member dashboard, then present the QR code at the turnstile. Access is available from 06:00.',
      record: 'Open Member App > Check-In > Generate code\nShow the QR code at the desk or turnstile\nCodes are single-use and time-limited',
    },
  },
  {
    patterns: [/balance|owe|ledger|debt/i],
    reply: {
      title: 'Balance Information',
      answer: 'Your balance and payment history are private. Check the Payments section of your member dashboard for the current ledger.',
      record: 'Balance data is isolated by member and available in the member dashboard',
    },
  },
];

const DEFAULT_REPLY: LocalChatReply = {
  title: 'Spotter Assistant',
  answer: 'I can answer common questions about gym hours, classes, membership prices, guest passes, check-in, and payments. My live AI service is temporarily at its request limit, so please try again shortly or ask one of those topics.',
  record: 'Live AI temporarily unavailable - answered from the local Spotter knowledge base',
};

export function getLocalChatReply(message: string): LocalChatReply {
  for (const rule of LOCAL_CHAT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(message))) {
      return rule.reply;
    }
  }
  return DEFAULT_REPLY;
}
