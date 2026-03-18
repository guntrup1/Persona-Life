import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "tp_welcome_seen_v1";

const slides = [
  {
    icon: "👋",
    title: "Добро пожаловать!",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Рад, что ты здесь. <span className="text-foreground font-semibold">Trade Persona</span> — это твоя персональная операционная система трейдера.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Я вложил в этот проект много сил и искренне благодарен, что ты решил попробовать.
        </p>
        <div className="mt-4 p-3 border border-primary/20 bg-primary/5 text-xs font-mono text-primary/80 leading-relaxed">
          ⚠️ Приложение находится в режиме <strong>Беты</strong>. Могут быть мелкие недочёты — пиши в обратную связь, я всё исправлю.
        </div>
        <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 text-xs font-mono text-yellow-400/80 leading-relaxed">
          🐢 Сервер работает на бесплатном тарифе Render + MongoDB Atlas, поэтому первый отклик может быть чуть медленнее обычного. Это нормально.
        </div>
      </div>
    ),
  },
  {
    icon: "🎯",
    title: "Главная и задачи",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">Главная</span> — твой дашборд дня. Здесь виден персонаж, часы, задачи, прогресс и заметки.
        </p>
        <div className="space-y-2">
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">✅</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Задачи</span> — добавляй ежедневные задачи, выполняй их и получай XP. Стрик растёт каждый день когда ты выполняешь хоть одну задачу.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">⭐</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Цели</span> — ставь недельные и месячные цели, разбивай на шаги и следи за прогрессом.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">📝</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Заметки дня</span> — записывай мысли, идеи и наблюдения прямо на главной странице.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "📊",
    title: "Трейдинг и аналитика",
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">📈</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Трейдинг</span> — веди дневник сделок. Записывай входы, выходы, мысли по рынку. Анализируй решения ретроспективно.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">📰</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Новости</span> — автоматический экономический календарь. High-impact события выделяются красным — никогда не пропустишь важный релиз.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">📊</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Статистика</span> — графики продуктивности, история XP, стрики. Видь свой рост в цифрах.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⏱",
    title: "Фокус, идеи и настройки",
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">⏱</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Фокус</span> — помодоро-таймер. Запускай рабочие сессии, делай перерывы. Время фокуса записывается в статистику.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">💡</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Идеи</span> — быстро сохраняй мысли которые приходят в голову во время работы. Не теряй инсайты.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">⚙️</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Настройки</span> — выставь свой часовой пояс и торговые сессии. Это влияет на часы и маркет-сессию в сайдбаре.</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-primary font-mono text-xs mt-0.5 shrink-0">💬</span>
            <p className="text-xs text-muted-foreground leading-relaxed"><span className="text-foreground">Обратная связь</span> — кнопка в левом меню внизу. Пиши баги, пожелания, идеи — всё важно.</p>
          </div>
        </div>
      </div>
    ),
  },
];

export function WelcomePopup() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const goTo = (next: number, dir: "left" | "right") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setSlide(next);
      setAnimating(false);
    }, 180);
  };

  const prev = () => slide > 0 && goTo(slide - 1, "left");
  const next = () => {
    if (slide < slides.length - 1) goTo(slide + 1, "right");
    else close();
  };

  if (!visible) return null;

  const current = slides[slide];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/70"
        style={{ backdropFilter: "blur(6px)", animation: "welcomeFadeIn 0.3s ease-out" }}
        onClick={close}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[301] flex items-center justify-center p-4"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="w-full max-w-md bg-card border border-border relative"
          style={{
            clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
            animation: "welcomeSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)",
            pointerEvents: "auto",
          }}
        >
          {/* Top red line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" style={{ boxShadow: "0 0 8px rgba(225,29,72,0.6)" }} />
          {/* Corner accent */}
          <div className="absolute top-0 right-0 w-4 h-4 bg-primary" style={{ clipPath: "polygon(0 0,100% 0,100% 100%)" }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{current.icon}</span>
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-widest text-foreground">{current.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground tracking-widest mt-0.5">
                  {slide + 1} / {slides.length}
                </div>
              </div>
            </div>
            <button
              onClick={close}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              style={{ clipPath: "none", background: "transparent", border: "none" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Slide dots */}
          <div className="flex gap-1.5 px-6 pt-4">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > slide ? "right" : "left")}
                style={{
                  height: "3px",
                  flex: 1,
                  background: i === slide ? "hsl(var(--primary))" : "hsl(var(--border))",
                  border: "none",
                  clipPath: "none",
                  transition: "background 0.2s",
                  cursor: "pointer",
                  boxShadow: i === slide ? "0 0 6px rgba(225,29,72,0.5)" : "none",
                }}
              />
            ))}
          </div>

          {/* Content */}
          <div
            className="px-6 py-5 min-h-[200px]"
            style={{
              opacity: animating ? 0 : 1,
              transform: animating
                ? `translateX(${direction === "right" ? "20px" : "-20px"})`
                : "translateX(0)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            {current.content}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 pb-5 gap-3">
            <button
              onClick={prev}
              disabled={slide === 0}
              className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "transparent", border: "none", clipPath: "none" }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Назад
            </button>

            <button
              onClick={next}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white font-display text-xs uppercase tracking-widest hover:brightness-110 transition-all active:scale-95"
            >
              {slide < slides.length - 1 ? (
                <>Далее <ChevronRight className="w-3.5 h-3.5" /></>
              ) : (
                "Начать →"
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes welcomeFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes welcomeSlideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </>
  );
}
