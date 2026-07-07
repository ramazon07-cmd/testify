"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearTokens, isAuthenticated } from "@/lib/auth";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => setAuthed(isAuthenticated()), [pathname]);

  function logout() {
    clearTokens();
    setAuthed(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link href="/" className="brand"><span className="brand-mark">T</span>Testify</Link>
        <nav className="nav-links">
          {authed ? <>
            <Link href="/dashboard">Dashboard</Link>
            <button className="link-button" onClick={logout}>Chiqish</button>
          </> : <>
            <Link href="/login">Kirish</Link>
            <Link href="/register" className="button small">Boshlash</Link>
          </>}
        </nav>
      </div>
    </header>
  );
}
