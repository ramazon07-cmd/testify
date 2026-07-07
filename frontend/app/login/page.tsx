"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{access: string; refresh: string}>("/auth/login/", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      saveTokens(data.access, data.refresh);
      router.push("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Login xatoligi"); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="eyebrow">XUSH KELIBSIZ</span><h1>O‘qituvchi kabinetiga kirish</h1>{error && <div className="alert error">{error}</div>}<label>Username<input name="username" required placeholder="teacher" /></label><label>Parol<input name="password" type="password" required placeholder="••••••••" /></label><button className="button full" disabled={loading}>{loading ? "Kirilmoqda..." : "Kirish"}</button><p>Hisob yo‘qmi? <Link href="/register">Ro‘yxatdan o‘ting</Link></p></form></main>;
}
