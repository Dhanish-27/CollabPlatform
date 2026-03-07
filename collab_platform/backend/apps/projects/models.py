from django.db import models
from django.conf import settings
from django.utils import timezone


class ProjectCategory(models.TextChoices):
    AI = 'ai', 'Artificial Intelligence'
    WEB = 'web', 'Web Development'
    MOBILE = 'mobile', 'Mobile Development'
    ML = 'ml', 'Machine Learning'
    DATA = 'data', 'Data Science'
    DEVOPS = 'devops', 'DevOps'
    BLOCKCHAIN = 'blockchain', 'Blockchain'
    GAME = 'game', 'Game Development'
    OTHER = 'other', 'Other'


class ProjectDifficulty(models.TextChoices):
    BEGINNER = 'beginner', 'Beginner'
    INTERMEDIATE = 'intermediate', 'Intermediate'
    ADVANCED = 'advanced', 'Advanced'
    EXPERT = 'expert', 'Expert'


class ProjectStatus(models.TextChoices):
    IDEA = 'idea', 'Idea Stage'
    ACCEPTING = 'accepting', 'Accepting Members'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    ARCHIVED = 'archived', 'Archived'


class Visibility(models.TextChoices):
    PUBLIC = 'public', 'Public'
    PRIVATE = 'private', 'Private'


class Project(models.Model):
    """Main Project model."""
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField()
    problem_statement = models.TextField(
        help_text="Mandatory: What problem does this project solve?"
    )
    
    # Classification
    category = models.CharField(
        max_length=20,
        choices=ProjectCategory.choices,
        default=ProjectCategory.OTHER,
        db_index=True
    )
    difficulty = models.CharField(
        max_length=20,
        choices=ProjectDifficulty.choices,
        default=ProjectDifficulty.INTERMEDIATE,
        db_index=True
    )
    
    # Team settings
    max_team_size = models.IntegerField(default=5)
    required_roles = models.JSONField(default=list)
    tech_stack = models.JSONField(default=list)
    
    # Time
    estimated_duration = models.CharField(max_length=100, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    
    # Visibility and status
    visibility = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.IDEA,
        db_index=True
    )
    
    # Badges
    is_beginner_friendly = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    
    # Owner
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_projects'
    )
    
    # Members (ManyToMany through ProjectMember)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ProjectMember',
        related_name='projects'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity = models.DateTimeField(default=timezone.now)
    
    # Health tracking
    health_status = models.CharField(
        max_length=20,
        choices=[
            ('active', 'Active'),
            ('slow', 'Slow'),
            ('inactive', 'Inactive'),
        ],
        default='active',
        db_index=True
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Projects'
    
    def __str__(self):
        return self.title
    
    @property
    def member_count(self):
        return self.members.count()
    
    @property
    def completion_percentage(self):
        from apps.tasks.models import Task
        total_tasks = Task.objects.filter(project=self).count()
        if total_tasks == 0:
            return 0
        completed_tasks = Task.objects.filter(project=self, status='done').count()
        return int((completed_tasks / total_tasks) * 100)


class ProjectMember(models.Model):
    """Through model for project members with roles."""
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        MAINTAINER = 'maintainer', 'Maintainer'
        CONTRIBUTOR = 'contributor', 'Contributor'
        MENTOR = 'mentor', 'Mentor'
        OBSERVER = 'observer', 'Observer'
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        IDLE = 'idle', 'Idle'
        INACTIVE = 'inactive', 'Inactive'
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CONTRIBUTOR
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    
    # Contribution tracking
    tasks_completed = models.IntegerField(default=0)
    commits_count = models.IntegerField(default=0)
    last_active = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ['project', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.project.title} ({self.role})"


class JoinRequest(models.Model):
    """Model for project join requests."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'
        WAITLISTED = 'waitlisted', 'Waitlisted'
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='join_requests'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='join_requests'
    )
    role_preference = models.CharField(
        max_length=20,
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.CONTRIBUTOR
    )
    message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['project', 'user']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} wants to join {self.project.title}"


class ProjectInvitation(models.Model):
    """Model for project invitations."""
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    email = models.EmailField()
    role = models.CharField(
        max_length=20,
        choices=ProjectMember.Role.choices,
        default=ProjectMember.Role.CONTRIBUTOR
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )
    token = models.CharField(max_length=100, unique=True)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    def __str__(self):
        return f"Invitation to {self.email} for {self.project.title}"


class ProjectBookmark(models.Model):
    """Model for bookmarking projects."""
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookmarked_projects'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['project', 'user']
    
    def __str__(self):
        return f"{self.user.email} bookmarked {self.project.title}"
