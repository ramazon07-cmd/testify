# START HERE — Testify Ready MVP

1. Backendni ishga tushiring:

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

2. Frontendni ishga tushiring:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

3. Browserda oching:

- Frontend: http://localhost:3000
- API docs: http://127.0.0.1:8000/api/docs/

Demo hisob:

- username: teacher
- password: demo12345

Critical fixlar allaqachon kiritilgan:

- ball yashirish ishlaydi
- test timer backendda tekshiriladi
- token refresh ishlaydi
- CSV export bor
- quiz settings bor

---

## Frontend npm ishlamasa: standalone rejim

`npm install` ishlamasa, Next.js frontend o‘rniga dependency'siz standalone frontenddan foydalaning:

```bash
cd frontend-standalone
node server.js
```

Keyin oching:

```text
http://localhost:3000
```

Port 3000 band bo‘lsa:

```bash
PORT=3001 node server.js
```

Agar 3001 ishlatsangiz, backend `.env` faylida CORS sozlamasini shunday qiling:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## New standalone marketing pages

Frontend standalone now has a longer landing page and 3 extra pages:

- `/features`
- `/use-cases`
- `/founder`

Run `cd frontend-standalone && node server.js` and open `http://localhost:3000`.
