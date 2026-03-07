from django.contrib import admin
from .models import Task, TaskComment, TaskAttachment, Milestone


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'assignee', 'status', 'priority', 'deadline', 'created_at']
    list_filter = ['status', 'priority']
    search_fields = ['title', 'description']
    date_hierarchy = 'created_at'


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ['task', 'author', 'created_at']
    search_fields = ['content']


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'task', 'uploaded_by', 'created_at']


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'due_date', 'is_completed', 'created_at']
    list_filter = ['is_completed']
    search_fields = ['title', 'project__title']
