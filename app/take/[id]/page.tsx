import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { AssessmentRunner } from "@/components/AssessmentRunner";

export default async function TakeAssessmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const { id } = await params;
  const { attempt } = await searchParams;
  const { supabase, profile } = await requireAccount();
  const { data: assessment, error } = await supabase.from("assessments").select("id,title,description,kind,duration_minutes,grade_min,grade_max,status").eq("id", id).eq("status", "published").maybeSingle();
  if (error || !assessment) notFound();
  if (!attempt && profile.role === "student" && (profile.grade === null || profile.grade < assessment.grade_min || profile.grade > assessment.grade_max)) {
    return <div className="section-wrap page-wrap narrow-page"><div className="glass-panel confirmation-card"><div className="section-kicker">ЗАДАНИЕ НЕДОСТУПНО</div><h1>Проверь класс в профиле</h1><p>Это задание рассчитано на {assessment.grade_min}–{assessment.grade_max} классы, а класс в твоём аккаунте не подходит.</p><Link className="button button-primary" href="/dashboard">В личный кабинет</Link></div></div>;
  }
  return <div className="section-wrap page-wrap"><div className="page-heading"><div><Link className="back-link" href={`/assessments/${id}`}>← Условия задания</Link><div className="section-kicker">{assessment.kind === "Олимпиада" ? "ОЛИМПИАДНЫЙ РЕЖИМ" : "ТЕСТИРОВАНИЕ"}</div><h1>{assessment.title}</h1><p>{assessment.kind === "Олимпиада" ? "Распределяй время, переходи между вопросами и проверь ответы перед сдачей." : "Отвечай на вопросы и проверяй знания. Ответы сохраняются по мере прохождения."}</p></div></div><AssessmentRunner assessmentId={id} title={assessment.title} description={assessment.description ?? ""} duration={assessment.duration_minutes} kind={assessment.kind as "Олимпиада" | "Тест"} initialAttemptId={attempt} /></div>;
}
