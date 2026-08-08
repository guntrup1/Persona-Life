import type { Goal } from "./store";

export const MOTIVATIONAL_NOTIFICATIONS: string[] = [
  "Дружище, ты же работаешь над своими целями? Время поджимает для «{title}»!",
  "Цель «{title}» скоро завершится. Сделай рывок прямо сейчас!",
  "Каждый день на счету! Как успехи с «{title}»?",
  "Не откладывай «{title}» на завтра. Финишная прямая уже близко!",
  "Дисциплина — это ключ. Проверь свой прогресс по «{title}»!",
  "Ты обещал себе достигнуть «{title}». Время выполнять обещание!",
  "Остались считанные дни для «{title}»! Нажми на газ!",
  "Твой потенциал безграничен, но у цели «{title}» есть дедлайн!",
  "Маленький шаг сегодня по «{title}» — огромная победа завтра!",
  "Помни, ради чего ты начинал «{title}»!",
  "Часики тикают: цель «{title}» требует твоего внимания!",
  "Сфокусируйся! До завершения «{title}» осталось совсем немного.",
  "Не дай «{title}» уйти в невыполненные цели. Действуй!",
  "Каждая минута приближает дедлайн «{title}». Сделай следующий шаг!",
  "Ты ближе к цели «{title}», чем думаешь. Не останавливайся!",
  "Успех любит энергичных! Вложи силу в цель «{title}».",
  "Проверь под-цели для «{title}». Всё ли идёт по плану?",
  "Великие дела состоят из маленьких шагов. Продвинь «{title}»!",
  "Не оставляй «{title}» на самый последний момент!",
  "Твое будущее «Я» скажет тебе спасибо за работу над «{title}»!",
  "Сделай хоть один пункт по «{title}» прямо сейчас!",
  "Победители не сдаются. Закрой цель «{title}» вовремя!",
  "Таймер тикает: дедлайн по «{title}» уже на горизонте!",
  "Ты можешь больше! Сфокусируйся на «{title}».",
  "Препятствия — это вызов. Заверши «{title}» со стилем!",
  "Фокус и концентрация: цель «{title}» ждать не будет!",
  "Не ищи оправданий для «{title}», ищи возможности!",
  "Твои результаты определяются твоими действиями по «{title}».",
  "Осталось совсем немного до дедлайна «{title}»! Включайся!",
  "Сделай фокус-сессию по «{title}» прямо сегодня!",
  "Каждый шаг по «{title}» укрепляет твою дисциплину.",
  "Цель «{title}» требует твоей решимости. Пора действовать!",
  "Напоминание: у цели «{title}» заканчивается срок действия!",
  "Будь честен с собой — сколько сделано по «{title}»?",
  "Ты хозяин своего времени. Посвяти час цели «{title}».",
  "Дедлайн близко! «{title}» ждёт твоего финального рывка.",
  "Не дай рутине отвлечь тебя от главной цели «{title}»!",
  "Один сфокусированный час по «{title}» изменит всё.",
  "Ты заложил фундамент для «{title}», теперь доведи до конца!",
  "Уважай свои мечты: доработай цель «{title}»!",
  "Время — твой главный ресурс. Задействуй его на «{title}».",
  "Сделай рывок по «{title}» и отпразднуй победу!",
  "Цель «{title}» поджимает по срокам. Пора прибавить ходу!",
  "Остались считанные дни! Закрой под-цели для «{title}».",
  "Не отступай перед трудностями по «{title}»!",
  "Твой план по «{title}» ждёт выполнения. Вперёд!",
  "Каждый зачеркнутый пункт по «{title}» — шаг к мастерству.",
  "Держи ритм! Цель «{title}» близка к дедлайну.",
  "Заверши «{title}» вовремя и докажи себе, на что способен!",
  "Время действовать по «{title}» — прямо сейчас!"
];

export interface UrgentGoalNotification {
  goalId: string;
  goalTitle: string;
  daysRemaining: number;
  message: string;
  goalType: "year" | "month" | "week";
}

export function getUrgentGoalNotifications(goals: Goal[]): UrgentGoalNotification[] {
  if (!goals || goals.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notifications: UrgentGoalNotification[] = [];

  goals.forEach((goal, idx) => {
    // Only notify for active, uncompleted goals that have an endDate
    if (goal.status === "failed" || goal.completed || !goal.endDate) return;

    const [ey, em, ed] = goal.endDate.split("-").map(Number);
    if (!ey || !em || !ed) return;

    const end = new Date(ey, em - 1, ed, 23, 59, 59);
    const diffMs = end.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return; // Overdue items handled by auto-fail

    let isUrgent = false;
    if (goal.type === "year" && daysRemaining <= 30) isUrgent = true;
    else if (goal.type === "month" && daysRemaining <= 7) isUrgent = true;
    else if (goal.type === "week" && daysRemaining <= 2) isUrgent = true;

    if (isUrgent) {
      const template = MOTIVATIONAL_NOTIFICATIONS[(idx + daysRemaining + goal.title.length) % MOTIVATIONAL_NOTIFICATIONS.length];
      const message = template.replace("{title}", goal.title);
      notifications.push({
        goalId: goal.id,
        goalTitle: goal.title,
        daysRemaining,
        message,
        goalType: goal.type,
      });
    }
  });

  return notifications;
}
