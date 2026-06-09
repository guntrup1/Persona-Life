const fs = require('fs');
const glob = require('fs').readdirSync;
const path = require('path');

const pagesDir = 'client/src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const fullPath = path.join(pagesDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes('"ru-RU"')) {
        // Ensure lang is destructured if t is destructured
        if (content.includes('const { t } = useI18n();')) {
            content = content.replace('const { t } = useI18n();', 'const { t, lang } = useI18n();');
        } else if (!content.includes('lang') && content.includes('useI18n')) {
             // fallback for others
        }
        
        const localeStr = "lang === 'ru' ? 'ru-RU' : 'en-US'";
        content = content.split('"ru-RU"').join(localeStr);
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + file);
    }
}
