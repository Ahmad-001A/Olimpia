"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function back(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) back("/login", "Укажи электронную почту и пароль.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) back("/login", "Не удалось войти. Проверь почту и пароль.");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    back("/login", "Этот аккаунт заблокирован или профиль не активирован.");
  }
  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const grade = Number(formData.get("grade"));
  if (displayName.length < 2 || displayName.length > 100) back("/register", "Имя должно содержать от 2 до 100 символов.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("/register", "Укажи корректную электронную почту.");
  if (password.length < 8) back("/register", "Пароль должен содержать не менее 8 символов.");
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) back("/register", "Выбери класс от 1 до 11.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName, grade: String(grade) },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/dashboard`,
    },
  });
  if (error) back("/register", "Не удалось зарегистрироваться. Проверь данные или попробуй позже.");
  if (!data.session) redirect("/auth/check-email");
  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
