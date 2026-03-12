from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserRole(models.TextChoices):
    STUDENT = 'student', _('Student')
    DEVELOPER = 'developer', _('Developer')
    MENTOR = 'mentor', _('Mentor')


class ExperienceLevel(models.TextChoices):
    BEGINNER = 'beginner', _('Beginner')
    INTERMEDIATE = 'intermediate', _('Intermediate')
    ADVANCED = 'advanced', _('Advanced')
    EXPERT = 'expert', _('Expert')


class User(AbstractUser):
    """
    Custom User model with extended profile fields.
    """
    email = models.EmailField(_('email address'), unique=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.DEVELOPER,
        db_index=True
    )
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True, max_length=500)
    
    # Skill and experience
    skills = models.JSONField(default=list, blank=True)
    experience_level = models.CharField(
        max_length=20,
        choices=ExperienceLevel.choices,
        default=ExperienceLevel.BEGINNER,
        db_index=True
    )
    
    # Links
    github_username = models.CharField(max_length=39, unique=True, help_text="Your GitHub username (validated against GitHub)")
    github_link = models.URLField(blank=True)
    portfolio_link = models.URLField(blank=True)
    linkedin_link = models.URLField(blank=True)
    
    # Availability
    availability_hours = models.IntegerField(default=0, help_text="Hours per week")
    is_available_for_mentoring = models.BooleanField(default=False)
    
    # Profile settings
    is_public_profile = models.BooleanField(default=True)
    is_verified_mentor = models.BooleanField(default=False)
    profile_completion = models.IntegerField(default=0)
    
    # Activity tracking
    projects_joined = models.ManyToManyField(
        'projects.Project',
        related_name='joined_users',
        blank=True
    )
    tasks_completed = models.IntegerField(default=0)
    total_contributions = models.IntegerField(default=0)
    
    # Trust & Quality
    teamwork_rating = models.FloatField(default=0.0)
    reliability_rating = models.FloatField(default=0.0)
    feedback_count = models.IntegerField(default=0)
    
    # Timestamps
    last_activity = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    def calculate_profile_completion(self):
        """Calculate profile completion percentage."""
        fields_to_check = [
            self.bio,
            self.avatar,
            self.skills,
            self.experience_level,
            self.github_username,
            self.portfolio_link,
            self.availability_hours,
        ]
        completed = sum(1 for field in fields_to_check if field)
        self.profile_completion = int((completed / len(fields_to_check)) * 100)
        return self.profile_completion


class UserSkill(models.Model):
    """User skills with proficiency levels."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_skills'
    )
    name = models.CharField(max_length=100)
    proficiency = models.IntegerField(default=1, help_text="1-10 scale")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'name']
        ordering = ['-proficiency', 'name']

    def __str__(self):
        return f"{self.user.email} - {self.name}"


class UserActivity(models.Model):
    """Track user activities."""
    ACTION_TYPES = [
        ('login', 'Login'),
        ('project_joined', 'Project Joined'),
        ('project_created', 'Project Created'),
        ('task_completed', 'Task Completed'),
        ('commit_made', 'Commit Made'),
        ('message_sent', 'Message Sent'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    action = models.CharField(max_length=50, choices=ACTION_TYPES)
    description = models.TextField()
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_activities'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'User Activities'

    def __str__(self):
        return f"{self.user.email} - {self.action}"
