"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiAll } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { BulkStudentResult, Quiz, Student, StudentGroup } from "@/lib/types";

const statusLabel = { draft: "Qoralama", published: "Faol", closed: "Yopilgan" };

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [bulkRows, setBulkRows] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: number; name: string; parent_phone: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    const [quizRows, groupRows] = await Promise.all([apiAll<Quiz>("/quizzes/"), apiAll<StudentGroup>("/groups/")]);
    setQuizzes(quizRows);
    setGroups(groupRows);
    setSelectedGroup((current) => current && groupRows.some((group) => group.id === current) ? current : groupRows[0]?.id || null);
  }, []);

  const loadStudents = useCallback(async (groupId: number) => {
    setStudentsLoading(true);
    try { setStudents(await apiAll<Student>(`/students/?group=${groupId}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "O‘quvchilar yuklanmadi."); }
    finally { setStudentsLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    loadOverview().catch((caught) => setError(caught instanceof Error ? caught.message : "Panel yuklanmadi.")).finally(() => setLoading(false));
  }, [loadOverview, router]);

  useEffect(() => {
    if (selectedGroup) void loadStudents(selectedGroup);
    else setStudents([]);
  }, [loadStudents, selectedGroup]);

  function clearNotice() { setError(""); setMessage(""); }

  async function createGroup(event: FormEvent) {
    event.preventDefault(); clearNotice();
    try {
      const group = await api<StudentGroup>("/groups/", { method: "POST", body: JSON.stringify({ name: groupName }) });
      setGroupName("");
      await loadOverview();
      setSelectedGroup(group.id);
      setMessage("Guruh yaratildi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Guruh yaratilmadi."); }
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault(); if (!editingGroup) return; clearNotice();
    try {
      await api(`/groups/${editingGroup.id}/`, { method: "PATCH", body: JSON.stringify({ name: editingGroup.name }) });
      setEditingGroup(null); await loadOverview(); setMessage("Guruh nomi yangilandi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Guruh yangilanmadi."); }
  }

  async function deleteGroup(group: StudentGroup) {
    if (!window.confirm(`“${group.name}” guruhi va uning o‘quvchilarini o‘chirasizmi?`)) return;
    clearNotice();
    try { await api(`/groups/${group.id}/`, { method: "DELETE" }); await loadOverview(); setMessage("Guruh o‘chirildi."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Guruh o‘chirilmadi."); }
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault(); if (!selectedGroup) return; clearNotice();
    try {
      await api<Student>("/students/", { method: "POST", body: JSON.stringify({ group: selectedGroup, name: studentName, parent_phone: parentPhone }) });
      setStudentName(""); setParentPhone(""); await Promise.all([loadStudents(selectedGroup), loadOverview()]); setMessage("O‘quvchi qo‘shildi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "O‘quvchi qo‘shilmadi."); }
  }

  async function importStudents(event: FormEvent) {
    event.preventDefault(); if (!selectedGroup) return; clearNotice();
    try {
      const result = await api<BulkStudentResult>("/students/bulk/", { method: "POST", body: JSON.stringify({ group: selectedGroup, rows: bulkRows }) });
      setBulkRows(""); setShowBulk(false); await Promise.all([loadStudents(selectedGroup), loadOverview()]);
      setMessage(`${result.created_count} ta o‘quvchi qo‘shildi${result.skipped_count ? `, ${result.skipped_count} ta takror o‘tkazib yuborildi` : ""}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ro‘yxat import qilinmadi."); }
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault(); if (!editingStudent || !selectedGroup) return; clearNotice();
    try {
      await api(`/students/${editingStudent.id}/`, { method: "PATCH", body: JSON.stringify({ name: editingStudent.name, parent_phone: editingStudent.parent_phone }) });
      setEditingStudent(null); await loadStudents(selectedGroup); setMessage("O‘quvchi ma’lumoti yangilandi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "O‘quvchi yangilanmadi."); }
  }

  async function deleteStudent(student: Student) {
    if (!selectedGroup || !window.confirm(`${student.name} ro‘yxatdan o‘chirilsinmi?`)) return;
    clearNotice();
    try { await api(`/students/${student.id}/`, { method: "DELETE" }); await Promise.all([loadStudents(selectedGroup), loadOverview()]); setMessage("O‘quvchi o‘chirildi."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "O‘quvchi o‘chirilmadi."); }
  }

  const active = quizzes.filter((quiz) => quiz.status === "published").length;
  const attempts = quizzes.reduce((sum, quiz) => sum + quiz.attempt_count, 0);
  const selected = groups.find((group) => group.id === selectedGroup);

  return <main className="dashboard-page"><div className="container">
    <div className="page-head dashboard-title"><div><span className="eyebrow">TESTIFY / MARKAZ PANELI</span><h1>Sinovlar boshqaruvi</h1><p>Guruh, o‘quvchi, test va natija — barchasi bitta ish oqimida.</p></div><Link href="/dashboard/new" className="button"><span aria-hidden="true">＋</span> Yangi sinov</Link></div>
    {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
    <div className="stats-grid dashboard-metrics"><div className="stat-card"><span>Guruh</span><strong>{groups.length}</strong></div><div className="stat-card"><span>Faol sinov</span><strong>{active}</strong></div><div className="stat-card"><span>Topshiriqlar</span><strong>{attempts}</strong></div></div>
    <div className="group-dashboard-grid">
      <section className="panel group-panel"><div className="section-heading"><div><span className="eyebrow">01 / TASHKILOT</span><h2>Guruhlar</h2></div></div>
        <form className="inline-form" onSubmit={createGroup}><input aria-label="Guruh nomi" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Masalan: Matematika 11-A" required maxLength={120} /><button className="button" type="submit">Qo‘shish</button></form>
        {loading ? <div className="empty compact-empty">Ma’lumot yuklanmoqda…</div> : groups.length === 0 ? <div className="empty compact-empty"><span className="empty-index">01</span><strong>Birinchi guruhni yarating</strong><span>Masalan: “Matematika · 11-A”.</span></div> : <div className="group-list">{groups.map((group) => editingGroup?.id === group.id ? <form className="edit-row" key={group.id} onSubmit={saveGroup}><input autoFocus value={editingGroup.name} onChange={(event) => setEditingGroup({ ...editingGroup, name: event.target.value })} /><button type="submit">Saqlash</button><button type="button" onClick={() => setEditingGroup(null)}>Bekor</button></form> : <div className={`group-row ${selectedGroup === group.id ? "selected" : ""}`} key={group.id}><button className="group-select" type="button" onClick={() => setSelectedGroup(group.id)}><span><strong>{group.name}</strong><small>{group.student_count} o‘quvchi</small></span><span aria-hidden="true">→</span></button><div className="row-actions"><button type="button" onClick={() => setEditingGroup({ id: group.id, name: group.name })} aria-label={`${group.name} guruhini tahrirlash`}>Tahrir</button><button className="danger" type="button" onClick={() => void deleteGroup(group)} aria-label={`${group.name} guruhini o‘chirish`}>O‘chir</button></div></div>)}</div>}
      </section>
      <section className="panel group-panel"><div className="section-heading"><div><span className="eyebrow">02 / O‘QUVCHILAR</span><h2>{selected?.name || "Guruh ro‘yxati"}</h2></div>{selectedGroup && <span className="roster-count">{students.length} ta</span>}</div>
        {selectedGroup ? <><form className="student-form" onSubmit={addStudent}><input aria-label="O‘quvchi ismi" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Ism va familiya" required maxLength={150} /><input aria-label="Ota-ona telefoni" value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} placeholder="Ota-ona telefoni" /><button className="button" type="submit">Qo‘shish</button></form><button className="bulk-toggle" type="button" onClick={() => setShowBulk((current) => !current)}>{showBulk ? "Ommaviy importni yopish" : "＋ Ro‘yxatni birdan import qilish"}</button>{showBulk && <form className="bulk-form" onSubmit={importStudents}><label>Har qatorda: Ism Familiya, +998…<textarea value={bulkRows} onChange={(event) => setBulkRows(event.target.value)} placeholder={"Aziza Karimova, +998901234567\nBekzod Aliyev, +998907654321"} required /></label><button className="button full" type="submit">Ro‘yxatni import qilish</button></form>}<div className="student-list">{studentsLoading ? <div className="empty compact-empty">Ro‘yxat yuklanmoqda…</div> : students.map((student) => editingStudent?.id === student.id ? <form className="edit-row student-edit-row" key={student.id} onSubmit={saveStudent}><input autoFocus value={editingStudent.name} onChange={(event) => setEditingStudent({ ...editingStudent, name: event.target.value })} /><input value={editingStudent.parent_phone} onChange={(event) => setEditingStudent({ ...editingStudent, parent_phone: event.target.value })} placeholder="Telefon" /><button type="submit">Saqlash</button><button type="button" onClick={() => setEditingStudent(null)}>Bekor</button></form> : <div className="student-row" key={student.id}><span><strong>{student.name}</strong><small>{student.parent_phone || "Telefon kiritilmagan"}</small></span><div className="row-actions"><button type="button" onClick={() => setEditingStudent({ id: student.id, name: student.name, parent_phone: student.parent_phone })}>Tahrir</button><button className="danger" type="button" onClick={() => void deleteStudent(student)}>O‘chir</button></div></div>)}{!studentsLoading && students.length === 0 && <div className="empty compact-empty">Bu guruhga hali o‘quvchi qo‘shilmagan.</div>}</div></> : <div className="empty compact-empty roster-empty"><span className="empty-index">02</span><strong>Guruh yarating</strong><span>O‘quvchilar ro‘yxati shu yerda boshqariladi.</span></div>}
      </section>
    </div>
    <div className="page-head quiz-section-head"><div><span className="eyebrow">03 / BAHOLASH</span><h2>So‘nggi sinovlar</h2></div><span className="section-note">Test yaratish → guruhga ulash → natijani ko‘rish</span></div>
    {quizzes.length === 0 ? <div className="empty"><h3>Sinovlar hali yo‘q</h3><p>PDF yoki javob kalitidan birinchi sinovni yarating.</p><Link className="button" href="/dashboard/new">Test yaratish</Link></div> : <div className="quiz-list">{quizzes.map((quiz) => <Link href={`/dashboard/quizzes/${quiz.id}`} className="quiz-row" key={quiz.id}><div className="quiz-icon">Q</div><div className="quiz-main"><strong>{quiz.title}</strong><span>{quiz.group_name || "Guruh biriktirilmagan"} · {quiz.question_count} savol</span></div><span className={`status ${quiz.status}`}>{statusLabel[quiz.status]}</span><div className="quiz-meta"><strong>{quiz.attempt_count}</strong><span>urinish</span></div><span className="arrow">→</span></Link>)}</div>}
  </div></main>;
}
