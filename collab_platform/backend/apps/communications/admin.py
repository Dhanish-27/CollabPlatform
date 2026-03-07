from django.contrib import admin
from .models import ChatMessage, Thread, ThreadReply, Announcement


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['project', 'author', 'content', 'is_pinned', 'created_at']
    list_filter = ['is_pinned', 'created_at']
    search_fields = ['content']


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'author', 'is_pinned', 'is_locked', 'created_at']
    list_filter = ['is_pinned', 'is_locked']


@admin.register(ThreadReply)
class ThreadReplyAdmin(admin.ModelAdmin):
    list_display = ['thread', 'author', 'created_at']


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'author', 'is_pinned', 'created_at']
    list_filter = ['is_pinned', 'created_at']
