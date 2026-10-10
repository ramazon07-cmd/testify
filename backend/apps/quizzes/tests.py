from unittest.mock import patch
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Quiz, Student, StudentGroup
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


class PDFImportQuestionCountTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='teacher', password='demo12345')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @staticmethod
    def ready_test_text():
        return "\n".join(
            f'{index}. Savol {index}?\nA) Bir\nB) Ikki\nC) Uch\nD) To‘rt\nJavob: A\n'
            for index in range(1, 4)
        )

    @patch('apps.quizzes.views.extract_pdf_text')
    def test_import_uses_requested_question_count(self, extract_pdf_text):
        extract_pdf_text.return_value = self.ready_test_text()
        pdf = SimpleUploadedFile('questions.pdf', b'%PDF-mock', content_type='application/pdf')

        response = self.client.post(
            '/api/quizzes/import-pdf/',
            {'file': pdf, 'title': 'Qisqa test', 'mode': 'ready_test', 'question_count': 2},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data['questions']), 2)

    @patch('apps.quizzes.views.extract_pdf_text')
    def test_import_fails_if_pdf_has_fewer_questions(self, extract_pdf_text):
        extract_pdf_text.return_value = self.ready_test_text()
        pdf = SimpleUploadedFile('questions.pdf', b'%PDF-mock', content_type='application/pdf')

        response = self.client.post(
            '/api/quizzes/import-pdf/',
            {'file': pdf, 'mode': 'ready_test', 'question_count': 4},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('3 ta yaroqli savol', response.data['detail'])


class AnswerKeyQuizTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='center', password='demo12345')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_creates_standard_quiz_from_numbered_key(self):
        response = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'Haftalik sinov', 'answer_key': '1-A, 2-B, 3-C, 4-D'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['question_count'], 4)
        self.assertEqual(response.data['scoring_scheme'], 'standard')
        self.assertEqual(response.data['questions'][1]['choices'][1]['is_correct'], True)

    def test_dtm_template_has_90_questions_and_189_points(self):
        response = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'DTM diagnostika', 'answer_key': 'A' * 90, 'scoring_scheme': 'dtm_189'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        quiz = Quiz.objects.get(pk=response.data['id'])
        self.assertEqual(quiz.questions.count(), 90)
        self.assertEqual(quiz.total_points, Decimal('189.00'))
        self.assertEqual(quiz.duration_minutes, 180)

    def test_dtm_template_rejects_non_90_key(self):
        response = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'Noto‘liq DTM', 'answer_key': 'A' * 89, 'scoring_scheme': 'dtm_189'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_results_include_ranking_difficulty_and_parent_report(self):
        group = StudentGroup.objects.create(owner=self.user, name='11-A')
        Student.objects.create(owner=self.user, group=group, name='Aziza', parent_phone='+998901234567')
        Student.objects.create(owner=self.user, group=group, name='Bekzod')
        created = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'Diagnostika', 'answer_key': 'ABCD', 'group': group.id},
            format='json',
        )
        quiz_id = created.data['id']

        self.client.post(f'/api/quizzes/{quiz_id}/paper-attempts/', {'student_name': 'Aziza', 'answers': 'ABCD'}, format='json')
        self.client.post(f'/api/quizzes/{quiz_id}/paper-attempts/', {'student_name': 'Bekzod', 'answers': 'AAAA'}, format='json')
        response = self.client.get(f'/api/quizzes/{quiz_id}/results/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['attempts'][0]['student_name'], 'Aziza')
        self.assertEqual(response.data['attempts'][0]['rank'], 1)
        self.assertIn('Guruhdagi o‘rni: 1/2', response.data['attempts'][0]['parent_report'])
        self.assertEqual(response.data['question_analytics'][0]['correct_rate'], 100.0)
        self.assertEqual(response.data['question_analytics'][1]['correct_rate'], 50.0)

    def test_bulk_student_import_skips_duplicates(self):
        group = StudentGroup.objects.create(owner=self.user, name='11-B')
        Student.objects.create(owner=self.user, group=group, name='Aziza')

        response = self.client.post(
            '/api/students/bulk/',
            {'group': group.id, 'rows': 'Aziza\nBekzod,+998901112233\nDilnoza'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['created_count'], 2)
        self.assertEqual(response.data['skipped_count'], 1)
        self.assertEqual(group.students.count(), 3)

    def test_paper_attempt_respects_one_attempt_rule(self):
        created = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'Bir martalik', 'answer_key': 'ABCD'},
            format='json',
        )
        quiz_id = created.data['id']

        first = self.client.post(
            f'/api/quizzes/{quiz_id}/paper-attempts/',
            {'student_name': 'Aziza', 'answers': 'ABCD'},
            format='json',
        )
        duplicate = self.client.post(
            f'/api/quizzes/{quiz_id}/paper-attempts/',
            {'student_name': 'aziza', 'answers': 'ABCD'},
            format='json',
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)

    def test_public_quiz_blocks_parallel_active_attempt(self):
        created = self.client.post(
            '/api/quizzes/from-answer-key/',
            {'title': 'Online sinov', 'answer_key': 'ABCD'},
            format='json',
        )
        quiz_id = created.data['id']
        code = created.data['share_code']
        self.client.post(f'/api/quizzes/{quiz_id}/publish/')
        self.client.force_authenticate(user=None)

        first = self.client.post(
            f'/api/public/quizzes/{code}/start/',
            {'student_name': 'Aziza'},
            format='json',
        )
        duplicate = self.client.post(
            f'/api/public/quizzes/{code}/start/',
            {'student_name': 'aziza'},
            format='json',
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn('allaqachon boshlangan', duplicate.data['detail'])
