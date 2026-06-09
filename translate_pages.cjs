const fs = require('fs');

function translateStats() {
  const path = 'client/src/pages/stats.tsx';
  let c = fs.readFileSync(path, 'utf8');

  if (!c.includes('useI18n')) {
    c = c.replace('import { useState } from "react";', 'import { useState } from "react";\nimport { useI18n } from "@/lib/i18n";');
  }

  c = c.replace(/const \{ state \} = useStore\(\);/, 'const { state } = useStore();\n  const { t } = useI18n();');

  c = c.replace(/>Статистика</g, '>{t.stats.title}<');
  c = c.replace(/p === "day" \? "День" : p === "week" \? "Неделя" : p === "month" \? "Месяц" : "Всё время"/g, 'p === "day" ? t.stats.day : p === "week" ? t.stats.week : p === "month" ? t.stats.month : t.stats.allTime');
  c = c.replace(/>Total XP</g, '>{t.stats.totalXp}<');
  c = c.replace(/>Задач выполнено</g, '>{t.stats.tasksCompleted}<');
  c = c.replace(/>Стрик \(дней\)</g, '>{t.stats.streakDays}<');
  c = c.replace(/>Минут фокуса</g, '>{t.stats.focusMinutes}<');
  
  c = c.replace(/Уровень \{level\}/g, '{t.stats.level.replace("{level}", level.toString())}');
  c = c.replace(/>Рутина XP</g, '>{t.stats.routineXp}<');
  c = c.replace(/>Задачи XP</g, '>{t.stats.taskXp}<');
  c = c.replace(/>Цели XP</g, '>{t.stats.goalXp}<');
  
  c = c.replace(/>Рекорд стрика</g, '>{t.stats.longestStreak}<');
  c = c.replace(/\{completionRate\}% выполнено/g, '{t.stats.completionRate.replace("{rate}", completionRate.toString())}');
  
  c = c.replace(/>XP по дням</g, '>{t.stats.xpByDay}<');
  c = c.replace(/>XP по сферам жизни</g, '>{t.stats.xpByArea}<');
  c = c.replace(/>Выполненные цели</g, '>{t.stats.completedGoals}<');
  c = c.replace(/"Год" : goal\.type === "month" \? "Месяц" : "Неделя"/g, 't.stats.goalYear : goal.type === "month" ? t.stats.goalMonth : t.stats.goalWeek');

  fs.writeFileSync(path, c);
}

function translateNews() {
  const path = 'client/src/pages/news.tsx';
  let c = fs.readFileSync(path, 'utf8');

  if (!c.includes('useI18n')) {
    c = c.replace('import { useToast } from "@/hooks/use-toast";', 'import { useToast } from "@/hooks/use-toast";\nimport { useI18n } from "@/lib/i18n";');
  }

  c = c.replace(/const \{ toast \} = useToast\(\);/, 'const { toast } = useToast();\n  const { t } = useI18n();');

  c = c.replace(/"Обновлено"/g, 't.news.refreshed');
  c = c.replace(/"Данные загружены с Forex Factory"/g, 't.news.refreshedDesc');
  c = c.replace(/"Ошибка"/g, 't.news.error');
  c = c.replace(/"Не удалось загрузить данные"/g, 't.news.errorDesc');
  
  c = c.replace(/>Обновить</g, '>{t.news.refresh}<');
  
  c = c.replace(/\{todayItems\.length\} важных событий сегодня/g, '{t.news.importantEvents.replace("{count}", todayItems.length.toString())}');
  c = c.replace(/>Высокая волатильность по EUR\/USD</g, '>{t.news.volatility}<');
  
  c = c.replace(/>Сегодня</g, '>{t.news.today}<');
  c = c.replace(/>Ближайший день</g, '>{t.news.nextDay}<');
  
  c = c.replace(/>Важных новостей по EUR\/USD сегодня нет</g, '>{t.news.noNewsToday}<');
  c = c.replace(/>Нет предстоящих важных новостей по EUR\/USD</g, '>{t.news.noNewsNext}<');
  
  c = c.replace(/>Forex Factory · HIGH IMPACT · EUR &amp; USD · Обновляется ежедневно</g, '>{t.news.footer}<');

  fs.writeFileSync(path, c);
}

function translateCalendar() {
  const path = 'client/src/pages/calendar-page.tsx';
  let c = fs.readFileSync(path, 'utf8');

  if (!c.includes('useI18n')) {
    c = c.replace('import { useState } from "react";', 'import { useState } from "react";\nimport { useI18n } from "@/lib/i18n";');
  }

  c = c.replace(/const \{ state, actions \} = useStore\(\);/, 'const { state, actions } = useStore();\n  const { t } = useI18n();');
  c = c.replace(/function DayDetails\(\{ selectedDate \}: \{ selectedDate: string \}\) \{/g, 'function DayDetails({ selectedDate }: { selectedDate: string }) {\n  const { t } = useI18n();');

  c = c.replace(/>Календарь</g, '>{t.calendar.title}<');
  c = c.replace(/v === "day" \? "День" : v === "week" \? "Неделя" : "Месяц"/g, 'v === "day" ? t.calendar.day : v === "week" ? t.calendar.week : t.calendar.month');
  
  c = c.replace(/>Неделя</g, '>{t.calendar.weekTitle}<');
  c = c.replace(/>Нет задач на этот день</g, '>{t.calendar.noTasks}<');
  c = c.replace(/>Нет задач</g, '>{t.calendar.noTasksShort}<');
  
  c = c.replace(/\{selectedTasks\.filter\(t => t\.completed\)\.length\}\/\{selectedTasks\.length\} задач/g, '{t.calendar.tasksCount.replace("{done}", selectedTasks.filter(t => t.completed).length.toString()).replace("{total}", selectedTasks.length.toString())}');
  
  c = c.replace(/"Редактировать задачу" : "Новая задача"/g, 't.calendar.editTask : t.calendar.newTask');
  c = c.replace(/>Название</g, '>{t.calendar.taskName}<');
  c = c.replace(/"Что нужно сделать\?"/g, 't.calendar.taskNamePlaceholder');
  c = c.replace(/>Описание \(опционально\)</g, '>{t.calendar.taskDesc}<');
  c = c.replace(/"Подробности\.\.\."/g, 't.calendar.taskDescPlaceholder');
  c = c.replace(/>Сфера</g, '>{t.calendar.category}<');
  c = c.replace(/>Сложность</g, '>{t.calendar.difficulty}<');
  c = c.replace(/>Лёгкая — 10 XP</g, '>{t.calendar.diffLow}<');
  c = c.replace(/>Средняя — 25 XP</g, '>{t.calendar.diffMedium}<');
  c = c.replace(/>Сложная — 50 XP</g, '>{t.calendar.diffHigh}<');
  
  c = c.replace(/>Привязать к цели</g, '>{t.calendar.linkGoal}<');
  c = c.replace(/"Выберите цель"/g, 't.calendar.selectGoal');
  c = c.replace(/>Без цели</g, '>{t.calendar.noGoal}<');
  
  c = c.replace(/>Указать время</g, '>{t.calendar.specifyTime}<');
  c = c.replace(/>Начало</g, '>{t.calendar.startTime}<');
  c = c.replace(/>Конец</g, '>{t.calendar.endTime}<');
  
  c = c.replace(/"Сохранить изменения" : "Добавить"/g, 't.calendar.saveChanges : t.calendar.addBtn');
  
  c = c.replace(/>Легенда</g, '>{t.calendar.legend}<');
  c = c.replace(/>Выполнено</g, '>{t.calendar.legendCompleted}<');
  c = c.replace(/>Не выполнено</g, '>{t.calendar.legendNotCompleted}<');
  c = c.replace(/>Высокая сложность</g, '>{t.calendar.legendHighImpact}<');
  c = c.replace(/>Заметки \/ Bias</g, '>{t.calendar.legendNotes}<');
  
  c = c.replace(/>Заметки дня</g, '>{t.calendar.dayNotes}<');
  c = c.replace(/>Заметок нет</g, '>{t.calendar.noDayNotes}<');
  c = c.replace(/>Дневной BIAS</g, '>{t.calendar.dailyBias}<');
  c = c.replace(/>Торговые заметки</g, '>{t.calendar.tradingNotes}<');
  c = c.replace(/"Без названия"/g, 't.calendar.untitled');

  fs.writeFileSync(path, c);
}

function translateAuth() {
  const fpPath = 'client/src/pages/forgot-password.tsx';
  let fp = fs.readFileSync(fpPath, 'utf8');
  if (!fp.includes('useI18n')) {
    fp = fp.replace('import { Link } from "wouter";', 'import { Link } from "wouter";\nimport { useI18n } from "@/lib/i18n";');
    fp = fp.replace(/export default function ForgotPasswordPage\(\) \{/, 'export default function ForgotPasswordPage() {\n  const { t } = useI18n();');
  }
  fp = fp.replace(/"Ошибка соединения"/g, 't.authPages.connError');
  fp = fp.replace(/>Забыл пароль</g, '>{t.authPages.forgotTitle}<');
  fp = fp.replace(/>Если аккаунт с таким email существует — письмо отправлено\. Проверь почту\.</g, '>{t.authPages.forgotSent}<');
  fp = fp.replace(/>Вернуться</g, '>{t.authPages.back}<');
  fp = fp.replace(/"Твой email"/g, 't.authPages.emailPlaceholder');
  fp = fp.replace(/"Отправляем\.\.\." : "Отправить ссылку"/g, 't.authPages.sending : t.authPages.sendLink');
  fp = fp.replace(/>Назад</g, '>{t.authPages.backBtn}<');
  fs.writeFileSync(fpPath, fp);

  const rpPath = 'client/src/pages/reset-password.tsx';
  let rp = fs.readFileSync(rpPath, 'utf8');
  if (!rp.includes('useI18n')) {
    rp = rp.replace('import { Link } from "wouter";', 'import { Link } from "wouter";\nimport { useI18n } from "@/lib/i18n";');
    rp = rp.replace(/export default function ResetPasswordPage\(\) \{/, 'export default function ResetPasswordPage() {\n  const { t } = useI18n();');
  }
  rp = rp.replace(/"Пароли не совпадают"/g, 't.authPages.passMismatch');
  rp = rp.replace(/"Ошибка"/g, 't.news.error');
  rp = rp.replace(/"Ошибка соединения"/g, 't.authPages.connError');
  rp = rp.replace(/>Новый пароль</g, '>{t.authPages.resetTitle}<');
  rp = rp.replace(/>Пароль успешно изменён!</g, '>{t.authPages.resetSuccess}<');
  rp = rp.replace(/>Войти</g, '>{t.authPages.loginBtn}<');
  rp = rp.replace(/"Новый пароль"/g, 't.authPages.newPassPlaceholder');
  rp = rp.replace(/"Повтори пароль"/g, 't.authPages.confirmPassPlaceholder');
  rp = rp.replace(/"Сохраняем\.\.\." : "Сохранить пароль"/g, 't.authPages.saving : t.authPages.savePass');
  fs.writeFileSync(rpPath, rp);

  const vePath = 'client/src/pages/verify-email.tsx';
  let ve = fs.readFileSync(vePath, 'utf8');
  if (!ve.includes('useI18n')) {
    ve = ve.replace('import { useLocation } from "wouter";', 'import { useLocation } from "wouter";\nimport { useI18n } from "@/lib/i18n";');
    ve = ve.replace(/function ResendForm\(\) \{/, 'function ResendForm() {\n  const { t } = useI18n();');
    ve = ve.replace(/export default function VerifyEmailPage\(\) \{/, 'export default function VerifyEmailPage() {\n  const { t } = useI18n();');
  }
  ve = ve.replace(/"Введите email"/g, 't.authPages.enterEmail');
  ve = ve.replace(/"Письмо отправлено! Проверьте почту\."/g, 't.authPages.sendEmailSuccess');
  ve = ve.replace(/"Ошибка отправки"/g, 't.authPages.sendError');
  ve = ve.replace(/"Ошибка сети"/g, 't.authPages.netError');
  ve = ve.replace(/>Получить новую ссылку:</g, '>{t.authPages.resendLink}<');
  ve = ve.replace(/"Ваш email"/g, 't.authPages.yourEmail');
  ve = ve.replace(/"Отправка\.\.\." : "Отправить новую ссылку"/g, 't.authPages.sendingLink : t.authPages.sendNewLink');
  ve = ve.replace(/>Проверяем токен\.\.\.</g, '>{t.authPages.verifying}<');
  ve = ve.replace(/>EMAIL ПОДТВЕРЖДЁН</g, '>{t.authPages.emailVerified}<');
  ve = ve.replace(/>Перенаправляем на страницу входа\.\.\.</g, '>{t.authPages.redirecting}<');
  ve = ve.replace(/>ССЫЛКА ИСТЕКЛА</g, '>{t.authPages.linkExpired}<');
  ve = ve.replace(/>Ссылка больше недействительна\. Запросите новую\.</g, '>{t.authPages.linkExpiredDesc}<');
  ve = ve.replace(/>На главную</g, '>{t.authPages.goHome}<');
  ve = ve.replace(/>ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</g, '>{t.authPages.linkInvalid}<');
  ve = ve.replace(/>Ссылка уже использована или неверна\.</g, '>{t.authPages.linkInvalidDesc}<');
  fs.writeFileSync(vePath, ve);
}

translateStats();
translateNews();
translateCalendar();
translateAuth();
console.log("Done");
