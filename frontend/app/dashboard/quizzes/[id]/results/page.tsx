"use client";

import { use, useEffect, useState } from "react";
import { api, downloadWithAuth } from "@/lib/api";
import type { Quiz } from "@/lib/types";

type Attempt = { id: number; student_name: string; score: number; max_score: number; percentage: string; submitted_at: string };
type Results = { quiz: Quiz; attempts: Attempt[]; average_percentage: number };

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Results>(`/quizzes/${id}/results/`).then(setData).catch((e) => setError(e.message)); }, [id]);

  if (!data) return <main className="dashboard-page"><div className="container"><div className="empty">{error || "Yuklanmoqda..."}</div></div></main>;
  return <main className="dashboard-page"><div className="container"><div className="page-head"><div><span className="eyebrow">NATIJALAR</span><h1>{data.quiz.title}</h1></div><button className="button" onClick={() => downloadWithAuth(`/quizzes/${id}/results/export/`, `quiz-${id}-results.csv`)}>CSV yuklab olish</button></div><div className="stats-grid"><div className="stat-card"><span>Urinishlar</span><strong>{data.attempts.length}</strong></div><div className="stat-card"><span>O‘rtacha natija</span><strong>{data.average_percentage}%</strong></div><div className="stat-card"><span>Savollar</span><strong>{data.quiz.question_count}</strong></div></div><div className="panel table-wrap"><table><thead><tr><th>O‘quvchi</th><th>Ball</th><th>Foiz</th><th>Vaqt</th></tr></thead><tbody>{data.attempts.map((a) => <tr key={a.id}><td><strong>{a.student_name}</strong></td><td>{a.score}/{a.max_score}</td><td>{a.percentage}%</td><td>{new Date(a.submitted_at).toLocaleString("uz-UZ")}</td></tr>)}</tbody></table>{data.attempts.length === 0 && <div className="empty">Hali hech kim test ishlamagan.</div>}</div></div></main>;
}
