import Link from "next/link";

export default function NotFound() {
  return <main className="state-page"><div><span className="state-code">404</span><h1>Sahifa topilmadi</h1><p>Havola noto‘g‘ri yoki sahifa o‘chirilgan.</p><Link className="button" href="/">Bosh sahifaga qaytish</Link></div></main>;
}
