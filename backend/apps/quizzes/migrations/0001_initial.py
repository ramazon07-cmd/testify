# Generated for Testify Ready MVP
from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
import apps.quizzes.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Quiz',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('closed', 'Closed')], default='draft', max_length=20)),
                ('share_code', models.CharField(default=apps.quizzes.models.generate_share_code, editable=False, max_length=12, unique=True)),
                ('duration_minutes', models.PositiveIntegerField(default=20, validators=[django.core.validators.MinValueValidator(1)])),
                ('shuffle_questions', models.BooleanField(default=False)),
                ('shuffle_choices', models.BooleanField(default=False)),
                ('show_score', models.BooleanField(default=True)),
                ('one_attempt_per_student', models.BooleanField(default=False)),
                ('starts_at', models.DateTimeField(blank=True, null=True)),
                ('ends_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='quizzes', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('explanation', models.TextField(blank=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('points', models.PositiveIntegerField(default=1, validators=[django.core.validators.MinValueValidator(1)])),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='quizzes.quiz')),
            ],
            options={'ordering': ['order', 'id']},
        ),
        migrations.CreateModel(
            name='Choice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('is_correct', models.BooleanField(default=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='choices', to='quizzes.question')),
            ],
            options={'ordering': ['order', 'id']},
        ),
        migrations.CreateModel(
            name='SourceDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='pdfs/%Y/%m/')),
                ('original_name', models.CharField(max_length=255)),
                ('mode', models.CharField(choices=[('auto', 'Auto detect'), ('ready_test', 'Ready test'), ('content', 'Content to questions')], default='auto', max_length=20)),
                ('status', models.CharField(choices=[('processing', 'Processing'), ('done', 'Done'), ('failed', 'Failed')], default='processing', max_length=20)),
                ('extracted_text', models.TextField(blank=True)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='source_documents', to=settings.AUTH_USER_MODEL)),
                ('quiz', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='source_document', to='quizzes.quiz')),
            ],
        ),
        migrations.CreateModel(
            name='Attempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('student_name', models.CharField(max_length=150)),
                ('score', models.PositiveIntegerField(default=0)),
                ('max_score', models.PositiveIntegerField(default=0)),
                ('percentage', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('submitted_at', models.DateTimeField(blank=True, null=True)),
                ('quiz', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attempts', to='quizzes.quiz')),
            ],
            options={'ordering': ['-submitted_at', '-started_at']},
        ),
        migrations.CreateModel(
            name='AttemptAnswer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_correct', models.BooleanField(default=False)),
                ('awarded_points', models.PositiveIntegerField(default=0)),
                ('attempt', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='answers', to='quizzes.attempt')),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='quizzes.question')),
                ('selected_choice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='quizzes.choice')),
            ],
        ),
        migrations.AddIndex(model_name='attempt', index=models.Index(fields=['quiz', 'student_name'], name='quizzes_att_quiz_id_student_idx')),
        migrations.AddConstraint(model_name='attemptanswer', constraint=models.UniqueConstraint(fields=('attempt', 'question'), name='unique_attempt_question')),
    ]
