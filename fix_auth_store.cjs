const fs = require('fs');

let f1 = fs.readFileSync('client/src/pages/forgot-password.tsx', 'utf8');
f1 = f1.replace('Забыл пароль', '{t.authPages?.resetTitle?.toUpperCase() || "СБРОС ПАРОЛЯ"}');
f1 = f1.replace('Если аккаунт с таким email существует — письмо отправлено. Проверь почту.', '{t.authPages?.emailSent || "Если аккаунт с таким email существует — письмо отправлено."}');
fs.writeFileSync('client/src/pages/forgot-password.tsx', f1);

let f2 = fs.readFileSync('client/src/pages/reset-password.tsx', 'utf8');
f2 = f2.replace('Новый пароль', '{t.authPages?.newPassword?.toUpperCase() || "НОВЫЙ ПАРОЛЬ"}');
fs.writeFileSync('client/src/pages/reset-password.tsx', f2);

let store = fs.readFileSync('client/src/lib/store.ts', 'utf8');
if (!store.includes('["Азия"')) {
    store = store.replace('export const useStore = create<AppState>()(',
\`// Migration inside loadUserSettings
function migrateSessions(sessions) {
  if (!sessions) return sessions;
  let changed = false;
  const migrated = sessions.map(s => {
    if (s.name === "Азия") { changed = true; return { ...s, name: "Asia" }; }
    if (s.name === "Франкфурт") { changed = true; return { ...s, name: "Frankfurt" }; }
    if (s.name === "Лондон") { changed = true; return { ...s, name: "London" }; }
    if (s.name === "Нью-Йорк") { changed = true; return { ...s, name: "New York" }; }
    return s;
  });
  return { migrated, changed };
}

export const useStore = create<AppState>()(\`);
    
    let loadSettingsStr = 'const parsed = JSON.parse(str);';
    let replaceSettingsStr = \`const parsed = JSON.parse(str);
    const { migrated, changed } = migrateSessions(parsed.tradingSessions);
    if (changed) {
      parsed.tradingSessions = migrated;
      localStorage.setItem("lifeos_settings", JSON.stringify(parsed));
    }\`;
    
    store = store.replace(loadSettingsStr, replaceSettingsStr);
    fs.writeFileSync('client/src/lib/store.ts', store);
}

console.log('Fixed');
