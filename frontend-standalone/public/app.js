(() => {
  const DEFAULT_API_URL = 'http://127.0.0.1:8000/api';
  const ACCESS_KEY = 'Testify_access';
  const REFRESH_KEY = 'Testify_refresh';
  const API_KEY = 'Testify_api_url';
  const $app = document.getElementById('app');

  const state = {
    timers: [],
  };

  function apiBase() {
    return localStorage.getItem(API_KEY) || DEFAULT_API_URL;
  }

  function setApiBase(url) {
    localStorage.setItem(API_KEY, url.replace(/\/$/, ''));
    render();
  }

  function token() { return localStorage.getItem(ACCESS_KEY); }
  function refreshToken() { return localStorage.getItem(REFRESH_KEY); }
  function saveTokens(access, refresh) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }
  function clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
  function isAuthed() { return Boolean(token()); }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function fmtDate(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString('uz-UZ'); } catch { return value; }
  }

  function toLocalInput(value) {
    if (!value) return '';
    const d = new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function navigate(path) {
    history.pushState({}, '', path);
    render();
  }

  async function refreshAccess() {
    const refresh = refreshToken();
    if (!refresh) throw new Error('Session tugagan. Qayta login qiling.');
    const response = await fetch(`${apiBase()}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access) {
      clearTokens();
      throw new Error(data.detail || 'Session tugagan. Qayta login qiling.');
    }
    localStorage.setItem(ACCESS_KEY, data.access);
    return data.access;
  }

  async function request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const access = token();
    if (access) headers.set('Authorization', `Bearer ${access}`);
    const response = await fetch(`${apiBase()}${path}`, { ...options, headers, cache: 'no-store' });
    if (response.status === 401 && retry && refreshToken()) {
      await refreshAccess();
      return request(path, options, false);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
      throw new Error(data.detail || data.non_field_errors?.[0] || JSON.stringify(data) || 'Server xatoligi yuz berdi.');
    }
    if (options.raw) return response;
    return contentType.includes('json') ? response.json() : response.text();
  }

  function navbar() {
    const authed = isAuthed();
    const inApp = location.pathname.startsWith('/dashboard') || authed;
    const brandHref = inApp ? '/dashboard' : '/';
    return `
      <header class="navbar glass-nav ${inApp ? 'app-navbar' : 'marketing-navbar'}">
        <div class="container nav-inner">
          <a href="${brandHref}" data-link class="brand"><span class="brand-mark">T</span>Testify</a>
          <nav class="nav-links">
            ${inApp ? `
              <a href="/dashboard" data-link class="app-nav-link">Testlar</a>
              <a href="/dashboard/new" data-link class="app-nav-link">Yangi test</a>
              <a href="/features" data-link class="app-nav-link hide-mobile">Imkoniyatlar</a>
              <button class="link-button danger-link" data-action="logout">Chiqish</button>
            ` : `
              <a href="/features" data-link class="hide-mobile">Imkoniyatlar</a>
              <a href="/use-cases" data-link class="hide-mobile">Kimlar uchun</a>
              <a href="/founder" data-link class="hide-mobile">Asoschi</a>
              <a href="/login" data-link>Kirish</a>
              <a href="/register" data-link class="button small">Boshlash</a>
            `}
          </nav>
        </div>
      </header>`;
  }  function apiBanner() {
    return `<div class="api-banner"><code>${esc(apiBase())}</code><button class="button ghost small" data-action="api-url">API</button></div>`;
  }

  function pageShell(html) {
    $app.innerHTML = navbar() + html;
    bindGlobal();
  }

    function bindGlobal() {
    document.querySelectorAll('[data-link]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const href = el.getAttribute('href');
        if (!href || href.startsWith('http')) return;
        e.preventDefault();
        navigate(href);
      });
    });
    document.querySelectorAll('[data-action="logout"]').forEach((el) => el.addEventListener('click', () => {
      clearTokens();
      navigate('/');
    }));
    document.querySelectorAll('[data-action="api-url"]').forEach((el) => el.addEventListener('click', () => {
      const next = prompt('Backend API URL:', apiBase());
      if (next) setApiBase(next);
    }));
  }

  function clearTimers() {
    state.timers.forEach(clearInterval);
    state.timers = [];
  }

  function homePage() {
    pageShell(`
      <main>
        <section class="hero hero-premium">
          <div class="container hero-grid">
            <div>
              <div class="eyebrow">O‘QITUVCHILAR VA O‘QUV MARKAZLAR UCHUN</div>
              <h1>PDF testlaringizni <span>professional online imtihon</span> platformasiga aylantiring.</h1>
              <p class="hero-copy">Testify PDF faylni yuklaydi, savollarni ajratadi, o‘qituvchiga tahrirlash imkonini beradi, o‘quvchiga link yaratadi va natijalarni avtomatik dashboardga yig‘adi.</p>
              <div class="hero-actions">
                <a href="/register" data-link class="button large">Bepul boshlash →</a>
                <a href="/features" data-link class="button ghost large">Platformani ko‘rish</a>
              </div>
              <div class="trust-row"><span>✓ npm install kerak emas</span><span>✓ O‘zbekcha interfeys</span><span>✓ PDF → test → natija</span></div>
            </div>
            <div class="hero-product">
              <div class="product-top"><span>Live import</span><b>99%</b></div>
              <div class="hero-card"><div class="window-bar"><i></i><i></i><i></i></div><div class="upload-visual"><div class="pdf-icon">PDF</div><strong>CEFR_B2_mock_test.pdf</strong><span>32 ta savol aniqlandi</span><div class="progress"><b></b></div><div class="success-chip">✓ Test tayyor</div></div></div>
              <div class="floating-card left"><b>186</b><span>javob qabul qilindi</span></div>
              <div class="floating-card right"><b>82%</b><span>o‘rtacha natija</span></div>
            </div>
          </div>
        </section>

        <section class="proof-strip">
          <div class="container proof-grid">
            <div><strong>5 daqiqa</strong><span>PDFdan test linkgacha</span></div>
            <div><strong>0 login</strong><span>o‘quvchi uchun oddiy kirish</span></div>
            <div><strong>CSV</strong><span>natijalarni eksport qilish</span></div>
            <div><strong>UZ</strong><span>mahalliy ta’lim bozori uchun</span></div>
          </div>
        </section>

        <section class="section problem-section">
          <div class="container split-grid">
            <div>
              <span class="eyebrow">MUAMMO</span>
              <h2>Ustozlar test tuzishdan ko‘ra, o‘quvchi natijasini tahlil qilishi kerak.</h2>
              <p class="lead">Bugungi real holat: PDF Telegramga tashlanadi, o‘quvchi daftariga yechadi, javoblar qo‘lda tekshiriladi, natija esa Excel yoki chat ichida yo‘qolib ketadi.</p>
            </div>
            <div class="pain-list">
              <article><b>01</b><h3>Qo‘lda tekshirish</h3><p>30 nafar o‘quvchi test ishlasa, ustozning kechasi ketadi.</p></article>
              <article><b>02</b><h3>Natija tarqoq</h3><p>Kim necha oldi, qaysi savoldan ko‘p xato qildi — buni ko‘rish qiyin.</p></article>
              <article><b>03</b><h3>Takroriy ish</h3><p>Har bir test uchun bir xil jarayon qayta-qayta qilinadi.</p></article>
            </div>
          </div>
        </section>

        <section class="section alt-section">
          <div class="container">
            <div class="section-heading wide"><span class="eyebrow">YECHIM</span><h2>Testify — o‘qituvchi uchun imtihon operatsion tizimi.</h2><p>Platforma bitta vazifani qiladi: PDF testlarni o‘quvchi ishlay oladigan, ustoz natijani ko‘ra oladigan interaktiv sistemaga aylantiradi.</p></div>
            <div class="feature-grid big">
              <article class="feature-card"><span>PDF Import</span><h3>Tayyor testni yuklang</h3><p>A/B/C/D formatdagi PDF testlar avtomatik savol va variantlarga ajratiladi.</p></article>
              <article class="feature-card"><span>AI Generator</span><h3>Materialdan savol yarating</h3><p>Dars matnidan AI yordamida yangi test savollarini yaratish mumkin.</p></article>
              <article class="feature-card"><span>Editor</span><h3>Ustoz nazorati</h3><p>Savol, variant, to‘g‘ri javob va izohlarni publish qilishdan oldin tahrirlang.</p></article>
              <article class="feature-card"><span>Public Link</span><h3>O‘quvchiga link bering</h3><p>O‘quvchi login qilmasdan test kod yoki link orqali ishlaydi.</p></article>
              <article class="feature-card"><span>Dashboard</span><h3>Natijalar bitta joyda</h3><p>Ball, foiz, urinishlar va o‘rtacha natija real dashboardga tushadi.</p></article>
              <article class="feature-card"><span>Export</span><h3>CSV yuklab oling</h3><p>Natijalarni Excel/Google Sheets uchun CSV formatda eksport qiling.</p></article>
            </div>
          </div>
        </section>

        <section class="section workflow-section">
          <div class="container">
            <div class="section-heading"><span class="eyebrow">WORKFLOW</span><h2>PDF’dan natijagacha — 4 qadam</h2></div>
            <div class="timeline-grid">
              <article><span>1</span><h3>PDF yuklang</h3><p>Tayyor test yoki dars materialini platformaga tashlang.</p></article>
              <article><span>2</span><h3>Savollarni tekshiring</h3><p>AI yoki parser topgan savollarni ustoz sifat nazoratidan o‘tkazadi.</p></article>
              <article><span>3</span><h3>Testni publish qiling</h3><p>Duration, shuffle, score visibility kabi sozlamalarni belgilang.</p></article>
              <article><span>4</span><h3>Natijani oling</h3><p>O‘quvchilar ishlaydi, ustoz esa dashboarddan tahlil qiladi.</p></article>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container split-grid reverse">
            <div class="dashboard-mock">
              <div class="mock-head"><b>Testify Dashboard</b><span>Live</span></div>
              <div class="mock-stats"><div><strong>24</strong><span>testlar</span></div><div><strong>1,248</strong><span>urinishlar</span></div><div><strong>78%</strong><span>o‘rtacha</span></div></div>
              <div class="mock-table"><p><b>Ali Karimov</b><span>91%</span></p><p><b>Madina Sobir</b><span>84%</span></p><p><b>Jasur Olim</b><span>76%</span></p></div>
            </div>
            <div>
              <span class="eyebrow">NATIJAGA YO‘NALTIRILGAN</span>
              <h2>Ustoz endi “kim nechta oldi?” deb qo‘lda sanamaydi.</h2>
              <p class="lead">Testify’da har bir test yakunida natijalar avtomatik yig‘iladi. Bu o‘quv markaz uchun nazorat, ustoz uchun vaqt, o‘quvchi uchun tez feedback beradi.</p>
              <div class="check-list"><p>✓ avtomatik ball hisoblash</p><p>✓ natijani ko‘rsatish/yashirish</p><p>✓ test vaqtini belgilash</p><p>✓ natijalarni CSV eksport qilish</p></div>
            </div>
          </div>
        </section>

        <section class="section dark-section">
          <div class="container cta-grid">
            <div><span class="eyebrow light">STARTUP VISION</span><h2>Testify faqat quiz tool emas. Bu — O‘zbekiston ta’limi uchun exam infrastructure.</h2></div>
            <div><p>Keyingi bosqichlarda OCR, center CRM, teacher analytics, student progress va speaking checker modullari qo‘shilishi mumkin.</p><a href="/founder" data-link class="button large">Asoschi haqida →</a></div>
          </div>
        </section>
      </main>`);
  }

    function loginPage() {
    pageShell(`
      <main class="auth-page"><form class="auth-card" id="login-form">
        <span class="eyebrow">XUSH KELIBSIZ</span><h1>O‘qituvchi kabinetiga kirish</h1>
        <div id="form-error"></div>
        <label>Username<input name="username" required placeholder="teacher" /></label>
        <label>Parol<input name="password" type="password" required placeholder="••••••••" /></label>
        <button class="button full">Kirish</button>
        <p>Hisob yo‘qmi? <a href="/register" data-link>Ro‘yxatdan o‘ting</a></p>
      </form></main>`);
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = document.getElementById('form-error'); box.innerHTML = '';
      const form = new FormData(e.currentTarget);
      try {
        const data = await request('/auth/login/', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
        saveTokens(data.access, data.refresh);
        navigate('/dashboard');
      } catch (err) { box.innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
    });
  }

  function registerPage() {
    pageShell(`
      <main class="auth-page"><form class="auth-card" id="register-form">
        <span class="eyebrow">BEPUL BOSHLANG</span><h1>O‘qituvchi hisobi yarating</h1>
        <div id="form-error"></div>
        <div class="form-grid two"><label>Ism<input name="first_name" required /></label><label>Familiya<input name="last_name" required /></label></div>
        <label>Username<input name="username" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Parol<input name="password" type="password" minlength="8" required /></label>
        <button class="button full">Hisob yaratish</button>
        <p>Hisobingiz bormi? <a href="/login" data-link>Kiring</a></p>
      </form></main>`);
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = document.getElementById('form-error'); box.innerHTML = '';
      const form = new FormData(e.currentTarget);
      const payload = Object.fromEntries(form.entries());
      try {
        await request('/auth/register/', { method: 'POST', body: JSON.stringify(payload) });
        const data = await request('/auth/login/', { method: 'POST', body: JSON.stringify({ username: payload.username, password: payload.password }) });
        saveTokens(data.access, data.refresh);
        navigate('/dashboard');
      } catch (err) { box.innerHTML = `<div class="alert error">${esc(err.message)}</div>`; }
    });
  }

  async function dashboardPage() {
    if (!isAuthed()) return navigate('/login');
    pageShell(`<main class="dashboard-page"><div class="container"><div class="empty">Yuklanmoqda...</div></div></main>`);
    try {
      const data = await request('/quizzes/');
      const quizzes = data.results || [];
      const totalAttempts = quizzes.reduce((sum, q) => sum + Number(q.attempt_count || 0), 0);
      const published = quizzes.filter(q => q.status === 'published').length;
      pageShell(`
        <main class="dashboard-page"><div class="container">
          <div class="page-head"><div><span class="eyebrow">DASHBOARD</span><h1>Testlaringiz</h1></div><a href="/dashboard/new" data-link class="button">+ PDF yuklash</a></div>
          <div class="stats-grid"><div class="stat-card"><span>Jami testlar</span><strong>${quizzes.length}</strong></div><div class="stat-card"><span>Aktiv testlar</span><strong>${published}</strong></div><div class="stat-card"><span>Jami urinishlar</span><strong>${totalAttempts}</strong></div></div>
          ${quizzes.length ? `<div class="quiz-list">${quizzes.map(q => `<div class="quiz-row" data-open="${q.id}"><div class="quiz-icon">Q</div><div class="quiz-main"><strong>${esc(q.title)}</strong><span>${q.question_count} savol · ${q.duration_minutes} daqiqa</span></div><span class="status ${esc(q.status)}">${esc(q.status)}</span><div class="quiz-meta"><strong>${q.attempt_count}</strong><span>urinish</span></div><span class="arrow">→</span></div>`).join('')}</div>` : `<div class="empty"><h3>Hali test yo‘q</h3><p>Birinchi PDF faylingizni yuklang.</p><a class="button" data-link href="/dashboard/new">Test yaratish</a></div>`}
        </div></main>`);
      document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => navigate(`/dashboard/quizzes/${el.dataset.open}`)));
    } catch (err) {
      pageShell(`<main class="dashboard-page"><div class="container"><div class="alert error">${esc(err.message)}</div></div></main>`);
    }
  }

  function newQuizPage() {
    if (!isAuthed()) return navigate('/login');
    pageShell(`
      <main class="dashboard-page"><div class="container narrow">
        <div class="page-head"><div><span class="eyebrow">YANGI TEST</span><h1>PDF fayl yuklang</h1></div></div>
        <form class="panel upload-form" id="upload-form">
          <div id="form-error"></div>
          <label>Test nomi<input name="title" placeholder="Masalan: 9-sinf tarix testi" /></label>
          <label class="dropzone" id="dropzone"><input id="file-input" type="file" accept="application/pdf" /><div class="pdf-icon">PDF</div><strong id="file-name">PDF faylni tanlang</strong><span id="file-size">Maksimum 15 MB</span></label>
          <div class="form-grid two"><label>Import turi<select name="mode"><option value="auto">Avtomatik aniqlash</option><option value="ready_test">Tayyor test</option><option value="content">Materialdan AI test</option></select></label><label>AI savollar soni<input name="question_count" type="number" min="1" max="50" value="10" /></label></div>
          <div class="info-box"><strong>Maslahat:</strong> Tayyor testda savollar 1., 2. va variantlar A), B), C), D) ko‘rinishida bo‘lsin.</div>
          <button class="button full" id="upload-btn">Testify aylantirish →</button>
        </form>
      </div></main>`);
    let file = null;
    document.getElementById('file-input').addEventListener('change', (e) => {
      file = e.target.files?.[0] || null;
      document.getElementById('dropzone').classList.toggle('has-file', Boolean(file));
      document.getElementById('file-name').textContent = file ? file.name : 'PDF faylni tanlang';
      document.getElementById('file-size').textContent = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Maksimum 15 MB';
    });
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('form-error'); errBox.innerHTML = '';
      if (!file) { errBox.innerHTML = '<div class="alert error">PDF fayl tanlang.</div>'; return; }
      const btn = document.getElementById('upload-btn'); btn.disabled = true; btn.textContent = 'PDF qayta ishlanmoqda...';
      const raw = new FormData(e.currentTarget);
      const form = new FormData();
      form.append('file', file);
      form.append('title', raw.get('title') || '');
      form.append('mode', raw.get('mode') || 'auto');
      form.append('question_count', raw.get('question_count') || '10');
      try {
        const quiz = await request('/quizzes/import-pdf/', { method: 'POST', body: form });
        navigate(`/dashboard/quizzes/${quiz.id}`);
      } catch (err) {
        errBox.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
      } finally { btn.disabled = false; btn.textContent = 'Testify aylantirish →'; }
    });
  }

  function questionHtml(q, qIndex) {
    const choices = q.choices || [];
    return `<article class="question-card" data-question="${qIndex}">
      <div class="question-top"><span>${qIndex + 1}</span><button data-remove-question="${qIndex}">O‘chirish</button></div>
      <textarea data-q-text="${qIndex}" placeholder="Savol matni">${esc(q.text)}</textarea>
      <div class="choices-editor">${choices.map((c, cIndex) => `<label class="choice-edit"><input type="radio" name="correct-${qIndex}" data-correct="${qIndex}:${cIndex}" ${c.is_correct ? 'checked' : ''}/><b>${String.fromCharCode(65 + cIndex)}</b><input data-choice-text="${qIndex}:${cIndex}" value="${esc(c.text)}" placeholder="Variant" /></label>`).join('')}</div>
      <label style="margin-top:12px">Izoh<textarea data-q-explanation="${qIndex}" placeholder="Qisqa izoh">${esc(q.explanation || '')}</textarea></label>
    </article>`;
  }

  function emptyQuestion(order) {
    return { text: '', explanation: '', order, points: 1, choices: [0,1,2,3].map(i => ({ text: '', is_correct: i === 0, order: i })) };
  }

  async function quizEditorPage(id) {
    if (!isAuthed()) return navigate('/login');
    pageShell(`<main class="dashboard-page"><div class="container"><div class="empty">Yuklanmoqda...</div></div></main>`);
    try {
      let quiz = await request(`/quizzes/${id}/`);
      let questions = structuredClone(quiz.questions || []);
      const publicUrl = `${location.origin}/quiz/${quiz.share_code}`;
      function paint(message = '', error = '') {
        pageShell(`
          <main class="dashboard-page"><div class="container editor-layout">
            <section>
              <div class="page-head"><div><span class="eyebrow">TEST EDITOR</span><h1>${esc(quiz.title)}</h1></div><div class="head-actions"><button class="button ghost" data-action="save">Saqlash</button><button class="button" data-action="publish">Publish</button><button class="button ghost" data-action="close">Yopish</button></div></div>
              ${message ? `<div class="alert success">${esc(message)}</div>` : ''}${error ? `<div class="alert error">${esc(error)}</div>` : ''}
              <div class="question-stack" id="question-stack">${questions.map(questionHtml).join('')}</div>
              <button class="button ghost full" data-action="add-question">+ Savol qo‘shish</button>
            </section>
            <aside class="editor-sidebar"><div class="panel sticky">
              <h3>Test holati</h3><span class="status ${esc(quiz.status)}">${esc(quiz.status)}</span>
              <dl><div><dt>Savollar</dt><dd>${questions.length}</dd></div><div><dt>Vaqt</dt><dd>${quiz.duration_minutes} min</dd></div><div><dt>Kod</dt><dd>${quiz.share_code}</dd></div></dl>
              ${quiz.status === 'published' ? `<input readonly value="${esc(publicUrl)}" /><button class="button full" data-action="copy-link">Linkni nusxalash</button><a href="/quiz/${quiz.share_code}" data-link class="text-link">Testni ochish ↗</a>` : ''}
              <a href="/dashboard/quizzes/${quiz.id}/results" data-link class="button ghost full">Natijalarni ko‘rish</a>
            </div><div class="panel" style="margin-top:16px"><h3>Sozlamalar</h3><form id="settings-form" class="settings-stack">
              <label>Test nomi<input name="title" value="${esc(quiz.title)}" /></label>
              <label>Tavsif<textarea name="description">${esc(quiz.description || '')}</textarea></label>
              <label>Davomiylik / daqiqa<input name="duration_minutes" type="number" min="1" value="${quiz.duration_minutes}" /></label>
              <label class="check-row"><input name="shuffle_questions" type="checkbox" ${quiz.shuffle_questions ? 'checked' : ''}/> Savollarni aralashtirish</label>
              <label class="check-row"><input name="shuffle_choices" type="checkbox" ${quiz.shuffle_choices ? 'checked' : ''}/> Variantlarni aralashtirish</label>
              <label class="check-row"><input name="show_score" type="checkbox" ${quiz.show_score ? 'checked' : ''}/> O‘quvchiga natijani ko‘rsatish</label>
              <label class="check-row"><input name="one_attempt_per_student" type="checkbox" ${quiz.one_attempt_per_student ? 'checked' : ''}/> Bitta ism bilan 1 urinish</label>
              <label>Boshlanish vaqti<input name="starts_at" type="datetime-local" value="${esc(toLocalInput(quiz.starts_at))}" /></label>
              <label>Tugash vaqti<input name="ends_at" type="datetime-local" value="${esc(toLocalInput(quiz.ends_at))}" /></label>
              <button class="button ghost full">Sozlamalarni saqlash</button>
            </form></div></aside>
          </div></main>`);
        bindEditor();
      }
      async function saveQuestions() {
        questions = questions.map((q, qIndex) => ({ ...q, order: qIndex, points: Number(q.points || 1), choices: q.choices.map((c, cIndex) => ({ ...c, order: cIndex })) }));
        quiz = await request(`/quizzes/${id}/questions/`, { method: 'PUT', body: JSON.stringify({ questions }) });
        questions = structuredClone(quiz.questions || []);
      }
      async function saveSettings() {
        const form = new FormData(document.getElementById('settings-form'));
        const payload = {
          title: form.get('title') || quiz.title,
          description: form.get('description') || '',
          duration_minutes: Number(form.get('duration_minutes') || quiz.duration_minutes),
          shuffle_questions: form.get('shuffle_questions') === 'on',
          shuffle_choices: form.get('shuffle_choices') === 'on',
          show_score: form.get('show_score') === 'on',
          one_attempt_per_student: form.get('one_attempt_per_student') === 'on',
          starts_at: fromLocalInput(form.get('starts_at')),
          ends_at: fromLocalInput(form.get('ends_at')),
        };
        quiz = await request(`/quizzes/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      function syncQuestionsFromDom() {
        questions.forEach((q, qIndex) => {
          q.text = document.querySelector(`[data-q-text="${qIndex}"]`)?.value || '';
          q.explanation = document.querySelector(`[data-q-explanation="${qIndex}"]`)?.value || '';
          q.choices.forEach((c, cIndex) => {
            c.text = document.querySelector(`[data-choice-text="${qIndex}:${cIndex}"]`)?.value || '';
            c.is_correct = Boolean(document.querySelector(`[data-correct="${qIndex}:${cIndex}"]`)?.checked);
          });
        });
      }
      function bindEditor() {
        document.querySelectorAll('[data-remove-question]').forEach(btn => btn.addEventListener('click', () => { syncQuestionsFromDom(); questions.splice(Number(btn.dataset.removeQuestion), 1); paint(); }));
        document.querySelector('[data-action="add-question"]')?.addEventListener('click', () => { syncQuestionsFromDom(); questions.push(emptyQuestion(questions.length)); paint(); });
        document.querySelector('[data-action="save"]')?.addEventListener('click', async () => { try { syncQuestionsFromDom(); await saveSettings(); await saveQuestions(); paint('Savollar va sozlamalar saqlandi.'); } catch (err) { paint('', err.message); } });
        document.querySelector('[data-action="publish"]')?.addEventListener('click', async () => { try { syncQuestionsFromDom(); await saveSettings(); await saveQuestions(); quiz = await request(`/quizzes/${id}/publish/`, { method: 'POST' }); paint('Test e’lon qilindi. Linkni ulashishingiz mumkin.'); } catch (err) { paint('', err.message); } });
        document.querySelector('[data-action="close"]')?.addEventListener('click', async () => { try { quiz = await request(`/quizzes/${id}/close/`, { method: 'POST' }); paint('Test yopildi.'); } catch (err) { paint('', err.message); } });
        document.querySelector('[data-action="copy-link"]')?.addEventListener('click', async () => { await navigator.clipboard.writeText(publicUrl); alert('Link nusxalandi'); });
        document.getElementById('settings-form')?.addEventListener('submit', async (e) => { e.preventDefault(); try { syncQuestionsFromDom(); await saveSettings(); paint('Sozlamalar saqlandi.'); } catch (err) { paint('', err.message); } });
      }
      paint();
    } catch (err) { pageShell(`<main class="dashboard-page"><div class="container"><div class="alert error">${esc(err.message)}</div></div></main>`); }
  }

  async function resultsPage(id) {
    if (!isAuthed()) return navigate('/login');
    pageShell(`<main class="dashboard-page"><div class="container"><div class="empty">Yuklanmoqda...</div></div></main>`);
    try {
      const data = await request(`/quizzes/${id}/results/`);
      pageShell(`
        <main class="dashboard-page"><div class="container">
          <div class="page-head"><div><span class="eyebrow">NATIJALAR</span><h1>${esc(data.quiz.title)}</h1></div><div class="head-actions"><button class="button ghost" data-action="export-csv">CSV yuklab olish</button><a href="/dashboard/quizzes/${id}" data-link class="button ghost">Editor</a></div></div>
          <div class="stats-grid"><div class="stat-card"><span>Urinishlar</span><strong>${data.attempts.length}</strong></div><div class="stat-card"><span>O‘rtacha natija</span><strong>${data.average_percentage}%</strong></div><div class="stat-card"><span>Savollar</span><strong>${data.quiz.question_count}</strong></div></div>
          <div class="panel table-wrap"><table><thead><tr><th>O‘quvchi</th><th>Ball</th><th>Foiz</th><th>Vaqt</th></tr></thead><tbody>${data.attempts.map(a => `<tr><td><strong>${esc(a.student_name)}</strong></td><td>${a.score}/${a.max_score}</td><td>${a.percentage}%</td><td>${fmtDate(a.submitted_at)}</td></tr>`).join('')}</tbody></table>${data.attempts.length === 0 ? '<div class="empty">Hali hech kim test ishlamagan.</div>' : ''}</div>
        </div></main>`);
      document.querySelector('[data-action="export-csv"]').addEventListener('click', async () => {
        const response = await request(`/quizzes/${id}/results/export/`, { raw: true });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `quiz-${id}-results.csv`; a.click();
        URL.revokeObjectURL(url);
      });
    } catch (err) { pageShell(`<main class="dashboard-page"><div class="container"><div class="alert error">${esc(err.message)}</div></div></main>`); }
  }

  async function publicQuizPage(code) {
    pageShell(`<main class="quiz-page"><div class="quiz-shell"><div class="empty">Test yuklanmoqda...</div></div></main>`);
    try {
      const quiz = await request(`/public/quizzes/${code}/`);
      let attempt = null;
      let name = '';
      let answers = {};
      let seconds = quiz.duration_minutes * 60;
      function paintIntro(error = '') {
        pageShell(`<main class="quiz-page"><div class="quiz-intro"><div class="quiz-logo">T</div><span class="eyebrow">TEST KODI: ${esc(quiz.share_code)}</span><h1>${esc(quiz.title)}</h1><p>${esc(quiz.description || '')}</p><div class="quiz-facts"><span>${quiz.question_count} savol</span><span>${quiz.duration_minutes} daqiqa</span></div>${error ? `<div class="alert error">${esc(error)}</div>` : ''}<input id="student-name" value="${esc(name)}" placeholder="Ism va familiyangiz" /><button class="button full large" data-action="start-quiz">Testni boshlash →</button></div></main>`);
        document.querySelector('[data-action="start-quiz"]').addEventListener('click', async () => {
          name = document.getElementById('student-name').value.trim();
          if (!name) return paintIntro('Ism va familiyangizni yozing.');
          try {
            attempt = await request(`/public/quizzes/${code}/start/`, { method: 'POST', body: JSON.stringify({ student_name: name }) });
            seconds = Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000));
            paintQuiz();
          } catch (err) { paintIntro(err.message); }
        });
      }
      function timeText() { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
      function paintQuiz(error = '') {
        clearTimers();
        pageShell(`<main class="quiz-page"><form class="quiz-shell" id="quiz-form"><div class="quiz-header"><div><span class="eyebrow">${esc(quiz.title)}</span><strong>${esc(name)}</strong></div><div class="timer ${seconds < 60 ? 'danger' : ''}" id="timer">${timeText()}</div></div><div class="progress-text">Javob berildi: <span id="answered-count">${Object.keys(answers).length}</span>/${quiz.question_count}</div>${error ? `<div class="alert error">${esc(error)}</div>` : ''}<div class="question-stack">${(quiz.questions || []).map((q, qIndex) => `<article class="public-question"><h2><span>${qIndex+1}</span>${esc(q.text)}</h2><div class="public-choices">${q.choices.map((c, cIndex) => `<label data-choice-label="${q.id}:${c.id}" class="${answers[q.id] === c.id ? 'selected' : ''}"><input type="radio" name="q-${q.id}" data-answer="${q.id}:${c.id}" ${answers[q.id] === c.id ? 'checked' : ''}/><b>${String.fromCharCode(65+cIndex)}</b><span>${esc(c.text)}</span></label>`).join('')}</div></article>`).join('')}</div><button class="button full large" type="submit" ${seconds <= 0 ? 'disabled' : ''}>Testni yakunlash</button></form></main>`);
        document.querySelectorAll('[data-answer]').forEach(input => input.addEventListener('change', () => {
          const [qid, cid] = input.dataset.answer.split(':').map(Number);
          answers[qid] = cid;
          document.getElementById('answered-count').textContent = Object.keys(answers).length;
          document.querySelectorAll(`[data-choice-label^="${qid}:"]`).forEach(el => el.classList.remove('selected'));
          document.querySelector(`[data-choice-label="${qid}:${cid}"]`)?.classList.add('selected');
        }));
        document.getElementById('quiz-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            const result = await request(`/public/quizzes/${code}/submit/`, { method: 'POST', body: JSON.stringify({ attempt_id: attempt.id, answers: (quiz.questions || []).map(q => ({ question_id: q.id, choice_id: answers[q.id] || null })) }) });
            paintResult(result);
          } catch (err) { paintQuiz(err.message); }
        });
        state.timers.push(setInterval(() => {
          seconds -= 1;
          if (seconds <= 0) { seconds = 0; clearTimers(); paintQuiz('Test vaqti tugadi. Javob yuborilmadi.'); return; }
          const el = document.getElementById('timer');
          if (el) { el.textContent = timeText(); el.classList.toggle('danger', seconds < 60); }
        }, 1000));
      }
      function paintResult(result) {
        clearTimers();
        if (result.show_score && result.attempt?.percentage !== undefined) {
          pageShell(`<main class="quiz-page"><div class="result-card"><div class="result-ring"><strong>${esc(result.attempt.percentage)}%</strong></div><h1>Test yakunlandi!</h1><p>${esc(name)}, siz <b>${result.attempt.score}/${result.attempt.max_score}</b> ball oldingiz.</p></div></main>`);
        } else {
          pageShell(`<main class="quiz-page"><div class="result-card"><div class="quiz-logo" style="margin:0 auto 22px">✓</div><h1>Javoblar qabul qilindi</h1><p>${esc(name)}, ustozingiz natijalarni dashboardda ko‘radi.</p></div></main>`);
        }
      }
      paintIntro();
    } catch (err) { pageShell(`<main class="quiz-page"><div class="quiz-shell"><div class="alert error">${esc(err.message)}</div></div></main>`); }
  }

  function featuresPage() {
    pageShell(`
      <main>
        <section class="page-hero"><div class="container narrow-center"><span class="eyebrow">IMKONIYATLAR</span><h1>Testify o‘qituvchi workflow’ini boshidan oxirigacha yopadi.</h1><p>PDF importdan tortib natija eksportigacha — har bir feature ustozning real vaqtini tejash uchun qurilgan.</p></div></section>
        <section class="section"><div class="container feature-grid big">
          <article class="feature-card premium"><span>01</span><h3>Ready-test parser</h3><p>1., 2., A), B), C), D) va “Javob: C” kabi formatlarni savol modeliga aylantiradi.</p></article>
          <article class="feature-card premium"><span>02</span><h3>AI question generation</h3><p>Matnli materiallardan yangi test yaratish uchun OpenAI API bilan ishlaydi.</p></article>
          <article class="feature-card premium"><span>03</span><h3>Advanced quiz settings</h3><p>Vaqt, shuffle, score visibility, close/publish va one-attempt rejimlari.</p></article>
          <article class="feature-card premium"><span>04</span><h3>Public student mode</h3><p>O‘quvchi account ochmasdan test ishlaydi. Bu adoptionni osonlashtiradi.</p></article>
          <article class="feature-card premium"><span>05</span><h3>Teacher dashboard</h3><p>Testlar, urinishlar, o‘rtacha natija va published holat ko‘rinadi.</p></article>
          <article class="feature-card premium"><span>06</span><h3>Export-ready results</h3><p>Natijalar CSV orqali Excel yoki Google Sheetsga olib chiqiladi.</p></article>
        </div></section>
        <section class="section alt-section"><div class="container split-grid"><div><span class="eyebrow">PRODUCT QUALITY</span><h2>Real ustoz uchun eng muhim narsa — ishonchlilik.</h2><p class="lead">Shuning uchun Testify’da “chiroyli animatsiya”dan oldin score hiding, timer validation, JWT refresh va CSV export kabi fundamental narsalar tuzatildi.</p></div><div class="check-panel"><p>✓ backend score visibility</p><p>✓ backend timer check</p><p>✓ refresh token flow</p><p>✓ CSV result export</p><p>✓ standalone frontend</p></div></div></section>
      </main>`);
  }

  function useCasesPage() {
    pageShell(`
      <main>
        <section class="page-hero"><div class="container narrow-center"><span class="eyebrow">KIMLAR UCHUN?</span><h1>Testify individual ustozdan tortib o‘quv markazgacha ishlaydi.</h1><p>Har bir segment uchun bitta aniq foyda: vaqt tejash, nazoratni kuchaytirish, natijani tez chiqarish.</p></div></section>
        <section class="section"><div class="container usecase-grid">
          <article><div class="use-icon">👩‍🏫</div><h3>Individual ustozlar</h3><p>Haftalik testlarni online qilib yuboradi, natijani avtomatik oladi.</p><ul><li>IELTS/CEFR mock</li><li>Matematika testlari</li><li>Tarix, biologiya, ona tili</li></ul></article>
          <article><div class="use-icon">🏫</div><h3>O‘quv markazlar</h3><p>Bir nechta ustozlar testlarini markaz nomidan yuritadi va natijalarni tizimli ko‘radi.</p><ul><li>Teacher workspace</li><li>Center dashboard</li><li>CSV reporting</li></ul></article>
          <article><div class="use-icon">🎓</div><h3>Xususiy maktablar</h3><p>Ichki nazorat, sinov imtihonlari va fanlar bo‘yicha testlarni tez raqamlashtiradi.</p><ul><li>Class-based testing</li><li>Weekly assessment</li><li>Result archive</li></ul></article>
          <article><div class="use-icon">🚀</div><h3>Exam prep loyihalar</h3><p>Telegram kanal yoki kurs egasi testlarni link orqali ommaga tarqatishi mumkin.</p><ul><li>Share code</li><li>No student login</li><li>Fast feedback</li></ul></article>
        </div></section>
        <section class="section dark-section"><div class="container cta-grid"><div><span class="eyebrow light">REAL SCENARIO</span><h2>Ustoz PDF yuboradi. Testify online test qiladi. O‘quvchi ishlaydi. Natija tayyor.</h2></div><div><p>Bu aynan O‘zbekiston ta’lim bozoridagi oddiy, lekin og‘riqli workflow’ni raqamlashtiradi.</p><a href="/register" data-link class="button large">Bepul sinash →</a></div></div></section>
      </main>`);
  }

  function founderPage() {
    pageShell(`
      <main>
        <section class="page-hero founder-hero">
          <div class="container founder-hero-grid">
            <div>
              <span class="eyebrow">ASOSCHI</span>
              <h1>Ramazon Ergashev — O‘zbekistonda ta’limni raqamlashtirishga bel bog‘lagan yosh builder.</h1>
              <p>Testify oddiy “PDF converter” emas. Bu ustozlar, o‘quv markazlar va o‘quvchilar uchun imtihon jarayonini tezroq, aniqroq va professionalroq qilishga qaratilgan EdTech mahsulot.</p>
              <div class="founder-actions">
                <a href="/register" data-link class="button large">Platformani sinash →</a>
                <a href="/features" data-link class="button ghost large">Imkoniyatlar</a>
              </div>
            </div>
            <div class="founder-card">
              <div class="founder-avatar">RE</div>
              <h3>Ramazon Ergashev</h3>
              <p>Founder & Builder, Testify</p>
              <div class="founder-tags"><span>Python</span><span>Django</span><span>SaaS</span><span>EdTech</span></div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container split-grid">
            <div>
              <span class="eyebrow">FOUNDER STORY</span>
              <h2>Men buni nazariya uchun emas, real ustozlar og‘rig‘i uchun quryapman.</h2>
              <p class="lead">O‘zbekistonda ko‘p ustozlar testlarni hali ham PDF, Telegram, daftar va Excel orqali boshqaradi. Bu ishlaydi, lekin sekin, chalkash va masshtablanmaydi. Testify shu jarayonni bitta tartibli sistemaga aylantirish uchun qurildi.</p>
            </div>
            <div class="pain-list founder-list">
              <article><b>01</b><h3>Builder mindset</h3><p>Kod shunchaki portfolio uchun emas — real odam ishlatadigan mahsulotga aylanishi kerak.</p></article>
              <article><b>02</b><h3>Uzbek-first product</h3><p>Interfeys, workflow va demo O‘zbekiston ustozlari tushunadigan shaklda qurilgan.</p></article>
              <article><b>03</b><h3>Long-term vision</h3><p>Testify kelajakda test, CRM, analytics va AI assessment moduliga aylanishi mumkin.</p></article>
            </div>
          </div>
        </section>

        <section class="section alt-section">
          <div class="container">
            <div class="section-heading wide"><span class="eyebrow">VISION</span><h2>Maqsad — O‘zbekiston ta’lim bozori uchun world-class exam infrastructure.</h2><p>Bugun Testify PDF’dan online test yaratadi. Ertaga u o‘quv markazlar uchun assessment OS bo‘lishi mumkin: testlar, natijalar, progress, ustoz dashboard, center analytics va AI feedback.</p></div>
            <div class="feature-grid big">
              <article class="feature-card premium"><span>Product</span><h3>Oddiy workflow</h3><p>Ustoz PDF yuklaydi, savollarni ko‘radi, link yuboradi, natijani oladi.</p></article>
              <article class="feature-card premium"><span>Market</span><h3>Ta’lim markazlari</h3><p>Individual ustozdan boshlab o‘quv markazlargacha sotiladigan B2B EdTech.</p></article>
              <article class="feature-card premium"><span>Technology</span><h3>Django + AI</h3><p>Backend mustahkam, keyingi bosqichda OCR va AI analytics qo‘shiladi.</p></article>
            </div>
          </div>
        </section>

        <section class="section dark-section">
          <div class="container cta-grid">
            <div><span class="eyebrow light">FOUNDER NOTE</span><h2>Logo, domain va chiroyli gaplar yetmaydi. Testify real testlar, real natijalar va real foydalanuvchilar bilan o‘sadi.</h2></div>
            <div><p>Keyingi fokus: ustozlar bilan pilot, feedback, CSV/export, OCR, center dashboard va pullik planlarni bozor orqali tekshirish.</p><a href="/register" data-link class="button large">Demo boshlash →</a></div>
          </div>
        </section>
      </main>`);
  }

    function notFound() { pageShell(`<main class="dashboard-page"><div class="container"><div class="empty"><h3>404</h3><p>Sahifa topilmadi.</p><a href="/" data-link class="button">Bosh sahifa</a></div></div></main>`); }

  function render() {
    clearTimers();
    const path = location.pathname.replace(/\/$/, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (path === '/') return homePage();
    if (path === '/features') return featuresPage();
    if (path === '/use-cases') return useCasesPage();
    if (path === '/founder') return founderPage();
    if (path === '/login') return loginPage();
    if (path === '/register') return registerPage();
    if (path === '/dashboard') return dashboardPage();
    if (path === '/dashboard/new') return newQuizPage();
    if (parts[0] === 'dashboard' && parts[1] === 'quizzes' && parts[2] && parts[3] === 'results') return resultsPage(parts[2]);
    if (parts[0] === 'dashboard' && parts[1] === 'quizzes' && parts[2]) return quizEditorPage(parts[2]);
    if (parts[0] === 'quiz' && parts[1]) return publicQuizPage(parts[1]);
    return notFound();
  }

  window.addEventListener('popstate', render);
  document.addEventListener('DOMContentLoaded', render);
})();
