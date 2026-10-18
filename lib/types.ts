export type AppRole = "student" | "teacher" | "admin";
export type QuestionType = "choice" | "written" | "matching";
export type MatchPair = { left: string; right: string };
export type QuestionAnswer = number | string | Record<string, string>;

export type Profile = {
  id: string;
  display_name: string;
  grade: number | null;
  role: AppRole;
  is_active: boolean;
};

export type Assessment = {
  id: string;
  title: string;
  description: string;
  subject: string;
  kind: "Олимпиада" | "Тест";
  grade_min: number;
  grade_max: number;
  duration_minutes: number;
  difficulty: "Лёгкая" | "Средняя" | "Сложная";
  status: "draft" | "pending" | "published" | "rejected" | "archived";
  creator_id: string;
  review_note: string | null;
  created_at: string;
  published_at: string | null;
};

export type SafeQuestion = {
  id: string;
  position: number;
  prompt: string;
  question_type: QuestionType;
  options: string[];
  match_items: string[];
  match_options: string[];
  points: number;
};

export type StartedAttempt = {
  attempt_id: string;
  assessment_id: string;
  assessment_title: string;
  kind: "Олимпиада" | "Тест";
  duration_minutes: number;
  started_at: string;
  ends_at: string;
  questions: SafeQuestion[];
  answers: Record<string, QuestionAnswer>;
};

export type AttemptReviewQuestion = {
  id: string;
  position: number;
  prompt: string;
  question_type: QuestionType;
  options: string[];
  chosen_index: number | null;
  chosen_answer: QuestionAnswer | null;
  correct_index: number | null;
  correct_text: string;
  match_pairs: MatchPair[];
  explanation: string;
  points: number;
  earned_points: number;
  is_correct: boolean;
};

export type AttemptReview = {
  attempt_id: string;
  assessment_id: string;
  assessment_title: string;
  subject: string;
  kind: string;
  score: number;
  max_score: number;
  state: "submitted" | "timed_out";
  started_at: string;
  submitted_at: string;
  questions: AttemptReviewQuestion[];
};
