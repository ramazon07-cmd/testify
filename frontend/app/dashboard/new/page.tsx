"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Quiz } from "@/lib/types";

export default function NewQuizPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("PDF fayl tanlang.");
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("Faqat PDF fayl yuklang.");
    setLoading(true); setError("");
    const raw = new FormData(event.currentTarget);
    const form = new FormData();
    form.append("file", file);
    form.append("title", String(raw.get("title") || ""));
    form.append("mode", String(raw.get("mode") || "auto"));
    form.append("question_count", String(raw.get("question_count") || "10"));
    try { const quiz = await api<Quiz>("/quizzes/import-pdf/", { method: "POST", body: form }); router.push(`/dashboard/quizzes/${quiz.id}`); }
    catch (err) { setError(err instanceof Error ? err.message : "PDF import xatoligi"); }
    finally { setLoading(false); }
  }

  return <main className="dashboard-page"><div className="container narrow"><div className="page-head"><div><span className="eyebrow">YANGI TEST</span><h1>PDF fayl yuklang</h1></div></div><form className="panel upload-form" onSubmit={submit}>{error && <div className="alert error">{error}</div>}<label>Test nomi<input name="title" placeholder="Masalan: 9-sinf tarix testi" /></label><label className={`dropzone ${file ? "has-file" : ""}`}><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /><div className="pdf-icon">PDF</div><strong>{file ? file.name : "PDF faylni tanlang"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maksimum 15 MB"}</span></label><div className="form-grid two"><label>Import turi<select name="mode" defaultValue="auto"><option value="auto">Avtomatik aniqlash</option><option value="ready_test">Tayyor A/B/C/D test</option><option value="content">Materialdan AI test</option></select></label><label>AI savollar soni<input name="question_count" type="number" min="1" max="50" defaultValue="10" /></label></div><div className="info-box"><strong>Maslahat:</strong> Tayyor testda savollar 1., 2. va variantlar A), B), C), D) ko‘rinishida bo‘lsin. Scanned PDF hozircha OCRsiz ishlamaydi.</div><button className="button full" disabled={loading}>{loading ? "PDF qayta ishlanmoqda..." : "Testify aylantirish →"}</button></form></div></main>;
}
