export const DEVOTION_REMINDERS = [
  'Before the day gets busy, spend a quiet moment in the Word.',
  'Start your day by making room for God.',
  'Let the Word speak before the noise of the day begins.',
  'A few quiet minutes with God can shape the rest of your day.',
  'Before you face today, pause and listen to the Word.',
  'You do not need a perfect morning—just a willing heart.',
  'Slow down for a moment. God may have something to show you today.',
  'Begin with Scripture, then carry its truth into your day.',
  'Your schedule may be full, but your soul still needs time with God.',
  'Before checking everything else, check what God may be saying to you.',
  'Give God the first quiet moment of your day.',
  'Start with the Word and let it steady your heart.',
  'Pause before the rush. There is wisdom waiting in Scripture.',
  'Make room for God before the day asks everything from you.',
  'A small moment in the Word can become strength for the whole day.',
  'Come as you are. God is still inviting you into His presence.',
  'Let today begin with truth, not pressure.',
  'Open the Word before the worries of the day take over.',
  'Your devotion does not need to be long to be meaningful.',
  'Take one quiet step toward God before taking on the day.',
  'Before you move forward, let Scripture realign your heart.',
  'Start today by listening before doing.',
  'God can use a few faithful minutes to reshape your perspective.',
  'Give your heart a place to breathe in the Word today.',
  'The day can wait for a moment. Spend that moment with God.',
  'Begin again. Grace is already waiting for you in the Word.',
  'Let Scripture become the first voice that guides you today.',
  'Take a breath, open the Word, and allow God to meet you here.',
  'Before the world speaks loudly, listen quietly to God.',
  'Today is another opportunity to build your rhythm with God.',
  'A consistent walk with God begins with one honest moment today.',
  'Pause, reflect, and let the Word prepare you for what is ahead.',
  'You are not completing a task—you are making room for God.',
  'Start from the inside today. Let the Word shape your response.',
  'Even on a busy day, there is room for one meaningful pause with God.',
  'Let your first response today be openness to what God wants to teach you.',
  'Return to the Word. You never have to begin perfectly.',
  'Before carrying today’s responsibilities, receive today’s truth.',
  'Spend a moment with God now, and take that moment with you all day.',
  'Open your heart before you open the rest of your day.',
];

function hashDateKey(dateKey) {
  let hash = 2166136261;

  for (const character of String(dateKey || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getDailyDevotionReminder(dateKey) {
  if (!DEVOTION_REMINDERS.length) return 'Make room for God in your day.';
  return DEVOTION_REMINDERS[hashDateKey(dateKey) % DEVOTION_REMINDERS.length];
}
