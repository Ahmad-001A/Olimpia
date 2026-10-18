import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth";
import { signOutAction } from "@/app/auth/actions";

export async function Header() {
  const account = await getCurrentAccount();
  const profile = account?.profile?.is_active ? account.profile : null;
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Olympia — главная">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 6.7C9.5 4.8 6.4 4.5 3.5 5.7v12c3.2-1.1 6.1-.6 8.5 1.5m0-12.5c2.5-1.9 5.6-2.2 8.5-1v12c-3.2-1.1-6.1-.6-8.5 1.5m0-12.5v12.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="brand-word">olympia<span>.</span></span>
        </Link>
        <nav className="main-nav" aria-label="Главная навигация">
          <Link href="/assessments">Задания</Link>
          <Link href="/leaderboard">Рейтинг</Link>
          <Link href="/#about">О платформе</Link>
        </nav>
        <div className="header-actions">
          {profile ? (
            <>
              {profile.role === "student" && <Link className="header-profile" href="/dashboard"><span className="avatar-dot">{profile.display_name.slice(0, 1).toUpperCase()}</span><span>{profile.display_name}</span></Link>}
              {profile.role === "teacher" && <Link className="button button-quiet" href="/teacher">Кабинет учителя</Link>}
              {profile.role === "admin" && <Link className="button button-quiet" href="/admin">Администрирование</Link>}
              {profile.role === "student" && <Link className="button button-primary header-dashboard" href="/dashboard">Мой кабинет</Link>}
              <form action={signOutAction}><button className="button button-plain header-signout" type="submit">Выйти</button></form>
            </>
          ) : (
            <>
              <Link className="button button-plain header-login" href="/login">Войти</Link>
              <Link className="button button-primary header-register" href="/register">Создать аккаунт <span aria-hidden="true">↗</span></Link>
            </>
          )}
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Навигация на мобильном устройстве">
        <Link href="/assessments">Задания</Link><Link href="/leaderboard">Рейтинг</Link><Link href="/#about">О платформе</Link>
        {profile?.role === "student" && <Link href="/dashboard">Мой кабинет</Link>}
        {profile?.role === "teacher" && <Link href="/teacher">Кабинет учителя</Link>}
        {profile?.role === "admin" && <Link href="/admin">Администрирование</Link>}
        {!profile && <Link href="/login">Войти</Link>}
      </nav>
    </header>
  );
}
