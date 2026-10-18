import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { AssessmentEditor } from "@/components/AssessmentEditor";

export default async function NewAssessmentPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { supabase, user } = await requireRole(["teacher"]);
  const { edit } = await searchParams;
  let initialAssessment;
  let initialQuestions;
  if (edit) {
    const { data: assessment } = await supabase.from("assessments").select("id,title,description,subject,kind,grade_min,grade_max,duration_minutes,difficulty,status").eq("id", edit).eq("creator_id", user.id).maybeSingle();
    if (!assessment || !["draft", "rejected"].includes(assessment.status)) notFound();
    const { data: questions } = await supabase.from("assessment_questions").select("prompt,options,correct_index,explanation,points,question_type,correct_text,match_pairs").eq("assessment_id", edit).order("position", { ascending: true });
    initialAssessment = assessment;
    initialQuestions = questions ?? [];
  }
  return <div className="section-wrap page-wrap"><div className="page-heading"><div><Link className="back-link" href="/teacher">← Кабинет учителя</Link><div className="section-kicker">КОНСТРУКТОР</div><h1>{initialAssessment ? "Редактировать задание" : "Новое задание"}</h1><p>Заполни условия и добавь вопросы. Все поля проверяются и сохраняются в Supabase.</p></div></div><AssessmentEditor initialAssessment={initialAssessment} initialQuestions={initialQuestions} /></div>;
}
