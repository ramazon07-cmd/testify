"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Quiz } from "@/lib/types";

export default function AnswerSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Quiz>(`/quizzes/${id}/`).then(setQuiz).catch((err) => setError(err.message));
  }, [id]);

  if (!quiz) return <main className="dashboard-page"><div className="container"><div className="empty">{error || "Varaq tayyorlanmoqda…"}</div></div></main>;

  return <main className="sheet-page">
    <div className="sheet-toolbar"><Link className="button ghost" href={`/dashboard/quizzes/${id}`}>← Sinovga qaytish</Link><span>Chop etishda A4 va 100% masshtabni tanlang.</span><button className="button" type="button" onClick={() => window.print()}>Chop etish</button></div>
    <article className="answer-sheet">
      <header><div><span>TESTIFY · JAVOB VARAQASI</span><h1>{quiz.title}</h1><p>{quiz.group_name || "Guruh ko‘rsatilmagan"} · {quiz.question_count} savol · kod {quiz.share_code}</p></div><div className="sheet-code">{quiz.share_code}</div></header>
      <div className="student-fields"><span>O‘quvchi: __________________________________</span><span>Sana: ____ / ____ / ______</span></div>
      <div className="bubble-grid">{Array.from({ length: quiz.question_count }, (_, index) => <div className="bubble-row" key={index}><b>{index + 1}</b>{"ABCDE".split("").map((letter) => <span key={letter}><i />{letter}</span>)}</div>)}</div>
      <footer><strong>Belgini doira ichiga aniq qo‘ying.</strong><span>Testify · o‘quv markazlari uchun sinov operatsiyalari</span></footer>
    </article>
  </main>;
}
