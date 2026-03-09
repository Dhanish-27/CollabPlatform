from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.conf import settings
from django.db import models

from .models import (
    Group, GitHubRepository, GitHubCommit, GitHubPullRequest,
    GitHubIssue, ContributionAnalytics
)
from .serializers import (
    GroupSerializer, GroupCreateSerializer,
    GitHubRepositorySerializer, GitHubCommitSerializer,
    GitHubPullRequestSerializer, GitHubIssueSerializer,
    ContributionAnalyticsSerializer
)
from .github_service import GitHubService


class GroupViewSet(viewsets.ModelViewSet):
    """ViewSet for GitHub repository groups.
    
    Provides endpoints for creating, listing, joining, and deleting
    GitHub repository groups.
    """
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Return groups where user is a member OR public groups
        return Group.objects.filter(
            models.Q(members=user) | models.Q(visibility='public')
        ).distinct()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return GroupCreateSerializer
        return GroupSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new GitHub repository and corresponding group.
        
        POST /api/github/groups/
        
        Request body:
        {
            "name": "My Project Team",
            "repo_name": "my-project-team",
            "visibility": "private",
            "members": ["github-user1", "github-user2"]
        }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Initialize GitHub service (token from .env via settings)
        try:
            github_service = GitHubService()
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Create repository on GitHub
        try:
            repo = github_service.create_repository(
                name=serializer.validated_data['repo_name'],
                visibility=serializer.validated_data['visibility']
            )
        except Exception as e:
            return Response(
                {'error': f'GitHub API error: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create group in database
        group = Group.objects.create(
            name=serializer.validated_data['name'],
            repo_name=serializer.validated_data['repo_name'],
            github_repo_id=repo.id,
            visibility=serializer.validated_data['visibility'],
            created_by=request.user
        )
        
        # Add creator as a member
        group.members.add(request.user)
        
        # Add additional members if provided
        members_list = serializer.validated_data.get('members', [])
        if members_list:
            try:
                github_service.add_collaborators(repo, members_list)
                # Try to find users by username and add them
                from apps.users.models import User
                for username in members_list:
                    try:
                        # Users should have github_username field or we use email
                        user = User.objects.filter(
                            models.Q(github_username=username) | models.Q(email=f"{username}@example.com")
                        ).first()
                        if user:
                            group.members.add(user)
                    except:
                        pass  # Skip if user not found
            except Exception as e:
                # Continue even if adding collaborators fails
                pass
        
        # Create dev branch
        try:
            github_service.create_branch(repo, "dev")
        except:
            pass  # Continue even if branch creation fails
        
        return Response(
            GroupSerializer(group).data,
            status=status.HTTP_201_CREATED
        )
    
    def destroy(self, request, *args, **kwargs):
        """Delete a GitHub repository and corresponding group.
        
        DELETE /api/github/groups/<repo_name>/
        """
        group = self.get_object()
        repo_name = group.repo_name
        
        # Initialize GitHub service
        try:
            github_service = GitHubService()
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Delete repository from GitHub
        try:
            github_service.delete_repository(repo_name)
        except Exception as e:
            return Response(
                {'error': f'Failed to delete GitHub repository: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete group from database
        group.delete()
        
        return Response(
            {'message': 'Deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def my_groups(self, request):
        """List groups the authenticated user is a member of.
        
        GET /api/github/groups/my-groups/
        """
        groups = Group.objects.filter(members=request.user)
        serializer = self.get_serializer(groups, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Add the authenticated user as a member to a group.
        
        POST /api/github/groups/<group_id>/join/
        """
        group = self.get_object()
        group.members.add(request.user)
        return Response(
            GroupSerializer(group).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Remove the authenticated user from a group.
        
        POST /api/github/groups/<group_id>/leave/
        """
        group = self.get_object()
        group.members.remove(request.user)
        return Response(
            GroupSerializer(group).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def check_config(self, request):
        """Check if GitHub is properly configured.
        
        GET /api/github/groups/check-config/
        """
        token = settings.GITHUB_TOKEN
        org_name = settings.GITHUB_ORG_NAME
        
        if not token or not org_name:
            return Response({
                'configured': False,
                'message': 'GITHUB_TOKEN or GITHUB_ORG_NAME not configured'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            github_service = GitHubService()
            return Response({
                'configured': True,
                'organization': org_name,
                'message': 'GitHub integration is properly configured'
            })
        except Exception as e:
            return Response({
                'configured': False,
                'message': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


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
