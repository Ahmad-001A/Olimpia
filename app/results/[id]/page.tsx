import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import type { AttemptReview, QuestionAnswer } from "@/lib/types";

function chosenMatchingAnswer(answer: QuestionAnswer | null, index: number) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return "";
  return answer[String(index)] ?? "";
}

export default async function AttemptResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAccount();
  const { data, error } = await supabase.rpc("get_attempt_review", { _attempt_id: id });
  if (error || !data) notFound();
  const result = data as AttemptReview;
  const percentage = result.max_score > 0 ? Math.round(result.score / result.max_score * 100) : 0;
  const correctCount = result.questions.filter(q => q.is_correct).length;
  return <div className="section-wrap page-wrap narrow-page result-page">
    <div className={`result-summary glass-panel ${result.kind === "Олимпиада" ? "result-olympiad" : "result-test"}`}><div className="result-check">{percentage >= 60 ? "✓" : "↗"}</div><div className="section-kicker">{result.kind === "Олимпиада" ? "ИТОГ ОЛИМПИАДЫ" : "РЕЗУЛЬТАТ ТЕСТА"}</div><h1>{result.assessment_title}</h1><p>{result.state === "timed_out" ? "Время на выполнение закончилось. Система проверила сохранённые ответы." : "Попытка завершена. Ниже можно посмотреть результат и разбор каждого типа вопроса."}</p><div className="score-ring" style={{ "--score-angle": `${percentage * 3.6}deg` } as CSSProperties}><div><strong>{percentage}%</strong><span>результат</span></div></div><div className="result-score-line"><strong>{result.score} из {result.max_score} баллов</strong><span>{correctCount} из {result.questions.length} вопросов выполнено полностью верно</span></div><Link className="button button-primary button-large" href="/assessments">Выбрать следующее задание <span aria-hidden="true">↗</span></Link></div>
    <section className="glass-panel result-review"><div className="panel-heading"><div><div className="section-kicker">РАЗБОР</div><h2>Ответы по порядку</h2></div><span className="count-pill">{result.questions.length}</span></div>{result.questions.map((q, i) => {
      const correct = q.is_correct;
      const answerText = typeof q.chosen_answer === "string" ? q.chosen_answer : "";
      return <article className="review-question" key={q.id}><div className="review-question-head"><span className="question-index">{String(i + 1).padStart(2,"0")}</span><span className={`review-state ${correct ? "review-correct" : "review-wrong"}`}>{correct ? "Верно" : "Есть ошибки или ответ не полный"} · {q.earned_points}/{q.points} балл.</span></div><h3>{q.prompt}</h3>
        {q.question_type === "choice" && <div className="review-options">{q.options.map((option, oi) => <div key={oi} className={`review-option ${oi === q.correct_index ? "correct-answer" : ""} ${q.chosen_index === oi && oi !== q.correct_index ? "wrong-answer" : ""}`}><span className="option-letter">{String.fromCharCode(65+oi)}</span><span>{option}</span><span>{oi === q.correct_index ? "✓" : q.chosen_index === oi ? "×" : ""}</span></div>)}</div>}
        {q.question_type === "written" && <div className="written-review-grid"><div><span>Твой ответ</span><p>{answerText || "Ответ не указан"}</p></div><div className="written-correct-answer"><span>Эталонный ответ</span><p>{q.correct_text}</p></div></div>}
        {q.question_type === "matching" && <div className="matching-review-list">{q.match_pairs.map((pair, pi) => { const selected = chosenMatchingAnswer(q.chosen_answer, pi); const pairCorrect = selected === pair.right; return <div className="matching-review-row" key={`${q.id}-${pi}`}><span className="matching-review-term">{pair.left}</span><span className="matching-review-arrow">→</span><span className={`matching-review-chosen ${pairCorrect ? "matched" : "not-matched"}`}>{selected || "Не выбрано"}</span>{!pairCorrect && <span className="matching-review-expected">Правильно: {pair.right}</span>}</div>; })}</div>}
        {q.explanation && <p className="explanation-text"><strong>Объяснение:</strong> {q.explanation}</p>}
      </article>;
    })}</section>
  </div>;
}
