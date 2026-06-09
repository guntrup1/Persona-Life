import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "ru" | "en";

export const translations = {
  ru: {
    // ── App shell ──
    loading: "Загрузка...",
    menu: "Меню",
    logout: "Выйти",
    saved: "Сохранено",
    synced: "Синхронизировано",
    noConnection: "Нет соединения",

    // ── Quick note ──
    quickNote: "Заметка дня",
    quickIdea: "Новая идея",
    noteType: "Заметка",
    ideaType: "Идея",
    ideaTitle: "Заголовок идеи (опционально)",
    notePlaceholder: "Что хочешь записать?",
    ideaPlaceholder: "Опиши свою идею...",
    addNote: "Добавить заметку",
    addIdea: "Добавить идею",
    noteAdded: "Заметка добавлена",
    ideaAdded: "Идея добавлена",

    // ── Nav items ──
    nav: {
      home: "Главная",
      tasks: "Задачи",
      goals: "Цели",
      timer: "Фокус",
      stats: "Статистика",
      trading: "Трейдинг",
      ideas: "Идеи",
      news: "Новости",
      calendar: "Календарь",
      settings: "Настройки",
    },

    // ── News indicator ──
    newsToday: (n: number) =>
      n === 1 ? "1 новость" : n < 5 ? `${n} новости` : `${n} новостей`,
    newsNext: (date: string) => `Новости ${date}`,
    newsPcs: (n: number) => `${n} шт.`,

    // ── Auth / Login page ──
    auth: {
      welcome: "Добро пожаловать",
      subtitle: "Gamified Trading OS",
      loginTab: "Войти",
      registerTab: "Регистрация",
      email: "Email",
      password: "Пароль",
      loginBtn: "Войти",
      registerBtn: "Создать аккаунт",
      forgotPassword: "Забыл пароль?",
      noAccount: "Нет аккаунта?",
      hasAccount: "Уже есть аккаунт?",
      verifyEmail: "Подтверди email",
      verifyDesc: "Мы отправили письмо на",
      resend: "Отправить повторно",
      resendSent: "Письмо отправлено",
      resetTitle: "Сброс пароля",
      resetDesc: "Введи email — мы отправим ссылку для сброса",
      resetBtn: "Отправить ссылку",
      resetSent: "Письмо отправлено! Проверь почту.",
      newPassword: "Новый пароль",
      savePassword: "Сохранить пароль",
      passwordSaved: "Пароль сохранён — теперь войди",
      backToLogin: "← Назад ко входу",
    },

    // ── 404 ──
    notFound: "Страница не найдена",
    goHome: "На главную",
  },

  en: {
    // ── App shell ──
    loading: "Loading...",
    menu: "Menu",
    logout: "Log out",
    saved: "Saved",
    synced: "Synced",
    noConnection: "No connection",

    // ── Quick note ──
    quickNote: "Day note",
    quickIdea: "New idea",
    noteType: "Note",
    ideaType: "Idea",
    ideaTitle: "Idea title (optional)",
    notePlaceholder: "What do you want to note?",
    ideaPlaceholder: "Describe your idea...",
    addNote: "Add note",
    addIdea: "Add idea",
    noteAdded: "Note added",
    ideaAdded: "Idea added",

    // ── Nav items ──
    nav: {
      home: "Home",
      tasks: "Tasks",
      goals: "Goals",
      timer: "Focus",
      stats: "Stats",
      trading: "Trading",
      ideas: "Ideas",
      news: "News",
      calendar: "Calendar",
      settings: "Settings",
    },

    // ── News indicator ──
    newsToday: (n: number) => n === 1 ? "1 event" : `${n} events`,
    newsNext: (date: string) => `News ${date}`,
    newsPcs: (n: number) => `${n} items`,

    // ── Auth / Login page ──
    auth: {
      welcome: "Welcome back",
      subtitle: "Gamified Trading OS",
      loginTab: "Log in",
      registerTab: "Sign up",
      email: "Email",
      password: "Password",
      loginBtn: "Log in",
      registerBtn: "Create account",
      forgotPassword: "Forgot password?",
      noAccount: "No account?",
      hasAccount: "Already have an account?",
      verifyEmail: "Verify your email",
      verifyDesc: "We sent a confirmation link to",
      resend: "Resend email",
      resendSent: "Email sent",
      resetTitle: "Reset password",
      resetDesc: "Enter your email — we'll send a reset link",
      resetBtn: "Send link",
      resetSent: "Email sent! Check your inbox.",
      newPassword: "New password",
      savePassword: "Save password",
      passwordSaved: "Password saved — please log in",
      backToLogin: "← Back to login",
    },

    // ── 404 ──
    notFound: "Page not found",
    goHome: "Go home",
  },
} as const;

type Translations = typeof translations.ru;

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("tp_lang");
      if (saved === "en" || saved === "ru") return saved;
    } catch {}
    return "ru";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("tp_lang", l); } catch {}
  };

  // Update <html lang> attribute
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] as unknown as Translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Small toggle button — drop anywhere in the UI */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "ru" ? "en" : "ru")}
      className={`h-9 px-2.5 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground ${className}`}
      title={lang === "ru" ? "Switch to English" : "Переключить на русский"}
      data-testid="button-lang-toggle"
    >
      {lang === "ru" ? "EN" : "RU"}
    </button>
  );
}
