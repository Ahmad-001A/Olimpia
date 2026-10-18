"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export async function applyForTeacherAction(formData: FormData) {
  const { supabase } = await requireRole(["student"]);
  const subject = String(formData.get("subject") ?? "");
  const experience = String(formData.get("experience") ?? "").trim();
  const { error } = await supabase.rpc("apply_for_teacher", { _subject: subject, _experience: experience });
  if (error) redirect(`/teacher-application?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher-application");
  redirect("/teacher-application?message=" + encodeURIComponent("Заявка отправлена. Статус можно проверить в этом разделе."));
}
