import { requireRole } from "@/lib/auth";
import { applyForTeacherAction } from "@/app/teacher-application/actions";
import { Notice } from "@/components/Notice";
import { formatDate, statusLabel } from "@/lib/utils";

const subjects = ["Математика", "Биология", "Физика", "История", "Русский язык", "Информатика", "Химия", "География", "Английский язык"];
type Params = { error?: string; message?: string };

export default async function TeacherApplicationPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, user, profile } = await requireRole(["student"]);
  const params = await searchParams;
  const { data: applications } = await supabase.from("teacher_applications").select("id,subject,experience,status,reviewer_note,created_at,reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false });
  const pending = (applications ?? []).some((a: { status: string }) => a.status === "pending");
  return <div className="section-wrap page-wrap narrow-page"><div className="page-heading"><div><div className="section-kicker">ПРИСОЕДИНИТЬСЯ К КОМАНДЕ</div><h1>Стать учителем</h1><p>Опиши свой предмет и опыт. Администратор рассмотрит заявку и назначит права после проверки.</p></div></div>
    <section className="glass-panel form-panel"><Notice message={params.error} /><Notice message={params.message} type="success" />
      {applications?.length ? <div className="application-history"><h2>История заявок</h2>{applications.map((item: { id: string; subject: string; experience: string; status: string; reviewer_note: string | null; created_at: string }) => <div className="application-item" key={item.id}><div><strong>{item.subject}</strong><p>{item.experience}</p><small>Отправлено: {formatDate(item.created_at)}</small></div><span className={`state-pill state-${item.status}`}>{statusLabel(item.status)}</span>{item.reviewer_note && <p className="review-note">Комментарий: {item.reviewer_note}</p>}</div>)}</div> : null}
      {pending ? <div className="empty-inline"><h3>Заявка уже рассматривается</h3><p>Дождись решения администратора. Повторная заявка пока недоступна.</p></div> : <form action={applyForTeacherAction} className="stack-form"><label><span>Предмет</span><select name="subject" required defaultValue=""><option value="" disabled>Выбери предмет</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label><span>Образование и опыт</span><textarea name="experience" required minLength={20} maxLength={2500} rows={6} placeholder="Расскажи, какой предмет преподаёшь, какой у тебя опыт и какие задания хочешь создавать." /></label><p className="small-note">Заявка не даёт доступ к кабинету автоматически. Роль меняется только после решения администратора в базе.</p><button className="button button-primary button-large" type="submit">Отправить заявку <span aria-hidden="true">↗</span></button></form>}
    </section></div>;
}
