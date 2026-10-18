"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function saveAssessmentAction(formData: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase } = await requireRole(["teacher", "admin"]);
  try {
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const subject = String(formData.get("subject") ?? "");
    const kind = String(formData.get("kind") ?? "");
    const gradeMin = Number(formData.get("grade_min"));
    const gradeMax = Number(formData.get("grade_max"));
    const durationMinutes = Number(formData.get("duration_minutes"));
    const difficulty = String(formData.get("difficulty") ?? "");
    let questions: unknown;
    try { questions = JSON.parse(String(formData.get("questions") ?? "[]")); }
    catch { return { ok: false, error: "Список вопросов повреждён. Обнови страницу и повтори попытку." }; }
    if (!Array.isArray(questions) || questions.length < 1) return { ok: false, error: "Добавь хотя бы один вопрос." };
    if (questions.length > 200) return { ok: false, error: "В одном задании можно сохранить не больше 200 вопросов." };
    const payload = { title, description, subject, kind, gradeMin, gradeMax, durationMinutes, difficulty };
    const rawAssessmentId = String(formData.get("assessment_id") ?? "").trim();
    const { data, error } = await supabase.rpc("save_assessment", {
      _assessment_id: rawAssessmentId || null,
      _data: payload,
      _questions: questions,
    });
    if (error) return { ok: false, error: error.message };
    if (typeof data !== "string") return { ok: false, error: "База данных не вернула ID задания." };
    revalidatePath("/");
    revalidatePath("/assessments");
    revalidatePath("/teacher");
    return { ok: true, id: data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить задание." };
  }
}

export async function submitAssessmentForReviewAction(formData: FormData) {
  const { supabase } = await requireRole(["teacher", "admin"]);
  const id = String(formData.get("assessment_id") ?? "");
  const { error } = await supabase.rpc("submit_assessment_for_review", { _assessment_id: id });
  if (error) redirect(`/teacher?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher");
  revalidatePath("/admin");
  redirect("/teacher?message=" + encodeURIComponent("Задание отправлено на проверку."));
}

export async function deleteAssessmentAction(formData: FormData) {
  const { supabase } = await requireRole(["teacher", "admin"]);
  const id = String(formData.get("assessment_id") ?? "").trim();
  if (!id) redirect("/teacher?error=" + encodeURIComponent("Не указан ID задания."));
  const { error } = await supabase.rpc("manage_assessment_delete", { _assessment_id: id });
  if (error) redirect("/teacher?error=" + encodeURIComponent(error.message));
  revalidatePath("/"); revalidatePath("/assessments"); revalidatePath("/teacher"); revalidatePath("/admin"); revalidatePath("/leaderboard");
  redirect("/teacher?message=" + encodeURIComponent("Задание и его результаты удалены."));
}
