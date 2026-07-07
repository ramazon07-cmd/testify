from django.test import TestCase

from .services.pdf_parser import as_question_payload, parse_ready_test


class PDFParserTests(TestCase):
    def test_parse_inline_answers(self):
        text = """
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
"""
        parsed = parse_ready_test(text)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0].correct_letter, 'C')
        payload = as_question_payload(parsed)
        self.assertTrue(payload[0]['choices'][2]['is_correct'])

    def test_parse_answer_key(self):
        text = """
1. Savol bir?
A) A
B) B
C) C
D) D
2. Savol ikki?
A) A
B) B
C) C
D) D
Javoblar: 1-B, 2-D
"""
        parsed = parse_ready_test(text)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0].correct_letter, 'B')
        self.assertEqual(parsed[1].correct_letter, 'D')
