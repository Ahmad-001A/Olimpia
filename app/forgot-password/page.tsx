import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/password-actions";
import { Notice } from "@/components/Notice";

type Params = { error?: string; sent?: string };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return <div className="section-wrap auth-layout"><div className="auth-aside"><div className="section-kicker">ВОССТАНОВЛЕНИЕ ДОСТУПА</div><h1>Вернём тебя<br /><em>к учёбе.</em></h1><p>Укажи адрес, который использовал при регистрации. Supabase отправит письмо со ссылкой для создания нового пароля.</p></div><section className="glass-panel auth-card"><div className="section-kicker">НОВЫЙ ПАРОЛЬ</div><h2>Не помнишь пароль?</h2><p className="muted-text">Отправим ссылку на почту, если адрес зарегистрирован в системе.</p><Notice message={params.error} /><Notice type="success" message={params.sent ? "Если такой аккаунт существует, письмо для восстановления отправлено." : undefined} /><form className="stack-form" action={requestPasswordResetAction}><label><span>Электронная почта</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><button className="button button-primary button-large button-full" type="submit">Отправить ссылку</button></form><p className="auth-switch"><Link href="/login">← Вернуться ко входу</Link></p></section></div>;
}
