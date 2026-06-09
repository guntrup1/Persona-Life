const fs = require('fs');

function fixFile(file, replacements) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [find, replace] of replacements) {
    text = text.split(find).join(replace);
  }
  fs.writeFileSync(file, text);
}

// timer.tsx fix
fixFile('client/src/pages/timer.tsx', [
  ['const MODES: { key: TimerMode; label: string; duration: number; xp: number; color: string }[] = [', 'const getModes = (t: any): { key: TimerMode; label: string; duration: number; xp: number; color: string }[] => ['],
  ['  { key: "custom", label: t.timer.customTimer, duration: 60, xp: 15, color: "text-purple-400" },\n];', '  { key: "custom", label: t.timer.customTimer, duration: 60, xp: 15, color: "text-purple-400" },\n];'],
  ['const mode = MODES.find', 'const mode = getModes(t).find'],
  ['MODES.map', 'getModes(t).map']
]);

// notes.tsx fix
fixFile('client/src/pages/notes.tsx', [
  ['const TAGS: { value: NoteTag; label: string; color: string }[] = [', 'const getTags = (t: any): { value: NoteTag; label: string; color: string }[] => ['],
  ['  { value: "ошибка", label: "Ошибка", color: "text-red-400 border-red-500/30" },\n];', '  { value: "ошибка", label: "Ошибка", color: "text-red-400 border-red-500/30" },\n];'],
  ['TAGS.map', 'getTags(t).map'],
  ['const tagInfo = (tag: NoteTag) => TAGS.find', 'const tagInfo = (tag: NoteTag) => getTags(t).find']
]);

// goals.tsx fix (adding useI18n to EmptyGoals if missing)
let goalsText = fs.readFileSync('client/src/pages/goals.tsx', 'utf8');
if (!goalsText.includes('const { t } = useI18n();') && goalsText.includes('function EmptyGoals')) {
    // wait I'll just use regex replacement for ALL functions that start with capital letter in pages
    // actually, I'll just insert useI18n() in EmptyGoals manually via string replace
}

goalsText = goalsText.replace('function EmptyGoals({ type, onAdd }: { type: GoalType, onAdd: (g: any) => void }) {', 'function EmptyGoals({ type, onAdd }: { type: GoalType, onAdd: (g: any) => void }) {\n  const { t } = useI18n();');

goalsText = goalsText.replace('function EditGoalDialog({ goal, onUpdate }: { goal: Goal; onUpdate: (id: string, g: any) => void }) {\n  const [open, setOpen] = useState(false);', 'function EditGoalDialog({ goal, onUpdate }: { goal: Goal; onUpdate: (id: string, g: any) => void }) {\n  const { t } = useI18n();\n  const [open, setOpen] = useState(false);');

goalsText = goalsText.replace('function GoalCard({ goal, goals, onToggle, onDelete, onAdd, onUpdate, setGoalTaskWeight, state }: {\n  goal: Goal;', 'function GoalCard({ goal, goals, onToggle, onDelete, onAdd, onUpdate, setGoalTaskWeight, state }: {\n  goal: Goal;\n  goals: Goal[];\n  onToggle: (id: string) => void;\n  onDelete: (id: string) => void;\n  onAdd: (g: any) => void;\n  onUpdate: (id: string, g: any) => void;\n  setGoalTaskWeight?: (goalId: string, taskId: string, weight: number) => void;\n  state: any;\n}) {\n  const { t } = useI18n();');

// For GoalCard we need to be careful with its exact signature, let's just do a generic replace
// function GoalCard(...
goalsText = goalsText.replace(/(function GoalCard[^\{]+\{)/, '$1\n  const { t } = useI18n();');
goalsText = goalsText.replace(/(function ArchivedGoalCard[^\{]+\{)/, '$1\n  const { t } = useI18n();');
goalsText = goalsText.replace(/(function PlanSection[^\{]+\{)/, '$1\n  const { t } = useI18n();');
goalsText = goalsText.replace(/(function CollapsibleTasks[^\{]+\{)/, '$1\n  const { t } = useI18n();');

// Just remove all current `const { t } = useI18n();` then add them perfectly to ensure no duplicates
goalsText = goalsText.replace(/\s*const \{ t \} = useI18n\(\);/g, '');

const funcRegex = /function\s+([A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g;
goalsText = goalsText.replace(funcRegex, (match) => match + '\n  const { t } = useI18n();');
goalsText = goalsText.replace(/export default function GoalsPage\(\) \{\n  const \{ t \} = useI18n\(\);/, 'export default function GoalsPage() {\n  const { t } = useI18n();');


fs.writeFileSync('client/src/pages/goals.tsx', goalsText);
console.log("Fixed all missing t");
