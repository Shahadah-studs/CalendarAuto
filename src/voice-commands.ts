export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  color: string;
  notes: string;
  notified?: boolean;
}

export type ChimeType = 'bell' | 'retro' | 'pulse' | 'silent';

export interface VoiceHooks {
  getSelectedDate: () => string;
  onAddEvent: (ev: CalendarEvent) => void;
  onSetMood: (mood: string) => void;
  onSetTheme: (dark: boolean) => void;
}

const SOUND_KEY = 'calenderauto_sound_v1';
const BASE_TITLE = 'CalenderAuto';

let selectedSound: ChimeType = (localStorage.getItem(SOUND_KEY) as ChimeType) || 'bell';
let audioCtx: AudioContext | null = null;
let flashInterval: number | null = null;
let isVoiceActive = false;
let recognition: any = null;

const toastContainerEl = document.getElementById('toastContainer') as HTMLDivElement;
const soundSelect = document.getElementById('soundSelect') as HTMLSelectElement;
const voiceToggleBtn = document.getElementById('voiceToggleBtn') as HTMLButtonElement;
const voiceBannerEl = document.getElementById('voiceBanner') as HTMLDivElement;
const voiceTranscriptEl = document.getElementById('voiceTranscript') as HTMLSpanElement;

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export function stripUrl(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/gi, '').trim();
}

function unlockAudio(): void {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

document.addEventListener('click', unlockAudio, { once: true });

export function playChime(): void {
  if (selectedSound === 'silent') return;
  unlockAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (selectedSound === 'bell') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (selectedSound === 'retro') {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.14, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.14);
    });
  } else if (selectedSound === 'pulse') {
    [0, 0.18].forEach((offset) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now + offset);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });
  }
}

export function startTabFlash(alertTitle: string): void {
  stopTabFlash();
  let toggle = false;
  document.title = `🔔 ${alertTitle}`;
  flashInterval = window.setInterval(() => {
    toggle = !toggle;
    document.title = toggle ? BASE_TITLE : `🔔 ${alertTitle}`;
  }, 900);
}

export function stopTabFlash(): void {
  if (flashInterval !== null) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  document.title = BASE_TITLE;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && toastContainerEl.children.length === 0) {
    stopTabFlash();
  }
});

export function showInAppToast(ev: CalendarEvent, tagLabel = 'Due Now'): void {
  playChime();
  if (tagLabel === 'Due Now') {
    startTabFlash(ev.title);
  }

  const linkUrl = extractUrl(ev.notes);
  const cleanNotes = stripUrl(ev.notes);

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.style.borderLeftColor = ev.color;
  toast.innerHTML = `
    <div class="toast-header">
      <span>${tagLabel} • ${ev.time}</span>
      <button type="button" style="padding:0.15rem 0.45rem;font-size:0.72rem;">Dismiss</button>
    </div>
    <div class="toast-title">${ev.title}</div>
    ${cleanNotes ? `<div class="toast-notes">${cleanNotes}</div>` : ''}
    ${linkUrl ? `<div><a class="join-link-btn" href="${linkUrl}" target="_blank" rel="noopener noreferrer">Join Link ↗</a></div>` : ''}
  `;

  toast.querySelector('button')?.addEventListener('click', () => {
    toast.remove();
    if (toastContainerEl.children.length === 0) {
      stopTabFlash();
    }
  });

  toastContainerEl.appendChild(toast);
}

function parseVoiceTime(text: string): { time: string; cleaned: string } {
  let cleaned = text;
  let hours = 9;
  let minutes = 0;

  const amPmMatch = cleaned.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (amPmMatch) {
    hours = parseInt(amPmMatch[1], 10);
    minutes = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
    const period = amPmMatch[3].toLowerCase().replace(/\./g, '');
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    cleaned = cleaned.replace(amPmMatch[0], ' ');
    return {
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      cleaned,
    };
  }

  const militaryMatch = cleaned.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/i);
  if (militaryMatch) {
    hours = Math.min(23, parseInt(militaryMatch[1], 10));
    minutes = Math.min(59, parseInt(militaryMatch[2], 10));
    cleaned = cleaned.replace(militaryMatch[0], ' ');
    return {
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      cleaned,
    };
  }

  const atHourMatch = cleaned.match(/\bat\s+(\d{1,2})\b/i);
  if (atHourMatch) {
    hours = Math.min(23, parseInt(atHourMatch[1], 10));
    cleaned = cleaned.replace(atHourMatch[0], ' ');
    return {
      time: `${String(hours).padStart(2, '0')}:00`,
      cleaned,
    };
  }

  return { time: '09:00', cleaned };
}

function parseVoiceDate(text: string, fallbackDate: string): { date: string; cleaned: string } {
  const now = new Date();
  let cleaned = text;

  if (/\btomorrow\b/i.test(cleaned)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    cleaned = cleaned.replace(/\b(?:on\s+)?tomorrow\b/i, ' ');
    return { date: toDateKey(d), cleaned };
  }

  if (/\btoday\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/\b(?:on\s+)?today\b/i, ' ');
    return { date: toDateKey(now), cleaned };
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    const rx = new RegExp(`\\b(?:on\\s+|next\\s+)?${weekdays[i]}\\b`, 'i');
    const match = cleaned.match(rx);
    if (match) {
      const currentDay = now.getDay();
      let delta = i - currentDay;
      if (delta <= 0) delta += 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
      cleaned = cleaned.replace(match[0], ' ');
      return { date: toDateKey(d), cleaned };
    }
  }

  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const monthRx = new RegExp(`\\b(?:on\\s+)?(${months.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
  const monthMatch = cleaned.match(monthRx);
  if (monthMatch) {
    const mIdx = months.indexOf(monthMatch[1].toLowerCase());
    const dayNum = parseInt(monthMatch[2], 10);
    let year = now.getFullYear();
    const candidate = new Date(year, mIdx, dayNum);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
    }
    cleaned = cleaned.replace(monthMatch[0], ' ');
    return {
      date: `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
      cleaned,
    };
  }

  return { date: fallbackDate, cleaned };
}

function handleVoiceCommand(rawTranscript: string, hooks: VoiceHooks): void {
  const transcript = rawTranscript.trim();
  if (!transcript) return;
  voiceTranscriptEl.textContent = `Heard: "${transcript}"`;

  const lower = transcript.toLowerCase();

  if (lower.includes('dark mode')) {
    hooks.onSetTheme(true);
    return;
  }
  if (lower.includes('light mode')) {
    hooks.onSetTheme(false);
    return;
  }

  if (lower.includes('mood')) {
    if (lower.includes('energy') || lower.includes('high')) {
      hooks.onSetMood('⚡');
      return;
    }
    if (lower.includes('good') || lower.includes('happy')) {
      hooks.onSetMood('😊');
      return;
    }
    if (lower.includes('neutral') || lower.includes('okay')) {
      hooks.onSetMood('😐');
      return;
    }
    if (lower.includes('tired') || lower.includes('low') || lower.includes('sleepy')) {
      hooks.onSetMood('😴');
      return;
    }
  }

  let working = transcript
    .replace(/^(?:hey\s+|ok\s+|okay\s+)?(?:calender\s*auto|calendar\s*auto)[,\s]*/i, '')
    .replace(/^(?:please\s+)?(?:add|schedule|create|put|set)\s+(?:an?\s+event\s+(?:called|named)\s+)?/i, '')
    .replace(/\b(?:to|on|into)\s+my\s+calendar[.!?]*$/i, '')
    .trim();

  const parsedTime = parseVoiceTime(working);
const parsedDate = parseVoiceDate(parsedTime.cleaned, hooks.getSelectedDate());
const cleanTitle = parsedDate.cleaned
.replace(/\s+/g, ' ')
.replace(/^[\s,.-]+|[\s,.-]+$/g, '')
.trim();
if (!cleanTitle) return;
const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
let color = '#4f46e5';
if (/\b(?:meeting|sync|call|zoom|interview)\b/i.test(formattedTitle)) color = '#d97706';
else if (/\b(?:urgent|deadline|exam|due|important)\b/i.test(formattedTitle)) color = '#e11d48';
else if (/\b(?:gym|workout|personal|dinner|lunch|birthday|doctor|dentist)\b/i.test(formattedTitle)) color = '#059669';
const newEvent: CalendarEvent = {
id: crypto.randomUUID(),
date: parsedDate.date,
time: parsedTime.time,
title: formattedTitle,
color,
notes: 'Added via Voice Command',
notified: false,
};
hooks.onAddEvent(newEvent);
showInAppToast(newEvent, Added for ${newEvent.date});
}
function updateVoiceUI(): void {
if (isVoiceActive) {
voiceToggleBtn.textContent = '🔴 Listening';
voiceToggleBtn.classList.remove('muted');
voiceToggleBtn.classList.add('listening');
voiceBannerEl.classList.remove('hidden');
} else {
voiceToggleBtn.textContent = '🎙️ Muted';
voiceToggleBtn.classList.remove('listening');
voiceToggleBtn.classList.add('muted');
voiceBannerEl.classList.add('hidden');
}
}
export function initVoiceAndAudio(hooks: VoiceHooks): void {
soundSelect.value = selectedSound;
soundSelect.addEventListener('change', () => {
selectedSound = soundSelect.value as ChimeType;
localStorage.setItem(SOUND_KEY, selectedSound);
playChime();
});
const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
if (!SpeechRec) {
voiceToggleBtn.textContent = '🎙️ Unsupported';
voiceToggleBtn.disabled = true;
return;
}
recognition = new SpeechRec();
recognition.lang = 'en-US';
recognition.continuous = true;
recognition.interimResults = false;
recognition.onresult = (event: any) => {
const lastIdx = event.results.length - 1;
const result = event.results[lastIdx][0];
if (event.results[lastIdx].isFinal) {
handleVoiceCommand(result.transcript, hooks);
}
};
recognition.onerror = (event: any) => {
if (event.error === 'not-allowed') {
isVoiceActive = false;
updateVoiceUI();
voiceTranscriptEl.textContent = 'Microphone permission denied.';
}
};
recognition.onend = () => {
if (isVoiceActive) {
try {
recognition.start();
} catch {
}
}
};
voiceToggleBtn.addEventListener('click', () => {
if (!recognition) return;
isVoiceActive = !isVoiceActive;
if (isVoiceActive) {
voiceTranscriptEl.textContent = 'Listening... Say "Please add Dentist tomorrow at 2 PM to my calendar"';
try {
recognition.start();
} catch {
}
} else {
try {
recognition.stop();
} catch {
}
}
updateVoiceUI();
});
}
