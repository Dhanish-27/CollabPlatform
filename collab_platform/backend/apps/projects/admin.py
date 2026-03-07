from django.contrib import admin
from .models import (
    Project, ProjectMember, JoinRequest,
    ProjectInvitation, ProjectBookmark
)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'category', 'difficulty', 'status', 'visibility', 'is_featured', 'created_at']
    list_filter = ['category', 'difficulty', 'status', 'visibility', 'is_featured', 'health_status']
    search_fields = ['title', 'description', 'owner__email']
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at', 'last_activity']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ['user', 'project', 'role', 'status', 'joined_at']
    list_filter = ['role', 'status']
    search_fields = ['user__email', 'project__title']


@admin.register(JoinRequest)
class JoinRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'project', 'role_preference', 'status', 'created_at']
    list_filter = ['status', 'role_preference']
    search_fields = ['user__email', 'project__title']
    date_hierarchy = 'created_at'


@admin.register(ProjectInvitation)
class ProjectInvitationAdmin(admin.ModelAdmin):
    list_display = ['project', 'email', 'role', 'invited_by', 'is_used', 'created_at']
    list_filter = ['is_used', 'role']
    search_fields = ['project__title', 'email']
    date_hierarchy = 'created_at'


@admin.register(ProjectBookmark)
class ProjectBookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'project', 'created_at']
    search_fields = ['user__email', 'project__title']
    date_hierarchy = 'created_at'
