import re
from dataclasses import dataclass, field
from typing import BinaryIO

from pypdf import PdfReader


# Masalan:
# 1-33-betlar
# 33-49-betlar
# 49-62-betlar
# 62-80-betlar
SECTION_RE = re.compile(
    r'^\s*(\d+\s*[-–]\s*\d+\s*-?\s*betlar)\s*$',
    re.IGNORECASE,
)

# Masalan:
# 1. Savol matni
# 2) Savol matni
# 3- Savol matni
# 4: Savol matni
QUESTION_RE = re.compile(r'^\s*(\d{1,4})\s*[\.)\-:]\s*(.+)$')

# Muhim:
# Faqat katta A-H variantlarni variant deb olamiz.
# Chunki PDF ichida kichik a), b), c) ko‘pincha moslashtirish elementlari bo‘ladi.
CHOICE_RE = re.compile(r'^\s*([A-H])\s*[\.)\-:]\s*(.+)$')

# Masalan:
# Javob: C
# Answer: B
# Ans: A
# To‘g‘ri javob: D
ANSWER_RE = re.compile(
    r'^\s*(?:javob|answer|ans|to[‘\']?g[‘\']?ri\s+javob|correct\s+answer)\s*[:\-]\s*([A-H])\s*$',
    re.IGNORECASE,
)

# Masalan:
# Javoblar: 1-C, 2-B, 3-A
# Kalit: 1-C 2-B 3-A
ANSWER_KEY_RE = re.compile(r'(\d{1,4})\s*[-:=.)]\s*([A-H])', re.IGNORECASE)


@dataclass
class ParsedQuestion:
    number: int
    text: str
    section_title: str = ''
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
        raise ValueError(
            'PDF ichidan matn topilmadi. Fayl skanerlangan rasm bo‘lishi mumkin. '
            'Hozircha text PDF yuklang.'
        )

    return text


def _clean_line(line: str) -> str:
    line = line.strip()

    # PDF extraction ba’zida g‘alati belgilar qo‘shadi.
    line = line.replace('￾', '')
    line = line.replace('\u00ad', '')  # soft hyphen
    line = line.replace('­', '')
    line = re.sub(r'\s+', ' ', line)

    return line.strip()


def _normalize(text: str) -> list[str]:
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[\u00a0\t]+', ' ', text)

    # Ba’zi PDFlarda A. B. C. D. variantlar bitta qatorda kelib qoladi.
    # Faqat uppercase variantlarni yangi qatorga tushiramiz.
    text = re.sub(r'\s+([A-H][\.)]\s+)', r'\n\1', text)

    lines = []

    for raw_line in text.split('\n'):
        line = _clean_line(raw_line)

        if not line:
            continue

        low = line.lower()

        # Header/footerlarni olib tashlaymiz.
        if low.startswith('©mardon halimov'):
            continue
        if 'https://t.me/' in low:
            continue
        if low.startswith('telegram'):
            continue
        if low.startswith('+998'):
            continue
        if low.startswith('10-sinf o‘zbekiston tarixi'):
            continue
        if low.startswith('10-sinf o`zbekiston tarixi'):
            continue

        lines.append(line)

    return lines


def _is_answer_key_line(line: str) -> bool:
    low = line.lower().strip()

    return (
        low.startswith('javoblar:')
        or low.startswith('javoblari:')
        or low.startswith('answers:')
        or low.startswith('answer key:')
        or low.startswith('kalit:')
        or low.startswith('javoblar ')
        or low.startswith('answers ')
        or low.startswith('kalit ')
    )


def _is_probably_not_question(rest: str) -> bool:
    rest = rest.strip()

    # "1-C" yoki "1. C" kabi answer key fragmentlarni savol deb olmaymiz.
    if len(rest) <= 2 and rest.upper() in list('ABCDEFGH'):
        return True

    # Section title "1-33-betlar" QUESTION_REga tushib qolmasligi uchun.
    if re.match(r'^\d+\s*[-–]\s*\d+\s*-?\s*betlar$', rest, re.IGNORECASE):
        return True

    return False


def parse_ready_test(text: str) -> list[ParsedQuestion]:
    lines = _normalize(text)

    questions: list[ParsedQuestion] = []
    current: ParsedQuestion | None = None
    current_choice: dict | None = None
    current_section = ''

    # Answer keylar section ichida bo‘lishi mumkin.
    # Shuning uchun kalitni (section, question_number) bo‘yicha saqlaymiz.
    section_answer_map: dict[tuple[str, int], str] = {}
    global_answer_map: dict[int, str] = {}

    scan_section = ''

    # 1-pass: answer keylarni yig‘amiz.
    for line in lines:
        section_match = SECTION_RE.match(line)
        if section_match:
            scan_section = section_match.group(1).strip()
            continue

        if _is_answer_key_line(line):
            found = ANSWER_KEY_RE.findall(line)
            for number, letter in found:
                q_number = int(number)
                q_letter = letter.upper()

                if scan_section:
                    section_answer_map[(scan_section, q_number)] = q_letter
                else:
                    global_answer_map[q_number] = q_letter

    # 2-pass: savollar va variantlarni yig‘amiz.
    for line in lines:
        section_match = SECTION_RE.match(line)
        if section_match:
            current_section = section_match.group(1).strip()
            current = None
            current_choice = None
            continue

        if _is_answer_key_line(line):
            current_choice = None
            continue

        answer_match = ANSWER_RE.match(line)
        if answer_match and current:
            current.correct_letter = answer_match.group(1).upper()
            current_choice = None
            continue

        q_match = QUESTION_RE.match(line)
        if q_match:
            number = int(q_match.group(1))
            rest = q_match.group(2).strip()

            if _is_probably_not_question(rest):
                continue

            current = ParsedQuestion(
                number=number,
                text=rest,
                section_title=current_section,
            )
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

        # Davomiy qatorlar:
        # Agar variant boshlangan bo‘lsa, variant matniga qo‘shamiz.
        # Aks holda savol matniga qo‘shamiz.
        if current_choice is not None:
            current_choice['text'] += ' ' + line
        elif current is not None:
            current.text += ' ' + line

    valid: list[ParsedQuestion] = []

    for question in questions:
        if not question.correct_letter:
            question.correct_letter = section_answer_map.get(
                (question.section_title, question.number)
            )

        if not question.correct_letter:
            question.correct_letter = global_answer_map.get(question.number)

        # Kamida 2 ta variant bo‘lsa import qilamiz.
        # To‘g‘ri javob bo‘lmasa ham draft sifatida import bo‘ladi.
        if len(question.choices) >= 2:
            valid.append(question)

    return valid


def as_question_payload(items: list[ParsedQuestion]) -> list[dict]:
    payload = []

    for index, item in enumerate(items):
        correct = item.correct_letter.upper() if item.correct_letter else None

        payload.append({
            'section_title': item.section_title,
            'text': item.text,
            'order': index,
            'points': 1,
            'explanation': '',
            'choices': [
                {
                    'text': choice['text'],
                    'order': choice_index,
                    # Agar correct yo‘q bo‘lsa, hammasi False bo‘ladi.
                    # Ustoz editor’da keyin to‘g‘ri javobni belgilaydi.
                    'is_correct': bool(correct and choice['letter'] == correct),
                }
                for choice_index, choice in enumerate(item.choices)
            ],
        })

    return payload