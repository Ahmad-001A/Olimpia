import Link from "next/link";
import { updatePasswordAction } from "@/app/auth/password-actions";
import { Notice } from "@/components/Notice";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="section-wrap page-wrap narrow-page"><section className="glass-panel auth-card"><div className="section-kicker">БЕЗОПАСНОСТЬ АККАУНТА</div><h2>Новый пароль</h2><p className="muted-text">Придумай пароль длиной не менее 8 символов.</p><Notice message={error} /><form className="stack-form" action={updatePasswordAction}><label><span>Новый пароль</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label><span>Повтори пароль</span><input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label><button className="button button-primary button-large button-full" type="submit">Сохранить пароль</button></form><p className="auth-switch"><Link href="/login">← Войти</Link></p></section></div>;
}
