from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import (
    GitHubRepository, GitHubCommit, GitHubPullRequest,
    GitHubIssue, ContributionAnalytics
)
from .serializers import (
    GitHubRepositorySerializer, GitHubCommitSerializer,
    GitHubPullRequestSerializer, GitHubIssueSerializer,
    ContributionAnalyticsSerializer
)


class GitHubRepositoryViewSet(viewsets.ModelViewSet):
    """ViewSet for GitHub repositories."""
    serializer_class = GitHubRepositorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return GitHubRepository.objects.all()
    
    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Sync repository data from GitHub."""
        repo = self.get_object()
        # TODO: Implement actual GitHub API sync
        repo.last_synced = timezone.now()
        repo.save()
        
        return Response({'message': 'Repository synced successfully'})
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search GitHub for repositories."""
        # TODO: Implement GitHub API search
        return Response({'results': []})


class ContributionAnalyticsViewSet(viewsets.ModelViewSet):
    """ViewSet for contribution analytics."""
    serializer_class = ContributionAnalyticsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ContributionAnalytics.objects.all()
        
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset.select_related('user', 'project')
    
    @action(detail=False, methods=['get'])
    def project_summary(self, request):
        """Get contribution summary for a project."""
        project_id = request.query_params.get('project')
        if not project_id:
            return Response({'error': 'Project ID required'}, status=400)
        
        analytics = ContributionAnalytics.objects.filter(project_id=project_id)
        
        total_commits = sum(a.commits_count for a in analytics)
        total_prs = sum(a.prs_count for a in analytics)
        total_merged = sum(a.prs_merged for a in analytics)
        total_issues = sum(a.issues_count for a in analytics)
        
        return Response({
            'total_contributors': analytics.count(),
            'total_commits': total_commits,
            'total_prs': total_prs,
            'total_merged': total_merged,
            'total_issues': total_issues
        })
