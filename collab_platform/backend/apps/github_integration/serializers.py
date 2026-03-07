from rest_framework import serializers
from .models import (
    GitHubRepository, GitHubCommit, GitHubPullRequest,
    GitHubIssue, ContributionAnalytics
)


class GitHubCommitSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubCommit
        fields = [
            'id', 'sha', 'message', 'author_name', 'author_email',
            'author_username', 'committer_username', 'date', 'url'
        ]


class GitHubPullRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubPullRequest
        fields = [
            'id', 'number', 'title', 'description', 'state',
            'author_username', 'is_merged', 'merged_at',
            'created_at', 'updated_at', 'url'
        ]


class GitHubIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubIssue
        fields = [
            'id', 'number', 'title', 'description', 'state',
            'author_username', 'labels', 'is_pull_request',
            'created_at', 'updated_at', 'closed_at', 'url'
        ]


class GitHubRepositorySerializer(serializers.ModelSerializer):
    commits = GitHubCommitSerializer(many=True, read_only=True)
    pull_requests = GitHubPullRequestSerializer(many=True, read_only=True)
    issues = GitHubIssueSerializer(many=True, read_only=True)
    
    class Meta:
        model = GitHubRepository
        fields = [
            'id', 'project', 'owner', 'repo_name', 'full_name',
            'description', 'url', 'default_branch', 'is_private',
            'stars', 'forks', 'language', 'last_synced',
            'commits', 'pull_requests', 'issues'
        ]
        read_only_fields = ['id', 'last_synced']


class ContributionAnalyticsSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = ContributionAnalytics
        fields = [
            'id', 'user', 'user_email', 'project', 'commits_count',
            'prs_count', 'prs_merged', 'issues_count', 'active_days', 'last_active'
        ]
