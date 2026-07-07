from django.db import transaction
from rest_framework import serializers

from .models import Attempt, Choice, Question, Quiz, SourceDocument


class ChoiceSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Choice
        fields = ('id', 'text', 'is_correct', 'order')


class QuestionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    choices = ChoiceSerializer(many=True)

    class Meta:
        model = Question
        fields = ('id', 'text', 'explanation', 'order', 'points', 'choices')

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError('Savol matni bo‘sh bo‘lmasin.')
        return value

    def validate_choices(self, choices):
        if len(choices) < 2:
            raise serializers.ValidationError('Kamida 2 ta variant kerak.')
        if sum(bool(choice.get('is_correct')) for choice in choices) != 1:
            raise serializers.ValidationError('Aynan 1 ta to‘g‘ri javob tanlanishi kerak.')
        for choice in choices:
            if not str(choice.get('text', '')).strip():
                raise serializers.ValidationError('Variant matni bo‘sh bo‘lmasin.')
        return choices


class QuizListSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(source='questions.count', read_only=True)
    attempt_count = serializers.IntegerField(source='attempts.count', read_only=True)

    class Meta:
        model = Quiz
        fields = (
            'id', 'title', 'description', 'status', 'share_code', 'duration_minutes',
            'shuffle_questions', 'shuffle_choices', 'show_score', 'one_attempt_per_student',
            'starts_at', 'ends_at', 'question_count', 'attempt_count', 'created_at', 'updated_at',
        )
        read_only_fields = ('share_code', 'status', 'created_at', 'updated_at')

    def validate(self, attrs):
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo‘lishi kerak.')
        return attrs


class QuizDetailSerializer(QuizListSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta(QuizListSerializer.Meta):
        fields = QuizListSerializer.Meta.fields + ('questions',)


class ImportPDFSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    mode = serializers.ChoiceField(choices=SourceDocument.Mode.choices, required=False, default=SourceDocument.Mode.AUTO)
    question_count = serializers.IntegerField(min_value=1, max_value=50, required=False, default=10)

    def validate_file(self, uploaded):
        from django.conf import settings
        if not uploaded.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Faqat PDF fayl qabul qilinadi.')
        if uploaded.size > settings.MAX_PDF_MB * 1024 * 1024:
            raise serializers.ValidationError(f'PDF {settings.MAX_PDF_MB} MB dan katta bo‘lmasin.')
        return uploaded


class PublicChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ('id', 'text', 'order')


class PublicQuestionSerializer(serializers.ModelSerializer):
    choices = PublicChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ('id', 'text', 'order', 'points', 'choices')


class PublicQuizSerializer(serializers.ModelSerializer):
    questions = PublicQuestionSerializer(many=True, read_only=True)
    question_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model = Quiz
        fields = (
            'id', 'title', 'description', 'share_code', 'duration_minutes',
            'shuffle_questions', 'shuffle_choices', 'question_count', 'questions',
        )


class StartAttemptSerializer(serializers.Serializer):
    student_name = serializers.CharField(max_length=150)


class AnswerInputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    choice_id = serializers.IntegerField(required=False, allow_null=True)


class SubmitAttemptSerializer(serializers.Serializer):
    attempt_id = serializers.IntegerField()
    answers = AnswerInputSerializer(many=True)


class AttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attempt
        fields = (
            'id', 'student_name', 'score', 'max_score', 'percentage',
            'started_at', 'submitted_at',
        )


class PublicAttemptResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attempt
        fields = ('id', 'student_name', 'started_at', 'submitted_at')


class StartedAttemptSerializer(serializers.ModelSerializer):
    expires_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Attempt
        fields = ('id', 'student_name', 'started_at', 'expires_at')


def replace_quiz_questions(quiz: Quiz, questions_data: list[dict]):
    with transaction.atomic():
        quiz.questions.all().delete()
        for q_index, question_data in enumerate(questions_data):
            choices_data = question_data.pop('choices')
            question = Question.objects.create(
                quiz=quiz,
                order=question_data.get('order', q_index),
                text=question_data['text'],
                explanation=question_data.get('explanation', ''),
                points=question_data.get('points', 1),
            )
            Choice.objects.bulk_create([
                Choice(
                    question=question,
                    text=choice['text'],
                    is_correct=choice.get('is_correct', False),
                    order=choice.get('order', c_index),
                )
                for c_index, choice in enumerate(choices_data)
            ])
    return quiz
