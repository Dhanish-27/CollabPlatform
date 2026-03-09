from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q
from .models import ChatMessage, Thread, ThreadReply, Announcement, Message
from .serializers import (
    ChatMessageSerializer, ThreadSerializer, ThreadDetailSerializer,
    ThreadReplySerializer, AnnouncementSerializer, MessageSerializer
)


class GroupMessageListView(APIView):
    """
    GET /api/communications/groups/<group_id>/messages/
    Returns paginated message history ordered by created_at descending.
    Query params:
      - limit (default=50)
      - before_id (optional): return messages older than this message ID
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        limit = min(int(request.query_params.get('limit', 50)), 100)
        before_id = request.query_params.get('before_id')

        qs = Message.objects.filter(group_id=group_id).select_related('sender')

        if before_id:
            try:
                before_id = int(before_id)
                qs = qs.filter(id__lt=before_id)
            except (ValueError, TypeError):
                pass

        messages = list(qs[:limit])

        next_before_id = messages[-1].id if len(messages) == limit else None

        serializer = MessageSerializer(messages, many=True)
        return Response({
            'messages': serializer.data,
            'next_before_id': next_before_id,
        })


class ChatMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for chat messages."""
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ChatMessage.objects.all()
        
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.select_related('project', 'author')
    
    def perform_create(self, serializer):
        message = serializer.save(author=self.request.user)
        
        # Notify mentioned users
        mentions = message.mentions or []
        if mentions:
            from apps.notifications.models import Notification
            for user_id in mentions:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    user = User.objects.get(id=user_id)
                    Notification.objects.create(
                        recipient=user,
                        title='You were mentioned',
                        message=f"{self.request.user.email} mentioned you in {message.project.title}",
                        notification_type='mention',
                        link=f'/projects/{message.project.slug}/chat'
                    )
                except User.DoesNotExist:
                    pass


class ThreadViewSet(viewsets.ModelViewSet):
    """ViewSet for threaded discussions."""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ThreadSerializer
        if self.action == 'retrieve':
            return ThreadDetailSerializer
        return ThreadSerializer
    
    def get_queryset(self):
        queryset = Thread.objects.all()
        
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.select_related('project', 'author').prefetch_related('replies')
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class ThreadReplyViewSet(viewsets.ModelViewSet):
    """ViewSet for thread replies."""
    serializer_class = ThreadReplySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ThreadReply.objects.filter(thread_id=self.kwargs['thread_pk'])
    
    def perform_create(self, serializer):
        thread = Thread.objects.get(pk=self.kwargs['thread_pk'])
        if thread.is_locked:
            return Response(
                {'error': 'This thread is locked'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save(author=self.request.user)


class AnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for announcements."""
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Announcement.objects.all()
        
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.select_related('project', 'author')
    
    def perform_create(self, serializer):
        # Check if user is owner or maintainer
        project = serializer.validated_data['project']
        from apps.projects.models import ProjectMember
        membership = ProjectMember.objects.filter(
            project=project,
            user=self.request.user
        ).first()
        
        if not membership or membership.role not in ['owner', 'maintainer']:
            return Response(
                {'error': 'Only owners and maintainers can create announcements'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        announcement = serializer.save(author=self.request.user)
        
        # Notify all project members
        from apps.notifications.models import Notification
        for member in project.members.all():
            if member != self.request.user:
                Notification.objects.create(
                    recipient=member,
                    title='New Announcement',
                    message=f"New announcement in {project.title}: {announcement.title}",
                    notification_type='announcement',
                    link=f'/projects/{project.slug}/announcements'
                )
    
    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        """Pin an announcement."""
        announcement = self.get_object()
        announcement.is_pinned = True
        announcement.save()
        serializer = self.get_serializer(announcement)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def unpin(self, request, pk=None):
        """Unpin an announcement."""
        announcement = self.get_object()
        announcement.is_pinned = False
        announcement.save()
        serializer = self.get_serializer(announcement)
        return Response(serializer.data)
