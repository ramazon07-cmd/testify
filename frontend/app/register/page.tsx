"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { username: form.get("username"), first_name: form.get("first_name"), last_name: form.get("last_name"), email: form.get("email"), password: form.get("password") };
    try {
      await api("/auth/register/", { method: "POST", body: JSON.stringify(payload) });
      const tokens = await api<{access: string; refresh: string}>("/auth/login/", { method: "POST", body: JSON.stringify({ username: payload.username, password: payload.password }) });
      saveTokens(tokens.access, tokens.refresh); router.push("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Ro‘yxatdan o‘tish xatoligi"); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><span className="eyebrow">BEPUL BOSHLANG</span><h1>O‘qituvchi hisobi yarating</h1>{error && <div className="alert error">{error}</div>}<div className="form-grid two"><label>Ism<input name="first_name" required /></label><label>Familiya<input name="last_name" required /></label></div><label>Username<input name="username" required /></label><label>Email<input name="email" type="email" required /></label><label>Parol<input name="password" type="password" minLength={8} required /></label><button className="button full" disabled={loading}>{loading ? "Yaratilmoqda..." : "Hisob yaratish"}</button><p>Hisobingiz bormi? <Link href="/login">Kiring</Link></p></form></main>;
}
