interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  color: string;
  notes: string;
}

const STORAGE_KEY = 'calenderauto_events_v1';
let viewDate = new Date();
let selectedDateKey = toDateKey(new Date());
let events: CalendarEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const gridEl = document.getElementById('calendarGrid') as HTMLDivElement;
const monthLabelEl = document.getElementById('monthLabel') as HTMLHeadingElement;
const agendaListEl = document.getElementById('dailyAgendaList') as HTMLDivElement;
const selectedDateLabelEl = document.getElementById('selectedDateLabel') as HTMLHeadingElement;
const modal = document.getElementById('eventModal') as HTMLDialogElement;
const form = document.getElementById('eventForm') as HTMLFormElement;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function saveEvents(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function renderAll(): void {
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
    cell.innerHTML = `<div class="day-number">${prevMonthDays - i}</div>`;
    gridEl.appendChild(cell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (dateKey === todayKey) cell.classList.add('today');
    if (dateKey === selectedDateKey) cell.classList.add('selected');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = String(day);
    cell.appendChild(num);

    const dayEvents = events
      .filter((e) => e.date === dateKey)
      .sort((a, b) => a.time.localeCompare(b.time));

    dayEvents.forEach((ev) => {
      const chip = document.createElement('div');
      chip.className = 'event-chip';
      chip.style.backgroundColor = ev.color;
      chip.textContent = `${ev.time} ${ev.title}`;
      cell.appendChild(chip);
    });

    cell.addEventListener('click', () => {
      selectedDateKey = dateKey;
      renderAll();
    });

    cell.addEventListener('dblclick', () => {
      openModal(dateKey);
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
    agendaListEl.innerHTML = `<p style="font-size:0.82rem;color:#64748b;">No events scheduled. Double-click any day cell to add one.</p>`;
    return;
  }

  dayEvents.forEach((ev) => {
    const card = document.createElement('div');
    card.className = 'agenda-card';
    card.style.borderLeftColor = ev.color;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="time">${ev.time}</span>
        <button data-id="${ev.id}" style="padding:0.1rem 0.4rem;font-size:0.7rem;">Delete</button>
      </div>
      <div style="font-weight:600;margin-top:0.2rem;">${ev.title}</div>
      ${ev.notes ? `<div style="color:#64748b;margin-top:0.2rem;font-size:0.78rem;">${ev.notes}</div>` : ''}
    `;

    card.querySelector('button')?.addEventListener('click', () => {
      events = events.filter((item) => item.id !== ev.id);
      saveEvents();
      renderAll();
    });

    agendaListEl.appendChild(card);
  });
}

function openModal(dateKey: string): void {
  (document.getElementById('eventDate') as HTMLInputElement).value = dateKey;
  (document.getElementById('eventTitle') as HTMLInputElement).value = '';
  (document.getElementById('eventNotes') as HTMLTextAreaElement).value = '';
  modal.showModal();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = (document.getElementById('eventTitle') as HTMLInputElement).value.trim();
  const date = (document.getElementById('eventDate') as HTMLInputElement).value;
  const time = (document.getElementById('eventTime') as HTMLInputElement).value;
  const color = (document.getElementById('eventColor') as HTMLSelectElement).value;
  const notes = (document.getElementById('eventNotes') as HTMLTextAreaElement).value.trim();

  if (!title || !date) return;

  events.push({
    id: crypto.randomUUID(),
    date,
    time,
    title,
    color,
    notes,
  });

  selectedDateKey = date;
  saveEvents();
  modal.close();
  renderAll();
});

document.getElementById('newEventBtn')?.addEventListener('click', () => openModal(selectedDateKey));
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
