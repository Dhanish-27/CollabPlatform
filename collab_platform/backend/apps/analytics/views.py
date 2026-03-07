from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg
from django.utils import timezone
from datetime import timedelta
from .models import UserFeedback, Report
from apps.users.models import User
from apps.projects.models import Project


class UserFeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for user feedback."""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return UserFeedback.objects.filter(to_user=self.request.user)
    
    def perform_create(self, serializer):
        # Calculate average ratings after saving
        feedback = serializer.save()
        
        # Update user ratings
        to_user = feedback.to_user
        all_feedback = UserFeedback.objects.filter(to_user=to_user)
        
        to_user.teamwork_rating = all_feedback.aggregate(Avg('teamwork_rating'))['teamwork_rating__avg'] or 0
        to_user.reliability_rating = all_feedback.aggregate(Avg('reliability_rating'))['reliability_rating__avg'] or 0
        to_user.feedback_count = all_feedback.count()
        to_user.save()
    
    @action(detail=False, methods=['get'])
    def received(self, request):
        """Get all feedback received by the current user."""
        feedbacks = UserFeedback.objects.filter(
            to_user=request.user,
            is_private=False
        )
        return Response(feedbacks.values())


class ReportViewSet(viewsets.ModelViewSet):
    """ViewSet for reports."""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if request.user.is_staff:
            return Report.objects.all()
        return Report.objects.filter(reporter=request.user)
    
    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class AnalyticsViewSet(viewsets.ViewSet):
    """ViewSet for analytics endpoints."""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get user dashboard analytics."""
        user = request.user
        
        # Projects stats
        owned_projects = Project.objects.filter(owner=user).count()
        joined_projects = user.projects.count()
        
        # Tasks stats
        from apps.tasks.models import Task
        assigned_tasks = Task.objects.filter(assignee=user).count()
        completed_tasks = Task.objects.filter(assignee=user, status='done').count()
        
        # Feedback stats
        from .models import UserFeedback
        feedback_received = UserFeedback.objects.filter(to_user=user).count()
        
        return Response({
            'owned_projects': owned_projects,
            'joined_projects': joined_projects,
            'assigned_tasks': assigned_tasks,
            'completed_tasks': completed_tasks,
            'feedback_received': feedback_received,
            'teamwork_rating': user.teamwork_rating,
            'reliability_rating': user.reliability_rating
        })
    
    @action(detail=False, methods=['get'])
    def admin_stats(self, request):
        """Get admin analytics."""
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # User stats
        total_users = User.objects.count()
        new_users_today = User.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=1)
        ).count()
        
        # Project stats
        total_projects = Project.objects.count()
        active_projects = Project.objects.filter(status='in_progress').count()
        completed_projects = Project.objects.filter(status='completed').count()
        
        return Response({
            'total_users': total_users,
            'new_users_today': new_users_today,
            'total_projects': total_projects,
            'active_projects': active_projects,
            'completed_projects': completed_projects
        })
