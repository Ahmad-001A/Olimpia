import Link from "next/link";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  return <div className="section-wrap page-wrap narrow-page"><div className="glass-panel confirmation-card"><div className="confirmation-icon">✉</div><div className="section-kicker">ПРОВЕРЬ ПОЧТУ</div><h1>{profile ? "Не удалось загрузить профиль" : "Остался один шаг"}</h1><p>{profile ? "Профиль аккаунта пока не найден. Выйди и войди снова; если проблема сохранится, проверь, что SQL-миграция Olympia выполнена полностью." : "Если в Supabase включено подтверждение электронной почты, открой письмо от проекта и перейди по ссылке. После подтверждения ты попадёшь в личный кабинет."}</p><div className="hero-buttons"><Link className="button button-primary" href="/login">Перейти ко входу</Link><Link className="button button-glass" href="/">На главную</Link></div></div></div>;
}
