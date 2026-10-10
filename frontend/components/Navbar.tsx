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

  const isDashboard = pathname.startsWith("/dashboard");

  if (pathname.startsWith("/quiz/")) return null;

  return (
    <header className={`navbar ${pathname === "/" ? "landing-navbar" : authed ? "app-navbar" : ""}`}>
      <div className="container nav-inner">
        <div className="nav-brand-group">
          <Link href="/" className="brand"><span className="brand-mark">T</span><span>Testify</span></Link>
          {pathname === "/" && <span className="brand-status"><i /> Beta</span>}
          {authed && pathname !== "/" && <span className="app-product-label"><i /> Markaz paneli</span>}
        </div>
        <nav className="nav-links">
          {pathname === "/" && <div className="nav-anchor-links"><a href="#how-it-works">Qanday ishlaydi</a><a href="#features">Imkoniyatlar</a></div>}
          {authed ? <>
            <Link href="/dashboard/new" className="nav-create"><span aria-hidden="true">＋</span><b>Yangi sinov</b></Link>
            <Link href="/dashboard" aria-current={isDashboard ? "page" : undefined} className={`nav-dashboard ${isDashboard ? "active" : ""}`}><span className="dashboard-glyph" aria-hidden="true"><i /><i /><i /><i /></span><span className="nav-dashboard-copy"><strong>Panel</strong><small>Boshqaruv</small></span></Link>
            <span className="nav-divider" aria-hidden="true" />
            <button className="nav-logout" onClick={logout}><span>Chiqish</span><b aria-hidden="true">↗</b></button>
          </> : <>
            <Link href="/login" className="nav-login">Kirish</Link>
            <Link href="/register" className="button small nav-cta">Boshlash <span>↗</span></Link>
          </>}
        </nav>
      </div>
    </header>
  );
}
