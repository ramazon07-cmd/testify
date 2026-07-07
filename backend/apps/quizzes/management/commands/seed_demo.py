from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.quizzes.models import Choice, Question, Quiz


class Command(BaseCommand):
    help = 'Create demo teacher and demo quiz.'

    @transaction.atomic
    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username='teacher',
            defaults={'first_name': 'Demo', 'last_name': 'Teacher', 'email': 'teacher@example.com'},
        )
        user.set_password('demo12345')
        user.save()

        quiz, _ = Quiz.objects.get_or_create(
            owner=user,
            title='Demo: O‘zbekiston va matematika testi',
            defaults={'description': 'Testify demo testi', 'status': Quiz.Status.PUBLISHED, 'duration_minutes': 10},
        )
        quiz.questions.all().delete()
        data = [
            ('O‘zbekiston poytaxti qaysi shahar?', ['Samarqand', 'Buxoro', 'Toshkent', 'Xiva'], 2),
            ('2 + 2 nechiga teng?', ['3', '4', '5', '6'], 1),
            ('Django qaysi til frameworki?', ['Python', 'Java', 'PHP', 'Go'], 0),
        ]
        for i, (text, choices, correct) in enumerate(data):
            q = Question.objects.create(quiz=quiz, text=text, order=i, points=1)
            for j, choice in enumerate(choices):
                Choice.objects.create(question=q, text=choice, order=j, is_correct=j == correct)
        self.stdout.write(self.style.SUCCESS('Demo yaratildi: username=teacher password=demo12345'))
