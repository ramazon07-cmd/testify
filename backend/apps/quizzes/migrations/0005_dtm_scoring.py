from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('quizzes', '0004_student_attempt_student_studentgroup_student_group_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='scoring_scheme',
            field=models.CharField(
                choices=[('standard', 'Standard'), ('dtm_189', 'DTM 90 / 189')],
                default='standard',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='question',
            name='points',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('1.00'),
                max_digits=6,
                validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
            ),
        ),
        migrations.AlterField(
            model_name='attempt',
            name='score',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=8),
        ),
        migrations.AlterField(
            model_name='attempt',
            name='max_score',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=8),
        ),
        migrations.AlterField(
            model_name='attemptanswer',
            name='awarded_points',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=6),
        ),
    ]
