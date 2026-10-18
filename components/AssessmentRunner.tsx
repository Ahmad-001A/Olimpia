"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resumeAttemptAction, saveAttemptAnswersAction, startAttemptAction, submitAttemptAction } from "@/app/take/actions";
import type { QuestionAnswer, StartedAttempt } from "@/lib/types";
import { Notice } from "@/components/Notice";

function clock(seconds: number) {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
function answerIsPresent(value: QuestionAnswer | undefined) {
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value && Object.keys(value).length);
}

export function AssessmentRunner({ assessmentId, title, description, duration, kind, initialAttemptId }: {
  assessmentId: string; title: string; description: string; duration: number; kind: "Олимпиада" | "Тест"; initialAttemptId?: string;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const answersRef = useRef<Record<string, QuestionAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(-1);
  const [loading, setLoading] = useState(Boolean(initialAttemptId));
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const submittedLock = useRef(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialAttemptId) return;
    let cancelled = false;
    setLoading(true);
    resumeAttemptAction(initialAttemptId).then(result => {
      if (cancelled) return;
      if (!result.ok) { setError(result.error); setLoading(false); return; }
      setAttempt(result.attempt);
      answersRef.current = result.attempt.answers ?? {};
      setAnswers(answersRef.current);
      setLoading(false);
    }).catch(() => { if (!cancelled) { setError("Не удалось восстановить попытку."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [initialAttemptId]);

  useEffect(() => {
    if (!attempt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((new Date(attempt.ends_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  const submit = useCallback(async (automatic = false) => {
    if (!attempt || submittedLock.current) return;
    if (!automatic && !window.confirm("Отправить ответы и завершить задание? После отправки изменить их нельзя.")) return;
    submittedLock.current = true;
    setSubmitting(true);
    setError("");
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    try {
      await saveQueue.current;
      const finalAnswers = answersRef.current;
      const result = await submitAttemptAction(attempt.attempt_id, finalAnswers);
      if (!result.ok) {
        submittedLock.current = false;
        setError(result.error);
        setSubmitting(false);
        return;
      }
      router.push(`/results/${result.attemptId}`);
      router.refresh();
    } catch {
      submittedLock.current = false;
      setError("Не удалось отправить ответы. Проверь интернет и повтори попытку.");
      setSubmitting(false);
    }
  }, [attempt, router]);

  useEffect(() => {
    if (attempt && remaining === 0 && !loading && !submitting && !submittedLock.current) void submit(true);
  }, [attempt, remaining, loading, submitting, submit]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  async function start() {
    setStarting(true); setError("");
    const result = await startAttemptAction(assessmentId);
    setStarting(false);
    if (!result.ok) { setError(result.error); return; }
    submittedLock.current = false;
    setAttempt(result.attempt);
    answersRef.current = result.attempt.answers ?? {};
    setAnswers(answersRef.current);
    router.replace(`/take/${assessmentId}?attempt=${result.attempt.attempt_id}`);
  }

  function updateAnswer(questionId: string, value: QuestionAnswer | undefined) {
    if (!attempt || submitting) return;
    const nextAnswers = { ...answersRef.current };
    if (value === undefined || (typeof value === "string" && !value.trim())) delete nextAnswers[questionId];
    else nextAnswers[questionId] = value;
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setSaveError("");
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveQueue.current = saveQueue.current.then(async () => {
        const result = await saveAttemptAnswersAction(attempt.attempt_id, nextAnswers);
        if (!result.ok) setSaveError(result.error);
        else setSaveError("");
        return result;
      }).catch(() => { setSaveError("Ответ пока не подтверждён сервером. Перед отправкой попробуй ещё раз."); }).finally(() => setSaving(false));
    }, typeof value === "string" || (value && typeof value === "object") ? 450 : 180);
  }

  if (loading) return <div className="glass-panel runner-loading"><span className="loader-dot" /><p>Восстанавливаем твою попытку…</p></div>;
  if (error && !attempt) return <div className="glass-panel runner-loading"><Notice message={error} /><button className="button button-glass" type="button" onClick={() => router.push("/assessments")}>Назад к заданиям</button></div>;

  const isOlympiad = kind === "Олимпиада";
  if (!attempt) return <div className={`glass-panel take-start-card ${isOlympiad ? "take-start-olympiad" : "take-start-test"}`}>
    <div className="assessment-mode-banner"><span className="mode-mark">{isOlympiad ? "✦" : "✓"}</span><div><div className="section-kicker">{isOlympiad ? "ОЛИМПИАДНЫЙ РЕЖИМ" : "РЕЖИМ ПРАКТИКИ"}</div><h2>{title}</h2></div><span className="mode-type-pill">{kind}</span></div>
    <p>{description || (isOlympiad ? "Соберись, распределяй время и постарайся набрать максимум баллов." : "Отвечай на вопросы в своём темпе в пределах общего времени и проверь свои знания.")}</p>
    <div className="start-facts"><div><span>Время</span><strong>{duration} минут</strong></div><div><span>Сохранение</span><strong>Автоматическое</strong></div><div><span>Результат</span><strong>После отправки</strong></div></div>
    {isOlympiad && <div className="olympiad-rules"><strong>Перед стартом</strong><span>Следи за таймером, переключайся между вопросами и проверь ответы перед завершением. После отправки изменить их нельзя.</span></div>}
    <Notice message={error} /><button className="button button-primary button-large" type="button" onClick={start} disabled={starting}>{starting ? "Готовим задание…" : isOlympiad ? "Начать олимпиаду" : "Начать тест"} <span aria-hidden="true">↗</span></button><p className="small-note">Отсчёт начнётся только после старта. Сервер проверяет срок выполнения при отправке.</p>
  </div>;

  const question = attempt.questions[currentIndex];
  if (!question) return <div className="glass-panel runner-loading"><Notice message="В этом задании не найдено вопросов." /></div>;
  const answeredCount = attempt.questions.filter(q => answerIsPresent(answers[q.id])).length;
  const questionAnswer = answers[question.id];
  const matchAnswers = questionAnswer && typeof questionAnswer === "object" ? questionAnswer : {};
  return <div className={`runner-layout ${isOlympiad ? "runner-olympiad" : "runner-test"}`}>
    <section className="glass-panel runner-main"><div className="runner-mode-header"><div><span className="runner-mode-mark">{isOlympiad ? "✦" : "✓"}</span><div><strong>{isOlympiad ? "Олимпиада · режим соревнования" : "Тест · режим практики"}</strong><span>{isOlympiad ? "Работай внимательно и распределяй время" : "Ответы сохраняются автоматически"}</span></div></div><span className="runner-mode-pill">{currentIndex + 1} / {attempt.questions.length}</span></div>
      <div className="runner-top"><div><div className="section-kicker">ВОПРОС {currentIndex + 1} ИЗ {attempt.questions.length}</div><div className="runner-progress"><span style={{ width: `${((currentIndex + 1) / attempt.questions.length) * 100}%` }} /></div></div><div className={`countdown ${remaining >= 0 && remaining < 60 ? "countdown-urgent" : ""}`}><span>{isOlympiad ? "До конца олимпиады" : "Осталось"}</span><strong>{clock(remaining)}</strong></div></div>
      <h1 className="runner-question">{question.prompt}</h1>
      {question.question_type === "choice" && <div className="runner-options">{question.options.map((option, index) => <button key={index} type="button" className={`runner-option ${questionAnswer === index ? "selected" : ""}`} onClick={() => updateAnswer(question.id, index)} disabled={submitting}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span><span className="option-check">{questionAnswer === index ? "✓" : ""}</span></button>)}</div>}
      {question.question_type === "written" && <div className="written-answer-panel"><label htmlFor={`written-${question.id}`}>Твой ответ</label><textarea id={`written-${question.id}`} rows={6} maxLength={4000} value={typeof questionAnswer === "string" ? questionAnswer : ""} onChange={e => updateAnswer(question.id, e.target.value)} placeholder="Напиши ответ своими словами…" disabled={submitting} /><div className="written-answer-note">Ответ сохраняется автоматически. Проверь орфографию перед завершением.</div></div>}
      {question.question_type === "matching" && <div className="student-matching-panel"><div className="matching-instructions">Сопоставь каждый элемент слева с подходящим вариантом справа.</div>{question.match_items.map((item, index) => <div className="student-match-row" key={`${question.id}-${index}`}><div className="student-match-term"><span>{String(index + 1).padStart(2, "0")}</span>{item}</div><span className="student-match-arrow">→</span><select value={typeof matchAnswers[String(index)] === "string" ? matchAnswers[String(index)] : ""} onChange={e => { const next = { ...matchAnswers }; if (e.target.value) next[String(index)] = e.target.value; else delete next[String(index)]; updateAnswer(question.id, next); }} disabled={submitting}><option value="">Выбери соответствие…</option>{question.match_options.map(option => <option key={option} value={option}>{option}</option>)}</select></div>)}</div>}
      <Notice message={error} /><Notice message={saveError} />
      <div className="runner-footer"><button type="button" className="button button-quiet" onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0 || submitting}>← Назад</button><span className="save-state">{saving ? "Сохраняем ответ…" : saveError ? "Не сохранено" : "Ответы сохраняются автоматически"}</span>{currentIndex < attempt.questions.length - 1 ? <button type="button" className="button button-primary" onClick={() => setCurrentIndex(i => Math.min(attempt.questions.length - 1, i + 1))}>Далее →</button> : <button type="button" className="button button-primary" onClick={() => void submit(false)} disabled={submitting}>{submitting ? "Отправляем…" : "Завершить"}</button>}</div>
    </section>
    <aside className="glass-panel runner-sidebar"><div className="section-kicker">{isOlympiad ? "КАРТА ОЛИМПИАДЫ" : "НАВИГАЦИЯ"}</div><h3>{isOlympiad ? "Твой маршрут" : "Вопросы"}</h3><p>Отвечено: <strong>{answeredCount} из {attempt.questions.length}</strong></p><div className="question-number-grid">{attempt.questions.map((q, i) => <button type="button" key={q.id} onClick={() => setCurrentIndex(i)} className={`${i === currentIndex ? "current" : ""} ${answerIsPresent(answers[q.id]) ? "answered" : ""}`} aria-label={`Вопрос ${i + 1}`}>{String(i + 1).padStart(2, "0")}</button>)}</div><div className="sidebar-help"><span className="legend-dot answered-dot" /> Ответ заполнен <br /><span className="legend-dot" /> Осталось ответить</div><button type="button" className="button button-quiet button-full" onClick={() => void submit(false)} disabled={submitting}>{submitting ? "Отправляем…" : isOlympiad ? "Сдать олимпиаду" : "Завершить тест"}</button><p className="small-note">Не закрывай вкладку до отправки. При повторном открытии ответы восстанавливаются.</p></aside>
  </div>;
}
