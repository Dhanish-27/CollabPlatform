from django.contrib import admin
from .models import UserFeedback, Report


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    list_display = ['from_user', 'to_user', 'project', 'teamwork_rating', 'reliability_rating', 'created_at']
    list_filter = ['teamwork_rating', 'reliability_rating']


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['reporter', 'report_type', 'status', 'created_at']
    list_filter = ['report_type', 'status']
    search_fields = ['reason']
    date_hierarchy = 'created_at'
