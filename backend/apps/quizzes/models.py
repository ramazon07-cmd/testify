import secrets
import string
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def generate_share_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(7))


class Quiz(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        CLOSED = 'closed', 'Closed'

    class ScoringScheme(models.TextChoices):
        STANDARD = 'standard', 'Standard'
        DTM_189 = 'dtm_189', 'DTM 90 / 189'

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quizzes')
    group = models.ForeignKey('StudentGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='quizzes')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    scoring_scheme = models.CharField(max_length=20, choices=ScoringScheme.choices, default=ScoringScheme.STANDARD)
    share_code = models.CharField(max_length=12, unique=True, default=generate_share_code, editable=False)
    duration_minutes = models.PositiveIntegerField(default=20, validators=[MinValueValidator(1)])
    shuffle_questions = models.BooleanField(default=False)
    shuffle_choices = models.BooleanField(default=False)
    show_score = models.BooleanField(default=True)
    one_attempt_per_student = models.BooleanField(default=False)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def total_points(self):
        return sum(q.points for q in self.questions.all())

    def is_available(self) -> tuple[bool, str]:
        now = timezone.now()
        if self.status != self.Status.PUBLISHED:
            return False, 'Test e’lon qilinmagan yoki yopilgan.'
        if self.starts_at and now < self.starts_at:
            return False, 'Test hali boshlanmagan.'
        if self.ends_at and now > self.ends_at:
            return False, 'Test vaqti tugagan.'
        return True, ''


class SourceDocument(models.Model):
    class Mode(models.TextChoices):
        AUTO = 'auto', 'Auto detect'
        READY_TEST = 'ready_test', 'Ready test'
        CONTENT = 'content', 'Content to questions'

    class Status(models.TextChoices):
        PROCESSING = 'processing', 'Processing'
        DONE = 'done', 'Done'
        FAILED = 'failed', 'Failed'

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='source_documents')
    quiz = models.OneToOneField(Quiz, on_delete=models.CASCADE, related_name='source_document')
    file = models.FileField(upload_to='pdfs/%Y/%m/')
    original_name = models.CharField(max_length=255)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.AUTO)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    extracted_text = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    section_title = models.CharField(max_length=200, blank=True)
    explanation = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    points = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('1.00'), validators=[MinValueValidator(Decimal('0.01'))])

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.text[:80]


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.text[:80]


class Attempt(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey('Student', on_delete=models.SET_NULL, null=True, blank=True, related_name='attempts')
    student_name = models.CharField(max_length=150)
    score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    max_score = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at', '-started_at']
        indexes = [models.Index(fields=['quiz', 'student_name'])]

    def __str__(self):
        return f'{self.student_name} — {self.quiz.title}'

    @property
    def expires_at(self):
        return self.started_at + timedelta(minutes=self.quiz.duration_minutes)

    def is_expired(self):
        return timezone.now() > self.expires_at


class AttemptAnswer(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(Choice, on_delete=models.SET_NULL, null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    awarded_points = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['attempt', 'question'], name='unique_attempt_question')
        ]


class StudentGroup(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_groups')
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'id']
        constraints = [models.UniqueConstraint(fields=['owner', 'name'], name='unique_owner_group_name')]

    def __str__(self):
        return self.name


class Student(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='students')
    group = models.ForeignKey(StudentGroup, on_delete=models.CASCADE, related_name='students')
    name = models.CharField(max_length=150)
    parent_phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'id']

    def __str__(self):
        return self.name
