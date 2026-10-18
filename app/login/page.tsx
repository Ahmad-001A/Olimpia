import Link from "next/link";
import { signInAction } from "@/app/auth/actions";
import { Notice } from "@/components/Notice";

type Params = { error?: string };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { error } = await searchParams;
  return <div className="auth-layout section-wrap"><div className="auth-aside"><div className="section-kicker">СНОВА РАДЫ ВИДЕТЬ</div><h1>Продолжим<br /><em>с того места,</em><br />где остановились.</h1><p>Войди, чтобы открыть личный кабинет, проходить задания и видеть свои результаты.</p><div className="auth-aside-mark">olympia<span>.</span></div></div><section className="auth-card glass-panel"><div className="section-kicker">ЛИЧНЫЙ АККАУНТ</div><h2>Вход в Olympia</h2><p className="muted-text">Введи данные своего аккаунта.</p><Notice message={error} /><form action={signInAction} className="stack-form"><label><span>Электронная почта</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label><label><span>Пароль</span><input name="password" type="password" autoComplete="current-password" minLength={8} required /></label><button className="button button-primary button-large button-full" type="submit">Войти <span aria-hidden="true">↗</span></button></form><p className="auth-switch"><Link href="/forgot-password">Забыл пароль?</Link></p><p className="auth-switch">Впервые здесь? <Link href="/register">Создать аккаунт</Link></p></section></div>;
}
