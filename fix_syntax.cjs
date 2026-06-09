const fs = require('fs');

function fix(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [find, replace] of replacements) {
    content = content.split(find).join(replace);
  }
  fs.writeFileSync(filePath, content);
}

fix('client/src/pages/calendar-page.tsx', [
  ['placeholder=t.calendar.taskNamePlaceholder', 'placeholder={t.calendar.taskNamePlaceholder}'],
  ['placeholder=t.calendar.taskDescPlaceholder', 'placeholder={t.calendar.taskDescPlaceholder}'],
  ['placeholder=t.calendar.selectGoal', 'placeholder={t.calendar.selectGoal}']
]);

fix('client/src/pages/forgot-password.tsx', [
  ['placeholder=t.authPages.emailPlaceholder', 'placeholder={t.authPages.emailPlaceholder}']
]);

fix('client/src/pages/reset-password.tsx', [
  ['placeholder=t.authPages.newPassPlaceholder', 'placeholder={t.authPages.newPassPlaceholder}'],
  ['placeholder=t.authPages.confirmPassPlaceholder', 'placeholder={t.authPages.confirmPassPlaceholder}']
]);

fix('client/src/pages/verify-email.tsx', [
  ['placeholder=t.authPages.yourEmail', 'placeholder={t.authPages.yourEmail}']
]);

fix('client/src/pages/tasks.tsx', [
  ['placeholder=t.tasks.placeholderName', 'placeholder={t.tasks.placeholderName}'],
  ['placeholder=t.tasks.placeholderDesc', 'placeholder={t.tasks.placeholderDesc}']
]);

fix('client/src/pages/goals.tsx', [
  ['placeholder=t.goals.placeholderName', 'placeholder={t.goals.placeholderName}'],
  ['placeholder=t.goals.placeholderDesc', 'placeholder={t.goals.placeholderDesc}'],
  ['placeholder=t.goals.placeholderReason', 'placeholder={t.goals.placeholderReason}']
]);

fix('client/src/pages/ideas.tsx', [
  ['placeholder=t.ideas.placeholderName', 'placeholder={t.ideas.placeholderName}'],
  ['placeholder=t.ideas.placeholderDesc', 'placeholder={t.ideas.placeholderDesc}'],
  ['placeholder=t.ideas.placeholderSearch', 'placeholder={t.ideas.placeholderSearch}']
]);

fix('client/src/pages/notes.tsx', [
  ['placeholder=t.notes.placeholderAsset', 'placeholder={t.notes.placeholderAsset}'],
  ['placeholder=t.notes.placeholderNote', 'placeholder={t.notes.placeholderNote}'],
  ['placeholder=t.notes.placeholderSearch', 'placeholder={t.notes.placeholderSearch}'],
  ['placeholder=t.notes.placeholderIdeaName', 'placeholder={t.notes.placeholderIdeaName}'],
  ['placeholder=t.notes.placeholderIdeaDesc', 'placeholder={t.notes.placeholderIdeaDesc}']
]);

console.log("Fixed!");
