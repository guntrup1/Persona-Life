const fs = require('fs');

let code = fs.readFileSync('client/src/pages/news.tsx', 'utf8');

code = code.replace(
    'function formatFullDate(dateStr: string): { weekday: string; full: string } {',
    'function formatFullDate(dateStr: string, lang: string): { weekday: string; full: string } {'
);

code = code.replace(
    'd.toLocaleDateString("ru-RU", { weekday: "long" })',
    'd.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { weekday: "long" })'
);
code = code.replace(
    'd.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })',
    'd.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "long", year: "numeric" })'
);

code = code.replace(
    'berlinTime.toLocaleTimeString("ru-RU"',
    'berlinTime.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US"'
);

code = code.replace(
    'const nextDate = formatFullDate(nextStr);',
    'const nextDate = formatFullDate(nextStr, lang);'
);

fs.writeFileSync('client/src/pages/news.tsx', code);
console.log('Fixed news.tsx safely!');
