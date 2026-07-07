import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">O‘QITUVCHILAR UCHUN AI PLATFORMА</div>
            <h1>PDF faylni bir necha soniyada <span>interaktiv testga</span> aylantiring.</h1>
            <p className="hero-copy">Tayyor testni yuklang yoki dars materialidan yangi savollar yarating. Havolani o‘quvchilarga yuboring va natijalarni avtomatik oling.</p>
            <div className="hero-actions"><Link href="/register" className="button large">Bepul boshlash →</Link><Link href="/login" className="button ghost large">Demo hisobga kirish</Link></div>
            <div className="trust-row"><span>✓ Kredit karta kerak emas</span><span>✓ O‘zbekcha interfeys</span><span>✓ CSV natija export</span></div>
          </div>
          <div className="hero-card"><div className="window-bar"><i></i><i></i><i></i></div><div className="upload-visual"><div className="pdf-icon">PDF</div><strong>Tarix_9-sinf_test.pdf</strong><span>24 ta savol aniqlandi</span><div className="progress"><b></b></div><div className="success-chip">✓ Test tayyor</div></div></div>
        </div>
      </section>
      <section className="section"><div className="container"><div className="section-heading"><span className="eyebrow">QANDAY ISHLAYDI?</span><h2>PDF’dan natijagacha — 3 qadam</h2></div><div className="steps-grid">{[["01","PDF yuklang","Tayyor A/B/C/D test yoki oddiy dars materialini tanlang."],["02","Tekshiring","Savollar, variantlar, timer va natija ko‘rsatish sozlamalarini tahrirlang."],["03","Ulashib yuboring","Linkni o‘quvchilarga bering, javoblarni kuzating va CSV yuklab oling."]].map(([n,title,text]) => <article className="step-card" key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    </main>
  );
}
