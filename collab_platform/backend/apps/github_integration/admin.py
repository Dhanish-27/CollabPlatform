from django.contrib import admin
from .models import (
    GitHubRepository, GitHubCommit, GitHubPullRequest,
    GitHubIssue, ContributionAnalytics
)


@admin.register(GitHubRepository)
class GitHubRepositoryAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'project', 'language', 'stars', 'forks']
    search_fields = ['full_name', 'repo_name']


@admin.register(GitHubCommit)
class GitHubCommitAdmin(admin.ModelAdmin):
    list_display = ['sha', 'repository', 'author_username', 'date']
    list_filter = ['date', 'repository']
    search_fields = ['message', 'sha']


@admin.register(GitHubPullRequest)
class GitHubPullRequestAdmin(admin.ModelAdmin):
    list_display = ['number', 'repository', 'title', 'state', 'author_username']
    list_filter = ['state', 'is_merged']


@admin.register(GitHubIssue)
class GitHubIssueAdmin(admin.ModelAdmin):
    list_display = ['number', 'repository', 'title', 'state', 'author_username']
    list_filter = ['state', 'is_pull_request']


@admin.register(ContributionAnalytics)
class ContributionAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['user', 'project', 'commits_count', 'prs_count', 'last_active']
    list_filter = ['project']
