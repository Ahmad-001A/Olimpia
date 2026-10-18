import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default async function TeacherResultsPage() {
  const { supabase, user } = await requireRole(["teacher"]);
  const { data: assessments } = await supabase.from("assessments").select("id,title,subject").eq("creator_id", user.id);
  const rows = assessments ?? [];
  const ids = rows.map((a: { id: string }) => a.id);
  const { data: attempts, error } = ids.length
    ? await supabase.from("attempts").select("id,assessment_id,user_id,started_at,submitted_at,state,score,max_score").in("assessment_id", ids).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(200)
    : { data: [], error: null };
  const titleById = new Map(rows.map((a: { id: string; title: string; subject: string }) => [a.id, a]));
  const userIds = Array.from(new Set((attempts ?? []).map((a: { user_id: string }) => a.user_id)));
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id,display_name,grade").in("id", userIds) : { data: [] as { id: string; display_name: string; grade: number | null }[] };
  const profileById = new Map((profiles ?? []).map((p: { id: string; display_name: string; grade: number | null }) => [p.id, p]));
  return <div className="section-wrap page-wrap"><div className="page-heading"><div><Link className="back-link" href="/teacher">← Кабинет учителя</Link><div className="section-kicker">АНАЛИТИКА</div><h1>Результаты учеников</h1><p>Только завершённые попытки по твоим заданиям. Правильные ответы видны после сдачи.</p></div></div>
    <section className="glass-panel panel-content">{error ? <div className="notice-message notice-error">Не удалось загрузить результаты: {error.message}</div> : attempts?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Ученик</th><th>Задание</th><th>Результат</th><th>Дата</th><th></th></tr></thead><tbody>{attempts.map((a: { id: string; assessment_id: string; user_id: string; submitted_at: string; score: number | null; max_score: number }) => { const assessment = titleById.get(a.assessment_id); const profile = profileById.get(a.user_id); return <tr key={a.id}><td><strong>{profile?.display_name ?? "Пользователь"}</strong><small className="table-sub">{profile?.grade ? `${profile.grade} класс` : "Класс не указан"}</small></td><td><strong>{assessment?.title ?? "Задание"}</strong><small className="table-sub">{assessment?.subject ?? ""}</small></td><td><strong>{a.score ?? 0} / {a.max_score}</strong></td><td>{formatDate(a.submitted_at)}</td><td><Link className="text-link" href={`/results/${a.id}`}>Разбор ↗</Link></td></tr>; })}</tbody></table></div> : <div className="empty-inline"><h3>Результатов пока нет</h3><p>Когда ученики завершат опубликованные задания, их результаты появятся в этой таблице.</p><Link className="button button-glass" href="/teacher">Назад в кабинет</Link></div>}</section>
  </div>;
}
