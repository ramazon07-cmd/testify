"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Question, Quiz } from "@/lib/types";

function emptyQuestion(order: number): Question {
  return { text: "", explanation: "", order, points: 1, choices: [0, 1, 2, 3].map((i) => ({ text: "", is_correct: i === 0, order: i })) };
}

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { api<Quiz>(`/quizzes/${id}/`).then((data) => { setQuiz(data); setQuestions(data.questions || []); }).catch((err) => setError(err.message)); }, [id]);

  function updateQuestion(index: number, patch: Partial<Question>) { setQuestions((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function updateChoice(qIndex: number, cIndex: number, text: string) { const next = structuredClone(questions); next[qIndex].choices[cIndex].text = text; setQuestions(next); }
  function markCorrect(qIndex: number, cIndex: number) { const next = structuredClone(questions); next[qIndex].choices = next[qIndex].choices.map((choice, i) => ({ ...choice, is_correct: i === cIndex })); setQuestions(next); }

  async function saveQuestions() {
    setSaving(true); setError(""); setMessage("");
    try {
      const normalized = questions.map((q, qIndex) => ({ ...q, order: qIndex, choices: q.choices.map((c, cIndex) => ({ ...c, order: cIndex })) }));
      const data = await api<Quiz>(`/quizzes/${id}/questions/`, { method: "PUT", body: JSON.stringify({ questions: normalized }) });
      setQuiz(data); setQuestions(data.questions || []); setMessage("Savollar saqlandi."); return data;
    } catch (err) { setError(err instanceof Error ? err.message : "Saqlash xatoligi"); throw err; }
    finally { setSaving(false); }
  }

  async function saveSettings(patch: Partial<Quiz>) {
    if (!quiz) return;
    setError(""); setMessage("");
    try { const data = await api<Quiz>(`/quizzes/${id}/`, { method: "PATCH", body: JSON.stringify(patch) }); setQuiz({ ...data, questions }); setMessage("Sozlamalar saqlandi."); }
    catch (err) { setError(err instanceof Error ? err.message : "Sozlamalar xatoligi"); }
  }

  async function publish() { setError(""); try { await saveQuestions(); const data = await api<Quiz>(`/quizzes/${id}/publish/`, { method: "POST" }); setQuiz({ ...data, questions }); setMessage("Test e’lon qilindi. Linkni ulashishingiz mumkin."); } catch (err) { setError(err instanceof Error ? err.message : "Publish xatoligi"); } }
  async function closeQuiz() { try { const data = await api<Quiz>(`/quizzes/${id}/close/`, { method: "POST" }); setQuiz({ ...data, questions }); setMessage("Test yopildi."); } catch (err) { setError(err instanceof Error ? err.message : "Yopishda xatolik"); } }

  if (!quiz) return <main className="dashboard-page"><div className="container"><div className="empty">{error || "Yuklanmoqda..."}</div></div></main>;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/quiz/${quiz.share_code}` : "";

  return <main className="dashboard-page"><div className="container editor-layout"><section><div className="page-head"><div><span className="eyebrow">TEST EDITOR</span><h1>{quiz.title}</h1></div><div className="head-actions"><button className="button ghost" onClick={saveQuestions} disabled={saving}>Saqlash</button><button className="button" onClick={publish}>Publish</button></div></div>{message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}<div className="question-stack">{questions.map((question, qIndex) => <article className="question-card" key={qIndex}><div className="question-top"><span>{qIndex + 1}</span><button onClick={() => setQuestions(questions.filter((_, i) => i !== qIndex))}>O‘chirish</button></div><textarea value={question.text} onChange={(e) => updateQuestion(qIndex, { text: e.target.value })} placeholder="Savol matni" /><div className="choices-editor">{question.choices.map((choice, cIndex) => <label className="choice-edit" key={cIndex}><input type="radio" name={`correct-${qIndex}`} checked={Boolean(choice.is_correct)} onChange={() => markCorrect(qIndex, cIndex)} /><b>{String.fromCharCode(65 + cIndex)}</b><input value={choice.text} onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)} placeholder="Variant" /></label>)}</div></article>)}</div><button className="button ghost full" onClick={() => setQuestions([...questions, emptyQuestion(questions.length)])}>+ Savol qo‘shish</button></section><aside className="editor-sidebar"><div className="panel sticky"><h3>Test holati</h3><span className={`status ${quiz.status}`}>{quiz.status}</span><dl><div><dt>Savollar</dt><dd>{questions.length}</dd></div><div><dt>Vaqt</dt><dd>{quiz.duration_minutes} min</dd></div><div><dt>Kod</dt><dd>{quiz.share_code}</dd></div></dl><label>Vaqt, daqiqa<input type="number" min="1" value={quiz.duration_minutes} onChange={(e) => setQuiz({ ...quiz, duration_minutes: Number(e.target.value) })} onBlur={() => saveSettings({ duration_minutes: quiz.duration_minutes })} /></label><label className="check"><input type="checkbox" checked={quiz.show_score} onChange={(e) => saveSettings({ show_score: e.target.checked })} /> O‘quvchiga natijani ko‘rsatish</label><label className="check"><input type="checkbox" checked={quiz.shuffle_questions} onChange={(e) => saveSettings({ shuffle_questions: e.target.checked })} /> Savollarni aralashtirish</label><label className="check"><input type="checkbox" checked={quiz.shuffle_choices} onChange={(e) => saveSettings({ shuffle_choices: e.target.checked })} /> Variantlarni aralashtirish</label><label className="check"><input type="checkbox" checked={quiz.one_attempt_per_student} onChange={(e) => saveSettings({ one_attempt_per_student: e.target.checked })} /> Bitta ism bilan bir marta</label>{quiz.status === "published" && <><input readOnly value={publicUrl} /><button className="button full" onClick={() => navigator.clipboard.writeText(publicUrl)}>Linkni nusxalash</button><Link href={`/quiz/${quiz.share_code}`} className="text-link" target="_blank">Testni ochish ↗</Link><button className="button ghost full" onClick={closeQuiz}>Testni yopish</button></>}<Link href={`/dashboard/quizzes/${quiz.id}/results`} className="button ghost full">Natijalarni ko‘rish</Link></div></aside></div></main>;
}
