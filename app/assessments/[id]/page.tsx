import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/lib/auth";
import type { Assessment } from "@/lib/types";

export default async function AssessmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("assessments").select("*").eq("id", id).eq("status", "published").maybeSingle();
  if (error || !data) notFound();
  const assessment = data as Assessment;
  const account = await getCurrentAccount();
  const gradeAllowed = !account?.profile || account.profile.role !== "student" || (account.profile.grade !== null && account.profile.grade >= assessment.grade_min && account.profile.grade <= assessment.grade_max);
  return <div className="section-wrap page-wrap narrow-page">
    <Link href="/assessments" className="back-link">← Все задания</Link>
    <div className={`detail-hero subject-${assessment.subject === "Математика" ? "math" : assessment.subject === "Биология" ? "bio" : assessment.subject === "Физика" ? "physics" : assessment.subject === "История" ? "history" : assessment.subject === "Информатика" ? "code" : "language"}`}>
      <span className="art-label">{assessment.kind}</span><span className="detail-subject">{assessment.subject}</span><h1>{assessment.title}</h1><p>{assessment.description || "У этого задания пока нет описания."}</p>
    </div>
    <div className="detail-columns"><section className="glass-panel detail-main"><div className="section-kicker">ПЕРЕД СТАРТОМ</div><h2>Что нужно знать</h2><p>{assessment.kind === "Олимпиада" ? "Это олимпиадный режим: отслеживай время, переходи по карте вопросов и отправь ответы до завершения отсчёта." : "Это обычный тест для проверки знаний: отвечай последовательно и возвращайся к вопросам при необходимости."} Выбранные ответы сохраняются автоматически, а результат рассчитывается на сервере.</p><p>Поддерживаются вопросы с вариантами ответа, письменные ответы и задания на сопоставление. Разбор будет доступен после завершения попытки.</p>{!gradeAllowed && <div className="notice-message notice-error">Это задание рассчитано на {assessment.grade_min}–{assessment.grade_max} классы. В твоём профиле указан другой класс.</div>}<div className="detail-actions">{gradeAllowed ? <Link className="button button-primary button-large" href={`/take/${assessment.id}`}>Начать задание <span aria-hidden="true">↗</span></Link> : <Link className="button button-glass" href="/dashboard">В личный кабинет</Link>}</div></section>
      <aside className="glass-panel detail-facts"><div className="fact-row"><span>Предмет</span><strong>{assessment.subject}</strong></div><div className="fact-row"><span>Тип</span><strong>{assessment.kind}</strong></div><div className="fact-row"><span>Классы</span><strong>{assessment.grade_min}–{assessment.grade_max}</strong></div><div className="fact-row"><span>Время</span><strong>{assessment.duration_minutes} минут</strong></div><div className="fact-row"><span>Сложность</span><strong>{assessment.difficulty}</strong></div><div className="fact-note">{assessment.kind === "Олимпиада" ? "Олимпиадный интерфейс с таймером и навигацией по всем вопросам." : "Обычный режим тестирования с автоматическим сохранением ответов."} Баллы начисляются системой после отправки.</div></aside>
    </div>
  </div>;
}
