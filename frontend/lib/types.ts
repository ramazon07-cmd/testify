export type Choice = { id?: number; text: string; is_correct?: boolean; order: number };

export type Question = {
  id?: number;
  text: string;
  section_title?: string;
  explanation: string;
  order: number;
  points: number;
  choices: Choice[];
};

export type Quiz = {
  id: number;
  group: number | null;
  group_name?: string | null;
  title: string;
  description: string;
  status: "draft" | "published" | "closed";
  scoring_scheme: "standard" | "dtm_189";
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
export type StudentGroup = { id: number; name: string; student_count: number; created_at: string };
export type Student = { id: number; group: number; name: string; parent_phone: string; created_at: string };
export type BulkStudentResult = { created_count: number; skipped_count: number; skipped: string[]; students: Student[] };
