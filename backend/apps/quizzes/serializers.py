from django.db import transaction
from rest_framework import serializers

from .models import Attempt, Choice, Question, Quiz, SourceDocument, Student, StudentGroup


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ('id', 'group', 'name', 'parent_phone', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_group(self, group):
        if group.owner_id != self.context['request'].user.id:
            raise serializers.ValidationError('Bu guruh sizga tegishli emas.')
        return group

    def validate(self, attrs):
        group = attrs.get('group', getattr(self.instance, 'group', None))
        name = attrs.get('name', getattr(self.instance, 'name', '')).strip()
        queryset = Student.objects.filter(group=group, name__iexact=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError({'name': 'Bu o‘quvchi shu guruhda allaqachon bor.'})
        attrs['name'] = name
        return attrs


class StudentGroupSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField(source='students.count', read_only=True)

    class Meta:
        model = StudentGroup
        fields = ('id', 'name', 'student_count', 'created_at')
        read_only_fields = ('id', 'student_count', 'created_at')

    def validate_name(self, value):
        request = self.context.get('request')
        queryset = StudentGroup.objects.filter(owner=request.user, name__iexact=value.strip()) if request else StudentGroup.objects.none()
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Bu nomdagi guruh mavjud.')
        return value.strip()


class BulkStudentSerializer(serializers.Serializer):
    group = serializers.PrimaryKeyRelatedField(queryset=StudentGroup.objects.all())
    rows = serializers.CharField(max_length=30000)

    def validate_group(self, group):
        if group.owner_id != self.context['request'].user.id:
            raise serializers.ValidationError('Bu guruh sizga tegishli emas.')
        return group

    def validate_rows(self, value):
        rows = [row.strip() for row in value.splitlines() if row.strip()]
        if not rows:
            raise serializers.ValidationError('Kamida bitta o‘quvchi kiriting.')
        if len(rows) > 300:
            raise serializers.ValidationError('Bir urinishda 300 tagacha o‘quvchi qo‘shish mumkin.')
        return rows

    def create(self, validated_data):
        group = validated_data['group']
        owner = self.context['request'].user
        existing_names = {
            name.casefold()
            for name in group.students.values_list('name', flat=True)
        }
        students = []
        skipped = []

        for row in validated_data['rows']:
            name, separator, phone = row.partition(',')
            name = name.strip()
            phone = phone.strip() if separator else ''
            if not name or name.casefold() in existing_names:
                skipped.append(name or row)
                continue
            existing_names.add(name.casefold())
            students.append(Student(owner=owner, group=group, name=name, parent_phone=phone))

        created = Student.objects.bulk_create(students)
        return {
            'created_count': len(created),
            'skipped_count': len(skipped),
            'skipped': skipped,
            'students': StudentSerializer(created, many=True).data,
        }


class PaperAttemptSerializer(serializers.Serializer):
    student_name = serializers.CharField(max_length=150)
    answers = serializers.CharField(max_length=350)


class AnswerKeyQuizSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    answer_key = serializers.CharField(max_length=900)
    scoring_scheme = serializers.ChoiceField(choices=Quiz.ScoringScheme.choices, default=Quiz.ScoringScheme.STANDARD)
    group = serializers.PrimaryKeyRelatedField(queryset=StudentGroup.objects.all(), required=False, allow_null=True)

    def validate_group(self, group):
        if group and group.owner_id != self.context['request'].user.id:
            raise serializers.ValidationError('Bu guruh sizga tegishli emas.')
        return group

    def validate(self, attrs):
        import re

        raw_key = attrs['answer_key'].strip().upper()
        if not re.fullmatch(r'[A-E0-9\s,;:\-.)]+', raw_key):
            raise serializers.ValidationError({'answer_key': 'Faqat A–E harflari va ajratuvchi belgilarni kiriting.'})
        key = ''.join(re.findall(r'[A-E]', raw_key))
        if not key:
            raise serializers.ValidationError({'answer_key': 'Kamida bitta javob kiriting.'})
        if len(key) > 350:
            raise serializers.ValidationError({'answer_key': 'Javoblar soni 350 tadan oshmasin.'})
        if attrs['scoring_scheme'] == Quiz.ScoringScheme.DTM_189 and len(key) != 90:
            raise serializers.ValidationError({'answer_key': 'DTM 90/189 shabloni uchun aynan 90 ta javob kerak.'})
        attrs['normalized_key'] = key
        return attrs


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
        fields = ('id', 'text', 'explanation', 'order', 'points', 'choices', 'section_title')

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError('Savol matni bo‘sh bo‘lmasin.')
        return value

    def validate_choices(self, choices):
        if len(choices) < 2:
            raise serializers.ValidationError('Kamida 2 ta variant kerak.')

        correct_count = sum(bool(choice.get('is_correct')) for choice in choices)

        # Muhim o‘zgarish:
        # Import vaqtida 0 ta correct bo‘lishiga ruxsat beramiz.
        # Chunki ba’zi PDFlarda javob kaliti bo‘lmaydi.
        # Lekin 2 ta yoki undan ko‘p correct bo‘lishi mumkin emas.
        if correct_count > 1:
            raise serializers.ValidationError('Faqat 1 ta to‘g‘ri javob tanlanishi mumkin.')

        for choice in choices:
            if not str(choice.get('text', '')).strip():
                raise serializers.ValidationError('Variant matni bo‘sh bo‘lmasin.')

        return choices


class QuizListSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(source='questions.count', read_only=True)
    attempt_count = serializers.IntegerField(source='attempts.count', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True, allow_null=True)

    class Meta:
        model = Quiz
        fields = (
            'id',
            'group',
            'group_name',
            'title',
            'description',
            'status',
            'scoring_scheme',
            'share_code',
            'duration_minutes',
            'shuffle_questions',
            'shuffle_choices',
            'show_score',
            'one_attempt_per_student',
            'starts_at',
            'ends_at',
            'question_count',
            'attempt_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('share_code', 'status', 'created_at', 'updated_at')

    def validate(self, attrs):
        group = attrs.get('group', getattr(self.instance, 'group', None))
        request = self.context.get('request')
        if group and request and group.owner_id != request.user.id:
            raise serializers.ValidationError({'group': 'Bu guruh sizga tegishli emas.'})
        starts_at = attrs.get('starts_at', getattr(self.instance, 'starts_at', None))
        ends_at = attrs.get('ends_at', getattr(self.instance, 'ends_at', None))

        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError('Boshlanish vaqti tugash vaqtidan oldin bo‘lishi kerak.')

        duration = attrs.get('duration_minutes', getattr(self.instance, 'duration_minutes', 20))
        if duration > 360:
            raise serializers.ValidationError({'duration_minutes': 'Test davomiyligi 360 daqiqadan oshmasin.'})

        return attrs


class QuizDetailSerializer(QuizListSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta(QuizListSerializer.Meta):
        fields = QuizListSerializer.Meta.fields + ('questions',)


class ImportPDFSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    mode = serializers.ChoiceField(
        choices=SourceDocument.Mode.choices,
        required=False,
        default=SourceDocument.Mode.AUTO,
    )
    question_count = serializers.IntegerField(min_value=1, max_value=350, required=False, default=20)

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
            'id',
            'title',
            'description',
            'share_code',
            'duration_minutes',
            'shuffle_questions',
            'shuffle_choices',
            'question_count',
            'questions',
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
            'id',
            'student_name',
            'score',
            'max_score',
            'percentage',
            'started_at',
            'submitted_at',
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
                section_title=question_data.get('section_title', ''),
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
