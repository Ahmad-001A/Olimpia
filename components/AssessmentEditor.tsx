"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAssessmentAction } from "@/app/teacher/actions";
import { Notice } from "@/components/Notice";

type QuestionType = "choice" | "written" | "matching";
type MatchPair = { left: string; right: string };
type DraftQuestion = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  correctText: string;
  pairs: MatchPair[];
  explanation: string;
  points: number;
};
const subjects = ["Математика", "Биология", "Физика", "История", "Русский язык", "Информатика", "Химия", "География", "Английский язык"];
const makeQuestion = (): DraftQuestion => ({ type: "choice", prompt: "", options: ["", "", "", ""], correctIndex: 0, correctText: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }], explanation: "", points: 1 });

type ExistingAssessment = {
  id: string; title: string; description: string; subject: string; kind: string;
  grade_min: number; grade_max: number; duration_minutes: number; difficulty: string;
};
type ExistingQuestion = {
  prompt: string; options: string[]; correct_index: number | null; explanation: string; points: number;
  question_type?: QuestionType | null; correct_text?: string | null; match_pairs?: MatchPair[] | null;
};

function normalizeType(value: unknown): QuestionType {
  const type = String(value ?? "choice").trim().toLowerCase();
  if (["written", "text", "open", "письменный", "письменный ответ", "текстовый"].includes(type)) return "written";
  if (["matching", "match", "сопоставление", "сопоставить", "пары"].includes(type)) return "matching";
  return "choice";
}
function normalizeQuestion(raw: Record<string, unknown>): DraftQuestion {
  const type = normalizeType(raw.type ?? raw.question_type ?? raw.kind);
  const rawOptions = Array.isArray(raw.options) ? raw.options.map(String) : typeof raw.options === "string" ? raw.options.split("|").map(s => s.trim()).filter(Boolean) : [];
  const rawPairs = Array.isArray(raw.pairs) ? raw.pairs : Array.isArray(raw.match_pairs) ? raw.match_pairs : [];
  const pairs = rawPairs.map((item) => {
    if (Array.isArray(item)) return { left: String(item[0] ?? ""), right: String(item[1] ?? "") };
    const pair = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return { left: String(pair.left ?? pair.term ?? ""), right: String(pair.right ?? pair.definition ?? "") };
  });
  const correctRaw = raw.correctIndex ?? raw.correct_index ?? raw.correct ?? raw.correctAnswer ?? raw.correct_answer;
  let correctIndex: number | null = Number.isInteger(Number(correctRaw)) && String(correctRaw).trim() !== "" ? Number(correctRaw) : null;
  if (type === "choice" && typeof correctRaw === "string" && !/^\d+$/.test(correctRaw.trim())) {
    const letter = correctRaw.trim().toUpperCase();
    const byLetter = /^[A-H]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1;
    const byText = rawOptions.findIndex(option => option.trim().toLowerCase() === letter.toLowerCase());
    correctIndex = byLetter >= 0 && byLetter < rawOptions.length ? byLetter : byText >= 0 ? byText : null;
  }
  if (type === "choice" && (correctIndex === null || correctIndex < 0 || correctIndex >= rawOptions.length) && typeof correctRaw === "string") {
    const found = rawOptions.findIndex(option => option.trim().toLowerCase() === correctRaw.trim().toLowerCase());
    if (found >= 0) correctIndex = found;
  }
  const options = type === "choice" ? (rawOptions.length >= 2 ? rawOptions.slice(0, 8) : ["", "", "", ""]) : [];
  return {
    type,
    prompt: String(raw.prompt ?? raw.question ?? raw.text ?? ""),
    options,
    correctIndex: type === "choice" ? (correctIndex ?? 0) : null,
    correctText: String(raw.correctText ?? raw.correct_text ?? raw.answer ?? (type === "written" && typeof correctRaw === "string" ? correctRaw : "")),
    pairs: type === "matching" ? (pairs.length >= 2 ? pairs.slice(0, 10) : [{ left: "", right: "" }, { left: "", right: "" }]) : [],
    explanation: String(raw.explanation ?? ""),
    points: Math.min(100, Math.max(1, Number(raw.points) || 1)),
  };
}
function parseCsv(text: string): DraftQuestion[] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
    const row: string[] = []; let value = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { row.push(value.trim()); value = ""; }
      else value += char;
    }
    row.push(value.trim()); rows.push(row);
  }
  if (!rows.length) return [];
  const headerNames = rows[0].map(v => v.toLowerCase().trim());
  const hasHeader = headerNames.some(v => ["prompt", "question", "вопрос", "type", "тип"].includes(v));
  const contentRows = hasHeader ? rows.slice(1) : rows;
  const get = (row: string[], ...names: string[]) => {
    if (!hasHeader) return "";
    for (const name of names) { const i = headerNames.indexOf(name); if (i >= 0) return row[i] ?? ""; }
    return "";
  };
  return contentRows.filter(row => row.some(c => c.trim())).map(row => {
    if (!hasHeader) {
      return normalizeQuestion({ type: row[0] || "choice", prompt: row[1] || "", options: (row[2] || "").split("|").map(s => s.trim()).filter(Boolean), correctAnswer: row[3] || "", points: row[4] || 1, explanation: row[5] || "" });
    }
    const type = normalizeType(get(row, "type", "тип") || "choice");
    const options = [get(row, "option1", "вариант1", "вариант 1"), get(row, "option2", "вариант2", "вариант 2"), get(row, "option3", "вариант3", "вариант 3"), get(row, "option4", "вариант4", "вариант 4")].filter(Boolean);
    const customOptions = get(row, "options", "варианты");
    if (customOptions) options.splice(0, options.length, ...customOptions.split("|").map(s => s.trim()).filter(Boolean));
    const pairText = get(row, "pairs", "пары");
    const pairs = pairText.split("|").filter(Boolean).map(pair => {
      const split = pair.includes("=>") ? pair.split("=>") : pair.includes("->") ? pair.split("->") : pair.includes("→") ? pair.split("→") : pair.split("—");
      return { left: (split[0] ?? "").trim(), right: (split.slice(1).join("—") ?? "").trim() };
    });
    return normalizeQuestion({ type, prompt: get(row, "prompt", "question", "вопрос"), options, correctAnswer: get(row, "correctanswer", "correct_answer", "correct", "правильный ответ", "ответ"), points: get(row, "points", "баллы") || 1, explanation: get(row, "explanation", "объяснение"), pairs });
  });
}
function parseText(text: string): DraftQuestion[] {
  const blocks = text.trim().split(/\n\s*\n+/).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const fields: Record<string, string> = {}; const options: string[] = []; const pairs: MatchPair[] = [];
    let prompt = ""; let explanation = ""; let correct = ""; let type: QuestionType = "choice"; let points = 1;
    for (const line of lines) {
      const pair = line.match(/^(?:Пара|Pair)\s*:\s*(.+?)\s*(?:—|->|=>)\s*(.+)$/i);
      if (pair) { pairs.push({ left: pair[1].trim(), right: pair[2].trim() }); continue; }
      const option = line.match(/^(?:[A-HА-Н][.)]|Вариант\s*\d+[.:])\s*(.+)$/i);
      if (option) { options.push(option[1].trim()); continue; }
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) { if (!prompt) prompt = line; else prompt += ` ${line}`; continue; }
      const key = match[1].trim().toLowerCase(); const value = match[2].trim(); fields[key] = value;
      if (["тип", "type"].includes(key)) type = normalizeType(value);
      else if (["вопрос", "question", "задание"].includes(key)) prompt = value;
      else if (["правильный", "правильный ответ", "ответ", "correct", "correct answer", "answer"].includes(key)) correct = value;
      else if (["объяснение", "explanation"].includes(key)) explanation = value;
      else if (["баллы", "points"].includes(key)) points = Number(value) || 1;
      else if (/^вариант\s*[a-hа-н\d]+$/i.test(key)) options.push(value);
      else if (["пары", "pairs"].includes(key)) value.split("|").forEach(v => { const split = v.includes("=>") ? v.split("=>") : v.split("—"); if (split.length > 1) pairs.push({ left: split[0].trim(), right: split.slice(1).join("—").trim() }); });
    }
    if (!prompt) prompt = fields.question ?? fields["вопрос"] ?? "";
    return normalizeQuestion({ type, prompt, options, correctAnswer: correct, answer: type === "written" ? correct : "", points, explanation, pairs });
  });
}
async function parseQuestionFile(file: File): Promise<DraftQuestion[]> {
  const text = await file.text();
  const extension = file.name.toLowerCase().split(".").pop();
  let parsed: DraftQuestion[];
  if (extension === "json") {
    const raw = JSON.parse(text) as unknown;
    const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions) ? (raw as { questions: unknown[] }).questions : null;
    if (!rows) throw new Error("JSON должен содержать массив вопросов или поле questions.");
    parsed = rows.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object").map(normalizeQuestion);
  } else if (extension === "csv") parsed = parseCsv(text);
  else if (extension === "txt" || extension === "md") parsed = parseText(text);
  else throw new Error("Пока поддерживаются файлы .txt, .csv и .json.");
  if (!parsed.length) throw new Error("В файле не удалось найти вопросы. Проверь формат примера ниже.");
  if (parsed.length > 200) throw new Error("В одном файле можно импортировать не больше 200 вопросов.");
  return parsed;
}

export function AssessmentEditor({ initialAssessment, initialQuestions }: { initialAssessment?: ExistingAssessment; initialQuestions?: ExistingQuestion[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assessmentKind, setAssessmentKind] = useState(initialAssessment?.kind ?? "Олимпиада");
  const [questions, setQuestions] = useState<DraftQuestion[]>(initialQuestions?.length ? initialQuestions.map(q => ({
    type: normalizeType(q.question_type), prompt: q.prompt, options: q.question_type === "written" || q.question_type === "matching" ? [] : (q.options ?? ["", "", "", ""]),
    correctIndex: q.correct_index ?? 0, correctText: q.correct_text ?? "", pairs: q.match_pairs ?? [{ left: "", right: "" }, { left: "", right: "" }],
    explanation: q.explanation, points: q.points,
  })) : [makeQuestion()]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [importing, setImporting] = useState(false);

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q;
      const next = { ...q, ...patch };
      if (patch.type === "choice" && next.options.length < 2) next.options = ["", "", "", ""];
      if (patch.type === "written") { next.options = []; next.correctIndex = null; next.pairs = []; }
      if (patch.type === "matching") { next.options = []; next.correctIndex = null; if (next.pairs.length < 2) next.pairs = [{ left: "", right: "" }, { left: "", right: "" }]; }
      if (patch.type === "choice") { next.correctText = ""; next.pairs = []; next.correctIndex = next.correctIndex ?? 0; }
      return next;
    }));
  }
  function updateOption(qIndex: number, optionIndex: number, value: string) {
    setQuestions(prev => prev.map((q, i) => i === qIndex ? { ...q, options: q.options.map((o, j) => j === optionIndex ? value : o) } : q));
  }
  function updatePair(qIndex: number, pairIndex: number, field: keyof MatchPair, value: string) {
    setQuestions(prev => prev.map((q, i) => i === qIndex ? { ...q, pairs: q.pairs.map((pair, j) => j === pairIndex ? { ...pair, [field]: value } : pair) } : q));
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImporting(true); setError(""); setSavedMessage("");
    try {
      const imported = await parseQuestionFile(file);
      const currentHasContent = questions.some(q => q.prompt.trim() || q.options.some(o => o.trim()) || q.correctText.trim() || q.pairs.some(p => p.left.trim() || p.right.trim()));
      const baseCount = currentHasContent ? questions.length : 0;
      if (baseCount + imported.length > 200) throw new Error("После импорта будет больше 200 вопросов. Удали лишние или загрузи файл меньшего размера.");
      setQuestions(prev => [...(currentHasContent ? prev : []), ...imported]);
      setSavedMessage(`Импортировано вопросов: ${imported.length}. Проверь правильные ответы перед сохранением.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать файл.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  async function onSubmit(formData: FormData) {
    setError(""); setSavedMessage("");
    const invalidIndex = questions.findIndex(q => {
      if (q.prompt.trim().length < 3) return true;
      if (q.type === "choice") return q.options.length < 2 || q.options.length > 8 || q.options.some(o => !o.trim()) || q.correctIndex === null || q.correctIndex < 0 || q.correctIndex >= q.options.length;
      if (q.type === "written") return !q.correctText.trim();
      const rightValues = q.pairs.map(p => p.right.trim());
      return q.pairs.length < 2 || q.pairs.length > 10 || q.pairs.some(p => !p.left.trim() || !p.right.trim()) || new Set(rightValues.map(value => value.toLocaleLowerCase("ru-RU"))).size !== rightValues.length;
    });
    if (!questions.length) { setError("Добавь или импортируй хотя бы один вопрос."); return; }
    if (invalidIndex >= 0) { setError(`Проверь вопрос №${invalidIndex + 1}: заполни обязательные поля, правильный ответ и пары без повторений.`); return; }
    setPending(true);
    formData.set("questions", JSON.stringify(questions.map(q => ({
      type: q.type, prompt: q.prompt.trim(), options: q.type === "choice" ? q.options.map(o => o.trim()) : [],
      correctIndex: q.type === "choice" ? q.correctIndex : null, correctText: q.type === "written" ? q.correctText.trim() : "",
      pairs: q.type === "matching" ? q.pairs.map(p => ({ left: p.left.trim(), right: p.right.trim() })) : [],
      explanation: q.explanation.trim(), points: q.points,
    }))));
    const result = await saveAssessmentAction(formData);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    setSavedMessage("Задание сохранено как черновик. Теперь отправь его на проверку из кабинета учителя.");
    router.push("/teacher?message=" + encodeURIComponent("Черновик сохранён. Теперь отправь его на проверку."));
    router.refresh();
  }

  return <form action={onSubmit} className="editor-form">
    <section className="glass-panel editor-section"><div className="panel-heading"><div><div className="section-kicker">ШАГ 01</div><h2>Основная информация</h2></div><span className="step-badge">01 / 02</span></div>
      {initialAssessment && <input type="hidden" name="assessment_id" value={initialAssessment.id} />}
      <div className="form-grid-two"><label><span>Название задания</span><input name="title" minLength={3} maxLength={140} defaultValue={initialAssessment?.title ?? ""} placeholder="Например, Логика и закономерности" required /></label><label><span>Предмет</span><select name="subject" required defaultValue={initialAssessment?.subject ?? "Математика"}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label></div>
      <label><span>Описание</span><textarea name="description" rows={3} maxLength={4000} defaultValue={initialAssessment?.description ?? ""} placeholder="Какие темы затрагивает задание и что ученик сможет проверить?" /></label>
      <div className="form-grid-four"><label><span>Формат</span><select name="kind" value={assessmentKind} onChange={e => setAssessmentKind(e.target.value)}><option>Олимпиада</option><option>Тест</option></select></label><label><span>Сложность</span><select name="difficulty" defaultValue={initialAssessment?.difficulty ?? "Средняя"}><option>Лёгкая</option><option>Средняя</option><option>Сложная</option></select></label><label><span>От класса</span><select name="grade_min" defaultValue={String(initialAssessment?.grade_min ?? 5)}>{Array.from({ length: 11 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><label><span>До класса</span><select name="grade_max" defaultValue={String(initialAssessment?.grade_max ?? 8)}>{Array.from({ length: 11 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label></div>
      <label className="duration-input"><span>Время на прохождение (минуты)</span><input name="duration_minutes" type="number" min={1} max={300} defaultValue={initialAssessment?.duration_minutes ?? 30} required /></label>
      <div className={`assessment-mode-note ${assessmentKind === "Тест" ? "mode-test" : "mode-olympiad"}`}><strong>{assessmentKind === "Тест" ? "Обычный тест" : "Олимпиадный формат"}</strong><span>{assessmentKind === "Тест" ? "Простой интерфейс прохождения и проверка знаний без дополнительной соревновательной подачи." : "Отдельное оформление, таймер, навигация по всем вопросам и визуальный акцент на соревновании."}</span></div>
    </section>

    <section className="glass-panel editor-section"><div className="panel-heading"><div><div className="section-kicker">ШАГ 02</div><h2>Вопросы и ответы</h2><p>Выбирай тип вопроса для каждого задания. Ответы и ключи хранятся в базе; ученик не получит их до завершения попытки.</p></div><span className="step-badge">{questions.length} {questions.length === 1 ? "вопрос" : "вопросов"}</span></div>
      <div className="question-import-panel"><div className="import-copy"><strong>Загрузить вопросы из файла</strong><span>Поддерживаются TXT, CSV и JSON. Вопросы добавятся к текущему списку; перед сохранением их можно проверить и изменить.</span></div><input ref={fileInputRef} type="file" accept=".txt,.csv,.json,.md,text/plain,text/csv,application/json" className="file-input-hidden" aria-label="Файл с вопросами" onChange={e => void importFile(e.target.files?.[0])} /><button type="button" className="button button-glass" disabled={importing} onClick={() => fileInputRef.current?.click()}>{importing ? "Читаем файл…" : "↑ Выбрать файл"}</button><div className="import-template-links"><a className="import-template-link" href="/question-import-template.json" download>JSON-шаблон</a><a className="import-template-link" href="/question-import-template.txt" download>TXT-шаблон</a></div><details className="import-help"><summary>Как оформить TXT / CSV</summary><pre>{`TXT: каждый вопрос отделяй пустой строкой
Тип: выбор
Вопрос: Сколько будет 2 + 2?
A) 3
B) 4
C) 5
D) 6
Правильный: B
Баллы: 1

Тип: письменный
Вопрос: Назови столицу Таджикистана.
Ответ: Душанбе
Баллы: 2

Тип: сопоставление
Вопрос: Сопоставь термин и определение.
Пара: Митоз — Деление клетки
Пара: Фотосинтез — Образование органических веществ`}</pre><p>В CSV используй заголовки: type,prompt,option1,option2,option3,option4,correctAnswer,points,explanation. Для сопоставления столбец pairs заполняй как «термин → определение | термин → определение».</p></details></div>
      <div className="question-editor-list">{questions.map((q, qi) => <article className="question-editor" key={qi}><div className="question-editor-title"><span className="question-index">{String(qi + 1).padStart(2, "0")}</span><strong>Вопрос {qi + 1}</strong><label className="question-type-control"><span>Тип ответа</span><select value={q.type} onChange={e => updateQuestion(qi, { type: e.target.value as QuestionType })}><option value="choice">Вариантный ответ</option><option value="written">Письменный ответ</option><option value="matching">Сопоставление</option></select></label>{questions.length > 1 && <button type="button" className="button button-plain button-small danger-text" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}>Удалить</button>}</div>
        <label><span>Текст вопроса</span><textarea rows={3} maxLength={4000} required value={q.prompt} onChange={e => updateQuestion(qi, { prompt: e.target.value })} placeholder="Напиши вопрос понятным языком" /></label>
        {q.type === "choice" && <><div className="option-editor-grid">{q.options.map((option, oi) => <label className="option-editor" key={oi}><span className="option-letter">{String.fromCharCode(65 + oi)}</span><input value={option} maxLength={500} required onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`Вариант ${oi + 1}`} /><button type="button" className="remove-option" disabled={q.options.length <= 2} aria-label={`Удалить вариант ${oi + 1}`} onClick={() => updateQuestion(qi, { options: q.options.filter((_, i) => i !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex !== null && q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}>×</button></label>)}</div><div className="question-option-actions"><button type="button" className="button button-quiet button-small" disabled={q.options.length >= 8} onClick={() => updateQuestion(qi, { options: [...q.options, ""] })}>＋ Добавить вариант</button><label><span>Правильный ответ</span><select value={q.correctIndex ?? 0} onChange={e => updateQuestion(qi, { correctIndex: Number(e.target.value) })}>{q.options.map((_, oi) => <option key={oi} value={oi}>Вариант {String.fromCharCode(65 + oi)}</option>)}</select></label></div></>}
        {q.type === "written" && <div className="question-type-box"><label><span>Правильный ответ для автоматической проверки</span><textarea rows={2} maxLength={4000} required value={q.correctText} onChange={e => updateQuestion(qi, { correctText: e.target.value })} placeholder="Введи эталонный ответ" /></label><p>Система сравнит текст ученика с эталоном без учёта регистра и лишних пробелов.</p></div>}
        {q.type === "matching" && <div className="question-type-box"><div className="matching-editor-head"><strong>Пары для сопоставления</strong><span>Ученик увидит левый список и варианты справа в перемешанном порядке.</span></div><div className="matching-editor-list">{q.pairs.map((pair, pi) => <div className="matching-editor-row" key={pi}><span className="match-index">{String(pi + 1).padStart(2, "0")}</span><label><span>Элемент</span><input required maxLength={500} value={pair.left} onChange={e => updatePair(qi, pi, "left", e.target.value)} placeholder="Например, Митоз" /></label><span className="matching-link-mark">↔</span><label><span>Соответствие</span><input required maxLength={500} value={pair.right} onChange={e => updatePair(qi, pi, "right", e.target.value)} placeholder="Например, Деление клетки" /></label>{q.pairs.length > 2 && <button type="button" className="remove-option" aria-label="Удалить пару" onClick={() => updateQuestion(qi, { pairs: q.pairs.filter((_, i) => i !== pi) })}>×</button>}</div>)}</div><button type="button" className="button button-quiet button-small" disabled={q.pairs.length >= 10} onClick={() => updateQuestion(qi, { pairs: [...q.pairs, { left: "", right: "" }] })}>＋ Добавить пару</button><p>Для точной проверки значения справа должны отличаться друг от друга.</p></div>}
        <div className="question-controls"><label><span>Баллы за вопрос</span><input type="number" value={q.points} min={1} max={100} required onChange={e => updateQuestion(qi, { points: Number(e.target.value) || 1 })} /></label><label><span>Объяснение (необязательно)</span><input maxLength={4000} value={q.explanation} onChange={e => updateQuestion(qi, { explanation: e.target.value })} placeholder="Краткий разбор ответа" /></label></div>
      </article>)}</div>
      <button type="button" className="button button-glass add-question" onClick={() => { if (questions.length >= 200) { setError("Максимум 200 вопросов в одном задании."); return; } setQuestions(prev => [...prev, makeQuestion()]); setError(""); }}>＋ Добавить вопрос</button>
    </section>
    <Notice message={error} />{savedMessage && <Notice message={savedMessage} type="success" />}
    <div className="editor-bottom"><p>При сохранении создаётся черновик. Ученик не увидит его, пока администратор не опубликует задание.</p><button className="button button-primary button-large" type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить черновик"} <span aria-hidden="true">↗</span></button></div>
  </form>;
}
