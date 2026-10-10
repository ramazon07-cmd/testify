import csv
import random
import re
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attempt, AttemptAnswer, Quiz, SourceDocument, Student, StudentGroup
from .permissions import IsQuizOwner
from .serializers import (
    AttemptSerializer,
    AnswerKeyQuizSerializer,
    BulkStudentSerializer,
    ImportPDFSerializer,
    PublicAttemptResultSerializer,
    PublicQuizSerializer,
    PaperAttemptSerializer,
    QuestionSerializer,
    QuizDetailSerializer,
    QuizListSerializer,
    StartAttemptSerializer,
    StartedAttemptSerializer,
    SubmitAttemptSerializer,
    replace_quiz_questions,
    StudentGroupSerializer,
    StudentSerializer,
)
from .services.ai_generator import AINotConfigured, AIResponseError, generate_questions_from_content
from .services.pdf_parser import as_question_payload, extract_pdf_text, parse_ready_test


@extend_schema_view(
    list=extend_schema(tags=['Teacher quizzes'], summary='O‘qituvchining testlari'),
    retrieve=extend_schema(tags=['Teacher quizzes'], summary='Test tafsilotlari'),
    create=extend_schema(tags=['Teacher quizzes'], summary='Yangi test yaratish'),
    update=extend_schema(tags=['Teacher quizzes'], summary='Testni to‘liq yangilash'),
    partial_update=extend_schema(tags=['Teacher quizzes'], summary='Testni qisman yangilash'),
    destroy=extend_schema(tags=['Teacher quizzes'], summary='Testni o‘chirish'),
)
class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsQuizOwner]

    def get_queryset(self):
        return (
            Quiz.objects
            .filter(owner=self.request.user)
            .select_related('group')
            .prefetch_related('questions__choices', 'attempts')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuizDetailSerializer
        return QuizListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Testni e’lon qilish',
        responses={200: QuizDetailSerializer},
    )
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        quiz = self.get_object()

        questions = quiz.questions.prefetch_related('choices').all()

        if not questions.exists():
            return Response(
                {'detail': 'Testda savollar yo‘q.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Muhim o‘zgarish:
        # Import vaqtida javobsiz savollar bo‘lishi mumkin.
        # Lekin publish qilishdan oldin har savolda aynan 1 ta correct javob bo‘lishi shart.
        for index, question in enumerate(questions, start=1):
            correct_count = question.choices.filter(is_correct=True).count()

            if correct_count == 0:
                return Response(
                    {'detail': f'{index}-savolda to‘g‘ri javob belgilanmagan.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if correct_count > 1:
                return Response(
                    {'detail': f'{index}-savolda faqat 1 ta to‘g‘ri javob bo‘lishi kerak.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        quiz.status = Quiz.Status.PUBLISHED
        quiz.save(update_fields=['status', 'updated_at'])

        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Testni yopish',
        responses={200: QuizDetailSerializer},
    )
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        quiz = self.get_object()
        quiz.status = Quiz.Status.CLOSED
        quiz.save(update_fields=['status', 'updated_at'])
        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Test savollarini almashtirish',
        request=inline_serializer(
            name='ReplaceQuestionsRequest',
            fields={'questions': QuestionSerializer(many=True)},
        ),
        responses={200: QuizDetailSerializer},
    )
    @action(detail=True, methods=['put'], url_path='questions')
    def replace_questions(self, request, pk=None):
        quiz = self.get_object()

        serializer = QuestionSerializer(
            data=request.data.get('questions', []),
            many=True,
        )
        serializer.is_valid(raise_exception=True)

        replace_quiz_questions(
            quiz,
            [dict(item) for item in serializer.validated_data],
        )

        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Test natijalarini olish',
        responses={
            200: inline_serializer(
                name='QuizResultsResponse',
                fields={
                    'quiz': QuizListSerializer(),
                    'attempts': AttemptSerializer(many=True),
                    'average_percentage': serializers.FloatField(),
                },
            )
        },
    )
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        quiz = self.get_object()
        attempts = list(quiz.attempts.filter(submitted_at__isnull=False).select_related('student'))
        attempts.sort(key=lambda item: (-item.score, item.submitted_at or item.started_at))
        attempt_rows = []
        for rank, attempt in enumerate(attempts, start=1):
            row = AttemptSerializer(attempt).data
            row['rank'] = rank
            row['parent_phone'] = attempt.student.parent_phone if attempt.student else ''
            previous = None
            if attempt.student_id:
                previous = (
                    Attempt.objects
                    .filter(student_id=attempt.student_id, submitted_at__isnull=False)
                    .exclude(quiz_id=quiz.id)
                    .order_by('-submitted_at')
                    .first()
                )
            trend = ''
            if previous:
                delta = float(attempt.percentage) - float(previous.percentage)
                trend = f" Oldingi sinovga nisbatan {abs(delta):.1f}% {'yuqori' if delta >= 0 else 'past'}."
            row['parent_report'] = (
                f"{attempt.student_name} — {quiz.title}: {attempt.score}/{attempt.max_score} ball "
                f"({attempt.percentage}%). Guruhdagi o‘rni: {rank}/{len(attempts)}.{trend}"
            )
            attempt_rows.append(row)

        question_analytics = []
        submitted_count = len(attempts)
        for question in quiz.questions.all():
            correct_count = question.attemptanswer_set.filter(attempt__submitted_at__isnull=False, is_correct=True).count()
            question_analytics.append({
                'question_id': question.id,
                'order': question.order + 1,
                'text': question.text,
                'correct_count': correct_count,
                'attempt_count': submitted_count,
                'correct_rate': round(correct_count / submitted_count * 100, 1) if submitted_count else 0,
            })

        return Response({
            'quiz': QuizListSerializer(quiz).data,
            'attempts': attempt_rows,
            'average_percentage': round(
                sum(float(a.percentage) for a in attempts) / len(attempts),
                2,
            ) if attempts else 0,
            'question_analytics': question_analytics,
        })

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Natijalarni CSV ko‘rinishida yuklab olish',
    )
    @action(detail=True, methods=['get'], url_path='results/export')
    def export_results(self, request, pk=None):
        quiz = self.get_object()

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="quiz-{quiz.id}-results.csv"'
        response.write('\ufeff')

        writer = csv.writer(response)
        writer.writerow([
            'Student name',
            'Score',
            'Max score',
            'Percentage',
            'Started at',
            'Submitted at',
        ])

        for attempt in quiz.attempts.filter(submitted_at__isnull=False):
            writer.writerow([
                attempt.student_name,
                attempt.score,
                attempt.max_score,
                attempt.percentage,
                attempt.started_at.isoformat(),
                attempt.submitted_at.isoformat() if attempt.submitted_at else '',
            ])

        return response

    @extend_schema(tags=['Teacher quizzes'], summary='Qog‘oz test javoblarini tekshirish', request=PaperAttemptSerializer)
    @action(detail=True, methods=['post'], url_path='paper-attempts')
    def paper_attempts(self, request, pk=None):
        quiz = self.get_object()
        serializer = PaperAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_answers = serializer.validated_data['answers'].strip().upper()
        if not re.fullmatch(r'[A-E0-9\s,;:\-.)]+', raw_answers):
            return Response({'detail': 'Javoblarda faqat A–E harflari va ajratuvchi belgilar bo‘lsin.'}, status=400)
        answers = ''.join(re.findall(r'[A-E]', raw_answers))
        questions = list(quiz.questions.prefetch_related('choices').all())
        if len(answers) != len(questions):
            return Response({'detail': f'{len(questions)} ta javob harfini yuboring.'}, status=400)

        student = quiz.group.students.filter(name__iexact=serializer.validated_data['student_name'].strip()).first() if quiz.group_id else None
        if quiz.group_id and not student:
            return Response({'detail': 'O‘quvchi tanlangan guruh ro‘yxatida topilmadi.'}, status=400)
        if quiz.one_attempt_per_student:
            attempts = Attempt.objects.filter(quiz=quiz, submitted_at__isnull=False)
            attempts = attempts.filter(student=student) if student else attempts.filter(student_name__iexact=serializer.validated_data['student_name'].strip())
            if attempts.exists():
                return Response({'detail': 'Bu o‘quvchi uchun natija allaqachon kiritilgan.'}, status=400)
        attempt = Attempt.objects.create(
            quiz=quiz,
            student_name=serializer.validated_data['student_name'].strip(),
            student=student,
            max_score=quiz.total_points,
            submitted_at=timezone.now(),
        )
        score = 0
        rows = []
        for question, letter in zip(questions, answers):
            choices = list(question.choices.all())
            chosen = choices[ord(letter) - ord('A')] if 'A' <= letter <= 'H' and ord(letter) - ord('A') < len(choices) else None
            correct = next((choice for choice in choices if choice.is_correct), None)
            is_correct = bool(chosen and correct and chosen.id == correct.id)
            awarded = question.points if is_correct else 0
            score += awarded
            rows.append(AttemptAnswer(attempt=attempt, question=question, selected_choice=chosen, is_correct=is_correct, awarded_points=awarded))
        AttemptAnswer.objects.bulk_create(rows)
        attempt.score = score
        attempt.percentage = round(score / attempt.max_score * 100, 2) if attempt.max_score else 0
        attempt.save(update_fields=['score', 'percentage'])
        return Response(AttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class StudentGroupViewSet(viewsets.ModelViewSet):
    serializer_class = StudentGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StudentGroup.objects.filter(owner=self.request.user).prefetch_related('students')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Student.objects.filter(owner=self.request.user).select_related('group')
        group_id = self.request.query_params.get('group')
        return queryset.filter(group_id=group_id) if group_id else queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @extend_schema(tags=['Students'], summary='O‘quvchilarni ommaviy qo‘shish', request=BulkStudentSerializer)
    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        serializer = BulkStudentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save(), status=status.HTTP_201_CREATED)


class FromAnswerKeyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=['Answer key'],
        summary='Javob kalitidan qog‘oz test yaratish',
        request=AnswerKeyQuizSerializer,
        responses={201: QuizDetailSerializer},
    )
    def post(self, request):
        serializer = AnswerKeyQuizSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        key = data['normalized_key']
        scheme = data['scoring_scheme']

        quiz = Quiz.objects.create(
            owner=request.user,
            group=data.get('group'),
            title=data['title'],
            description='Javob kaliti asosida yaratilgan qog‘oz sinov.',
            scoring_scheme=scheme,
            duration_minutes=180 if scheme == Quiz.ScoringScheme.DTM_189 else 60,
            one_attempt_per_student=True,
        )

        questions = []
        for index, correct_letter in enumerate(key):
            if scheme == Quiz.ScoringScheme.DTM_189:
                if index < 30:
                    points, section = Decimal('1.10'), 'Majburiy fanlar'
                elif index < 60:
                    points, section = Decimal('3.10'), '1-mutaxassislik fani'
                else:
                    points, section = Decimal('2.10'), '2-mutaxassislik fani'
            else:
                points, section = Decimal('1.00'), ''
            questions.append({
                'text': f'{index + 1}-savol',
                'section_title': section,
                'explanation': '',
                'order': index,
                'points': points,
                'choices': [
                    {'text': letter, 'order': choice_index, 'is_correct': letter == correct_letter}
                    for choice_index, letter in enumerate('ABCDE')
                ],
            })

        replace_quiz_questions(quiz, questions)
        return Response(QuizDetailSerializer(quiz).data, status=status.HTTP_201_CREATED)


class ImportPDFView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=['PDF import'],
        summary='PDF fayldan test yaratish',
        request={'multipart/form-data': ImportPDFSerializer},
        responses={
            201: QuizDetailSerializer,
            400: OpenApiResponse(description='PDF yoki so‘rov ma’lumotlari noto‘g‘ri.'),
        },
    )
    def post(self, request):
        input_serializer = ImportPDFSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        uploaded = input_serializer.validated_data['file']
        mode = input_serializer.validated_data.get('mode', SourceDocument.Mode.AUTO)
        title = input_serializer.validated_data.get('title') or uploaded.name.rsplit('.', 1)[0]
        question_count = input_serializer.validated_data.get('question_count', 20)

        quiz = Quiz.objects.create(owner=request.user, title=title)

        document = SourceDocument.objects.create(
            owner=request.user,
            quiz=quiz,
            file=uploaded,
            original_name=uploaded.name,
            mode=mode,
        )

        try:
            text = extract_pdf_text(document.file)
            document.extracted_text = text

            parsed = (
                parse_ready_test(text)
                if mode in {SourceDocument.Mode.AUTO, SourceDocument.Mode.READY_TEST}
                else []
            )

            # Muhim o‘zgarish:
            # Agar parser savol va variantlarni topsa, javob kaliti bo‘lmasa ham import qilamiz.
            # Correct answer keyin editor’da belgilanadi.
            if parsed:
                if len(parsed) < question_count:
                    raise ValueError(
                        f'PDF ichida faqat {len(parsed)} ta yaroqli savol topildi. '
                        f'{question_count} ta so‘ralgan edi.'
                    )

                # Tayyor testlarda PDF tartibini saqlagan holda faqat tanlangan
                # miqdordagi savollarni import qilamiz.
                payload = as_question_payload(parsed[:question_count])
            elif mode == SourceDocument.Mode.READY_TEST:
                raise ValueError(
                    'PDF ichidan A/B/C/D formatidagi savollar topilmadi. '
                    'Agar bu skanerlangan PDF bo‘lsa, hozircha text PDF yuklang.'
                )
            else:
                payload = generate_questions_from_content(text, question_count)

            serializer = QuestionSerializer(data=payload, many=True)
            serializer.is_valid(raise_exception=True)

            replace_quiz_questions(
                quiz,
                [dict(item) for item in serializer.validated_data],
            )

            document.status = SourceDocument.Status.DONE
            document.save(update_fields=['extracted_text', 'status'])

            return Response(
                QuizDetailSerializer(quiz).data,
                status=status.HTTP_201_CREATED,
            )

        except (ValueError, AINotConfigured, AIResponseError, ValidationError) as exc:
            document.status = SourceDocument.Status.FAILED
            document.error_message = str(exc)
            document.save(update_fields=['extracted_text', 'status', 'error_message'])

            quiz.delete()

            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception:
            document.status = SourceDocument.Status.FAILED
            document.error_message = 'PDFni qayta ishlashda kutilmagan xatolik.'
            document.save(update_fields=['status', 'error_message'])

            quiz.delete()

            return Response(
                {'detail': 'PDFni qayta ishlashda kutilmagan xatolik.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PublicQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['Public quiz'],
        summary='Kod orqali e’lon qilingan testni olish',
        responses={200: PublicQuizSerializer},
    )
    def get(self, request, code):
        quiz = get_object_or_404(
            Quiz.objects.prefetch_related('questions__choices'),
            share_code=code.upper(),
        )

        ok, reason = quiz.is_available()
        if not ok:
            return Response(
                {'detail': reason},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = PublicQuizSerializer(quiz).data

        if quiz.shuffle_questions:
            random.shuffle(data['questions'])

        if quiz.shuffle_choices:
            for question in data['questions']:
                random.shuffle(question['choices'])

        return Response(data)


class StartQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['Public quiz'],
        summary='Test urinishini boshlash',
        request=StartAttemptSerializer,
        responses={201: StartedAttemptSerializer},
    )
    def post(self, request, code):
        quiz = get_object_or_404(Quiz, share_code=code.upper())

        ok, reason = quiz.is_available()
        if not ok:
            return Response(
                {'detail': reason},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = StartAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_name = serializer.validated_data['student_name'].strip()
        student = None
        if quiz.group_id:
            student = quiz.group.students.filter(name__iexact=student_name).first()
            if not student:
                return Response(
                    {'detail': 'Bu ism guruh ro‘yxatida topilmadi. O‘qituvchidan ro‘yxatni tekshirishni so‘rang.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if quiz.one_attempt_per_student:
            attempts = Attempt.objects.filter(quiz=quiz)
            attempts = attempts.filter(student=student) if student else attempts.filter(student_name__iexact=student_name)
            if attempts.filter(submitted_at__isnull=False).exists():
                return Response(
                    {'detail': 'Bu o‘quvchi testni allaqachon topshirgan.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            active_since = timezone.now() - timedelta(minutes=quiz.duration_minutes)
            if attempts.filter(submitted_at__isnull=True, started_at__gte=active_since).exists():
                return Response(
                    {'detail': 'Bu o‘quvchi uchun test urinish allaqachon boshlangan.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        attempt = Attempt.objects.create(
            quiz=quiz,
            student=student,
            student_name=student_name,
            max_score=quiz.total_points,
        )

        return Response(
            StartedAttemptSerializer(attempt).data,
            status=status.HTTP_201_CREATED,
        )


class SubmitQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['Public quiz'],
        summary='Test javoblarini yuborish',
        request=SubmitAttemptSerializer,
        responses={
            201: inline_serializer(
                name='SubmitQuizResponse',
                fields={
                    'attempt': serializers.DictField(),
                    'show_score': serializers.BooleanField(),
                    'details': serializers.ListField(
                        child=serializers.DictField(),
                        required=False,
                    ),
                },
            )
        },
    )
    def post(self, request, code):
        quiz = get_object_or_404(
            Quiz.objects.prefetch_related('questions__choices'),
            share_code=code.upper(),
        )

        ok, reason = quiz.is_available()
        if not ok:
            return Response(
                {'detail': reason},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SubmitAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attempt = get_object_or_404(
            Attempt,
            id=serializer.validated_data['attempt_id'],
            quiz=quiz,
        )

        if attempt.submitted_at:
            return Response(
                {'detail': 'Bu urinish allaqachon topshirilgan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > attempt.expires_at + timedelta(seconds=15):
            return Response(
                {'detail': 'Test vaqti tugadi. Javob yuborilmadi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answers_by_question = {
            item['question_id']: item.get('choice_id')
            for item in serializer.validated_data['answers']
        }

        score = 0
        max_score = quiz.total_points
        detailed = []

        with transaction.atomic():
            answer_rows = []

            for question in quiz.questions.all():
                selected_id = answers_by_question.get(question.id)
                selected = question.choices.filter(id=selected_id).first() if selected_id else None
                correct = question.choices.filter(is_correct=True).first()

                is_correct = bool(selected and correct and selected.id == correct.id)
                awarded = question.points if is_correct else 0

                score += awarded

                answer_rows.append(
                    AttemptAnswer(
                        attempt=attempt,
                        question=question,
                        selected_choice=selected,
                        is_correct=is_correct,
                        awarded_points=awarded,
                    )
                )

                detailed.append({
                    'question_id': question.id,
                    'is_correct': is_correct,
                    'correct_choice_id': correct.id if correct else None,
                    'explanation': question.explanation,
                })

            AttemptAnswer.objects.bulk_create(answer_rows)

            percentage = (score / max_score * 100) if max_score else 0

            attempt.score = score
            attempt.max_score = max_score
            attempt.percentage = round(percentage, 2)
            attempt.submitted_at = timezone.now()
            attempt.save(update_fields=['score', 'max_score', 'percentage', 'submitted_at'])

        response = {'show_score': quiz.show_score}

        if quiz.show_score:
            response['attempt'] = AttemptSerializer(attempt).data
            response['details'] = detailed
        else:
            response['attempt'] = PublicAttemptResultSerializer(attempt).data

        return Response(response, status=status.HTTP_201_CREATED)
