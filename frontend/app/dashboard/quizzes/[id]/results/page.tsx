"use client";

import { FormEvent, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, apiAll, downloadWithAuth } from "@/lib/api";
import type { Quiz, Student } from "@/lib/types";

type Attempt = {
  id: number;
  rank: number;
  student_name: string;
  score: string;
  max_score: string;
  percentage: string;
  submitted_at: string;
  parent_phone: string;
  parent_report: string;
};
type QuestionAnalytics = { question_id: number; order: number; text: string; correct_count: number; attempt_count: number; correct_rate: number };
type Results = { quiz: Quiz; attempts: Attempt[]; average_percentage: number; question_analytics: QuestionAnalytics[] };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [saved, setSaved] = useState("");
  const load = useCallback(async () => {
    try {
      const results = await api<Results>(`/quizzes/${id}/results/`);
      setData(results);
      setStudents(results.quiz.group ? await apiAll<Student>(`/students/?group=${results.quiz.group}`) : []);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Natijalarni yuklab bo‘lmadi."); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function submitPaper(event: FormEvent) {
    event.preventDefault(); setError(""); setSaved("");
    try {
      const attempt = await api<Attempt>(`/quizzes/${id}/paper-attempts/`, { method: "POST", body: JSON.stringify({ student_name: studentName, answers }) });
      setSaved(`${attempt.student_name}: ${attempt.score}/${attempt.max_score} (${attempt.percentage}%)`);
      setStudentName(""); setAnswers(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Javoblarni tekshirishda xato"); }
  }

  async function copyReport(report: string) {
    await navigator.clipboard.writeText(report);
    setSaved("Ota-ona hisoboti nusxalandi.");
  }

  function shareTelegram(report: string) {
    window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(report)}`, "_blank", "noopener,noreferrer");
  }

  if (!data) return <main className="dashboard-page"><div className="container"><div className="empty">{error || "Yuklanmoqda…"}</div></div></main>;
  const difficult = [...data.question_analytics].sort((a, b) => a.correct_rate - b.correct_rate).slice(0, 5);

  return <main className="dashboard-page"><div className="container">
    <div className="page-head"><div><span className="eyebrow">NATIJALAR · {data.quiz.group_name || "GURUH TANLANMAGAN"}</span><h1>{data.quiz.title}</h1><p>{data.quiz.scoring_scheme === "dtm_189" ? "DTM 90 / 189 baholash" : "Oddiy baholash"}</p></div><div className="head-actions"><Link className="button ghost" href={`/dashboard/quizzes/${id}`}>← Sinovga qaytish</Link><button className="button" onClick={() => downloadWithAuth(`/quizzes/${id}/results/export/`, `quiz-${id}-results.csv`)}>Excel uchun CSV</button></div></div>
    <div className="stats-grid"><div className="stat-card"><span>Topshirganlar</span><strong>{data.attempts.length}</strong></div><div className="stat-card"><span>O‘rtacha natija</span><strong>{data.average_percentage}%</strong></div><div className="stat-card"><span>Maksimal ball</span><strong>{data.attempts[0]?.max_score || (data.quiz.scoring_scheme === "dtm_189" ? "189.00" : data.quiz.question_count)}</strong></div></div>

    <form className="panel paper-form" onSubmit={submitPaper}><div><span className="eyebrow">QOG‘OZ SINOV</span><h2>Javoblarni tez tekshiring</h2><p>{data.quiz.question_count} ta A/B/C/D/E javobini tartib bilan kiriting.</p></div><div className="paper-inputs">{students.length ? <select aria-label="O‘quvchini tanlang" value={studentName} onChange={(event) => setStudentName(event.target.value)} required><option value="">O‘quvchini tanlang</option>{students.map((student) => <option value={student.name} key={student.id}>{student.name}</option>)}</select> : <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="O‘quvchi ismi" required maxLength={150} />}<input className="paper-answer-input" value={answers} onChange={(event) => setAnswers(event.target.value.toUpperCase())} placeholder="Masalan: ABCDABCD" required /><button className="button" type="submit">Tekshirish</button></div><div className={`answer-count ${answers.replace(/[^A-E]/gi, "").length === data.quiz.question_count ? "ready" : ""}`}>{answers.replace(/[^A-E]/gi, "").length} / {data.quiz.question_count} javob</div>{saved && <div className="alert success">{saved}</div>}{error && <div className="alert error">{error}</div>}</form>

    {data.attempts.length > 0 && <section className="results-section"><div className="section-heading result-heading"><div><span className="eyebrow">01 / REYTING</span><h2>Guruh reytingi</h2></div><span>Natija bo‘yicha yuqoridan pastga</span></div><div className="panel table-wrap"><table><thead><tr><th>O‘rin</th><th>O‘quvchi</th><th>Ball</th><th>Foiz</th><th>Ota-ona hisoboti</th></tr></thead><tbody>{data.attempts.map((attempt) => <tr key={attempt.id}><td><span className={`rank-badge rank-${attempt.rank}`}>{attempt.rank}</span></td><td><strong>{attempt.student_name}</strong>{attempt.parent_phone && <small className="parent-phone">{attempt.parent_phone}</small>}</td><td>{attempt.score}/{attempt.max_score}</td><td><strong>{attempt.percentage}%</strong></td><td><div className="report-actions"><button type="button" onClick={() => void copyReport(attempt.parent_report)}>Nusxalash</button><button type="button" onClick={() => shareTelegram(attempt.parent_report)}>Telegram ↗</button></div></td></tr>)}</tbody></table></div></section>}

    <section className="results-section"><div className="section-heading result-heading"><div><span className="eyebrow">02 / DIAGNOSTIKA</span><h2>Qiyin savollar</h2></div><span>Eng kam to‘g‘ri ishlangan 5 savol</span></div>{data.attempts.length === 0 ? <div className="panel empty">Birinchi javob kiritilgach savollar kesimidagi tahlil shu yerda chiqadi.</div> : <div className="difficulty-list">{difficult.map((question) => <article key={question.question_id}><div className="difficulty-number">{String(question.order).padStart(2, "0")}</div><div><strong>{question.text}</strong><span>{question.correct_count}/{question.attempt_count} o‘quvchi to‘g‘ri ishladi</span></div><div className="difficulty-rate"><i style={{ width: `${question.correct_rate}%` }} /><b>{question.correct_rate}%</b></div></article>)}</div>}</section>
  </div></main>;
}
