"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?error=" + encodeURIComponent("Укажи электронную почту."));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/update-password`,
  });
  if (error) redirect("/forgot-password?error=" + encodeURIComponent("Не удалось отправить ссылку. Проверь настройки почты в Supabase."));
  redirect("/forgot-password?sent=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) redirect("/update-password?error=" + encodeURIComponent("Пароль должен содержать не менее 8 символов."));
  if (password !== confirmation) redirect("/update-password?error=" + encodeURIComponent("Пароли не совпадают."));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Сначала открой ссылку из письма восстановления."));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/update-password?error=" + encodeURIComponent("Не удалось изменить пароль. Запроси новую ссылку."));
  redirect("/dashboard?message=" + encodeURIComponent("Пароль обновлён."));
}
