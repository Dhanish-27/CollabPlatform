from django.db import models
from django.conf import settings


class Group(models.Model):
    """GitHub repository group linked with local database records.
    
    This model represents a GitHub repository that can be created and managed
    through the platform. It stores the link between local groups and GitHub repos.
    """
    name = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255, unique=True)
    github_repo_id = models.BigIntegerField()
    visibility = models.CharField(
        max_length=20,
        choices=[("private", "Private"), ("public", "Public")]
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups"
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="joined_groups",
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class GitHubRepository(models.Model):
    """GitHub repository linked to a project."""
    project = models.OneToOneField(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='github_repo'
    )
    owner = models.CharField(max_length=100)
    repo_name = models.CharField(max_length=100)
    full_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    url = models.URLField()
    default_branch = models.CharField(max_length=50, default='main')
    is_private = models.BooleanField(default=False)
    stars = models.IntegerField(default=0)
    forks = models.IntegerField(default=0)
    language = models.CharField(max_length=50, blank=True)
    last_synced = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.full_name


class GitHubCommit(models.Model):
    """GitHub commits linked to projects."""
    repository = models.ForeignKey(
        GitHubRepository,
        on_delete=models.CASCADE,
        related_name='commits'
    )
    sha = models.CharField(max_length=40)
    message = models.TextField()
    author_name = models.CharField(max_length=100)
    author_email = models.EmailField(blank=True)
    author_username = models.CharField(max_length=100, blank=True)
    committer_username = models.CharField(max_length=100, blank=True)
    date = models.DateTimeField()
    url = models.URLField()
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='github_commits'
    )
    
    class Meta:
        ordering = ['-date']
        unique_together = ['repository', 'sha']
    
    def __str__(self):
        return f"{self.sha[:7]} - {self.message[:50]}"


class GitHubPullRequest(models.Model):
    """GitHub pull requests linked to projects."""
    repository = models.ForeignKey(
        GitHubRepository,
        on_delete=models.CASCADE,
        related_name='pull_requests'
    )
    number = models.IntegerField()
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    state = models.CharField(max_length=20)
    author_username = models.CharField(max_length=100)
    is_merged = models.BooleanField(default=False)
    merged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    url = models.URLField()
    
    class Meta:
        unique_together = ['repository', 'number']
    
    def __str__(self):
        return f"PR #{self.number}: {self.title}"


class GitHubIssue(models.Model):
    """GitHub issues linked to projects."""
    repository = models.ForeignKey(
        GitHubRepository,
        on_delete=models.CASCADE,
        related_name='issues'
    )
    number = models.IntegerField()
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    state = models.CharField(max_length=20)
    author_username = models.CharField(max_length=100)
    labels = models.JSONField(default=list)
    is_pull_request = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    url = models.URLField()
    
    class Meta:
        unique_together = ['repository', 'number']
    
    def __str__(self):
        return f"Issue #{self.number}: {self.title}"


class ContributionAnalytics(models.Model):
    """Contribution analytics per user per project."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='contribution_analytics'
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='contribution_analytics'
    )
    commits_count = models.IntegerField(default=0)
    prs_count = models.IntegerField(default=0)
    prs_merged = models.IntegerField(default=0)
    issues_count = models.IntegerField(default=0)
    active_days = models.IntegerField(default=0)
    last_active = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['user', 'project']
    
    def __str__(self):
        return f"{self.user.email} - {self.project.title} analytics"
