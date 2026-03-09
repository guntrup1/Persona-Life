# Gamified Life OS — Persona 5 Royal Style

A full-featured gamified productivity application inspired by the visual style of Persona 5 Royal. Built with React, TypeScript, and a Persona 5-inspired black/red/white aesthetic.

## Features

- **Main Hub** — Redesigned 2-column layout: left panel (animated character + current session only + XP/level + streak + news alerts), right panel (4 collapsible blocks with smooth animations: week tasks, week progress, day progress, day tasks)
- **Task System** — Three task types: Routine (daily templates), Today Tasks, Goal Tasks
- **Routine Templates** — "Обновить рутину" button syncs enabled templates to today without duplication; hub also has "Синхр. рутину" shortcut
- **Goals** — Hierarchical Year → Month → Week goal system with custom XP rewards (user-defined per goal)
- **Focus Timer** — Pomodoro (25min), Deep Work (90min), Custom timer modes with XP rewards
- **Statistics** — Day/Week/Month/All-time XP charts, category breakdown, streaks
- **Trading Notes** — Quick notes with asset (GER40/EUR/XAU/GBP), timeframe, tags (мысль/идея/ошибка)
- **Financial News** — Forex Factory-style news calendar with impact levels (UTC+1)
- **Calendar** — Day/Week/Month views with task management

## Technical Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui components + Tailwind CSS
- **State**: localStorage as primary cache + server sync (2.5s debounce) via PostgreSQL
- **Auth**: Email/password with bcryptjs + express-session + connect-pg-simple (30-day persistent sessions)
- **Database**: PostgreSQL — tables: users, user_data (JSONB), session
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

State is stored in localStorage under key `lifeos_v1`. The store is a simple reactive singleton with listeners.

## Architecture

- `client/src/lib/store.ts` — Main state management (localStorage)
- `client/src/pages/` — All page components
- `client/src/components/app-sidebar.tsx` — Sidebar navigation
- `server/routes.ts` — Minimal Express backend (not used in MVP)
