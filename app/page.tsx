import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/lib/auth";
import { AssessmentCard } from "@/components/AssessmentCard";
import type { Assessment } from "@/lib/types";

export default async function HomePage() {
  const account = await getCurrentAccount();
  const profile = account?.profile?.is_active ? account.profile : null;
  const supabase = account?.supabase ?? await createClient();
  const { data } = await supabase.from("assessments").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(3);
  const assessments = (data ?? []) as Assessment[];
  return <>
    <section className="landing-hero section-wrap">
      <div className="hero-copy-block">
        <div className="eyebrow"><span className="eyebrow-dot" /> ПРОСТРАНСТВО ЗНАНИЙ</div>
        <h1>Интересно, на что ты способен? <em>Давай узнаем.</em></h1>
        <p className="hero-description">Выбирай предмет, решай настоящие задания и замечай свой прогресс. Подготовься к олимпиаде или проверь себя — в своём темпе.</p>
        <div className="hero-buttons">
          <Link className="button button-primary button-large" href="/assessments">Найти задание <span aria-hidden="true">↗</span></Link>
          {!profile ? (
            <Link className="button button-glass button-large" href="/register">Создать аккаунт</Link>
          ) : profile.role === "student" ? (
            <Link className="button button-glass button-large" href="/dashboard">Мой кабинет</Link>
          ) : profile.role === "teacher" ? (
            <Link className="button button-glass button-large" href="/teacher">Кабинет учителя</Link>
          ) : (
            <Link className="button button-glass button-large" href="/admin">Панель администратора</Link>
          )}
        </div>
        <div className="hero-caption"><span className="caption-mark">01</span><span>Знания растут, когда пробуешь сам.</span></div>
      </div>
      <div className="hero-visual" aria-label="Иллюстрация учебной книги и карандаша">
        <div className="visual-topline"><span>OLYMPIA / LEARN BY DOING</span><span className="live-badge"><i /> Учись в своём темпе</span></div>
        <div className="visual-heading">Твоя следующая<br />маленькая победа.</div>
        <svg className="hero-book" viewBox="0 0 360 260" role="img" aria-label="Открытая книга и карандаш">
          <defs><linearGradient id="leftPage" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffef8"/><stop offset="1" stopColor="#e7e4d8"/></linearGradient><linearGradient id="rightPage" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffdf5"/><stop offset="1" stopColor="#d9d4c7"/></linearGradient><linearGradient id="bookCover" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#527660"/><stop offset="1" stopColor="#2d4c39"/></linearGradient><linearGradient id="pencil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dfb77b"/><stop offset="1" stopColor="#b57b42"/></linearGradient><filter id="bookShadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="7" floodColor="#4b4d3c" floodOpacity=".18"/></filter></defs>
          <ellipse cx="183" cy="224" rx="136" ry="14" fill="#616b58" opacity=".15"/>
          <g filter="url(#bookShadow)" transform="rotate(-5 170 135)"><path d="M35 96 145 119 146 208 47 183Z" fill="url(#bookCover)"/><path d="M145 119 291 82 286 170 146 208Z" fill="#294a36"/><path d="M42 85 145 108 147 193 49 170Z" fill="#d2cec1"/><path d="M145 108 284 73 282 157 147 193Z" fill="#c8c3b4"/><path d="M42 76 145 99 147 184 50 161Z" fill="url(#leftPage)" stroke="#d2cec3" strokeWidth="1.3"/><path d="M145 99 284 64 282 148 147 184Z" fill="url(#rightPage)" stroke="#d0cbbf" strokeWidth="1.3"/><path d="M60 97 129 113M59 110 130 126M59 123 131 139M60 136 132 152M61 149 132 165" stroke="#b4c2b1" strokeWidth="2.4" strokeLinecap="round"/><path d="M164 105 260 81M163 118 259 94M162 131 258 107M162 144 257 120" stroke="#b6c1b2" strokeWidth="2.3" strokeLinecap="round"/><path d="M145 99 147 184" stroke="#a3a28e" strokeWidth="3.5"/></g>
          <g filter="url(#bookShadow)" transform="rotate(17 300 90)"><path d="M289 23 303 20 322 145 308 148Z" fill="url(#pencil)"/><path d="M289 23 296 8 303 20Z" fill="#d8b98f"/><path d="M296 8 298 4 303 20Z" fill="#373d36"/><path d="M289 23 303 20 304 28 291 31Z" fill="#f0cf9a"/><path d="M308 148 322 145 316 160 312 161Z" fill="#d5c4a6"/></g>
          <path d="M56 201 76 190 96 201 76 213Z" fill="#e5c38b"/><path d="M56 201 76 213V235L56 223Z" fill="#bb915a"/><path d="M76 213 96 201V223L76 235Z" fill="#a67543"/>
        </svg>
        <div className="visual-stats"><div><strong>1–11</strong><span>классы</span></div><div><strong>9</strong><span>предметов</span></div><div><strong>∞</strong><span>своих целей</span></div></div>
      </div>
    </section>

    <section className="section-wrap section-block" id="assessments">
      <div className="section-heading"><div><div className="section-kicker">ПОДБОРКА</div><h2>Задания, с которых можно начать</h2><p>Только опубликованные задания, созданные и проверенные на платформе.</p></div><Link className="text-link" href="/assessments">Все задания <span aria-hidden="true">↗</span></Link></div>
      {assessments.length ? <div className="assessment-grid">{assessments.map((assessment) => <AssessmentCard key={assessment.id} assessment={assessment} />)}</div> : <div className="empty-state"><div className="empty-rule" aria-hidden="true"><span /> <span /> <span /></div><h3>Пока нет опубликованных заданий</h3><p>Когда учителя добавят и администратор проверит первые задания, они появятся здесь.</p><Link className="button button-glass" href="/assessments">Открыть каталог</Link></div>}
    </section>

    <section className="section-wrap section-block" id="about">
      <div className="section-heading"><div><div className="section-kicker">КАК ЭТО РАБОТАЕТ</div><h2>Шаг за шагом — к большему</h2><p>От первой попытки до уверенного результата.</p></div></div>
      <div className="feature-grid"><article className="feature-card"><div className="feature-index"><span>01</span><span>ОРИЕНТИР</span></div><h3>Выбери направление</h3><p>Найди задание по предмету и своему классу.</p></article><article className="feature-card"><div className="feature-index"><span>02</span><span>ПРАКТИКА</span></div><h3>Решай сам</h3><p>Проходи задания с ограничением времени и сохраняй свои ответы.</p></article><article className="feature-card"><div className="feature-index"><span>03</span><span>ПРОГРЕСС</span></div><h3>Смотри результат</h3><p>Изучай набранные баллы и разбирай правильные ответы.</p></article></div>
    </section>
    <section className="section-wrap teacher-banner"><div><div className="section-kicker">СООБЩЕСТВО</div><h2>Учитель, делись знаниями.</h2><p>Создавай задания, отправляй их на проверку и следи за результатами учеников.</p></div><Link className="button button-primary button-large" href="/teacher-application">Стать учителем <span aria-hidden="true">↗</span></Link></section>
  </>;
}
