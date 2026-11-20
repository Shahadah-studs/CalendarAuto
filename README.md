# CalendarAuto

**CalendarAuto** is a browser-based monthly calendar and personal planning application built with vanilla TypeScript, HTML, and CSS. It supports local event storage, daily mood check-ins, in-app due-time alerts, custom alert sounds, light/dark themes, meeting URL extraction, and `.ics` calendar export.

**Live demo:** [https://shahadah-studs.github.io/CalendarAuto/](https://shahadah-studs.github.io/CalendarAuto/)

> [!NOTE]
> The product name is also spelled `CalenderAuto` in the current UI and source code. The repository name is `CalendarAuto`.

## Features

### Calendar management

- Navigate between months with previous, next, and today controls.
- Select a date to view its daily agenda.
- Double-click a day to create an event for that date.
- Create, edit, and delete events through a modal form.
- View time-sorted event chips directly on calendar days.
- Assign each event one of four color categories:
  - Focus — Indigo
  - Personal — Emerald
  - Meeting — Amber
  - Urgent — Rose

### Local storage

CalendarAuto does not use a backend or require account setup. Events, moods, theme, and sound preferences are stored in the browser with `localStorage` under the following keys:

- `calenderauto_events_v1`
- `calenderauto_moods_v1`
- `calenderauto_theme_v1`
- `calenderauto_sound_v1`

Data remains on the same browser and origin. Clearing browser site data will remove it.

### Alerts

- Events are checked every five seconds.
- A due event produces an in-app toast after its scheduled date and time.
- Each event is notified once; editing or rescheduling resets its notification state.
- The browser tab title flashes while an alert is active.
- Choose among Gentle Bell, Retro Chime, Digital Pulse, or Silent sounds.
- Use **Test Alert** to preview the notification experience.

### Notes and meeting links

An event note containing an `http://` or `https://` URL is parsed automatically. The URL is removed from the displayed note and rendered as a **Join Link** button in both the agenda and alert toast.

### Mood check-ins

Record a daily mood or energy level for each selected date:

- ⚡ High Energy
- 😊 Good
- 😐 Neutral
- 😴 Low Energy

The chosen mood appears on its calendar date and generates a contextual encouragement card in the sidebar.

### Appearance

- Responsive month-grid layout with a sidebar agenda.
- Persistent light and dark themes.
- Today and selected-date highlighting.
- Accessible modal controls and labeled navigation buttons.

### Calendar export

Use **Export (.ics)** to download all saved events as `calender-auto.ics`. The export is generated in the browser and can be opened in compatible calendar applications.

## Tech stack

- **TypeScript** — application logic and browser interactions
- **HTML** — application structure and event modal
- **CSS** — responsive layout, themes, and component styling
- **Web Audio API** — generated alert chimes
- **localStorage** — persistent browser-side data
- **iCalendar** — client-side `.ics` export
- **GitHub Pages** — static deployment
- **GitHub Actions** — automated build and deployment

## Project structure

```text
CalendarAuto/
├── .github/workflows/
│   └── deploy.yml       # GitHub Pages deployment workflow
├── public/
│   ├── index.html       # Application markup
│   └── styles.css       # Layout, theme, and component styles
├── scripts/
│   └── build.sh         # Creates dist and copies public assets
├── src/
│   └── app.ts           # Calendar, event, mood, alert, and export logic
├── package.json         # npm scripts and TypeScript dependency
└── tsconfig.json        # Strict TypeScript compiler configuration
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm
- A modern browser with support for:
  - `<dialog>` elements
  - ES2022
  - `localStorage`
  - the Web Audio API

### Installation

```bash
git clone https://github.com/Shahadah-studs/CalendarAuto.git
cd CalendarAuto
npm install
```

### Build

```bash
npm run build
```

The build script removes any existing `dist` directory, compiles `src/app.ts` with TypeScript, and copies the contents of `public/` into `dist/`.

### Run locally

A simple static server is required when loading ES modules. For example:

```bash
npx serve dist
```

Then open the URL printed by the server, normally `http://localhost:3000`.

## Using the application

1. Open the calendar.
2. Select a date to display its agenda.
3. Double-click the date or choose **New Event** to add an event.
4. Enter a title, date, time, category, and optional notes.
5. Save the event.
6. Select a mood emoji to record a daily check-in.
7. Choose an alert sound or enable silent mode.
8. Toggle **Dark Mode** or **Light Mode** as preferred.
9. Use **Export (.ics)** to download the saved event list.

To edit or remove an event, select it on the calendar or use the **Edit** and **Delete** controls in the agenda.

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

When changes are pushed to `main`, or the workflow is started manually, GitHub Actions:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Runs `npm install`.
4. Executes `bash scripts/build.sh`.
5. Uploads `dist/` as a Pages artifact.
6. Deploys the artifact to GitHub Pages.

A Pages deployment requires GitHub Pages to be enabled for the repository and the workflow permissions configured to allow Pages deployment.

## Browser storage and privacy

CalendarAuto is entirely client-side:

- Events and preferences are not sent to a server.
- There is no remote database or account system.
- Data is scoped to the browser and origin.
- Syncing between devices is not available.
- Exporting to `.ics` is the supported way to move event data to a calendar application.

## Known limitations

- Event times are stored in local time and the current implementation uses in-browser alert checks rather than system notifications.
- Data is not synced across tabs or devices.
- Data can be lost if browser site data is cleared.
- The `.ics` exporter includes event identifiers, start times, and summaries, but does not yet export notes or timezone metadata.
- Due notifications are only checked while the page is open.

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a focused feature branch.
3. Make your changes and build locally.
4. Open a pull request with a clear description and testing steps.

```bash
npm run build
```

Please keep changes scoped and ensure that new browser APIs have appropriate fallbacks or are supported by modern browsers.

## License

No license has been specified for this repository. Unless a license is added, standard copyright rules apply and third-party reuse may require permission from the repository owner.
