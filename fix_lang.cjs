const fs = require('fs');

let hub = fs.readFileSync('client/src/pages/hub.tsx', 'utf8');
if (!hub.includes('const { lang } = useI18n()') && hub.includes('function CurrentTimeBlock() {')) {
    hub = hub.replace('function CurrentTimeBlock() {', 'function CurrentTimeBlock() {\n  const { lang } = useI18n();');
}
fs.writeFileSync('client/src/pages/hub.tsx', hub);

let news = fs.readFileSync('client/src/pages/news.tsx', 'utf8');
if (news.includes('export function getFormattedDate(d: Date) {')) {
    news = news.replace('export function getFormattedDate(d: Date) {', 'export function getFormattedDate(d: Date, lang: string) {');
    // Inside news.tsx, the component calls getFormattedDate. We need to pass `lang` to it.
    news = news.replace(/getFormattedDate\(new Date\(date\)\)/g, 'getFormattedDate(new Date(date), lang)');
    news = news.replace(/getFormattedDate\(new Date\(e\.dateNormalized\)\)/g, 'getFormattedDate(new Date(e.dateNormalized), lang)');
}
fs.writeFileSync('client/src/pages/news.tsx', news);

let notes = fs.readFileSync('client/src/pages/notes.tsx', 'utf8');
if (!notes.includes('lang') && notes.includes('function TradingNotesContent')) {
   // Wait, maybe we just destructure lang where t is destructured.
   notes = notes.replace(/const { t } = useI18n\(\);/g, 'const { t, lang } = useI18n();');
}
fs.writeFileSync('client/src/pages/notes.tsx', notes);

console.log('Fixed lang');
