from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone
from .models import Task, TaskComment, TaskAttachment, Milestone
from .serializers import (
    TaskListSerializer, TaskDetailSerializer, TaskCreateSerializer,
    TaskCommentSerializer, TaskAttachmentSerializer, MilestoneSerializer
)
from apps.projects.models import ProjectMember


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet for Task model."""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TaskListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateSerializer
        return TaskDetailSerializer
    
    def get_queryset(self):
        queryset = Task.objects.all()
        
        # Filter by project
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        # Filter by status
        task_status = self.request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status)
        
        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        
        # Filter by assignee
        assignee_id = self.request.query_params.get('assignee')
        if assignee_id:
            queryset = queryset.filter(assignee_id=assignee_id)
        
        # Filter by milestone
        milestone_id = self.request.query_params.get('milestone')
        if milestone_id:
            queryset = queryset.filter(milestone_id=milestone_id)
        
        # Filter unassigned tasks
        unassigned = self.request.query_params.get('unassigned')
        if unassigned == 'true':
            queryset = queryset.filter(assignee__isnull=True)
        
        # My tasks
        my_tasks = self.request.query_params.get('my_tasks')
        if my_tasks == 'true':
            queryset = queryset.filter(assignee=self.request.user)
        
        return queryset.select_related('project', 'assignee', 'milestone')
    
    def perform_create(self, serializer):
        task = serializer.save()
        # Add activity
        from apps.users.models import UserActivity
        UserActivity.objects.create(
            user=self.request.user,
            action='task_created',
            description=f"Created task: {task.title}",
            project=task.project
        )
    
    def perform_update(self, serializer):
        old_status = self.get_object().status
        task = serializer.save()
        
        # If task is completed
        if task.status == 'done' and old_status != 'done':
            # Update user stats
            if task.assignee:
                task.assignee.tasks_completed += 1
                task.assignee.save()
                
                # Update project membership
                membership = ProjectMember.objects.filter(
                    project=task.project,
                    user=task.assignee
                ).first()
                if membership:
                    membership.tasks_completed += 1
                    membership.save()
            
            # Add activity
            from apps.users.models import UserActivity
            UserActivity.objects.create(
                user=self.request.user,
                action='task_completed',
                description=f"Completed task: {task.title}",
                project=task.project
            )
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign a task to a user."""
        task = self.get_object()
        user_id = request.data.get('user_id')
        
        # Check if user is member of project
        is_member = task.project.members.filter(id=user_id).exists()
        if not is_member:
            return Response(
                {'error': 'User is not a member of this project'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            user = User.objects.get(id=user_id)
            task.assignee = user
            task.save()
            
            # Notify assignee
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=user,
                title='Task Assigned',
                message=f"You have been assigned to task: {task.title}",
                notification_type='task_assigned',
                link=f'/projects/{task.project.slug}/tasks/{task.id}'
            )
            
            serializer = TaskDetailSerializer(task)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Add a comment to a task."""
        task = self.get_object()
        content = request.data.get('content')
        
        comment = TaskComment.objects.create(
            task=task,
            author=request.user,
            content=content
        )
        
        serializer = TaskCommentSerializer(comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        """Upload an attachment to a task."""
        task = self.get_object()
        file = request.FILES.get('file')
        
        if not file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attachment = TaskAttachment.objects.create(
            task=task,
            file=file,
            uploaded_by=request.user,
            filename=file.name
        )
        
        serializer = TaskAttachmentSerializer(attachment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MilestoneViewSet(viewsets.ModelViewSet):
    """ViewSet for Milestone model."""
    serializer_class = MilestoneSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Milestone.objects.all()
        
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        is_completed = self.request.query_params.get('is_completed')
        if is_completed:
            queryset = queryset.filter(is_completed=is_completed == 'true')
        
        return queryset.prefetch_related('tasks')
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark milestone as completed."""
        milestone = self.get_object()
        milestone.is_completed = True
        milestone.completed_at = timezone.now()
        milestone.save()
        
        serializer = self.get_serializer(milestone)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def incomplete(self, request, pk=None):
        """Mark milestone as incomplete."""
        milestone = self.get_object()
        milestone.is_completed = False
        milestone.completed_at = None
        milestone.save()
        
        serializer = self.get_serializer(milestone)
        return Response(serializer.data)
