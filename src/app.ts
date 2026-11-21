interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  color: string;
  notes: string;
  notified?: boolean;
}

interface MoodTip {
  cls: string;
  title: string;
  message: string;
}

type ChimeType = 'bell' | 'retro' | 'pulse' | 'silent';

const STORAGE_KEY = 'calenderauto_events_v1';
const THEME_KEY = 'calenderauto_theme_v1';
const SOUND_KEY = 'calenderauto_sound_v1';
const MOOD_KEY = 'calenderauto_moods_v1';
const BASE_TITLE = 'CalenderAuto';

const MOOD_TIPS: Record<string, MoodTip> = {
  '⚡': {
    cls: 'mood-energy',
    title: '⚡ High Energy Mode!',
    message: "Crush your toughest tasks today—and don't forget to drink water!",
  },
  '😊': {
    cls: 'mood-good',
    title: '😊 Great Vibes Today!',
    message: 'Keep the momentum rolling, stay hydrated, and celebrate your wins!',
  },
  '😐': {
    cls: 'mood-neutral',
    title: '😐 Steady & Grounded',
    message: 'Take it one step at a time today. Grab a glass of water and breathe!',
  },
  '😴': {
    cls: 'mood-tired',
    title: '😴 Low Battery Day',
    message: 'Pace yourself, take short screen breaks, and drink some cold water!',
  },
};

let lastKnownTodayKey = toDateKey(new Date());
let viewDate = new Date();
let selectedDateKey = lastKnownTodayKey;
let events: CalendarEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let moods: Record<string, string> = JSON.parse(localStorage.getItem(MOOD_KEY) || '{}');
let selectedSound: ChimeType = (localStorage.getItem(SOUND_KEY) as ChimeType) || 'bell';
let audioCtx: AudioContext | null = null;
let flashInterval: number | null = null;
let isVoiceActive = false;
let recognition: any = null;

const gridEl = document.getElementById('calendarGrid') as HTMLDivElement;
const monthLabelEl = document.getElementById('monthLabel') as HTMLHeadingElement;
const agendaListEl = document.getElementById('dailyAgendaList') as HTMLDivElement;
const selectedDateLabelEl = document.getElementById('selectedDateLabel') as HTMLHeadingElement;
const modal = document.getElementById('eventModal') as HTMLDialogElement;
const form = document.getElementById('eventForm') as HTMLFormElement;
const modalHeadingEl = document.getElementById('modalHeading') as HTMLHeadingElement;
const editEventIdInput = document.getElementById('editEventId') as HTMLInputElement;
const toastContainerEl = document.getElementById('toastContainer') as HTMLDivElement;
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
const soundSelect = document.getElementById('soundSelect') as HTMLSelectElement;
const moodPickerEl = document.getElementById('moodPicker') as HTMLDivElement;
const dailyMoodToastEl = document.getElementById('dailyMoodToast') as HTMLDivElement;
const statusPillEl = document.querySelector('.status-pill') as HTMLDivElement;
const voiceToggleBtn = document.getElementById('voiceToggleBtn') as HTMLButtonElement;
const voiceBannerEl = document.getElementById('voiceBanner') as HTMLDivElement;
const voiceTranscriptEl = document.getElementById('voiceTranscript') as HTMLSpanElement;

soundSelect.value = selectedSound;

soundSelect.addEventListener('change', () => {
  selectedSound = soundSelect.value as ChimeType;
  localStorage.setItem(SOUND_KEY, selectedSound);
  playChime();
});

function applyTheme(dark: boolean): void {
  document.body.classList.toggle('dark', dark);
  themeToggleBtn.textContent = dark ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}

themeToggleBtn.addEventListener('click', () => {
  const isDark = !document.body.classList.contains('dark');
  applyTheme(isDark);
});

applyTheme(localStorage.getItem(THEME_KEY) === 'dark');

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeKey(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function toClockDisplay(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function saveEvents(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function saveMoods(): void {
  localStorage.setItem(MOOD_KEY, JSON.stringify(moods));
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function stripUrl(text: string): string {
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

function playChime(): void {
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

function startTabFlash(alertTitle: string): void {
  stopTabFlash();
  let toggle = false;
  document.title = `🔔 ${alertTitle}`;
  flashInterval = window.setInterval(() => {
    toggle = !toggle;
    document.title = toggle ? BASE_TITLE : `🔔 ${alertTitle}`;
  }, 900);
}

function stopTabFlash(): void {
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

function showInAppToast(ev: CalendarEvent, tagLabel = 'Due Now'): void {
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

function parseVoiceDate(text: string): { date: string; cleaned: string } {
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
const rx = new RegExp(\\b(?:on\\s+|next\\s+)?${weekdays[i]}\\b, 'i');
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
const monthRx = new RegExp(\\b(?:on\\s+)?(${months.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b, 'i');
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
date: ${year}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')},
cleaned,
};
}
return { date: selectedDateKey, cleaned };
}
function handleVoiceCommand(rawTranscript: string): void {
const transcript = rawTranscript.trim();
if (!transcript) return;
voiceTranscriptEl.textContent = Heard: "${transcript}";
const lower = transcript.toLowerCase();
if (lower.includes('dark mode')) {
applyTheme(true);
return;
}
if (lower.includes('light mode')) {
applyTheme(false);
return;
}
if (lower.includes('mood')) {
if (lower.includes('energy') || lower.includes('high')) {
moods[selectedDateKey] = '⚡';
saveMoods();
renderAll();
return;
}
if (lower.includes('good') || lower.includes('happy')) {
moods[selectedDateKey] = '😊';
saveMoods();
renderAll();
return;
}
if (lower.includes('neutral') || lower.includes('okay')) {
moods[selectedDateKey] = '😐';
saveMoods();
renderAll();
return;
}
if (lower.includes('tired') || lower.includes('low') || lower.includes('sleepy')) {
moods[selectedDateKey] = '😴';
saveMoods();
renderAll();
return;
}
}
let working = transcript
.replace(/^(?:hey\s+|ok\s+|okay\s+)?(?:calender\sauto|calendar\sauto)[,\s]/i, '')
.replace(/^(?:please\s+)?(?:add|schedule|create|put|set)\s+(?:an?\s+event\s+(?:called|named)\s+)?/i, '')
.replace(/\b(?:to|on|into)\s+my\s+calendar[.!?]$/i, '')
.trim();
const parsedTime = parseVoiceTime(working);
const parsedDate = parseVoiceDate(parsedTime.cleaned);
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
events.push(newEvent);
selectedDateKey = newEvent.date;
const [y, m] = newEvent.date.split('-').map(Number);
viewDate = new Date(y, m - 1, 1);
saveEvents();
renderAll();
showInAppToast(newEvent, Added for ${newEvent.date});
checkDueEvents();
}
function initSpeechRecognition(): void {
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
const result = event.results[lastIdx];
if (result.isFinal) {
handleVoiceCommand(result[0].transcript);
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
initSpeechRecognition();
function formatRemainingTime(targetMs: number, nowMs: number): string {
const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
const hrs = Math.floor(diffSec / 3600);
const mins = Math.floor((diffSec % 3600) / 60);
const secs = diffSec % 60;
if (hrs > 0) return ${hrs}h ${mins}m;
if (mins > 0) return ${mins}m ${secs}s;
return ${secs}s;
}
function updateLiveClockAndTicker(now: Date): void {
if (!statusPillEl) return;
const clockStr = toClockDisplay(now);
const todayKey = toDateKey(now);
const nowMs = now.getTime();
const upcomingToday = events
.filter((ev) => ev.date === todayKey)
.map((ev) => {
const [hh, mm] = ev.time.split(':').map(Number);
const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
return { ev, targetMs: target.getTime() };
})
.filter((item) => item.targetMs > nowMs)
.sort((a, b) => a.targetMs - b.targetMs);
if (upcomingToday.length > 0) {
const next = upcomingToday[0];
const countdown = formatRemainingTime(next.targetMs, nowMs);
statusPillEl.textContent = ${clockStr} • Next: ${next.ev.title} in ${countdown};
} else {
statusPillEl.textContent = ${clockStr} • Clear for today;
}
}
function checkDueEvents(): void {
const now = new Date();
const todayKey = toDateKey(now);
const currentTime = toTimeKey(now);
if (todayKey !== lastKnownTodayKey) {
const wasViewingYesterday = selectedDateKey === lastKnownTodayKey;
const wasViewingCurrentMonth =
viewDate.getFullYear() === Number(lastKnownTodayKey.slice(0, 4)) &&
viewDate.getMonth() === Number(lastKnownTodayKey.slice(5, 7)) - 1;
lastKnownTodayKey = todayKey;
if (wasViewingYesterday) {
selectedDateKey = todayKey;
}
if (wasViewingCurrentMonth) {
viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
}
renderAll();
}
updateLiveClockAndTicker(now);
let updated = false;
events.forEach((ev) => {
if (!ev.notified && ev.date === todayKey && ev.time <= currentTime) {
ev.notified = true;
updated = true;
showInAppToast(ev);
}
});
if (updated) {
saveEvents();
}
}
moodPickerEl.querySelectorAll('.mood-btn').forEach((btn) => {
btn.addEventListener('click', () => {
const chosen = btn.dataset.mood || '';
if (moods[selectedDateKey] === chosen) {
delete moods[selectedDateKey];
} else {
moods[selectedDateKey] = chosen;
}
saveMoods();
renderAll();
});
});
function renderMoodBar(): void {
const activeMood = moods[selectedDateKey] || '';
moodPickerEl.querySelectorAll('.mood-btn').forEach((btn) => {
btn.classList.toggle('active', btn.dataset.mood === activeMood);
});
const tip = MOOD_TIPS[activeMood];
if (tip) {
dailyMoodToastEl.className = daily-mood-toast ${tip.cls};
dailyMoodToastEl.innerHTML = <div class="daily-toast-tag">Daily Mood Check-In</div> <div class="daily-toast-title">${tip.title}</div> <div class="daily-toast-msg">${tip.message}</div>;
} else {
dailyMoodToastEl.className = 'daily-mood-toast mood-default';
dailyMoodToastEl.innerHTML = <div class="daily-toast-tag">Daily Mood Check-In</div> <div class="daily-toast-title">Good Day! ✨</div> <div class="daily-toast-msg">Select a mood above for a daily boost—and don't forget to drink water!</div>;
}
}
function renderAll(): void {
renderMoodBar();
renderGrid();
renderAgenda();
}
function renderGrid(): void {
const year = viewDate.getFullYear();
const month = viewDate.getMonth();
const todayKey = toDateKey(new Date());
monthLabelEl.textContent = new Intl.DateTimeFormat('en-US', {
month: 'long',
year: 'numeric',
}).format(viewDate);
gridEl.innerHTML = '';
const firstDay = new Date(year, month, 1).getDay();
const totalDays = new Date(year, month + 1, 0).getDate();
const prevMonthDays = new Date(year, month, 0).getDate();
for (let i = firstDay - 1; i >= 0; i--) {
const cell = document.createElement('div');
cell.className = 'day-cell other-month';
cell.innerHTML = <div class="day-header"><div class="day-number">${prevMonthDays - i}</div></div>;
gridEl.appendChild(cell);
}
for (let day = 1; day <= totalDays; day++) {
const dateKey = ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')};
const dayEvents = events
.filter((e) => e.date === dateKey)
.sort((a, b) => a.time.localeCompare(b.time));
const cell = document.createElement('div');
cell.className = 'day-cell';
if (dateKey === todayKey) cell.classList.add('today');
if (dateKey === selectedDateKey) cell.classList.add('selected');
if (dayEvents.length === 1) cell.classList.add('heat-1');
else if (dayEvents.length === 2) cell.classList.add('heat-2');
else if (dayEvents.length === 3) cell.classList.add('heat-3');
else if (dayEvents.length >= 4) cell.classList.add('heat-4');
const header = document.createElement('div');
header.className = 'day-header';
const num = document.createElement('div');
num.className = 'day-number';
num.textContent = String(day);
header.appendChild(num);
if (moods[dateKey]) {
const moodBadge = document.createElement('span');
moodBadge.className = 'day-mood';
moodBadge.textContent = moods[dateKey];
header.appendChild(moodBadge);
}
cell.appendChild(header);
const eventsWrapper = document.createElement('div');
eventsWrapper.className = 'cell-events-list';
dayEvents.forEach((ev) => {
const chip = document.createElement('div');
chip.className = 'event-chip';
chip.style.backgroundColor = ev.color;
chip.textContent = ${ev.time} ${ev.title};
chip.addEventListener('click', (e) => {
e.stopPropagation();
openEditModal(ev);
});
eventsWrapper.appendChild(chip);
});
cell.appendChild(eventsWrapper);
cell.addEventListener('click', () => {
selectedDateKey = dateKey;
renderAll();
});
cell.addEventListener('dblclick', () => {
openCreateModal(dateKey);
});
gridEl.appendChild(cell);
}
}
function renderAgenda(): void {
selectedDateLabelEl.textContent = Agenda • ${selectedDateKey};
const dayEvents = events
.filter((e) => e.date === selectedDateKey)
.sort((a, b) => a.time.localeCompare(b.time));
agendaListEl.innerHTML = '';
if (dayEvents.length === 0) {
agendaListEl.innerHTML = <p style="font-size:0.82rem;color:var(--muted);">No events scheduled. Double-click any day cell to add one.</p>;
return;
}
dayEvents.forEach((ev) => {
const linkUrl = extractUrl(ev.notes);
const cleanNotes = stripUrl(ev.notes);
const card = document.createElement('div');
card.className = 'agenda-card';
card.style.borderLeftColor = ev.color;
card.innerHTML = <div style="display:flex;justify-content:space-between;align-items:center;"> <span class="time">${ev.time}</span> <div class="card-actions"> <button class="edit-btn" style="padding:0.1rem 0.4rem;font-size:0.7rem;">Edit</button> <button class="del-btn" style="padding:0.1rem 0.4rem;font-size:0.7rem;">Delete</button> </div> </div> <div style="font-weight:600;margin-top:0.25rem;">${ev.title}</div> ${cleanNotes ?${cleanNotes}: ''} ${linkUrl ?Join Link ↗: ''};
card.querySelector('.edit-btn')?.addEventListener('click', () => {
openEditModal(ev);
});
card.querySelector('.del-btn')?.addEventListener('click', () => {
events = events.filter((item) => item.id !== ev.id);
saveEvents();
renderAll();
});
agendaListEl.appendChild(card);
});
}
function openCreateModal(dateKey: string): void {
modalHeadingEl.textContent = 'Schedule on CalenderAuto';
editEventIdInput.value = '';
(document.getElementById('eventDate') as HTMLInputElement).value = dateKey;
(document.getElementById('eventTime') as HTMLInputElement).value = '09:00';
(document.getElementById('eventTitle') as HTMLInputElement).value = '';
(document.getElementById('eventColor') as HTMLSelectElement).value = '#4f46e5';
(document.getElementById('eventNotes') as HTMLTextAreaElement).value = '';
modal.showModal();
}
function openEditModal(ev: CalendarEvent): void {
modalHeadingEl.textContent = 'Edit Event';
editEventIdInput.value = ev.id;
(document.getElementById('eventDate') as HTMLInputElement).value = ev.date;
(document.getElementById('eventTime') as HTMLInputElement).value = ev.time;
(document.getElementById('eventTitle') as HTMLInputElement).value = ev.title;
(document.getElementById('eventColor') as HTMLSelectElement).value = ev.color;
(document.getElementById('eventNotes') as HTMLTextAreaElement).value = ev.notes;
modal.showModal();
}
document.getElementById('testAlertBtn')?.addEventListener('click', () => {
showInAppToast({
id: 'test',
date: toDateKey(new Date()),
time: toTimeKey(new Date()),
title: 'CalenderAuto Alert',
color: '#4f46e5',
notes: 'Meeting links in notes become buttons! https://github.com',
});
});
form.addEventListener('submit', (e) => {
e.preventDefault();
const existingId = editEventIdInput.value;
const title = (document.getElementById('eventTitle') as HTMLInputElement).value.trim();
const date = (document.getElementById('eventDate') as HTMLInputElement).value;
const time = (document.getElementById('eventTime') as HTMLInputElement).value;
const color = (document.getElementById('eventColor') as HTMLSelectElement).value;
const notes = (document.getElementById('eventNotes') as HTMLTextAreaElement).value.trim();
if (!title || !date) return;
if (existingId) {
const index = events.findIndex((item) => item.id === existingId);
if (index !== -1) {
const prev = events[index];
const rescheduled = prev.date !== date || prev.time !== time;
events[index] = {
...prev,
title,
date,
time,
color,
notes,
notified: rescheduled ? false : prev.notified,
};
}
} else {
events.push({
id: crypto.randomUUID(),
date,
time,
title,
color,
notes,
notified: false,
});
}
selectedDateKey = date;
saveEvents();
modal.close();
renderAll();
checkDueEvents();
});
document.getElementById('newEventBtn')?.addEventListener('click', () => openCreateModal(selectedDateKey));
document.getElementById('cancelModal')?.addEventListener('click', () => modal.close());
document.getElementById('prevBtn')?.addEventListener('click', () => {
viewDate.setMonth(viewDate.getMonth() - 1);
renderGrid();
});
document.getElementById('nextBtn')?.addEventListener('click', () => {
viewDate.setMonth(viewDate.getMonth() + 1);
renderGrid();
});
document.getElementById('todayBtn')?.addEventListener('click', () => {
viewDate = new Date();
selectedDateKey = toDateKey(viewDate);
renderAll();
});
document.getElementById('exportIcsBtn')?.addEventListener('click', () => {
const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CalenderAuto//EN'];
events.forEach((ev) => {
const dt = ev.date.replace(/-/g, '') + 'T' + ev.time.replace(':', '') + '00';
lines.push('BEGIN:VEVENT', UID:${ev.id}, DTSTART:${dt}, SUMMARY:${ev.title}, 'END:VEVENT');
});
lines.push('END:VCALENDAR');
const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = 'calender-auto.ics';
link.click();
});
renderAll();
checkDueEvents();
setInterval(checkDueEvents, 1000);
