const fs = require('fs');

function repl(path, find, replace) {
  let text = fs.readFileSync(path, 'utf8');
  text = text.split(find).join(replace);
  fs.writeFileSync(path, text);
}

repl('client/src/pages/goals.tsx', '>Цели', '>{t.nav.goals.toUpperCase()}');
repl('client/src/pages/timer.tsx', '>\\r\\n          Фокус таймер', '>\\r\\n          {t.nav.focus.toUpperCase()}');
repl('client/src/pages/timer.tsx', '>\\n          Фокус таймер', '>\\n          {t.nav.focus.toUpperCase()}');
repl('client/src/pages/stats.tsx', '>\\r\\n            Статистика', '>\\r\\n            {t.nav.stats.toUpperCase()}');
repl('client/src/pages/stats.tsx', '>\\n            Статистика', '>\\n            {t.nav.stats.toUpperCase()}');

repl('client/src/pages/notes.tsx', '>Дневной BIAS', '>{t.notes.dailyBias.toUpperCase()}');
repl('client/src/pages/notes.tsx', '>\\r\\n              Дневной BIAS', '>\\r\\n              {t.notes.dailyBias.toUpperCase()}');
repl('client/src/pages/notes.tsx', '>\\n              Дневной BIAS', '>\\n              {t.notes.dailyBias.toUpperCase()}');
repl('client/src/pages/notes.tsx', 'Торговые заметки', '{t.notes.tradingNotes.toUpperCase()}');

repl('client/src/pages/forgot-password.tsx', 'Забыл пароль', '{t.authPages?.forgotTitle?.toUpperCase() || "ЗАБЫЛ ПАРОЛЬ"}');
repl('client/src/pages/reset-password.tsx', 'Новый пароль', '{t.authPages?.newPassword?.toUpperCase() || "НОВЫЙ ПАРОЛЬ"}');

// Store migration fix
let store = fs.readFileSync('client/src/lib/store.ts', 'utf8');

const target1 = \`function loadUserSettings(): UserSettings {\`;
const repl1 = \`function loadUserSettings(): UserSettings {
  const str = localStorage.getItem("lifeos_settings");
  if (str) {
    try {
      const parsed = JSON.parse(str);
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
    } catch {}
  }\`;

if (!store.includes('["Азия", "Лондон"')) {
    store = store.replace(target1, repl1);
    fs.writeFileSync('client/src/lib/store.ts', store);
}

console.log('Done');
