from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q
from django.utils import timezone
import uuid
from datetime import timedelta
from .models import (
    Project, ProjectMember, JoinRequest,
    ProjectInvitation, ProjectBookmark
)
from .serializers import (
    ProjectListSerializer, ProjectDetailSerializer,
    ProjectCreateSerializer, ProjectUpdateSerializer,
    ProjectMemberSerializer, JoinRequestSerializer,
    ProjectInvitationSerializer, ProjectBookmarkSerializer
)


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for Project model."""
    queryset = Project.objects.all()
    permission_classes = [AllowAny]
    lookup_field = 'pk'
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        if self.action == 'create':
            return ProjectCreateSerializer
        if self.action in ['update', 'partial_update']:
            return ProjectUpdateSerializer
        return ProjectDetailSerializer
    
    def get_queryset(self):
        queryset = Project.objects.all()
        
        # Filter by visibility
        visibility = self.request.query_params.get('visibility')
        if visibility:
            queryset = queryset.filter(visibility=visibility)
        
        # Filter by status
        project_status = self.request.query_params.get('status')
        if project_status:
            queryset = queryset.filter(status=project_status)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by difficulty
        difficulty = self.request.query_params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)
        
        # Filter by tech stack
        tech = self.request.query_params.get('tech')
        if tech:
            queryset = queryset.filter(tech_stack__contains=[tech])
        
        # Filter by health status
        health = self.request.query_params.get('health')
        if health:
            queryset = queryset.filter(health_status=health)
        
        # Filter by beginner friendly
        beginner_friendly = self.request.query_params.get('beginner_friendly')
        if beginner_friendly == 'true':
            queryset = queryset.filter(is_beginner_friendly=True)
        
        # Filter featured projects
        featured = self.request.query_params.get('featured')
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)
        
        # Search query
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(problem_statement__icontains=search)
            )
        
        # Filter my projects (for authenticated users)
        my_projects = self.request.query_params.get('my_projects')
        if my_projects == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(
                Q(owner=self.request.user) |
                Q(members=self.request.user)
            )
        
        return queryset.select_related('owner').prefetch_related('members')
    
    def perform_create(self, serializer):
        project = serializer.save()
        # Add activity
        from apps.users.models import UserActivity
        UserActivity.objects.create(
            user=self.request.user,
            action='project_created',
            description=f"Created project: {project.title}",
            project=project
        )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        """Request to join a project."""
        project = self.get_object()
        user = request.user
        
        # Check if already a member
        if ProjectMember.objects.filter(project=project, user=user).exists():
            return Response(
                {'error': 'You are already a member of this project'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already has a pending request
        if JoinRequest.objects.filter(
            project=project,
            user=user,
            status='pending'
        ).exists():
            return Response(
                {'error': 'You already have a pending request'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if project is accepting members
        if project.status not in ['idea', 'accepting']:
            return Response(
                {'error': 'This project is not accepting new members'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        role_preference = request.data.get('role_preference', 'contributor')
        message = request.data.get('message', '')
        
        join_request = JoinRequest.objects.create(
            project=project,
            user=user,
            role_preference=role_preference,
            message=message
        )
        
        # Create notification for project owner
        from apps.notifications.models import Notification
        Notification.objects.create(
            recipient=project.owner,
            title='New Join Request',
            message=f"{user.email} wants to join your project {project.title}",
            notification_type='join_request',
            link=f'/projects/{project.slug}/members'
        )
        
        serializer = JoinRequestSerializer(join_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def join_requests(self, request, pk=None):
        """Get join requests for a project."""
        project = self.get_object()
        
        # Check if user is owner or maintainer
        membership = ProjectMember.objects.filter(
            project=project,
            user=request.user
        ).first()
        
        if not membership or membership.role not in ['owner', 'maintainer']:
            return Response(
                {'error': 'Only owners and maintainers can view join requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        join_requests = JoinRequest.objects.filter(project=project)
        status_filter = request.query_params.get('status')
        if status_filter:
            join_requests = join_requests.filter(status=status_filter)
        
        serializer = JoinRequestSerializer(join_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def handle_join_request(self, request, pk=None):
        """Accept or reject a join request."""
        project = self.get_object()
        
        # Check if user is owner or maintainer
        membership = ProjectMember.objects.filter(
            project=project,
            user=request.user
        ).first()
        
        if not membership or membership.role not in ['owner', 'maintainer']:
            return Response(
                {'error': 'Only owners and maintainers can handle join requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        request_id = request.data.get('request_id')
        action = request.data.get('action')  # 'accept', 'reject', 'waitlist'
        
        try:
            join_request = JoinRequest.objects.get(
                id=request_id,
                project=project
            )
        except JoinRequest.DoesNotExist:
            return Response(
                {'error': 'Join request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if action == 'accept':
            join_request.status = 'accepted'
            join_request.save()
            
            # Add user to project
            ProjectMember.objects.create(
                project=project,
                user=join_request.user,
                role=join_request.role_preference
            )
            
            # Notify the user
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=join_request.user,
                title='Join Request Accepted',
                message=f"Your request to join {project.title} has been accepted!",
                notification_type='join_request_accepted',
                link=f'/projects/{project.slug}'
            )
        
        elif action == 'reject':
            join_request.status = 'rejected'
            join_request.save()
            
            # Notify the user
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=join_request.user,
                title='Join Request Rejected',
                message=f"Your request to join {project.title} has been rejected.",
                notification_type='join_request_rejected',
                link=f'/projects/{project.slug}'
            )
        
        elif action == 'waitlist':
            join_request.status = 'waitlisted'
            join_request.save()
        
        serializer = JoinRequestSerializer(join_request)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def leave(self, request, pk=None):
        """Leave a project."""
        project = self.get_object()
        user = request.user
        
        membership = ProjectMember.objects.filter(
            project=project,
            user=user
        ).first()
        
        if not membership:
            return Response(
                {'error': 'You are not a member of this project'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if membership.role == 'owner':
            return Response(
                {'error': 'Owner cannot leave the project. Transfer ownership first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        membership.delete()
        
        return Response({'message': 'You have left the project'})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def update_member_role(self, request, pk=None):
        """Update a member's role."""
        project = self.get_object()
        
        # Check if user is owner
        membership = ProjectMember.objects.filter(
            project=project,
            user=request.user
        ).first()
        
        if not membership or membership.role != 'owner':
            return Response(
                {'error': 'Only owners can update member roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        member_id = request.data.get('member_id')
        new_role = request.data.get('role')
        
        try:
            member = ProjectMember.objects.get(
                id=member_id,
                project=project
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        member.role = new_role
        member.save()
        
        serializer = ProjectMemberSerializer(member)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def remove_member(self, request, pk=None):
        """Remove a member from the project."""
        project = self.get_object()
        
        # Check if user is owner or maintainer
        membership = ProjectMember.objects.filter(
            project=project,
            user=request.user
        ).first()
        
        if not membership or membership.role not in ['owner', 'maintainer']:
            return Response(
                {'error': 'Only owners and maintainers can remove members'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        member_id = request.data.get('member_id')
        
        try:
            member = ProjectMember.objects.get(
                id=member_id,
                project=project
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if member.role == 'owner':
            return Response(
                {'error': 'Cannot remove the owner'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        member.delete()
        
        return Response({'message': 'Member removed from project'})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def transfer_ownership(self, request, pk=None):
        """Transfer project ownership to another member."""
        project = self.get_object()
        
        if project.owner != request.user:
            return Response(
                {'error': 'Only the owner can transfer ownership'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_owner_id = request.data.get('user_id')
        
        try:
            new_owner = ProjectMember.objects.get(
                id=new_owner_id,
                project=project
            )
        except ProjectMember.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update roles
        old_owner_membership = ProjectMember.objects.get(
            project=project,
            user=request.user
        )
        old_owner_membership.role = ProjectMember.Role.MAINTAINER
        old_owner_membership.save()
        
        new_owner.role = ProjectMember.Role.OWNER
        new_owner.save()
        
        project.owner = new_owner.user
        project.save()
        
        return Response({'message': 'Ownership transferred successfully'})
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def invite(self, request, pk=None):
        """Invite a user to the project."""
        project = self.get_object()
        
        # Check if user is owner or maintainer
        membership = ProjectMember.objects.filter(
            project=project,
            user=request.user
        ).first()
        
        if not membership or membership.role not in ['owner', 'maintainer']:
            return Response(
                {'error': 'Only owners and maintainers can invite members'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = request.data.get('email')
        role = request.data.get('role', 'contributor')
        
        # Generate token
        token = str(uuid.uuid4())
        expires_at = timezone.now() + timedelta(days=7)
        
        invitation = ProjectInvitation.objects.create(
            project=project,
            email=email,
            role=role,
            invited_by=request.user,
            token=token,
            expires_at=expires_at
        )
        
        # TODO: Send invitation email
        
        serializer = ProjectInvitationSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def bookmark(self, request, pk=None):
        """Bookmark a project."""
        project = self.get_object()
        
        bookmark, created = ProjectBookmark.objects.get_or_create(
            project=project,
            user=request.user
        )
        
        if created:
            return Response({'message': 'Project bookmarked'})
        return Response({'message': 'Already bookmarked'})
    
    @action(detail=True, methods=['delete'], permission_classes=[IsAuthenticated])
    def unbookmark(self, request, pk=None):
        """Remove bookmark from a project."""
        project = self.get_object()
        
        deleted, _ = ProjectBookmark.objects.filter(
            project=project,
            user=request.user
        ).delete()
        
        if deleted:
            return Response({'message': 'Bookmark removed'})
        return Response({'error': 'Bookmark not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def bookmarks(self, request):
        """Get user's bookmarked projects."""
        bookmarks = ProjectBookmark.objects.filter(
            user=request.user
        ).select_related('project')
        
        projects = [b.project for b in bookmarks]
        serializer = ProjectListSerializer(projects, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_projects(self, request):
        """Get projects where user is a member."""
        memberships = ProjectMember.objects.filter(
            user=request.user
        ).select_related('project')
        
        projects = [m.project for m in memberships]
        serializer = ProjectListSerializer(projects, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured projects."""
        projects = Project.objects.filter(
            is_featured=True,
            visibility='public'
        ).exclude(status='archived')[:10]
        
        serializer = ProjectListSerializer(projects, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all project categories."""
        return Response(dict(Project.ProjectCategory.choices))
    
    @action(detail=False, methods=['get'])
    def tech_stack_options(self, request):
        """Get common tech stack options."""
        tech_stacks = [
            'Python', 'JavaScript', 'TypeScript', 'React', 'Vue.js',
            'Angular', 'Django', 'Flask', 'Node.js', 'Express',
            'Go', 'Rust', 'Java', 'Kotlin', 'Swift', 'Flutter',
            'React Native', 'PostgreSQL', 'MongoDB', 'Redis',
            'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
            'TensorFlow', 'PyTorch', 'OpenCV', 'Scikit-learn',
            'GraphQL', 'REST API', 'WebSockets'
        ]
        return Response(tech_stacks)


class JoinRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for JoinRequest model."""
    serializer_class = JoinRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return JoinRequest.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        # This is handled by ProjectViewSet.join
        pass
