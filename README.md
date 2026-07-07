# Testify Platform — Ready MVP

PDF fayllarni interaktiv online testlarga aylantiradigan full-stack MVP.

## Nimalar tuzatildi

- `show_score=False` bo‘lsa, o‘quvchiga ball/javoblar ko‘rinmaydi.
- Test vaqti backend tarafda tekshiriladi: public test start endpoint + attempt id.
- Frontendda access token tugasa refresh token orqali avtomatik yangilanadi.
- Results CSV export qo‘shildi.
- Import input validation yaxshilandi (`question_count`, `mode`, PDF size/type).
- Quiz settings UI: duration, shuffle, show/hide score, one attempt.
- Production settings: env-based DB, CORS, secure cookies, WhiteNoise.
- Demo seed command va PDF parser unit testlari qo‘shildi.

## Stack

- Backend: Django 5.2 LTS, Django REST Framework, SimpleJWT, drf-spectacular
- Frontend: Next.js 16 App Router, TypeScript, plain CSS
- Database: SQLite local, PostgreSQL via `DATABASE_URL`
- PDF: pypdf
- AI: OpenAI Responses API ixtiyoriy

## 1. Backendni ishga tushirish

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 8000
```

Demo login:

- username: `teacher`
- password: `demo12345`

API:

- Swagger UI: `http://127.0.0.1:8000/api/docs/`
- ReDoc: `http://127.0.0.1:8000/api/redoc/`
- OpenAPI: `http://127.0.0.1:8000/api/schema/`

## 2. Frontendni ishga tushirish

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Agar port band bo‘lsa:

```bash
PORT=3001 npm run dev
```

## PDF format namunasi

```text
1. O‘zbekiston poytaxti qaysi shahar?
A) Samarqand
B) Buxoro
C) Toshkent
D) Xiva
Javob: C

2. 2 + 2 nechiga teng?
A) 3
B) 4
C) 5
D) 6
Javob: B
```

Javoblar oxirida ham bo‘lishi mumkin:

```text
Javoblar: 1-C, 2-B, 3-A
```

## AI modulini yoqish

`backend/.env` ichida:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5-mini
```

AI kaliti bo‘lmasa ham tayyor test PDF importi ishlaydi.

## Muhim cheklov

Hozirgi MVP skanerlangan rasmdan iborat PDF uchun OCR qilmaydi. Bunday faylga keyingi bosqichda Tesseract yoki cloud OCR qo‘shiladi.

## Tekshirish

```bash
cd backend
python manage.py test
python manage.py check
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Frontend standalone — npm install ishlamasa

Bu ZIP ichida `frontend-standalone/` qo‘shilgan. U `npm install` talab qilmaydi.

```bash
cd frontend-standalone
node server.js
```

Frontend: `http://localhost:3000`

Port 3000 band bo‘lsa:

```bash
PORT=3001 node server.js
```

## Standalone marketing upgrade

`frontend-standalone` includes a longer high-end landing page and 3 extra project pages:

- `/features`
- `/use-cases`
- `/founder`

No `npm install` required. Start it with:

```bash
cd frontend-standalone
node server.js
```


Standalone sahifalar: `/`, `/features`, `/use-cases`, `/founder`, `/login`, `/register`, `/dashboard`.
