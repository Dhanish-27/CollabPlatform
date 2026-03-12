from django.db import migrations, models
import uuid


def set_placeholder_github_usernames(apps, schema_editor):
    """Assign unique placeholder github_usernames to all existing users."""
    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        # Use a unique placeholder: 'user_<uuid_short>' so UNIQUE constraint is satisfied
        user.github_username = f"user_{uuid.uuid4().hex[:12]}"
        user.save(update_fields=['github_username'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        # Step 1: Add the column as nullable first (no unique constraint yet)
        migrations.AddField(
            model_name='user',
            name='github_username',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=39,
                help_text='Your GitHub username (validated against GitHub)',
            ),
        ),
        # Step 2: Fill all existing rows with unique placeholder values
        migrations.RunPython(
            set_placeholder_github_usernames,
            reverse_code=migrations.RunPython.noop,
        ),
        # Step 3: Apply unique + not-null constraint now that every row has a value
        migrations.AlterField(
            model_name='user',
            name='github_username',
            field=models.CharField(
                max_length=39,
                unique=True,
                help_text='Your GitHub username (validated against GitHub)',
            ),
        ),
    ]
