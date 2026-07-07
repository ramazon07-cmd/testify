import csv
import random

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

from .models import Attempt, AttemptAnswer, Choice, Quiz, SourceDocument
from .permissions import IsQuizOwner
from .serializers import (
    AttemptSerializer,
    ImportPDFSerializer,
    PublicAttemptResultSerializer,
    PublicQuizSerializer,
    QuestionSerializer,
    QuizDetailSerializer,
    QuizListSerializer,
    StartAttemptSerializer,
    StartedAttemptSerializer,
    SubmitAttemptSerializer,
    replace_quiz_questions,
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
        return Quiz.objects.filter(owner=self.request.user).prefetch_related('questions__choices', 'attempts')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return QuizDetailSerializer
        return QuizListSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @extend_schema(tags=['Teacher quizzes'], summary='Testni e’lon qilish', responses={200: QuizDetailSerializer})
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        quiz = self.get_object()
        if not quiz.questions.exists():
            return Response({'detail': 'Testda savollar yo‘q.'}, status=status.HTTP_400_BAD_REQUEST)
        invalid = quiz.questions.filter(choices__is_correct=True).distinct().count() != quiz.questions.count()
        if invalid:
            return Response({'detail': 'Har savolda to‘g‘ri javob bo‘lishi kerak.'}, status=status.HTTP_400_BAD_REQUEST)
        quiz.status = Quiz.Status.PUBLISHED
        quiz.save(update_fields=['status', 'updated_at'])
        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(tags=['Teacher quizzes'], summary='Testni yopish', responses={200: QuizDetailSerializer})
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        quiz = self.get_object()
        quiz.status = Quiz.Status.CLOSED
        quiz.save(update_fields=['status', 'updated_at'])
        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Test savollarini almashtirish',
        request=inline_serializer(name='ReplaceQuestionsRequest', fields={'questions': QuestionSerializer(many=True)}),
        responses={200: QuizDetailSerializer},
    )
    @action(detail=True, methods=['put'], url_path='questions')
    def replace_questions(self, request, pk=None):
        quiz = self.get_object()
        serializer = QuestionSerializer(data=request.data.get('questions', []), many=True)
        serializer.is_valid(raise_exception=True)
        replace_quiz_questions(quiz, [dict(item) for item in serializer.validated_data])
        return Response(QuizDetailSerializer(quiz).data)

    @extend_schema(
        tags=['Teacher quizzes'],
        summary='Test natijalarini olish',
        responses={200: inline_serializer(name='QuizResultsResponse', fields={
            'quiz': QuizListSerializer(),
            'attempts': AttemptSerializer(many=True),
            'average_percentage': serializers.FloatField(),
        })},
    )
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        quiz = self.get_object()
        attempts = quiz.attempts.filter(submitted_at__isnull=False)
        return Response({
            'quiz': QuizListSerializer(quiz).data,
            'attempts': AttemptSerializer(attempts, many=True).data,
            'average_percentage': round(sum(float(a.percentage) for a in attempts) / attempts.count(), 2) if attempts.exists() else 0,
        })

    @extend_schema(tags=['Teacher quizzes'], summary='Natijalarni CSV ko‘rinishida yuklab olish')
    @action(detail=True, methods=['get'], url_path='results/export')
    def export_results(self, request, pk=None):
        quiz = self.get_object()
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="quiz-{quiz.id}-results.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(['Student name', 'Score', 'Max score', 'Percentage', 'Started at', 'Submitted at'])
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


class ImportPDFView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=['PDF import'],
        summary='PDF fayldan test yaratish',
        request={'multipart/form-data': ImportPDFSerializer},
        responses={201: QuizDetailSerializer, 400: OpenApiResponse(description='PDF yoki so‘rov ma’lumotlari noto‘g‘ri.')},
    )
    def post(self, request):
        input_serializer = ImportPDFSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        uploaded = input_serializer.validated_data['file']
        mode = input_serializer.validated_data.get('mode', SourceDocument.Mode.AUTO)
        title = input_serializer.validated_data.get('title') or uploaded.name.rsplit('.', 1)[0]
        question_count = input_serializer.validated_data.get('question_count', 10)

        quiz = Quiz.objects.create(owner=request.user, title=title)
        document = SourceDocument.objects.create(owner=request.user, quiz=quiz, file=uploaded, original_name=uploaded.name, mode=mode)

        try:
            text = extract_pdf_text(document.file)
            document.extracted_text = text

            parsed = parse_ready_test(text) if mode in {SourceDocument.Mode.AUTO, SourceDocument.Mode.READY_TEST} else []
            parsed_with_answers = parsed and all(item.correct_letter for item in parsed)
            if parsed_with_answers:
                payload = as_question_payload(parsed)
            elif mode == SourceDocument.Mode.READY_TEST:
                raise ValueError('PDF ichidan A/B/C/D formatidagi savollar va javoblar topilmadi.')
            else:
                payload = generate_questions_from_content(text, question_count)

            serializer = QuestionSerializer(data=payload, many=True)
            serializer.is_valid(raise_exception=True)
            replace_quiz_questions(quiz, [dict(item) for item in serializer.validated_data])
            document.status = SourceDocument.Status.DONE
            document.save(update_fields=['extracted_text', 'status'])
            return Response(QuizDetailSerializer(quiz).data, status=status.HTTP_201_CREATED)

        except (ValueError, AINotConfigured, AIResponseError, ValidationError) as exc:
            document.status = SourceDocument.Status.FAILED
            document.error_message = str(exc)
            document.save(update_fields=['extracted_text', 'status', 'error_message'])
            quiz.delete()
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            document.status = SourceDocument.Status.FAILED
            document.error_message = 'PDFni qayta ishlashda kutilmagan xatolik.'
            document.save(update_fields=['status', 'error_message'])
            quiz.delete()
            return Response({'detail': 'PDFni qayta ishlashda kutilmagan xatolik.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PublicQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(tags=['Public quiz'], summary='Kod orqali e’lon qilingan testni olish', responses={200: PublicQuizSerializer})
    def get(self, request, code):
        quiz = get_object_or_404(Quiz.objects.prefetch_related('questions__choices'), share_code=code.upper())
        ok, reason = quiz.is_available()
        if not ok:
            return Response({'detail': reason}, status=status.HTTP_400_BAD_REQUEST)
        data = PublicQuizSerializer(quiz).data
        if quiz.shuffle_questions:
            random.shuffle(data['questions'])
        if quiz.shuffle_choices:
            for question in data['questions']:
                random.shuffle(question['choices'])
        return Response(data)


class StartQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(tags=['Public quiz'], summary='Test urinishini boshlash', request=StartAttemptSerializer, responses={201: StartedAttemptSerializer})
    def post(self, request, code):
        quiz = get_object_or_404(Quiz, share_code=code.upper())
        ok, reason = quiz.is_available()
        if not ok:
            return Response({'detail': reason}, status=status.HTTP_400_BAD_REQUEST)
        serializer = StartAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_name = serializer.validated_data['student_name'].strip()
        if quiz.one_attempt_per_student and Attempt.objects.filter(quiz=quiz, student_name__iexact=student_name, submitted_at__isnull=False).exists():
            return Response({'detail': 'Bu ism bilan test allaqachon topshirilgan.'}, status=status.HTTP_400_BAD_REQUEST)
        attempt = Attempt.objects.create(quiz=quiz, student_name=student_name, max_score=quiz.total_points)
        return Response(StartedAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class SubmitQuizView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=['Public quiz'],
        summary='Test javoblarini yuborish',
        request=SubmitAttemptSerializer,
        responses={201: inline_serializer(name='SubmitQuizResponse', fields={
            'attempt': serializers.DictField(),
            'show_score': serializers.BooleanField(),
            'details': serializers.ListField(child=serializers.DictField(), required=False),
        })},
    )
    def post(self, request, code):
        quiz = get_object_or_404(Quiz.objects.prefetch_related('questions__choices'), share_code=code.upper())
        ok, reason = quiz.is_available()
        if not ok:
            return Response({'detail': reason}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubmitAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attempt = get_object_or_404(Attempt, id=serializer.validated_data['attempt_id'], quiz=quiz)
        if attempt.submitted_at:
            return Response({'detail': 'Bu urinish allaqachon topshirilgan.'}, status=status.HTTP_400_BAD_REQUEST)
        if attempt.is_expired():
            return Response({'detail': 'Test vaqti tugadi. Javob yuborilmadi.'}, status=status.HTTP_400_BAD_REQUEST)

        answers_by_question = {item['question_id']: item.get('choice_id') for item in serializer.validated_data['answers']}
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
                answer_rows.append(AttemptAnswer(attempt=attempt, question=question, selected_choice=selected, is_correct=is_correct, awarded_points=awarded))
                detailed.append({'question_id': question.id, 'is_correct': is_correct, 'correct_choice_id': correct.id if correct else None, 'explanation': question.explanation})
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
