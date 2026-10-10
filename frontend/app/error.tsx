"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-page"><div><span className="state-code">XATO</span><h1>Nimadir ishlamadi</h1><p>Sahifani qayta yuklab ko‘ring. Muammo takrorlansa, keyinroq urinib ko‘ring.</p><button className="button" onClick={reset}>Qayta urinish</button></div></main>;
}
