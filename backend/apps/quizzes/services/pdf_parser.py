import re
from dataclasses import dataclass, field
from typing import BinaryIO

from pypdf import PdfReader

QUESTION_RE = re.compile(r'^\s*(\d{1,4})\s*[\.)\-:]\s*(.+)$')
CHOICE_RE = re.compile(r'^\s*([A-Ha-h])\s*[\.)\-:]\s*(.+)$')
ANSWER_RE = re.compile(r'^\s*(?:javob|answer|to[‘\']?g[‘\']?ri\s+javob|correct\s+answer)\s*[:\-]\s*([A-Ha-h])\s*$', re.I)
ANSWER_KEY_RE = re.compile(r'(\d{1,4})\s*[-:=.)]\s*([A-Ha-h])')


@dataclass
class ParsedQuestion:
    number: int
    text: str
    choices: list[dict] = field(default_factory=list)
    correct_letter: str | None = None


def extract_pdf_text(file_obj: BinaryIO) -> str:
    file_obj.seek(0)
    reader = PdfReader(file_obj)
    if len(reader.pages) > 120:
        raise ValueError('PDF juda katta: 120 betdan oshmasin.')
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or '')
    text = '\n'.join(pages).strip()
    if not text:
        raise ValueError('PDF ichidan matn topilmadi. Fayl skanerlangan bo‘lishi mumkin.')
    return text


def _normalize(text: str) -> list[str]:
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[\u00a0\t]+', ' ', text)
    # Some PDFs place choices on same line. Push A), B), C), D) to new lines.
    text = re.sub(r'\s+([A-Ha-h][\.)]\s+)', r'\n\1', text)
    return [line.strip() for line in text.split('\n') if line.strip()]


def parse_ready_test(text: str) -> list[ParsedQuestion]:
    lines = _normalize(text)
    questions: list[ParsedQuestion] = []
    current: ParsedQuestion | None = None
    current_choice: dict | None = None

    answer_map = {}
    for line in lines:
        lower = line.lower()
        if 'javoblar' in lower or 'answers' in lower or len(ANSWER_KEY_RE.findall(line)) >= 2:
            for number, letter in ANSWER_KEY_RE.findall(line):
                answer_map[int(number)] = letter.upper()

    for line in lines:
        answer_match = ANSWER_RE.match(line)
        if answer_match and current:
            current.correct_letter = answer_match.group(1).upper()
            current_choice = None
            continue

        q_match = QUESTION_RE.match(line)
        if q_match:
            number = int(q_match.group(1))
            rest = q_match.group(2).strip()
            if len(rest) <= 2 and rest.upper() in list('ABCDEFGH'):
                continue
            current = ParsedQuestion(number=number, text=rest)
            questions.append(current)
            current_choice = None
            continue

        choice_match = CHOICE_RE.match(line)
        if choice_match and current:
            current_choice = {
                'letter': choice_match.group(1).upper(),
                'text': choice_match.group(2).strip(),
            }
            current.choices.append(current_choice)
            continue

        if current_choice is not None:
            current_choice['text'] += ' ' + line
        elif current is not None and not ('javoblar' in line.lower() or 'answers' in line.lower()):
            current.text += ' ' + line

    valid = []
    for question in questions:
        if not question.correct_letter:
            question.correct_letter = answer_map.get(question.number)
        if len(question.choices) >= 2:
            valid.append(question)

    return valid


def as_question_payload(items: list[ParsedQuestion]) -> list[dict]:
    payload = []
    for index, item in enumerate(items):
        correct = item.correct_letter
        payload.append({
            'text': item.text,
            'order': index,
            'points': 1,
            'explanation': '',
            'choices': [
                {
                    'text': choice['text'],
                    'order': choice_index,
                    'is_correct': choice['letter'] == correct,
                }
                for choice_index, choice in enumerate(item.choices)
            ],
        })
    return payload
