"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiAll } from "@/lib/api";
import type { Question, Quiz, StudentGroup } from "@/lib/types";

const statusLabel = { draft: "Qoralama", published: "Faol", closed: "Yopilgan" };
const toLocalInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

function emptyQuestion(order: number): Question {
  return { text: "", explanation: "", section_title: "", order, points: 1, choices: [0, 1, 2, 3].map((index) => ({ text: "", is_correct: index === 0, order: index })) };
}

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);

  useEffect(() => {
    Promise.all([api<Quiz>(`/quizzes/${id}/`), apiAll<StudentGroup>("/groups/")])
      .then(([quizData, groupRows]) => { setQuiz(quizData); setQuestions(quizData.questions || []); setGroups(groupRows); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Sinov yuklanmadi."));
  }, [id]);

  function notice(text = "") { setError(""); setMessage(text); }
  function updateQuestion(patch: Partial<Question>) {
    setKeyConfirmed(false);
    setQuestions((items) => items.map((item, index) => index === activeIndex ? { ...item, ...patch } : item));
  }
  function updateChoice(choiceIndex: number, text: string) {
    setKeyConfirmed(false);
    setQuestions((items) => items.map((item, index) => index === activeIndex ? { ...item, choices: item.choices.map((choice, current) => current === choiceIndex ? { ...choice, text } : choice) } : item));
  }
  function markCorrect(choiceIndex: number) {
    setKeyConfirmed(false);
    setQuestions((items) => items.map((item, index) => index === activeIndex ? { ...item, choices: item.choices.map((choice, current) => ({ ...choice, is_correct: current === choiceIndex })) } : item));
  }

  async function saveQuestions() {
    setSaving(true); notice();
    try {
      const normalized = questions.map((question, questionIndex) => ({ ...question, order: questionIndex, choices: question.choices.map((choice, choiceIndex) => ({ ...choice, order: choiceIndex })) }));
      const data = await api<Quiz>(`/quizzes/${id}/questions/`, { method: "PUT", body: JSON.stringify({ questions: normalized }) });
      setQuiz(data); setQuestions(data.questions || []); setMessage("Savollar saqlandi."); return data;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Savollar saqlanmadi."); throw caught; }
    finally { setSaving(false); }
  }

  async function saveSettings(patch?: Partial<Quiz>) {
    if (!quiz) return;
    notice(); setSaving(true);
    const payload = patch || {
      title: quiz.title,
      description: quiz.description,
      group: quiz.group,
      duration_minutes: quiz.duration_minutes,
      starts_at: quiz.starts_at || null,
      ends_at: quiz.ends_at || null,
    };
    try {
      const data = await api<Quiz>(`/quizzes/${id}/`, { method: "PATCH", body: JSON.stringify(payload) });
      setQuiz({ ...data, questions }); setMessage("Sinov sozlamalari saqlandi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sozlamalar saqlanmadi."); }
    finally { setSaving(false); }
  }

  async function publish() {
    notice();
    if (!keyConfirmed) { setError("E’lon qilishdan oldin barcha savol va javoblarni tekshirganingizni tasdiqlang."); return; }
    try {
      await saveQuestions();
      const data = await api<Quiz>(`/quizzes/${id}/publish/`, { method: "POST" });
      setQuiz({ ...data, questions }); setMessage("Test faol. Endi havolani ulashish mumkin.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Test e’lon qilinmadi."); }
  }

  async function closeQuiz() {
    notice();
    try { const data = await api<Quiz>(`/quizzes/${id}/close/`, { method: "POST" }); setQuiz({ ...data, questions }); setMessage("Test yopildi."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Test yopilmadi."); }
  }

  async function deleteQuiz() {
    if (!quiz || !window.confirm(`“${quiz.title}” sinovi va barcha natijalarini o‘chirasizmi?`)) return;
    try { await api(`/quizzes/${id}/`, { method: "DELETE" }); router.push("/dashboard"); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Sinov o‘chirilmadi."); }
  }

  function removeQuestion() {
    if (!questions[activeIndex] || !window.confirm(`${activeIndex + 1}-savol o‘chirilsinmi?`)) return;
    const next = questions.filter((_, index) => index !== activeIndex);
    setQuestions(next); setActiveIndex(Math.min(activeIndex, Math.max(0, next.length - 1))); setKeyConfirmed(false);
  }

  if (!quiz) return <main className="dashboard-page"><div className="container"><div className="empty">{error || "Sinov yuklanmoqda…"}</div></div></main>;
  const current = questions[activeIndex];
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/quiz/${quiz.share_code}` : "";
  const unansweredCount = questions.filter((question) => question.choices.filter((choice) => choice.is_correct).length !== 1).length;

  return <main className="dashboard-page"><div className="container editor-layout"><section>
    <div className="page-head"><div><span className="eyebrow">SINOV KONSTRUKTORI · {quiz.share_code}</span><h1>{quiz.title}</h1><p className="editor-subtitle">{questions.length} savol · {quiz.scoring_scheme === "dtm_189" ? "DTM 90 / 189" : "Oddiy baholash"}</p></div><div className="head-actions"><button className="button ghost" onClick={() => void saveQuestions()} disabled={saving}>Savollarni saqlash</button><button className="button" onClick={() => void publish()} disabled={saving || questions.length === 0}>Tekshirib e’lon qilish</button></div></div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    {unansweredCount > 0 && <div className="alert error">{unansweredCount} ta savolda to‘g‘ri javob belgilanmagan.</div>}
    <label className="key-confirm"><input type="checkbox" checked={keyConfirmed} disabled={unansweredCount > 0 || questions.length === 0} onChange={(event) => setKeyConfirmed(event.target.checked)} /> Barcha savollar va javob kalitini tekshirdim</label>
    <div className="editor-question-map"><div>{questions.map((question, index) => <button type="button" key={question.id || index} className={`${index === activeIndex ? "active" : ""} ${question.choices.filter((choice) => choice.is_correct).length !== 1 ? "invalid" : ""}`} onClick={() => setActiveIndex(index)}>{index + 1}</button>)}</div><button type="button" className="add-question-chip" onClick={() => { setQuestions((items) => [...items, emptyQuestion(items.length)]); setActiveIndex(questions.length); setKeyConfirmed(false); }}>＋ Savol</button></div>
    {current ? <article className="question-card editor-focus"><div className="question-top"><span>{activeIndex + 1}</span><label className="points-field">Ball<input type="number" min="0.01" step="0.1" value={current.points} onChange={(event) => updateQuestion({ points: Number(event.target.value) })} /></label><button onClick={removeQuestion}>Savolni o‘chirish</button></div><label>Bo‘lim nomi <span className="optional">(ixtiyoriy)</span><input value={current.section_title || ""} onChange={(event) => updateQuestion({ section_title: event.target.value })} placeholder="Masalan: Majburiy fanlar" /></label><label>Savol matni<textarea value={current.text} onChange={(event) => updateQuestion({ text: event.target.value })} placeholder="Savol matnini kiriting" /></label><div className="choices-editor">{current.choices.map((choice, choiceIndex) => <label className={`choice-edit ${choice.is_correct ? "correct" : ""}`} key={choice.id || choiceIndex}><input type="radio" name={`correct-${activeIndex}`} checked={Boolean(choice.is_correct)} onChange={() => markCorrect(choiceIndex)} /><b>{String.fromCharCode(65 + choiceIndex)}</b><input value={choice.text} onChange={(event) => updateChoice(choiceIndex, event.target.value)} placeholder="Variant" /></label>)}</div><label className="explanation-field">Izoh <span className="optional">(o‘quvchiga javobdan keyin)</span><textarea value={current.explanation} onChange={(event) => updateQuestion({ explanation: event.target.value })} placeholder="To‘g‘ri javob izohi" /></label><div className="editor-pagination"><button className="button ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>← Oldingi</button><span>{activeIndex + 1} / {questions.length}</span><button className="button ghost" disabled={activeIndex === questions.length - 1} onClick={() => setActiveIndex((index) => index + 1)}>Keyingi →</button></div></article> : <div className="empty panel"><h3>Savol yo‘q</h3><p>Birinchi savolni qo‘shing.</p><button className="button" onClick={() => setQuestions([emptyQuestion(0)])}>Savol qo‘shish</button></div>}
  </section><aside className="editor-sidebar"><div className="panel sticky"><div className="sidebar-title"><h3>Sinov sozlamalari</h3><span className={`status ${quiz.status}`}>{statusLabel[quiz.status]}</span></div><label>Nomi<input value={quiz.title} maxLength={200} onChange={(event) => setQuiz({ ...quiz, title: event.target.value })} /></label><label>Tavsif<textarea value={quiz.description} onChange={(event) => setQuiz({ ...quiz, description: event.target.value })} placeholder="O‘quvchi ko‘radigan qisqa tavsif" /></label><label>Guruh<select value={quiz.group ?? ""} onChange={(event) => setQuiz({ ...quiz, group: event.target.value ? Number(event.target.value) : null })}><option value="">Guruh tanlanmagan</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Vaqt, daqiqa<input type="number" min="1" max="360" value={quiz.duration_minutes} onChange={(event) => setQuiz({ ...quiz, duration_minutes: Number(event.target.value) })} /></label><div className="form-grid two"><label>Boshlanish<input type="datetime-local" value={toLocalInput(quiz.starts_at)} onChange={(event) => setQuiz({ ...quiz, starts_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label><label>Tugash<input type="datetime-local" value={toLocalInput(quiz.ends_at)} onChange={(event) => setQuiz({ ...quiz, ends_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label></div><button className="button ghost full" onClick={() => void saveSettings()} disabled={saving}>Sozlamalarni saqlash</button><div className="settings-divider" /><label className="check"><input type="checkbox" checked={quiz.show_score} onChange={(event) => { setQuiz({ ...quiz, show_score: event.target.checked }); void saveSettings({ show_score: event.target.checked }); }} /> Natijani o‘quvchiga ko‘rsatish</label><label className="check"><input type="checkbox" checked={quiz.shuffle_questions} onChange={(event) => { setQuiz({ ...quiz, shuffle_questions: event.target.checked }); void saveSettings({ shuffle_questions: event.target.checked }); }} /> Savollarni aralashtirish</label><label className="check"><input type="checkbox" checked={quiz.shuffle_choices} onChange={(event) => { setQuiz({ ...quiz, shuffle_choices: event.target.checked }); void saveSettings({ shuffle_choices: event.target.checked }); }} /> Variantlarni aralashtirish</label><label className="check"><input type="checkbox" checked={quiz.one_attempt_per_student} onChange={(event) => { setQuiz({ ...quiz, one_attempt_per_student: event.target.checked }); void saveSettings({ one_attempt_per_student: event.target.checked }); }} /> Har o‘quvchiga bir urinish</label>
    {quiz.status === "published" && <div className="share-panel"><span>O‘quvchi havolasi</span><input readOnly value={publicUrl} /><button className="button full" onClick={async () => { await navigator.clipboard.writeText(publicUrl); setMessage("Havola nusxalandi."); }}>Havolani nusxalash</button><Link href={`/quiz/${quiz.share_code}`} className="text-link" target="_blank">Testni ko‘rish ↗</Link><button className="button ghost full" onClick={() => void closeQuiz()}>Testni yopish</button></div>}
    <Link href={`/dashboard/quizzes/${quiz.id}/sheet`} className="button ghost full">Javob varaqasi</Link><Link href={`/dashboard/quizzes/${quiz.id}/results`} className="button ghost full">Natijalar</Link><button className="delete-quiz" onClick={() => void deleteQuiz()}>Sinovni butunlay o‘chirish</button>
  </div></aside></div></main>;
}
