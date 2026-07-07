# Changes Applied

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
- Public quiz result respects `show_score`.
- Editor sidebar now has quiz settings.
- Results page has CSV download.
- Upload UX includes scanned PDF limitation warning.

## Not included

- OCR for scanned PDFs is still not included.
- Payment/subscription system is not included.
- Background PDF/AI worker queue is not included.
