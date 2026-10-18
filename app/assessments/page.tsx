import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssessmentCard } from "@/components/AssessmentCard";
import type { Assessment } from "@/lib/types";

const subjects = ["Математика", "Биология", "Физика", "История", "Русский язык", "Информатика", "Химия", "География", "Английский язык"];

type Search = { q?: string; subject?: string; kind?: string; grade?: string; difficulty?: string };

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("assessments").select("*").eq("status", "published").order("published_at", { ascending: false });
  const q = (params.q ?? "").trim();
  if (params.subject && subjects.includes(params.subject)) query = query.eq("subject", params.subject);
  if (params.kind === "Олимпиада" || params.kind === "Тест") query = query.eq("kind", params.kind);
  if (params.difficulty && ["Лёгкая", "Средняя", "Сложная"].includes(params.difficulty)) query = query.eq("difficulty", params.difficulty);
  if (params.grade && /^([1-9]|1[01])$/.test(params.grade)) query = query.lte("grade_min", Number(params.grade)).gte("grade_max", Number(params.grade));
  const { data, error } = await query.limit(100);
  const assessments = ((data ?? []) as Assessment[]).filter((assessment) =>
    !q || assessment.title.toLocaleLowerCase("ru-RU").includes(q.toLocaleLowerCase("ru-RU")) ||
    assessment.description.toLocaleLowerCase("ru-RU").includes(q.toLocaleLowerCase("ru-RU"))
  ).slice(0, 100);
  return <div className="page-wrap section-wrap">
    <div className="page-heading"><div><div className="section-kicker">КАТАЛОГ</div><h1>Задания и олимпиады</h1><p>Выбери предмет, класс и формат. Здесь отображаются только опубликованные материалы.</p></div><span className="count-pill">{assessments.length} {assessments.length === 1 ? "задание" : "заданий"}</span></div>
    <form className="filter-form glass-panel" method="get">
      <label className="search-field"><span aria-hidden="true">⌕</span><input name="q" defaultValue={q} placeholder="Поиск по названию или описанию" /></label>
      <label><span className="field-label">Предмет</span><select name="subject" defaultValue={params.subject ?? ""}><option value="">Все предметы</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>
      <label><span className="field-label">Формат</span><select name="kind" defaultValue={params.kind ?? ""}><option value="">Все форматы</option><option>Олимпиада</option><option>Тест</option></select></label>
      <label><span className="field-label">Класс</span><select name="grade" defaultValue={params.grade ?? ""}><option value="">Все классы</option>{Array.from({ length: 11 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} класс</option>)}</select></label>
      <label><span className="field-label">Сложность</span><select name="difficulty" defaultValue={params.difficulty ?? ""}><option value="">Любая</option><option>Лёгкая</option><option>Средняя</option><option>Сложная</option></select></label>
      <div className="filter-buttons"><button type="submit" className="button button-primary">Применить</button><Link href="/assessments" className="button button-plain">Сбросить</Link></div>
    </form>
    {error ? <div className="notice-message notice-error">Не удалось загрузить каталог. Проверь подключение к Supabase.</div> : assessments.length ? <div className="assessment-grid">{assessments.map(assessment => <AssessmentCard key={assessment.id} assessment={assessment} />)}</div> : <div className="empty-state"><div className="empty-icon">⌕</div><h3>{q || params.subject || params.kind || params.grade ? "По этим фильтрам ничего не найдено" : "Каталог пока пуст"}</h3><p>{q || params.subject || params.kind || params.grade ? "Попробуй изменить параметры поиска." : "Опубликованные задания появятся здесь после создания учителем и проверки администратором."}</p><Link className="button button-glass" href="/assessments">Показать все задания</Link></div>}
  </div>;
}
