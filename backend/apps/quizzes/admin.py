from django.contrib import admin

from .models import Attempt, AttemptAnswer, Choice, Question, Quiz, SourceDocument


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 0


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'status', 'share_code', 'duration_minutes', 'created_at')
    list_filter = ('status', 'show_score', 'one_attempt_per_student')
    search_fields = ('title', 'share_code', 'owner__username')


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'order', 'text')
    search_fields = ('text', 'quiz__title')
    inlines = [ChoiceInline]


@admin.register(SourceDocument)
class SourceDocumentAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'owner', 'mode', 'status', 'created_at')
    list_filter = ('mode', 'status')


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ('quiz', 'student_name', 'score', 'max_score', 'percentage', 'started_at', 'submitted_at')
    search_fields = ('student_name', 'quiz__title')


admin.site.register(AttemptAnswer)
