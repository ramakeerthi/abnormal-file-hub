from django.db import models
import uuid
import os
import hashlib

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)

class StorageStats(models.Model):
    total_storage_used = models.BigIntegerField(default=0)  # in bytes
    total_storage_saved = models.BigIntegerField(default=0)  # in bytes
    total_files = models.IntegerField(default=0)
    total_unique_files = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Storage Statistics"
        verbose_name_plural = "Storage Statistics"

    def __str__(self):
        return f"Storage Stats - Last Updated: {self.last_updated}"

class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to=file_upload_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_hash = models.CharField(max_length=64, null=True)  # SHA-256 hash
    is_duplicate = models.BooleanField(default=False)
    original_file = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='duplicates')
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.original_filename
    
    def delete(self, *args, **kwargs):
        """Override delete to remove the file from storage"""
        if self.file and not self.is_duplicate:  # Only delete if it's not a duplicate
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
        super().delete(*args, **kwargs)

    def calculate_hash(self):
        """Calculate SHA-256 hash of the file"""
        sha256_hash = hashlib.sha256()
        with open(self.file.path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
