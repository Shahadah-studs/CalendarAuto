import {
  CalendarEvent,
  toDateKey,
  extractUrl,
  stripUrl,
  showInAppToast,
  initVoiceAndAudio,
} from './voice-commands.js';

interface MoodTip {
  cls: string;
  title: string;
  message: string;
}

const STORAGE_KEY = 'calenderauto_events_v1';
const THEME_KEY = 'calenderauto_theme_v1';
const MOOD_KEY = 'calenderauto_moods_v1';

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

const gridEl = document.getElementById('calendarGrid') as HTMLDivElement;
const monthLabelEl = document.getElementById('monthLabel') as HTMLHeadingElement;
const agendaListEl = document.getElementById('dailyAgendaList') as HTMLDivElement;
const selectedDateLabelEl = document.getElementById('selectedDateLabel') as HTMLHeadingElement;
const modal = document.getElementById('eventModal') as HTMLDialogElement;
const form = document.getElementById('eventForm') as HTMLFormElement;
const modalHeadingEl = document.getElementById('modalHeading') as HTMLHeadingElement;
const editEventIdInput = document.getElementById('editEventId') as HTMLInputElement;
const themeToggleBtn = document.getElementById('themeToggleBtn') as HTMLButtonElement;
const moodPickerEl = document.getElementById('moodPicker') as HTMLDivElement;
const dailyMoodToastEl = document.getElementById('dailyMoodToast') as HTMLDivElement;
const statusPillEl = document.querySelector('.status-pill') as HTMLDivElement;

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

function formatRemainingTime(targetMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
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
    statusPillEl.textContent = `${clockStr} • Next: ${next.ev.title} in ${countdown}`;
  } else {
    statusPillEl.textContent = `${clockStr} • Clear for today`;
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

moodPickerEl.querySelectorAll<HTMLButtonElement>('.mood-btn').forEach((btn) => {
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
  moodPickerEl.querySelectorAll<HTMLButtonElement>('.mood-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mood === activeMood);
  });

  const tip = MOOD_TIPS[activeMood];
  if (tip) {
    dailyMoodToastEl.className = `daily-mood-toast ${tip.cls}`;
    dailyMoodToastEl.innerHTML = `
      <div class="daily-toast-tag">Daily Mood Check-In</div>
      <div class="daily-toast-title">${tip.title}</div>
      <div class="daily-toast-msg">${tip.message}</div>
    `;
  } else {
    dailyMoodToastEl.className = 'daily-mood-toast mood-default';
    dailyMoodToastEl.innerHTML = `
      <div class="daily-toast-tag">Daily Mood Check-In</div>
      <div class="daily-toast-title">Good Day! ✨</div>
      <div class="daily-toast-msg">Select a mood above for a daily boost—and don't forget to drink water!</div>
    `;
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
    cell.innerHTML = `<div class="day-header"><div class="day-number">${prevMonthDays - i}</div></div>`;
    gridEl.appendChild(cell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
      chip.textContent = `${ev.time} ${ev.title}`;
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
  selectedDateLabelEl.textContent = `Agenda • ${selectedDateKey}`;
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
notes: 'Meeting links in notes become buttons! https://shahadah-studs.github.io/CalendarAuto',
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
initVoiceAndAudio({
getSelectedDate: () => selectedDateKey,
onAddEvent: (newEvent) => {
events.push(newEvent);
selectedDateKey = newEvent.date;
const [y, m] = newEvent.date.split('-').map(Number);
viewDate = new Date(y, m - 1, 1);
saveEvents();
renderAll();
checkDueEvents();
},
onSetMood: (mood) => {
moods[selectedDateKey] = mood;
saveMoods();
renderAll();
},
onSetTheme: (dark) => {
applyTheme(dark);
},
});
renderAll();
checkDueEvents();
setInterval(checkDueEvents, 1000);
