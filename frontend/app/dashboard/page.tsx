"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Paginated, Quiz } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    api<Paginated<Quiz>>("/quizzes/").then((data) => setQuizzes(data.results)).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [router]);

  const totalAttempts = quizzes.reduce((sum, q) => sum + q.attempt_count, 0);
  const published = quizzes.filter((q) => q.status === "published").length;

  return <main className="dashboard-page"><div className="container"><div className="page-head"><div><span className="eyebrow">DASHBOARD</span><h1>Testlaringiz</h1></div><Link href="/dashboard/new" className="button">+ PDF yuklash</Link></div><div className="stats-grid"><div className="stat-card"><span>Jami testlar</span><strong>{quizzes.length}</strong></div><div className="stat-card"><span>Aktiv testlar</span><strong>{published}</strong></div><div className="stat-card"><span>Jami urinishlar</span><strong>{totalAttempts}</strong></div></div>{error && <div className="alert error">{error}</div>}{loading ? <div className="empty">Yuklanmoqda...</div> : quizzes.length === 0 ? <div className="empty"><h3>Hali test yo‘q</h3><p>Birinchi PDF faylingizni yuklang.</p><Link className="button" href="/dashboard/new">Test yaratish</Link></div> : <div className="quiz-list">{quizzes.map((quiz) => <Link href={`/dashboard/quizzes/${quiz.id}`} className="quiz-row" key={quiz.id}><div className="quiz-icon">Q</div><div className="quiz-main"><strong>{quiz.title}</strong><span>{quiz.question_count} savol · {quiz.duration_minutes} daqiqa</span></div><span className={`status ${quiz.status}`}>{quiz.status}</span><div className="quiz-meta"><strong>{quiz.attempt_count}</strong><span>urinish</span></div><span className="arrow">→</span></Link>)}</div>}</div></main>;
}
