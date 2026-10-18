import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard");
  const rows = (data ?? []) as Array<{ display_name: string; grade: number | null; total_points: number; completed_attempts: number }>;
  return <div className="section-wrap page-wrap narrow-page"><div className="page-heading"><div><div className="section-kicker">СООБЩЕСТВО</div><h1>Рейтинг участников</h1><p>Рейтинг строится только по результатам завершённых попыток реальных аккаунтов.</p></div></div>
    <section className="glass-panel leaderboard-panel">{error ? <div className="notice-message notice-error">Не удалось загрузить рейтинг. Проверь SQL-миграцию и подключение.</div> : rows.length ? <><div className="leaderboard-head"><span>Участник</span><span>Попытки</span><span>Баллы</span></div>{rows.map((row, i) => <div className="leader-row" key={`${row.display_name}-${row.grade}-${i}`}><span className="leader-place">{String(i + 1).padStart(2, "0")}</span><span className="leader-person"><span className="avatar-dot">{row.display_name.slice(0, 1).toUpperCase()}</span><span><strong>{row.display_name}</strong><small>{row.grade ? `${row.grade} класс` : "Класс не указан"}</small></span></span><span className="leader-attempts">{row.completed_attempts}</span><strong className="leader-points">{row.total_points}</strong></div>)}</> : <div className="empty-state compact-empty"><div className="empty-icon">✳</div><h3>Рейтинг появится после первых результатов</h3><p>Когда ученики завершат задания, таблица сформируется автоматически. Сейчас в ней нет вымышленных участников или баллов.</p><Link className="button button-primary" href="/assessments">Найти задание</Link></div>}</section>
  </div>;
}
