# Testify Frontend Standalone

Bu frontend `npm install` talab qilmaydi. Faqat Node.js kerak.

## Ishga tushirish

```bash
cd frontend-standalone
node server.js
```

Keyin brauzerda oching:

```text
http://localhost:3000
```

Agar 3000-port band bo‘lsa:

```bash
PORT=3001 node server.js
```

Agar 3001 ishlatsangiz, backend `.env` ichida CORS ga qo‘shing:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## API URL

Default API URL:

```text
http://127.0.0.1:8000/api
```

Frontend ichidagi "API" tugmasi orqali URLni o‘zgartirish mumkin.

## Marketing pages added

Standalone frontend now includes a longer world-class landing page plus these pages:

- `/features` — platform imkoniyatlari
- `/use-cases` — ustozlar, markazlar, maktablar uchun scenario
- `/founder` — pilot founder va FAQ

Run:

```bash
node server.js
```

Then open:

- http://localhost:3000/
- http://localhost:3000/features
- http://localhost:3000/use-cases
- http://localhost:3000/founder
```
