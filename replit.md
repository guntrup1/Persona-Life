# Gamified Life OS — Persona 5 Royal Style

A full-featured gamified productivity application inspired by the visual style of Persona 5 Royal. Built with React, TypeScript, and a Persona 5-inspired black/red/white aesthetic.

## Features

- **Main Hub** — Redesigned 2-column layout: left panel (animated character + current session only + XP/level + streak), right panel (collapsible blocks: day progress, day tasks)
- **Task System** — Three task types: Routine (daily templates), Today Tasks, Goal Tasks
- **Routine Templates** — "Обновить рутину" button syncs enabled templates to today without duplication; hub also has "Синхр. рутину" shortcut
- **Goals** — Hierarchical Year → Month → Week goal system with custom XP rewards (user-defined per goal)
- **Focus Timer** — Pomodoro (25min), Deep Work (90min), Custom timer modes with XP rewards
- **Statistics** — Day/Week/Month/All-time XP charts, category breakdown, streaks
- **Trading (Трейдинг)** — Trading notes with asset (GER40/EUR/XAU/GBP), timeframe, tags (мысль/идея/ошибка), daily bias with screenshots
- **Ideas (Идеи)** — Idea bank with categories (Подарок/Хобби/Интересно изучить/Другое), links, creation dates; created via day notes with "idea" type
- **Financial News** — Forex Factory-style news calendar with impact levels (UTC+1)
- **Calendar** — Day/Week/Month views with task management
- **Day Notes** — Support two types: "note" (regular) and "idea" (goes to Ideas page); created from Hub or QuickNote button

## Technical Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui components + Tailwind CSS
- **State**: localStorage as primary cache + server sync (2.5s debounce) via MongoDB Atlas
- **Auth**: Email/password with bcryptjs + express-session + connect-mongo (30-day persistent sessions)
- **Database**: MongoDB Atlas (Mongoose) — collections: users, userdatas, sessions
- **Fonts**: Oxanium (display), Space Grotesk (body), JetBrains Mono (code)
- **Animations**: CSS animations
- **Charts**: Recharts
- **Routing**: Wouter

## Design

- Dark-only theme with Persona 5-inspired colors (black/red/white)
- Geometric shapes, sharp corners, comic-style UI
- Smooth animations and visual feedback for XP gains
- All UI in Russian language

## XP System

- **Routine XP**: 5–20 XP per task, max 50/day
- **Daily Task XP**: Low=10, Medium=25, High=50 XP
- **Goal XP**: Week=100, Month=250, Year=1000 XP
- **Focus XP**: 25min=5, 60min=15, 90min=25 XP

## State Management

State is stored in localStorage under key `lifeos_v2`. The store is a simple reactive singleton with listeners.
- **Auto-sync**: `scheduleServerSync` debounces PUT /api/user/data by 2.5s; shows "Сохранено" toast on success via `onSyncResult` listener
- **Data protection (multi-layer)**:
  - `beforeunload` + `visibilitychange` → `navigator.sendBeacon` flushes pending sync immediately
  - `visibilitychange` → `syncFromServer()` on tab focus to pull latest data
  - Merge strategy: `loadFromServerData` merges local + server arrays by ID (local priority); composite-key dedup for routine tasks (routineId+date) and biases (date+asset); XP/streak keeps higher value
  - Data loss guard: refuses merge if result would lose >50% of existing items
  - localStorage backup: every 5 minutes saves `lifeos_v2_backup`, used as fallback during merge
  - Server-side backups: last 10 versions saved in `userdatabackups` collection (10-minute cooldown)
  - Export: GET `/api/user/export` downloads full JSON backup; button in sidebar footer
  - Restore: GET `/api/user/backups` lists backups; POST `/api/user/restore/:id` restores from backup
- **Image compression**: `compressImage(dataUrl, maxWidth=800, quality=0.6)` utility compresses screenshots before storing as base64
- **Bias upsert**: `addDailyBias` upserts by date+asset (no duplicates for same day/instrument)
- **Calendar**: Day notes shown read-only with timestamps; trading note and bias screenshots displayed inline

## Architecture

- `client/src/lib/store.ts` — Main state management (localStorage), DayNote has `noteType` ("note" | "idea")
- `client/src/pages/` — All page components
- `client/src/pages/ideas.tsx` — Ideas page with filtering, sorting, editing
- `client/src/App.tsx` — Header navigation (desktop inline nav, mobile burger menu), sync button, news indicator, quick note (supports note/idea type)
- `client/src/components/app-sidebar.tsx` — Desktop sidebar navigation
- `server/routes.ts` — Minimal Express backend

## Deployment

- **Dockerfile** — Multi-stage build (builder + runner), Node 20 Alpine
- **render.yaml** — Render.com Blueprint for one-click deploy (free tier, Docker runtime)
- **DEPLOY.md** — Step-by-step deployment guide in Russian
- Required env vars: `MONGODB_URI`, `SESSION_SECRET`, `PORT`, `NODE_ENV`
- Build: `npm run build` → `dist/index.cjs` (server) + `dist/public/` (frontend)
- Start: `node dist/index.cjs`
