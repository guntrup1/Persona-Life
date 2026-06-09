const fs = require('fs');

function addI18nToFunctions(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const functionRegex = /(function\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{)/g;
  let newContent = content;

  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const startIdx = match.index;
    const bodyStart = startIdx + match[0].length;
    
    // Find the end of this function body to see if it uses 't.' and doesn't have 'const { t } = useI18n();'
    let braceCount = 1;
    let endIdx = bodyStart;
    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') braceCount++;
      if (content[endIdx] === '}') braceCount--;
      endIdx++;
    }

    const body = content.substring(bodyStart, endIdx);
    if (body.includes('t.') && !body.includes('useI18n()')) {
      const insertion = '\n  const { t } = useI18n();';
      newContent = newContent.slice(0, bodyStart) + insertion + newContent.slice(bodyStart);
    }
  }

  fs.writeFileSync(filePath, newContent);
}

addI18nToFunctions('client/src/pages/goals.tsx');
addI18nToFunctions('client/src/pages/notes.tsx');
addI18nToFunctions('client/src/pages/timer.tsx');
addI18nToFunctions('client/src/pages/ideas.tsx');
addI18nToFunctions('client/src/pages/calendar-page.tsx');

console.log("Added useI18n");
