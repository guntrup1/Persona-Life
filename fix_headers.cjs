const fs = require('fs');

function replaceStr(file, findStr, replaceStr) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(findStr, replaceStr);
    fs.writeFileSync(file, content);
}

replaceStr('client/src/pages/tasks.tsx', 'Задачи\r\n          </h1>', '{t.nav.tasks.toUpperCase()}\r\n          </h1>');
replaceStr('client/src/pages/tasks.tsx', 'Задачи\n          </h1>', '{t.nav.tasks.toUpperCase()}\n          </h1>');

replaceStr('client/src/pages/goals.tsx', 'Цели\r\n          </h1>', '{t.nav.goals.toUpperCase()}\r\n          </h1>');
replaceStr('client/src/pages/goals.tsx', 'Цели\n          </h1>', '{t.nav.goals.toUpperCase()}\n          </h1>');

replaceStr('client/src/pages/timer.tsx', 'Фокус таймер\r\n        </h1>', '{t.nav.focus.toUpperCase()}\r\n        </h1>');
replaceStr('client/src/pages/timer.tsx', 'Фокус таймер\n        </h1>', '{t.nav.focus.toUpperCase()}\n        </h1>');

replaceStr('client/src/pages/stats.tsx', 'Статистика\r\n          </h1>', '{t.nav.stats.toUpperCase()}\r\n          </h1>');
replaceStr('client/src/pages/stats.tsx', 'Статистика\n          </h1>', '{t.nav.stats.toUpperCase()}\n          </h1>');

replaceStr('client/src/pages/notes.tsx', 'Дневной BIAS', '{t.notes.dailyBias.toUpperCase()}');
replaceStr('client/src/pages/notes.tsx', 'Торговые заметки', '{t.notes.tradingNotes.toUpperCase()}');

replaceStr('client/src/pages/forgot-password.tsx', 'Забыл пароль', '{t.authPages?.resetTitle?.toUpperCase() || t.authPages.resetTitle.toUpperCase()}');
replaceStr('client/src/pages/reset-password.tsx', 'Новый пароль', '{t.authPages?.newPassword?.toUpperCase() || "НОВЫЙ ПАРОЛЬ"}');

// Quick store migration for trading sessions
// We will insert a hook inside `useStore` creation in client/src/lib/store.ts
// But `store.ts` handles initialization. We can update it right before `return { ...actions }`

let storeContent = fs.readFileSync('client/src/lib/store.ts', 'utf8');
const migrationLogic = \`
  // Migration for old Russian session names in localStorage
  set((state) => {
    if (state.settings.tradingSessions && state.settings.tradingSessions.some(s => ["Азия", "Лондон", "Франкфурт", "Нью-Йорк"].includes(s.name))) {
      return {
        settings: {
          ...state.settings,
          tradingSessions: state.settings.tradingSessions.map(s => {
            if (s.name === "Азия") return { ...s, name: "Asia" };
            if (s.name === "Франкфурт") return { ...s, name: "Frankfurt" };
            if (s.name === "Лондон") return { ...s, name: "London" };
            if (s.name === "Нью-Йорк") return { ...s, name: "New York" };
            return s;
          })
        }
      };
    }
    return state;
  });
\`;

if (!storeContent.includes('Migration for old Russian')) {
    storeContent = storeContent.replace('export const useStore = create<AppState>()(', 'export const useStore = create<AppState>()(');
    // Since Zustand init runs once, we can just patch `loadUserSettings`
    if (storeContent.includes('function loadUserSettings(): UserSettings {')) {
        let replacement = \`function loadUserSettings(): UserSettings {
  const str = localStorage.getItem("lifeos_settings");
  if (!str) return defaultSettings;
  try {
    const parsed = JSON.parse(str);
    // Migration:
    if (parsed.tradingSessions && parsed.tradingSessions.some(s => ["Азия", "Лондон", "Франкфурт", "Нью-Йорк"].includes(s.name))) {
      parsed.tradingSessions = parsed.tradingSessions.map(s => {
        if (s.name === "Азия") return { ...s, name: "Asia" };
        if (s.name === "Франкфурт") return { ...s, name: "Frankfurt" };
        if (s.name === "Лондон") return { ...s, name: "London" };
        if (s.name === "Нью-Йорк") return { ...s, name: "New York" };
        return s;
      });
      localStorage.setItem("lifeos_settings", JSON.stringify(parsed));
    }
    return { ...defaultSettings, ...parsed };
\`;
        storeContent = storeContent.replace(\`function loadUserSettings(): UserSettings {
  const str = localStorage.getItem("lifeos_settings");
  if (!str) return defaultSettings;
  try {
    const parsed = JSON.parse(str);
    return { ...defaultSettings, ...parsed };\`, replacement);
    }
    fs.writeFileSync('client/src/lib/store.ts', storeContent);
}

console.log('Fixed headers and store migration');
