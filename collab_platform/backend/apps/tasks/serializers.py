from rest_framework import serializers
from .models import Task, TaskComment, TaskAttachment, Milestone
from apps.users.serializers import UserProfileSerializer


class TaskCommentSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'author', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = TaskAttachment
        fields = ['id', 'task', 'file', 'uploaded_by', 'filename', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'created_at']


class TaskListSerializer(serializers.ModelSerializer):
    """Serializer for task list view."""
    assignee = UserProfileSerializer(read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'project', 'assignee',
            'status', 'priority', 'milestone', 'milestone_title',
            'tags', 'deadline', 'completed_at', 'created_at', 'updated_at'
        ]


class TaskDetailSerializer(serializers.ModelSerializer):
    """Serializer for task detail view."""
    assignee = UserProfileSerializer(read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'project', 'assignee',
            'status', 'priority', 'milestone', 'milestone_title',
            'tags', 'deadline', 'completed_at', 'comments', 'attachments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'completed_at', 'created_at', 'updated_at']


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'assignee', 'status', 'priority',
            'milestone', 'tags', 'deadline'
        ]


class MilestoneSerializer(serializers.ModelSerializer):
    """Serializer for Milestone model."""
    tasks_count = serializers.SerializerMethodField()
    completed_tasks_count = serializers.SerializerMethodField()
    completion_percentage = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Milestone
        fields = [
            'id', 'project', 'title', 'description', 'due_date',
            'is_completed', 'completed_at', 'completion_percentage',
            'tasks_count', 'completed_tasks_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'completed_at', 'created_at', 'updated_at']
    
    def get_tasks_count(self, obj):
        return obj.tasks.count()
    
    def get_completed_tasks_count(self, obj):
        return obj.tasks.filter(status='done').count()
