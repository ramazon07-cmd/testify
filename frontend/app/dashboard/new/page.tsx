"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Quiz, StudentGroup } from "@/lib/types";

type CreationMode = "answer-key" | "pdf";

export default function NewQuizPage() {
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>("answer-key");
  const [file, setFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [answerKey, setAnswerKey] = useState("");
  const [scheme, setScheme] = useState<"standard" | "dtm_189">("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ results: StudentGroup[] }>("/groups/").then((data) => setGroups(data.results)).catch(() => undefined);
  }, []);

  const keyCount = (answerKey.toUpperCase().match(/[A-E]/g) || []).length;

  async function createFromKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const raw = new FormData(event.currentTarget);
    try {
      const quiz = await api<Quiz>("/quizzes/from-answer-key/", {
        method: "POST",
        body: JSON.stringify({
          title: raw.get("title"),
          group: raw.get("group") ? Number(raw.get("group")) : null,
          scoring_scheme: scheme,
          answer_key: answerKey,
        }),
      });
      router.push(`/dashboard/quizzes/${quiz.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Javob kalitidan sinov yaratilmadi."); }
    finally { setLoading(false); }
  }

  async function importPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("PDF fayl tanlang.");
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("Faqat PDF fayl yuklang.");
    setLoading(true); setError("");
    const raw = new FormData(event.currentTarget);
    const form = new FormData();
    form.append("file", file);
    form.append("title", String(raw.get("title") || ""));
    form.append("mode", String(raw.get("import_mode") || "auto"));
    const questionCount = Number(raw.get("question_count") || "20");
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 350) {
      setLoading(false);
      return setError("Savollar soni 1 dan 350 gacha bo‘lishi kerak.");
    }
    form.append("question_count", String(questionCount));
    try {
      const quiz = await api<Quiz>("/quizzes/import-pdf/", { method: "POST", body: form });
      router.push(`/dashboard/quizzes/${quiz.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "PDF import xatoligi"); }
    finally { setLoading(false); }
  }

  return <main className="dashboard-page"><div className="container narrow">
    <div className="page-head"><div><span className="eyebrow">YANGI SINOV</span><h1>Sinovni qanday yaratasiz?</h1><p>Qog‘oz test uchun kalit eng tez yo‘l. PDF import savol matnlarini ham olib kiradi.</p></div></div>
    <div className="creation-switch" role="tablist" aria-label="Sinov yaratish usuli">
      <button type="button" role="tab" aria-selected={mode === "answer-key"} className={mode === "answer-key" ? "active" : ""} onClick={() => { setMode("answer-key"); setError(""); }}><strong>Javob kaliti</strong><span>Qog‘oz test · 1 daqiqa</span></button>
      <button type="button" role="tab" aria-selected={mode === "pdf"} className={mode === "pdf" ? "active" : ""} onClick={() => { setMode("pdf"); setError(""); }}><strong>PDF import</strong><span>Savollarni ham ajratish</span></button>
    </div>
    {error && <div className="alert error">{error}</div>}

    {mode === "answer-key" ? <form className="panel upload-form key-form" onSubmit={createFromKey}>
      <div className="form-grid two"><label>Sinov nomi<input name="title" placeholder="Masalan: DTM diagnostika · oktabr" required /></label><label>Guruh<select name="group" defaultValue=""><option value="">Guruhsiz sinov</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
      <fieldset className="scheme-picker"><legend>Baholash shabloni</legend><label className={scheme === "standard" ? "selected" : ""}><input type="radio" checked={scheme === "standard"} onChange={() => setScheme("standard")} /><span><strong>Oddiy</strong><small>Har bir to‘g‘ri javob — 1 ball</small></span></label><label className={scheme === "dtm_189" ? "selected" : ""}><input type="radio" checked={scheme === "dtm_189"} onChange={() => setScheme("dtm_189")} /><span><strong>DTM 90 / 189</strong><small>1.1 · 3.1 · 2.1 ball bloklari</small></span></label></fieldset>
      <label>Javob kaliti<textarea className="answer-key-input" value={answerKey} onChange={(event) => setAnswerKey(event.target.value)} placeholder={scheme === "dtm_189" ? "90 ta javob: ABCD..." : "Masalan: ABCDABCD yoki 1-A, 2-B, 3-C"} required /></label>
      <div className={`key-meter ${scheme === "dtm_189" && keyCount !== 90 ? "warning" : ""}`}><span>Aniqlangan javoblar</span><strong>{keyCount}{scheme === "dtm_189" ? " / 90" : " ta"}</strong></div>
      <div className="info-box"><strong>Tezkor oqim:</strong> kalitdan draft yaratiladi → tekshirasiz → qog‘oz javoblarini kiritasiz → reyting va ota-ona hisoboti tayyor bo‘ladi.</div>
      <button className="button full" disabled={loading || keyCount === 0 || (scheme === "dtm_189" && keyCount !== 90)}>{loading ? "Yaratilmoqda…" : "Draft sinov yaratish →"}</button>
    </form> : <form className="panel upload-form" onSubmit={importPdf}>
      <label>Test nomi<input name="title" placeholder="Masalan: 9-sinf tarix testi" /></label>
      <div className="form-grid two import-settings"><label>Savollar soni<input name="question_count" type="number" min="1" max="350" defaultValue="20" /><small className="field-help">PDF ichidan aynan shu miqdor olinadi.</small></label><label>Import turi<select name="import_mode" defaultValue="auto"><option value="auto">Avtomatik aniqlash</option><option value="ready_test">Tayyor A/B/C/D test</option><option value="content">Materialdan AI test</option></select><small className="field-help">Har bir javobni e’lon qilishdan oldin tekshirasiz.</small></label></div>
      <label className={`dropzone ${file ? "has-file" : ""}`}><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /><div className="pdf-icon">PDF</div><strong>{file ? file.name : "PDF faylni tanlang"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maksimum 15 MB"}</span></label>
      <div className="info-box"><strong>Muhim:</strong> birorta noto‘g‘ri kalit markaz ishonchini sindiradi. Import natijasini e’lon qilishdan oldin tekshirish majburiy.</div>
      <button className="button full" disabled={loading}>{loading ? "PDF qayta ishlanmoqda…" : "PDF’dan draft yaratish →"}</button>
    </form>}
  </div></main>;
}
