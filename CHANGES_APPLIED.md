# Changes Applied

## October 2026 B2B pivot

- Repositioned the product from a generic teacher quiz builder to mock-test operations for learning centers.
- Added answer-key-only quiz creation and a DTM 90/189 scoring preset.
- Added printable A4 answer sheets and paper-answer grading.
- Added center groups, student rosters, rankings, per-question difficulty analytics, and parent-ready Telegram reports.
- Reworked the landing page and dashboard copy around the real B2B workflow.
- Rebuilt the public exam as a focused one-question workspace with navigation, progress, session recovery, and automatic time-up submission.
- Added full group/student CRUD, bulk roster import, scalable question editing, scheduling, and quiz deletion.
- Added 404/error/legal states and removed the teacher navbar from the student exam experience.

## Backend

- Added production-oriented settings: `DATABASE_URL`, WhiteNoise, secure cookie switches.
- Added `one_attempt_per_student`, `starts_at`, `ends_at` quiz fields.
- Added `StartQuizView` to create server-side attempts before the quiz begins.
- `SubmitQuizView` now requires `attempt_id` and checks backend timer expiration.
- Fixed score privacy: when `show_score=False`, student response does not include score/percentage/details.
- Added CSV export endpoint: `/api/quizzes/{id}/results/export/`.
- Added robust import serializer for file/mode/question_count validation.
- Added demo seed command.
- Added parser tests.

## Frontend

- Added automatic JWT refresh flow.
- Public quiz now starts with backend attempt creation.
- Parallel and duplicate attempts are blocked consistently for online and paper workflows.
- A short network grace period lets automatic time-up submission reach the server safely.
- Public quiz result respects `show_score`.
- Editor sidebar now has quiz settings.
- The editor now updates title, description, group, duration, schedule, and one question at a time instead of rendering all 90 questions.
- Student answers and the active question survive an accidental page refresh in the current browser session.
- Results page has CSV download.
- Upload UX includes scanned PDF limitation warning.

## Not included

- OCR for scanned PDFs is still not included.
- Payment/subscription system is not included.
- Background PDF/AI worker queue is not included.
