const fs = require('fs');

let goalsText = fs.readFileSync('client/src/pages/goals.tsx', 'utf8');

const functions = [
  'EditGoalDialog',
  'AddGoalDialog',
  'PlanSection',
  'CollapsibleTasks',
  'GoalCard',
  'ArchivedGoalCard',
  'EmptyGoals'
];

for (const fn of functions) {
  // Replace `function FnName(...) {` with `function FnName(...) { const { t } = useI18n();`
  // We need a regex that matches `function FnName` until the first `{`
  const regex = new RegExp(`(function ${fn}[^\\{]*\\{)`);
  // First, check if it already has useI18n right after
  goalsText = goalsText.replace(regex, `$1\n  const { t } = useI18n();`);
}

fs.writeFileSync('client/src/pages/goals.tsx', goalsText);
console.log("Injected useI18n in goals");
