import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { formatDate, statusLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireAccount();
  if (profile.role === "teacher") redirect("/teacher");
  if (profile.role === "admin") redirect("/admin");
  const [{ data: attempts }, { data: statsData }] = await Promise.all([
    supabase.from("attempts").select("id,assessment_id,started_at,submitted_at,state,score,max_score").eq("user_id", user.id).order("started_at", { ascending: false }).limit(15),
    supabase.rpc("get_my_dashboard_stats"),
  ]);
  const stats = (statsData ?? {}) as { completed_attempts?: number; total_points?: number; unique_assessments?: number; average_percent?: number };
  const completedCount = stats.completed_attempts ?? 0;
  const totalPoints = stats.total_points ?? 0;
  const uniqueAssessments = stats.unique_assessments ?? 0;
  const averagePercent = stats.average_percent ?? 0;
  const assessmentIds = Array.from(new Set((attempts ?? []).map((item: { assessment_id: string }) => item.assessment_id)));
  const { data: assessmentRows } = assessmentIds.length ? await supabase.from("assessments").select("id,title,subject").in("id", assessmentIds) : { data: [] as { id: string; title: string; subject: string }[] };
  const titleById = new Map((assessmentRows ?? []).map((item: { id: string; title: string; subject: string }) => [item.id, item]));
  return <div className="section-wrap page-wrap">
    <div className="dashboard-welcome"><div><div className="section-kicker">ЛИЧНЫЙ КАБИНЕТ</div><h1>Привет, {profile.display_name.split(" ")[0]}.</h1><p>Твоя учёба — твой путь. Делай следующий шаг в собственном темпе.</p></div><div className="grade-badge">{profile.grade ? `${profile.grade} класс` : "Класс не указан"}</div></div>
    <div className="dashboard-stats"><div className="dashboard-stat"><span>Завершённые попытки</span><strong>{completedCount}</strong><small>Все отправленные результаты</small></div><div className="dashboard-stat"><span>Набранные баллы</span><strong>{totalPoints}</strong><small>Сумма по всем завершённым заданиям</small></div><div className="dashboard-stat"><span>Разных заданий пройдено</span><strong>{uniqueAssessments}</strong><small>Учитывается каждое задание один раз</small></div><div className="dashboard-stat"><span>Средний результат</span><strong>{completedCount ? `${averagePercent}%` : "—"}</strong><small>{completedCount ? "По всем завершённым попыткам" : "Появится после первой попытки"}</small></div></div>
    <div className="dashboard-columns"><section className="glass-panel panel-content"><div className="panel-heading"><div><div className="section-kicker">ИСТОРИЯ</div><h2>Твои попытки</h2></div><Link className="text-link" href="/assessments">Найти задание ↗</Link></div>
      {attempts?.length ? <div className="activity-list">{attempts.map((attempt: { id: string; assessment_id: string; started_at: string; submitted_at: string | null; state: string; score: number | null; max_score: number }) => { const assessment = titleById.get(attempt.assessment_id); return <div className="activity-row" key={attempt.id}><div className="activity-symbol">{attempt.submitted_at ? "✓" : "◷"}</div><div className="activity-copy"><strong>{assessment?.title ?? "Учебное задание"}</strong><span>{assessment?.subject ?? "Предмет"} · {formatDate(attempt.started_at)}</span></div><span className="state-pill">{attempt.submitted_at ? `${attempt.score ?? 0}/${attempt.max_score}` : statusLabel(attempt.state)}</span><Link className="icon-link" href={attempt.submitted_at ? `/results/${attempt.id}` : `/take/${attempt.assessment_id}?attempt=${attempt.id}`} aria-label="Открыть попытку">↗</Link></div>; })}</div> : <div className="empty-inline"><p>Здесь появится история твоих реальных попыток.</p><Link className="button button-primary" href="/assessments">Выбрать первое задание</Link></div>}
    </section><aside className="glass-panel panel-content dashboard-side"><div className="section-kicker">ПОЛЕЗНОЕ</div><h2>Дальше — больше</h2><p>Выбирай задания для своего класса. После завершения попытки можно будет разобрать ответы и узнать результат.</p><Link className="button button-glass button-full" href="/leaderboard">Посмотреть рейтинг</Link><div className="side-divider"/><h3>Хочешь помогать другим учиться?</h3><p>Подай заявку на роль учителя. После проверки администратор откроет инструменты создания заданий.</p><Link href="/teacher-application" className="text-link">Заявка учителя ↗</Link></aside></div>
  </div>;
}
