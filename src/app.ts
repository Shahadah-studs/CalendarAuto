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

let viewDate = new Date();
let selectedDateKey = toDateKey(new Date());
let events: CalendarEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let moods: Record<string, string> = JSON.parse(localStorage.getItem(MOOD_KEY) || '{}');
let selectedSound: ChimeType = (localStorage.getItem(SOUND_KEY) as ChimeType) || 'bell';
let audioCtx: AudioContext | null = null;
let flashInterval: number | null = null;

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

function showInAppToast(ev: CalendarEvent): void {
  playChime();
  startTabFlash(ev.title);

  const linkUrl = extractUrl(ev.notes);
  const cleanNotes = stripUrl(ev.notes);

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.style.borderLeftColor = ev.color;
  toast.innerHTML = `
    <div class="toast-header">
      <span>Due Now • ${ev.time}</span>
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

function checkDueEvents(): void {
  const now = new Date();
  const todayKey = toDateKey(now);
  const currentTime = toTimeKey(now);
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
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (dateKey === todayKey) cell.classList.add('today');
    if (dateKey === selectedDateKey) cell.classList.add('selected');

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

    const dayEvents = events
      .filter((e) => e.date === dateKey)
      .sort((a, b) => a.time.localeCompare(b.time));

    dayEvents.forEach((ev) => {
      const chip = document.createElement('div');
      chip.className = 'event-chip';
      chip.style.backgroundColor = ev.color;
      chip.textContent = `${ev.time} ${ev.title}`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(ev);
      });
      cell.appendChild(chip);
    });

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
    agendaListEl.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);">No events scheduled. Double-click any day cell to add one.</p>`;
    return;
  }

  dayEvents.forEach((ev) => {
    const linkUrl = extractUrl(ev.notes);
    const cleanNotes = stripUrl(ev.notes);

    const card = document.createElement('div');
    card.className = 'agenda-card';
    card.style.borderLeftColor = ev.color;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="time">${ev.time}</span>
        <div class="card-actions">
          <button class="edit-btn" style="padding:0.1rem 0.4rem;font-size:0.7rem;">Edit</button>
          <button class="del-btn" style="padding:0.1rem 0.4rem;font-size:0.7rem;">Delete</button>
        </div>
      </div>
      <div style="font-weight:600;margin-top:0.25rem;">${ev.title}</div>
      ${cleanNotes ? `<div style="color:var(--muted);margin-top:0.2rem;font-size:0.78rem;">${cleanNotes}</div>` : ''}
      ${linkUrl ? `<div><a class="join-link-btn" href="${linkUrl}" target="_blank" rel="noopener noreferrer">Join Link ↗</a></div>` : ''}
    `;

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
    notes: 'Meeting links in notes become buttons! https://shahadah-studs.github.io/CalendarAuto/',
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
    lines.push('BEGIN:VEVENT', `UID:${ev.id}`, `DTSTART:${dt}`, `SUMMARY:${ev.title}`, 'END:VEVENT');
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
setInterval(checkDueEvents, 5000);
