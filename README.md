# ShiftSync

A single-day, drag-and-drop staff scheduler with live coverage analytics. Built as a static single-page app with React, Vite, and Tailwind CSS.

## Features

- **Interactive timeline** covering 5 a.m. to 10 p.m. — drag shift blocks to change start times, resize from the right edge, and drag the striped meal segment to reposition lunch breaks. Drop a shift onto another row to swap allocations.
- **Coverage analytics** — compare scheduled associate-hours against hourly staffing targets, with a live chart and per-hour deficit/warning indicators.
- **Schedule metrics** — staffing adequacy score, total scheduled hours, and estimated labor cost at a glance.
- **Templates** — save and reload complete rosters (shifts + targets).
- **Bulk actions** — select multiple shifts to duplicate or delete them at once.
- **Dark mode** and responsive layout.

All data (shifts, targets, templates) persists in your browser's localStorage — there is no backend and nothing leaves your machine.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later (with npm)

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (http://localhost:5173 by default).

## Scripts

| Command           | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Start the Vite dev server with hot reload        |
| `npm run build`   | Type-check-free production build into `dist/`    |
| `npm run preview` | Serve the production build locally               |
| `npm run lint`    | Type-check the project (`tsc --noEmit`)          |
| `npm run clean`   | Remove the `dist/` folder                        |

## Deployment

`npm run build` produces a fully static site in `dist/` that can be hosted on any static host (Cloudflare Pages, Netlify, Firebase Hosting, GitHub Pages, etc.).
