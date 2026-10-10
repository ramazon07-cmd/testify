"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Quiz } from "@/lib/types";

type StartedAttempt = { id: number; student_name: string; started_at: string; expires_at: string };
type SubmitResult = { attempt: { id: number; student_name?: string; score?: number; max_score?: number; percentage?: string }; show_score: boolean };
type SavedSession = { attempt: StartedAttempt; name: string; answers: Record<number, number>; activeIndex: number };

export default function PublicQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const storageKey = `testify-attempt-${code.toUpperCase()}`;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [name, setName] = useState("");
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    api<Quiz>(`/public/quizzes/${code}/`)
      .then(setQuiz)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Testni yuklab bo‘lmadi."));

    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const session = JSON.parse(saved) as SavedSession;
        setAttempt(session.attempt);
        setName(session.name);
        setAnswers(session.answers || {});
        setActiveIndex(session.activeIndex || 0);
      } catch { sessionStorage.removeItem(storageKey); }
    }
  }, [code, storageKey]);

  useEffect(() => {
    if (!attempt || result) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ attempt, name, answers, activeIndex } satisfies SavedSession));
  }, [activeIndex, answers, attempt, name, result, storageKey]);

  const sendAnswers = useCallback(async () => {
    if (!quiz || !attempt || submitting || result) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await api<SubmitResult>(`/public/quizzes/${code}/submit/`, {
        method: "POST",
        body: JSON.stringify({
          attempt_id: attempt.id,
          answers: (quiz.questions || []).map((question) => ({
            question_id: question.id,
            choice_id: question.id ? answers[question.id] || null : null,
          })),
        }),
      });
      setResult(data);
      sessionStorage.removeItem(storageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Javoblarni yuborib bo‘lmadi.");
    } finally { setSubmitting(false); }
  }, [answers, attempt, code, quiz, result, storageKey, submitting]);

  useEffect(() => {
    if (!attempt || result) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(attempt.expires_at).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        void sendAnswers();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, result, sendAnswers]);

  const questions = quiz?.questions || [];
  const current = questions[activeIndex];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const time = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);

  async function start() {
    setError("");
    try {
      const data = await api<StartedAttempt>(`/public/quizzes/${code}/start/`, {
        method: "POST",
        body: JSON.stringify({ student_name: name.trim() }),
      });
      setAttempt(data);
      setSeconds(Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / 1000)));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Testni boshlab bo‘lmadi."); }
  }

  function choose(questionId: number, choiceId: number) {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: choiceId }));
    setConfirmFinish(false);
  }

  function requestFinish() {
    if (unansweredCount > 0 && !confirmFinish) {
      setConfirmFinish(true);
      return;
    }
    void sendAnswers();
  }

  if (error && !quiz) return <main className="quiz-page"><div className="quiz-shell"><div className="alert error">{error}</div></div></main>;
  if (!quiz) return <main className="quiz-page"><div className="quiz-shell"><div className="empty">Test yuklanmoqda…</div></div></main>;
  if (result) return <main className="quiz-page"><div className="result-card">{result.show_score ? <><div className="result-ring"><strong>{result.attempt.percentage}%</strong></div><span className="eyebrow">NATIJA TAYYOR</span><h1>Test yakunlandi</h1><p>{name}, siz <b>{result.attempt.score}/{result.attempt.max_score}</b> ball oldingiz.</p></> : <><div className="quiz-logo result-logo">✓</div><h1>Javoblar yuborildi</h1><p>{name}, natijani o‘qituvchingiz ko‘radi.</p></>}</div></main>;
  if (!attempt) return <main className="quiz-page"><div className="quiz-intro"><div className="quiz-logo">T</div><span className="eyebrow">TEST KODI · {quiz.share_code}</span><h1>{quiz.title}</h1><p>{quiz.description || "Sinovni boshlashdan oldin ism-familiyangizni to‘liq kiriting."}</p><div className="quiz-facts"><span>{quiz.question_count} savol</span><span>{quiz.duration_minutes} daqiqa</span></div>{error && <div className="alert error">{error}</div>}<label className="quiz-name-field">Ism va familiya<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Masalan: Aziza Karimova" maxLength={150} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) void start(); }} /></label><button className="button full large" disabled={!name.trim()} onClick={() => void start()}>Testni boshlash <span aria-hidden="true">→</span></button><small className="quiz-notice">Boshlaganingizdan keyin taymer ortga sanaydi.</small></div></main>;

  return <main className="quiz-page"><div className="quiz-workspace"><header className="quiz-header"><div><span className="eyebrow">{quiz.title}</span><strong>{name}</strong></div><div className={`timer ${seconds < 60 ? "danger" : ""}`} aria-label={`Qolgan vaqt ${time}`}>{time}</div></header><div className="quiz-progress"><div><span>Javob berildi</span><strong>{answeredCount}/{questions.length}</strong></div><i><b style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} /></i></div><div className="quiz-body"><aside className="question-map" aria-label="Savollar ro‘yxati"><strong>Savollar</strong><div>{questions.map((question, index) => <button type="button" key={question.id || index} className={`${index === activeIndex ? "active" : ""} ${question.id && answers[question.id] ? "answered" : ""}`} onClick={() => setActiveIndex(index)} aria-label={`${index + 1}-savol`}>{index + 1}</button>)}</div><span><i /> Javob berilgan</span></aside><section className="quiz-focus">{current ? <article className="public-question"><div className="public-question-kicker"><span>{activeIndex + 1}-savol</span><small>{current.points} ball</small></div><h2>{current.text}</h2><div className="public-choices">{current.choices.map((choice, choiceIndex) => <label className={current.id && answers[current.id] === choice.id ? "selected" : ""} key={choice.id || choiceIndex}><input type="radio" name={`q-${current.id}`} checked={Boolean(current.id && answers[current.id] === choice.id)} onChange={() => current.id && choice.id && choose(current.id, choice.id)} /><b>{String.fromCharCode(65 + choiceIndex)}</b><span>{choice.text}</span></label>)}</div></article> : <div className="empty">Savol topilmadi.</div>}<div className="quiz-nav"><button type="button" className="button ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>← Oldingi</button>{activeIndex < questions.length - 1 ? <button type="button" className="button" onClick={() => setActiveIndex((index) => Math.min(questions.length - 1, index + 1))}>Keyingi →</button> : <button type="button" className="button" onClick={requestFinish} disabled={submitting}>{submitting ? "Yuborilmoqda…" : "Testni yakunlash"}</button>}</div>{confirmFinish && <div className="finish-warning"><strong>{unansweredCount} ta savol javobsiz qolgan.</strong><span>Ularni ko‘rib chiqing yoki testni hozir yakunlang.</span><button type="button" onClick={() => void sendAnswers()} disabled={submitting}>Baribir yakunlash</button></div>}{error && <div className="alert error">{error}</div>}</section></div></div></main>;
}
