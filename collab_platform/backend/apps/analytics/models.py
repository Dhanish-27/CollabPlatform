from django.db import models


class UserFeedback(models.Model):
    """Peer feedback for users."""
    from_user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='given_feedback'
    )
    to_user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='received_feedback'
    )
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='feedbacks'
    )
    teamwork_rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    reliability_rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    comment = models.TextField(blank=True)
    is_private = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['from_user', 'to_user', 'project']
    
    def __str__(self):
        return f"Feedback from {self.from_user.email} to {self.to_user.email}"


class Report(models.Model):
    """Reports for users and projects."""
    REPORT_TYPES = [
        ('user', 'User Report'),
        ('project', 'Project Report'),
    ]
    
    reporter = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='reports_made'
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('reviewed', 'Reviewed'),
            ('resolved', 'Resolved'),
            ('dismissed', 'Dismissed')
        ],
        default='pending'
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Report by {self.reporter.email} - {self.report_type}"