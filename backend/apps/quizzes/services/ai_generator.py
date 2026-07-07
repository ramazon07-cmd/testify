import json
import re

from django.conf import settings


class AINotConfigured(RuntimeError):
    pass


class AIResponseError(RuntimeError):
    pass


def _extract_json(raw: str):
    raw = raw.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    match = re.search(r'\{.*\}', raw, re.S)
    if match:
        raw = match.group(0)
    return json.loads(raw)


def generate_questions_from_content(text: str, question_count: int = 10) -> list[dict]:
    if not settings.OPENAI_API_KEY:
        raise AINotConfigured(
            'Oddiy ma’lumotdan test yaratish uchun OPENAI_API_KEY kerak. '
            'Tayyor test PDF importi esa kalitsiz ishlaydi.'
        )

    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = f"""
Siz o‘qituvchi yordamchisisiz. Quyidagi manba matnidan aynan {question_count} ta sifatli,
bir javobli A/B/C/D test savoli tuzing. Faqat manbadagi faktlardan foydalaning.
Har savolda aynan 4 ta variant va aynan 1 ta to‘g‘ri javob bo‘lsin.

Faqat valid JSON qaytaring, markdown ishlatmang:
{{
  "questions": [
    {{
      "text": "Savol",
      "explanation": "Qisqa izoh",
      "choices": [
        {{"text": "Variant", "is_correct": false}},
        {{"text": "Variant", "is_correct": true}},
        {{"text": "Variant", "is_correct": false}},
        {{"text": "Variant", "is_correct": false}}
      ]
    }}
  ]
}}

MANBA:
{text[:30000]}
""".strip()

    response = client.responses.create(model=settings.OPENAI_MODEL, input=prompt)

    try:
        data = _extract_json(response.output_text)
        questions = data['questions']
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise AIResponseError('AI valid savollar JSONini qaytarmadi.') from exc

    normalized = []
    for q_index, question in enumerate(questions[:question_count]):
        choices = question.get('choices', [])
        if len(choices) != 4 or sum(bool(c.get('is_correct')) for c in choices) != 1:
            continue
        q_text = str(question.get('text', '')).strip()
        if not q_text:
            continue
        normalized.append({
            'text': q_text,
            'explanation': str(question.get('explanation', '')).strip(),
            'order': q_index,
            'points': 1,
            'choices': [
                {
                    'text': str(choice.get('text', '')).strip(),
                    'is_correct': bool(choice.get('is_correct')),
                    'order': c_index,
                }
                for c_index, choice in enumerate(choices)
            ],
        })

    if not normalized:
        raise AIResponseError('AI ishlatishga yaroqli savol yaratmadi.')
    return normalized
