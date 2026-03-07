from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserSkill, UserActivity


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'username', 'role', 'experience_level', 'is_verified_mentor', 'is_staff', 'is_active']
    list_filter = ['role', 'experience_level', 'is_verified_mentor', 'is_staff', 'is_active']
    search_fields = ['email', 'username', 'bio']
    ordering = ['-created_at']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile Info', {
            'fields': ('role', 'avatar', 'bio', 'skills', 'experience_level',
                      'github_link', 'portfolio_link', 'linkedin_link',
                      'availability_hours', 'is_available_for_mentoring',
                      'is_public_profile', 'is_verified_mentor', 'profile_completion')
        }),
        ('Activity', {
            'fields': ('tasks_completed', 'total_contributions',
                      'teamwork_rating', 'reliability_rating', 'feedback_count',
                      'last_activity')
        }),
    )


@admin.register(UserSkill)
class UserSkillAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'proficiency', 'created_at']
    list_filter = ['proficiency']
    search_fields = ['user__email', 'name']


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'project', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['user__email', 'description']
    date_hierarchy = 'created_at'
