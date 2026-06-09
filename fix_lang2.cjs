const fs = require('fs');

// Fix news.tsx
let news = fs.readFileSync('client/src/pages/news.tsx', 'utf8');
if (news.includes('function formatFullDate(dateStr: string)')) {
    news = news.replace('function formatFullDate(dateStr: string)', 'function formatFullDate(dateStr: string, lang: string)');
    news = news.replace(/formatFullDate\(nextStr\)/g, 'formatFullDate(nextStr, lang)');
    fs.writeFileSync('client/src/pages/news.tsx', news);
    console.log('Fixed news.tsx');
}

// Fix notes.tsx
let notes = fs.readFileSync('client/src/pages/notes.tsx', 'utf8');
// notes.tsx line 620 is probably inside TradingNotesContent or similar.
// It seems `const { t } = useI18n();` might be there, let's just make sure `lang` is destructured everywhere.
notes = notes.replace(/const \{ t \} = useI18n\(\);/g, 'const { t, lang } = useI18n();');
notes = notes.replace(/const \{\s*t\s*,\s*lang\s*\} = useI18n\(\);/g, 'const { t, lang } = useI18n();'); // avoid duplicate
fs.writeFileSync('client/src/pages/notes.tsx', notes);
console.log('Fixed notes.tsx');
