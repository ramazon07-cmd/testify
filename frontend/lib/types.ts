export type Choice = { id?: number; text: string; is_correct?: boolean; order: number };

export type Question = {
  id?: number;
  text: string;
  explanation: string;
  order: number;
  points: number;
  choices: Choice[];
};

export type Quiz = {
  id: number;
  title: string;
  description: string;
  status: "draft" | "published" | "closed";
  share_code: string;
  duration_minutes: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  show_score: boolean;
  one_attempt_per_student: boolean;
  starts_at: string | null;
  ends_at: string | null;
  question_count: number;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  questions?: Question[];
};

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };
