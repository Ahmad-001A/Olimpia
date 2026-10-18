import Link from "next/link";
import { requireRole } from "@/lib/auth";
import type { Assessment } from "@/lib/types";
import { formatDate, statusLabel } from "@/lib/utils";
import { submitAssessmentForReviewAction, deleteAssessmentAction } from "@/app/teacher/actions";
import { Notice } from "@/components/Notice";

type Params = { error?: string; message?: string };
export default async function TeacherPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, user, profile } = await requireRole(["teacher"]);
  const params = await searchParams;
  const { data } = await supabase.from("assessments").select("*").eq("creator_id", user.id).order("created_at", { ascending: false });
  const assessments = (data ?? []) as Assessment[];
  const { count: pendingCount } = await supabase.from("assessments").select("id", { count: "exact", head: true }).eq("creator_id", user.id).eq("status", "pending");
  const { count: publishedCount } = await supabase.from("assessments").select("id", { count: "exact", head: true }).eq("creator_id", user.id).eq("status", "published");
  const { count: attemptCount } = await supabase.from("attempts").select("id", { count: "exact", head: true }).in("assessment_id", assessments.map(a => a.id).length ? assessments.map(a => a.id) : ["00000000-0000-0000-0000-000000000000"]).not("submitted_at", "is", null);
  return <div className="section-wrap page-wrap"><div className="dashboard-welcome"><div><div className="section-kicker">КАБИНЕТ УЧИТЕЛЯ</div><h1>Здравствуйте, {profile.display_name.split(" ")[0]}.</h1><p>Создавайте задания и отслеживайте реальные результаты участников.</p></div><div className="teacher-dashboard-actions"><Link href="/teacher/results" className="button button-quiet">Результаты учеников</Link><Link href="/teacher/assessments/new" className="button button-primary button-large">＋ Создать задание</Link></div></div>
    <Notice message={params.error} /><Notice message={params.message} type="success" />
    <div className="dashboard-stats"><div className="dashboard-stat"><span>Мои задания</span><strong>{assessments.length}</strong><small>Все статусы</small></div><div className="dashboard-stat"><span>Опубликовано</span><strong>{publishedCount ?? 0}</strong><small>Доступны ученикам</small></div><div className="dashboard-stat"><span>На проверке</span><strong>{pendingCount ?? 0}</strong><small>Ожидают администратора</small></div><div className="dashboard-stat"><span>Завершённые попытки</span><strong>{attemptCount ?? 0}</strong><small>По твоим заданиям</small></div></div>
    <section className="glass-panel panel-content teacher-table-panel"><div className="panel-heading"><div><div className="section-kicker">УПРАВЛЕНИЕ</div><h2>Мои задания</h2></div><span className="count-pill">{assessments.length}</span></div>
      {assessments.length ? <div className="teacher-assessment-list">{assessments.map(assessment => <article className="teacher-assessment-row" key={assessment.id}><div className="teacher-assessment-copy"><div className="eyebrow-row"><span>{assessment.subject}</span><span className={`state-pill state-${assessment.status}`}>{statusLabel(assessment.status)}</span></div><h3>{assessment.title}</h3><p>{assessment.kind} · {assessment.grade_min}–{assessment.grade_max} классы · {assessment.duration_minutes} мин</p><small>Создано {formatDate(assessment.created_at)}</small>{assessment.review_note && <p className="review-note">Комментарий администратора: {assessment.review_note}</p>}</div><div className="teacher-row-actions">{assessment.status === "draft" || assessment.status === "rejected" ? <><Link className="button button-quiet" href={`/teacher/assessments/new?edit=${assessment.id}`}>Редактировать</Link><form action={submitAssessmentForReviewAction}><input type="hidden" name="assessment_id" value={assessment.id} /><button className="button button-primary" type="submit">На проверку</button></form></> : null}{assessment.status === "published" && <Link className="button button-quiet" href={`/assessments/${assessment.id}`}>Открыть</Link>}<form action={deleteAssessmentAction}><input type="hidden" name="assessment_id" value={assessment.id} /><button className="button button-quiet" type="submit">Удалить</button></form></div></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon">✳</div><h3>У тебя пока нет заданий</h3><p>Создай первое задание, добавь вопросы и отправь его администратору на проверку.</p><Link className="button button-primary" href="/teacher/assessments/new">Создать задание</Link></div>}
    </section>
  </div>;
}
