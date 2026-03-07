from rest_framework import serializers
from .models import Notification, NotificationSettings


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'title', 'message', 'notification_type',
            'link', 'is_read', 'is_emailed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = [
            'email_join_requests', 'email_task_assigned', 'email_task_completed',
            'email_mentions', 'email_announcements', 'email_deadline_reminders',
            'email_feedback', 'email_system', 'push_join_requests',
            'push_task_assigned', 'push_task_completed', 'push_mentions',
            'push_announcements', 'push_deadline_reminders'
        ]