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

let store = fs.readFileSync('client/src/lib/store.ts', 'utf8');

const target1 = 'function loadUserSettings(): UserSettings {';
const repl1 = 'function loadUserSettings(): UserSettings {\\n  const str = localStorage.getItem("lifeos_settings");\\n  if (str) {\\n    try {\\n      const parsed = JSON.parse(str);\\n      if (parsed.tradingSessions && parsed.tradingSessions.some(s => ["Азия", "Лондон", "Франкфурт", "Нью-Йорк"].includes(s.name))) {\\n        parsed.tradingSessions = parsed.tradingSessions.map(s => {\\n          if (s.name === "Азия") return { ...s, name: "Asia" };\\n          if (s.name === "Франкфурт") return { ...s, name: "Frankfurt" };\\n          if (s.name === "Лондон") return { ...s, name: "London" };\\n          if (s.name === "Нью-Йорк") return { ...s, name: "New York" };\\n          return s;\\n        });\\n        localStorage.setItem("lifeos_settings", JSON.stringify(parsed));\\n      }\\n    } catch {}\\n  }';

if (!store.includes('["Азия", "Лондон"')) {
    store = store.replace(target1, repl1);
    fs.writeFileSync('client/src/lib/store.ts', store);
}

console.log('Done');
