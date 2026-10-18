import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export async function getCurrentAccount() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,display_name,grade,role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Не удалось загрузить профиль: ${error.message}`);
  return { supabase, user, profile: profile as Profile | null };
}

export async function requireAccount() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.profile) redirect("/auth/check-email?profile=missing");
  if (!account.profile.is_active) {
    await account.supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("Этот аккаунт заблокирован. Обратись к администратору платформы."));
  }
  return account as typeof account & { profile: Profile };
}

export async function requireRole(roles: AppRole[]) {
  const account = await requireAccount();
  if (!roles.includes(account.profile.role)) {
    if (account.profile.role === "admin") redirect("/admin");
    if (account.profile.role === "teacher") redirect("/teacher");
    redirect("/dashboard");
  }
  return account;
}
