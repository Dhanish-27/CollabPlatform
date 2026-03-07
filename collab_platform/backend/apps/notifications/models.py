from django.db import models
from django.conf import settings


class Notification(models.Model):
    """Notification model for user notifications."""
    NOTIFICATION_TYPES = [
        ('join_request', 'Join Request'),
        ('join_request_accepted', 'Join Request Accepted'),
        ('join_request_rejected', 'Join Request Rejected'),
        ('task_assigned', 'Task Assigned'),
        ('task_completed', 'Task Completed'),
        ('mention', 'Mention'),
        ('announcement', 'Announcement'),
        ('deadline_reminder', 'Deadline Reminder'),
        ('feedback', 'Feedback Received'),
        ('system', 'System Notification'),
    ]
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    is_emailed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.recipient.email}: {self.title}"


class NotificationSettings(models.Model):
    """User notification preferences."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_settings'
    )
    
    # Email settings
    email_join_requests = models.BooleanField(default=True)
    email_task_assigned = models.BooleanField(default=True)
    email_task_completed = models.BooleanField(default=True)
    email_mentions = models.BooleanField(default=True)
    email_announcements = models.BooleanField(default=True)
    email_deadline_reminders = models.BooleanField(default=True)
    email_feedback = models.BooleanField(default=True)
    email_system = models.BooleanField(default=False)
    
    # In-app settings
    push_join_requests = models.BooleanField(default=True)
    push_task_assigned = models.BooleanField(default=True)
    push_task_completed = models.BooleanField(default=True)
    push_mentions = models.BooleanField(default=True)
    push_announcements = models.BooleanField(default=True)
    push_deadline_reminders = models.BooleanField(default=True)
    
    class Meta:
        verbose_name_plural = 'Notification Settings'
    
    def __str__(self):
        return f"Notification settings for {self.user.email}"
