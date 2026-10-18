"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { QuestionAnswer, StartedAttempt } from "@/lib/types";

export async function startAttemptAction(assessmentId: string): Promise<{ ok: true; attempt: StartedAttempt } | { ok: false; error: string }> {
  const { supabase } = await requireRole(["student", "teacher", "admin"]);
  try {
    const { data, error } = await supabase.rpc("start_assessment_attempt", { _assessment_id: assessmentId });
    if (error) return { ok: false, error: error.message };
    return { ok: true, attempt: data as StartedAttempt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось начать задание." };
  }
}

export async function resumeAttemptAction(attemptId: string): Promise<{ ok: true; attempt: StartedAttempt } | { ok: false; error: string }> {
  const { supabase } = await requireRole(["student", "teacher", "admin"]);
  try {
    const { data, error } = await supabase.rpc("resume_assessment_attempt", { _attempt_id: attemptId });
    if (error) return { ok: false, error: error.message };
    return { ok: true, attempt: data as StartedAttempt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось восстановить попытку." };
  }
}

export async function saveAttemptAnswersAction(attemptId: string, answers: Record<string, QuestionAnswer>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireRole(["student", "teacher", "admin"]);
  try {
    const { error } = await supabase.rpc("save_assessment_attempt_answers", { _attempt_id: attemptId, _answers: answers });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить ответ." };
  }
}

export async function submitAttemptAction(attemptId: string, answers: Record<string, QuestionAnswer>): Promise<{ ok: true; attemptId: string; score: number; maxScore: number; state: string } | { ok: false; error: string }> {
  const { supabase } = await requireRole(["student", "teacher", "admin"]);
  try {
    const { data, error } = await supabase.rpc("submit_assessment_attempt", { _attempt_id: attemptId, _answers: answers });
    if (error) return { ok: false, error: error.message };
    const result = data as { attempt_id: string; score: number; max_score: number; state: string };
    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
    revalidatePath(`/results/${attemptId}`);
    return { ok: true, attemptId: result.attempt_id, score: result.score, maxScore: result.max_score, state: result.state };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось отправить результат." };
  }
}
