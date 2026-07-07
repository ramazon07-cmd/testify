"use client";

import { FormEvent, use, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Quiz } from "@/lib/types";

type StartedAttempt = { id: number; student_name: string; started_at: string; expires_at: string };
type SubmitResult = { attempt: { id: number; student_name?: string; score?: number; max_score?: number; percentage?: string }; show_score: boolean };

export default function PublicQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [name, setName] = useState("");
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => { api<Quiz>(`/public/quizzes/${code}/`).then((data) => setQuiz(data)).catch((e) => setError(e.message)); }, [code]);
  useEffect(() => { if (!attempt || result || seconds <= 0) return; const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(timer); }, [attempt, result, seconds]);
  const time = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);

  async function start() {
    setError("");
    try {
      const data = await api<StartedAttempt>(`/public/quizzes/${code}/start/`, { method: "POST", body: JSON.stringify({ student_name: name }) });
      setAttempt(data);
      const expires = new Date(data.expires_at).getTime();
      setSeconds(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
    } catch (e) { setError(e instanceof Error ? e.message : "Boshlashda xatolik"); }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault(); if (!quiz || !attempt) return;
    try {
      const data = await api<SubmitResult>(`/public/quizzes/${code}/submit/`, { method: "POST", body: JSON.stringify({ attempt_id: attempt.id, answers: quiz.questions?.map((q) => ({ question_id: q.id, choice_id: answers[q.id!] || null })) }) });
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Yuborish xatoligi"); }
  }

  if (error && !quiz) return <main className="quiz-page"><div className="quiz-shell"><div className="alert error">{error}</div></div></main>;
  if (!quiz) return <main className="quiz-page"><div className="quiz-shell"><div className="empty">Test yuklanmoqda...</div></div></main>;
  if (result) return <main className="quiz-page"><div className="result-card">{result.show_score ? <><div className="result-ring"><strong>{result.attempt.percentage}%</strong></div><h1>Test yakunlandi!</h1><p>{name}, siz <b>{result.attempt.score}/{result.attempt.max_score}</b> ball oldingiz.</p></> : <><div className="quiz-logo result-logo">✓</div><h1>Javoblaringiz yuborildi</h1><p>{name}, natija o‘qituvchi tomonidan ko‘riladi.</p></>}</div></main>;
  if (!attempt) return <main className="quiz-page"><div className="quiz-intro"><div className="quiz-logo">T</div><span className="eyebrow">TEST KODI: {quiz.share_code}</span><h1>{quiz.title}</h1><p>{quiz.description}</p><div className="quiz-facts"><span>{quiz.question_count} savol</span><span>{quiz.duration_minutes} daqiqa</span></div>{error && <div className="alert error">{error}</div>}<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism va familiyangiz" /><button className="button full large" disabled={!name.trim()} onClick={start}>Testni boshlash →</button></div></main>;

  return <main className="quiz-page"><form className="quiz-shell" onSubmit={submit}><div className="quiz-header"><div><span className="eyebrow">{quiz.title}</span><strong>{name}</strong></div><div className={`timer ${seconds < 60 ? "danger" : ""}`}>{time}</div></div><div className="progress-text">Javob berildi: {Object.keys(answers).length}/{quiz.question_count}</div><div className="question-stack">{quiz.questions?.map((question, qIndex) => <article className="public-question" key={question.id}><h2><span>{qIndex + 1}</span>{question.text}</h2><div className="public-choices">{question.choices.map((choice, cIndex) => <label className={answers[question.id!] === choice.id ? "selected" : ""} key={choice.id}><input type="radio" name={`q-${question.id}`} onChange={() => setAnswers({ ...answers, [question.id!]: choice.id! })} /><b>{String.fromCharCode(65 + cIndex)}</b><span>{choice.text}</span></label>)}</div></article>)}</div>{error && <div className="alert error">{error}</div>}<button className="button full large" type="submit" disabled={seconds <= 0}>Testni yakunlash</button></form></main>;
}
