import Link from "next/link";
import type { Assessment } from "@/lib/types";

const subjectClass: Record<string, string> = {
  "Математика": "subject-math", "Биология": "subject-bio", "Физика": "subject-physics",
  "История": "subject-history", "Русский язык": "subject-language", "Информатика": "subject-code",
  "Химия": "subject-chemistry", "География": "subject-geography", "Английский язык": "subject-english",
};

export function AssessmentCard({ assessment }: { assessment: Assessment }) {
  return (
    <article className="assessment-card">
      <div className={`assessment-art ${subjectClass[assessment.subject] ?? "subject-math"}`} aria-hidden="true">
        <span className="art-label">{assessment.kind}</span>
        <svg viewBox="0 0 240 120" className="subject-art-svg" role="presentation">
          {assessment.subject === "Математика" ? <><path d="M46 84 91 20l44 64Z" fill="#f9fbf6" stroke="#63836a" strokeWidth="2"/><path d="M91 20v64M46 84l89 0" stroke="#63836a" strokeWidth="1.7"/><text x="72" y="72" fontSize="17" fill="#315c46">x²</text><path d="M154 34h42M175 13v42M158 69h38" stroke="#d1aa65" strokeWidth="4" strokeLinecap="round"/></> : null}
          {assessment.subject === "Биология" ? <><path d="M115 100C114 70 124 43 146 18M139 65C159 40 185 37 203 45M126 49C106 31 85 35 77 49" fill="none" stroke="#508761" strokeWidth="4" strokeLinecap="round"/><path d="M139 46C137 24 157 9 178 17 172 36 157 47 139 46ZM151 65C172 44 194 43 208 50 193 68 172 73 151 65ZM124 48C103 52 85 43 82 29 101 27 119 33 124 48Z" fill="#9ac49a" stroke="#548765" strokeWidth="1.5"/><circle cx="62" cy="80" r="17" fill="#d3e9d4" stroke="#73a27a" strokeWidth="2"/><circle cx="62" cy="80" r="6" fill="#77a781"/></> : null}
          {assessment.subject === "Физика" ? <><path d="M44 36h150M62 36v50M97 36v55M132 36v55M167 36v50" stroke="#849b9e" strokeWidth="2"/><path d="M62 86 97 92 132 92 167 86" fill="none" stroke="#849b9e" strokeWidth="2"/><circle cx="62" cy="95" r="11" fill="#82a4ae"/><circle cx="97" cy="101" r="11" fill="#d1d9d7"/><circle cx="132" cy="101" r="11" fill="#d1d9d7"/><circle cx="167" cy="95" r="11" fill="#e8bd7c"/></> : null}
          {assessment.subject === "История" ? <><path d="M49 48 120 15l71 33v9H49Z" fill="#d2b08e"/><path d="M58 57h124v9H58zM64 66h18v36H64zM91 66h18v36H91zM118 66h18v36h-18zM145 66h18v36h-18zM53 103h142v10H53z" fill="#b18b6c"/><path d="M40 114h160" stroke="#8d725e" strokeWidth="3"/></> : null}
          {assessment.subject === "Русский язык" ? <><path d="M44 24 133 13l14 83-90 12Z" fill="#fffdf5" stroke="#bb9698" strokeWidth="2"/><path d="M133 13 199 31l-5 78-61-13Z" fill="#f7f1e8" stroke="#bb9698" strokeWidth="2"/><path d="M61 43 119 35M63 57l60-8M66 72l60-8M68 86l61-8M149 42l34 9M147 56l34 9M146 70l34 9" stroke="#d5b7b9" strokeWidth="2" strokeLinecap="round"/><path d="M172 22 183 18l18 69-11 4Z" fill="#c18c70"/></> : null}
          {assessment.subject === "Информатика" ? <><path d="M43 29 170 15l34 61L77 90Z" fill="#2f5260"/><path d="M55 32 165 20l27 46L82 79Z" fill="#eff6f3"/><path d="M43 29 77 90 204 76l-8 13L70 104Z" fill="#b3c8cf"/><path d="M73 41l28-3M73 49l42-5M76 58l24-3M80 67l48-5" stroke="#618c7a" strokeWidth="3" strokeLinecap="round"/><path d="M176 81l16-9 16 9-16 9Z" fill="#e1b977"/><path d="M176 81l16 9v17l-16-9z" fill="#b98c4e"/><path d="M192 90l16-9v17l-16 9z" fill="#966d38"/></> : null}
          {!(["Математика","Биология","Физика","История","Русский язык","Информатика"].includes(assessment.subject)) ? <><rect x="61" y="28" width="116" height="70" rx="12" fill="#fffefa" stroke="#b9c7b5" strokeWidth="2"/><path d="M82 50h73M82 64h57M82 78h64" stroke="#87a78b" strokeWidth="4" strokeLinecap="round"/><circle cx="174" cy="26" r="12" fill="#e6c189"/></> : null}
        </svg>
        <span className="art-orbit art-orbit-one" /><span className="art-orbit art-orbit-two" />
      </div>
      <div className="assessment-card-content">
        <div className="eyebrow-row"><span>{assessment.subject}</span><span className={`difficulty difficulty-${assessment.difficulty === "Лёгкая" ? "easy" : assessment.difficulty === "Сложная" ? "hard" : "medium"}`}>{assessment.difficulty}</span></div>
        <h3><Link href={`/assessments/${assessment.id}`}>{assessment.title}</Link></h3>
        <p>{assessment.description || "Подробное описание задания пока не добавлено."}</p>
        <div className="card-meta"><span><strong>{assessment.grade_min}–{assessment.grade_max}</strong> классы</span><span><strong>{assessment.duration_minutes}</strong> мин</span></div>
        <div className="card-bottom"><span className="kind-pill">{assessment.kind}</span><Link className="text-link" href={`/assessments/${assessment.id}`}>Открыть <span aria-hidden="true">↗</span></Link></div>
      </div>
    </article>
  );
}
