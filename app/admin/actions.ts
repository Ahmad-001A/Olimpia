"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function moderateAssessmentAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const id = String(formData.get("assessment_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");
  const { error } = await supabase.rpc("moderate_assessment", { _assessment_id: id, _decision: decision, _note: note || null });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}#assessments`);
  revalidatePath("/");
  revalidatePath("/assessments");
  revalidatePath("/admin");
  redirect("/admin?message=" + encodeURIComponent("Решение по заданию сохранено." ) + "#assessments");
}

export async function reviewTeacherApplicationAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const id = String(formData.get("application_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");
  const { error } = await supabase.rpc("review_teacher_application", { _application_id: id, _decision: decision, _note: note || null });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}#teachers`);
  revalidatePath("/admin");
  redirect("/admin?message=" + encodeURIComponent("Заявка рассмотрена." ) + "#teachers");
}


export async function setUserActiveAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const userId = String(formData.get("user_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const { error } = await supabase.rpc("set_user_active", { _user_id: userId, _is_active: active });
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}#users`);
  revalidatePath("/admin");
  redirect("/admin?message=" + encodeURIComponent(active ? "Аккаунт разблокирован." : "Аккаунт заблокирован.") + "#users");
}

export async function adminUpdateAttemptScoreAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const id = String(formData.get("attempt_id") ?? "");
  const score = Number(formData.get("score"));
  if (!id || !Number.isInteger(score) || score < 0) redirect("/admin?error=" + encodeURIComponent("Укажи корректные баллы." ) + "#results");
  const { error } = await supabase.rpc("admin_update_attempt_score", { _attempt_id: id, _score: score });
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message) + "#results");
  revalidatePath("/admin"); revalidatePath("/leaderboard"); revalidatePath("/teacher/results");
  redirect("/admin?message=" + encodeURIComponent("Баллы обновлены." ) + "#results");
}

export async function adminDeleteAttemptAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const id = String(formData.get("attempt_id") ?? "");
  const { error } = await supabase.rpc("admin_delete_attempt", { _attempt_id: id });
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message) + "#results");
  revalidatePath("/admin"); revalidatePath("/leaderboard"); revalidatePath("/teacher/results");
  redirect("/admin?message=" + encodeURIComponent("Результат удалён из рейтинга." ) + "#results");
}

export async function adminClearLeaderboardAction() {
  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("admin_clear_leaderboard");
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message) + "#results");
  revalidatePath("/admin"); revalidatePath("/leaderboard"); revalidatePath("/teacher/results");
  redirect("/admin?message=" + encodeURIComponent("Рейтинг очищен. Удалены завершённые попытки; задания и аккаунты сохранены." ) + "#results");
}

export async function adminDeleteAssessmentAction(formData: FormData) {
  const { supabase } = await requireRole(["admin"]);
  const id = String(formData.get("assessment_id") ?? "");
  const { error } = await supabase.rpc("manage_assessment_delete", { _assessment_id: id });
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message) + "#all-assessments");
  revalidatePath("/admin"); revalidatePath("/assessments"); revalidatePath("/leaderboard"); revalidatePath("/teacher");
  redirect("/admin?message=" + encodeURIComponent("Задание и связанные результаты удалены.") + "#all-assessments");
}
