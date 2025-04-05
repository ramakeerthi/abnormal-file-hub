import os
import tempfile
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import File, StorageStats
from .views import FileFilter
from django.db.models import QuerySet
from datetime import datetime, timedelta
import logging

# Disable logging during tests
logging.disable(logging.CRITICAL)

class FileModelTests(TestCase):
    """Test the File model functionality"""
    
    def setUp(self):
        # Create a temporary file for testing
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.write(b"Test file content")
        self.temp_file.close()
        
        # Create a SimpleUploadedFile for testing
        self.uploaded_file = SimpleUploadedFile(
            "test_file.txt", 
            b"Test file content", 
            content_type="text/plain"
        )
        
        # Create a test file in the database
        self.file = File.objects.create(
            file=self.uploaded_file,
            original_filename="test_file.txt",
            file_type="text/plain",
            size=len(b"Test file content"),
            file_hash="test_hash",
            is_duplicate=False
        )
    
    def tearDown(self):
        # Clean up temporary files
        if hasattr(self, 'temp_file'):
            os.unlink(self.temp_file.name)
        if hasattr(self, 'file') and self.file.file:
            if os.path.exists(self.file.file.path):
                os.remove(self.file.file.path)
    
    def test_file_creation(self):
        """Test that a file can be created with the correct attributes"""
        self.assertEqual(self.file.original_filename, "test_file.txt")
        self.assertEqual(self.file.file_type, "text/plain")
        self.assertEqual(self.file.size, len(b"Test file content"))
        self.assertEqual(self.file.file_hash, "test_hash")
        self.assertFalse(self.file.is_duplicate)
        self.assertIsNotNone(self.file.uploaded_at)
    
    def test_file_str_representation(self):
        """Test the string representation of a File object"""
        self.assertEqual(str(self.file), "test_file.txt")
    
    def test_file_deletion(self):
        """Test that a file is properly deleted"""
        file_id = self.file.id
        self.file.delete()
        self.assertEqual(File.objects.filter(id=file_id).count(), 0)


class FileViewSetTests(APITestCase):
    """Test the FileViewSet API endpoints"""
    
    def setUp(self):
        # Create a test client
        self.client = APIClient()
        
        # Create test files
        self.create_test_files()
        
        # Create storage stats
        self.storage_stats = StorageStats.objects.create(
            total_storage_used=1000,
            total_storage_saved=500,
            total_files=2,
            total_unique_files=1
        )
    
    def create_test_files(self):
        """Create test files for testing"""
        # Create a unique file
        self.unique_file = SimpleUploadedFile(
            "unique_file.txt", 
            b"Unique file content", 
            content_type="text/plain"
        )
        self.file1 = File.objects.create(
            file=self.unique_file,
            original_filename="unique_file.txt",
            file_type="text/plain",
            size=len(b"Unique file content"),
            file_hash="unique_hash",
            is_duplicate=False
        )
        
        # Create a duplicate file
        self.duplicate_file = SimpleUploadedFile(
            "duplicate_file.txt", 
            b"Unique file content", 
            content_type="text/plain"
        )
        self.file2 = File.objects.create(
            file=self.duplicate_file,
            original_filename="duplicate_file.txt",
            file_type="text/plain",
            size=len(b"Unique file content"),
            file_hash="unique_hash",
            is_duplicate=True,
            original_file=self.file1
        )
    
    def tearDown(self):
        # Clean up files
        if hasattr(self, 'file1') and self.file1.file:
            if os.path.exists(self.file1.file.path):
                os.remove(self.file1.file.path)
        if hasattr(self, 'file2') and self.file2.file:
            if os.path.exists(self.file2.file.path):
                os.remove(self.file2.file.path)
    
    def test_list_files(self):
        """Test listing all files"""
        response = self.client.get('/api/files/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
    
    def test_retrieve_file(self):
        """Test retrieving a specific file"""
        response = self.client.get(f'/api/files/{self.file1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['original_filename'], "unique_file.txt")
    
    def test_delete_file(self):
        """Test deleting a file"""
        response = self.client.delete(f'/api/files/{self.file1.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(File.objects.filter(id=self.file1.id).count(), 0)
    
    def test_storage_stats(self):
        """Test retrieving storage stats"""
        response = self.client.get('/api/files/storage_stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_storage_used'], 1000)
        self.assertEqual(response.data['total_storage_saved'], 500)
        self.assertEqual(response.data['total_files'], 2)
        self.assertEqual(response.data['total_unique_files'], 1)
    
    def test_file_types(self):
        """Test retrieving file types"""
        response = self.client.get('/api/files/file_types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0], "text/plain")
    
    def test_size_ranges(self):
        """Test retrieving size ranges"""
        response = self.client.get('/api/files/size_ranges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)
    
    def test_date_ranges(self):
        """Test retrieving date ranges"""
        response = self.client.get('/api/files/date_ranges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) > 0)


class FileFilterTests(TestCase):
    """Test the FileFilter functionality"""
    
    def setUp(self):
        # Create test files with different attributes
        self.create_test_files()
    
    def create_test_files(self):
        """Create test files with different attributes for filtering"""
        # Create files with different dates
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        last_week = today - timedelta(days=7)
        
        # Create files with different names
        self.file1 = File.objects.create(
            original_filename="test_file1.txt",
            file_type="text/plain",
            size=1000,
            file_hash="hash1",
            is_duplicate=False,
            uploaded_at=timezone.make_aware(datetime.combine(today, datetime.min.time()))
        )
        
        self.file2 = File.objects.create(
            original_filename="test_file2.pdf",
            file_type="application/pdf",
            size=2000,
            file_hash="hash2",
            is_duplicate=False,
            uploaded_at=timezone.make_aware(datetime.combine(yesterday, datetime.min.time()))
        )
        
        self.file3 = File.objects.create(
            original_filename="test_file3.jpg",
            file_type="image/jpeg",
            size=3000,
            file_hash="hash3",
            is_duplicate=True,
            original_file=self.file1,
            uploaded_at=timezone.make_aware(datetime.combine(last_week, datetime.min.time()))
        )
    
    def test_filename_filter(self):
        """Test filtering by filename"""
        filter_set = FileFilter(data={'filename': 'file1'}, queryset=File.objects.all())
        filtered_qs = filter_set.qs
        self.assertEqual(filtered_qs.count(), 1)
        self.assertEqual(filtered_qs[0].id, self.file1.id)
    
    def test_file_type_filter(self):
        """Test filtering by file type"""
        filter_set = FileFilter(data={'file_type': 'pdf'}, queryset=File.objects.all())
        filtered_qs = filter_set.qs
        self.assertEqual(filtered_qs.count(), 1)
        self.assertEqual(filtered_qs[0].id, self.file2.id)
    
    def test_size_filter(self):
        """Test filtering by file size"""
        filter_set = FileFilter(data={'min_size': 1500, 'max_size': 2500}, queryset=File.objects.all())
        filtered_qs = filter_set.qs
        self.assertEqual(filtered_qs.count(), 1)
        self.assertEqual(filtered_qs[0].id, self.file2.id)
    
    def test_duplicate_filter(self):
        """Test filtering by duplicate status"""
        filter_set = FileFilter(data={'is_duplicate': 'true'}, queryset=File.objects.all())
        filtered_qs = filter_set.qs
        self.assertEqual(filtered_qs.count(), 1)
        self.assertEqual(filtered_qs[0].id, self.file3.id)
        
        filter_set = FileFilter(data={'is_duplicate': 'false'}, queryset=File.objects.all())
        filtered_qs = filter_set.qs
        self.assertEqual(filtered_qs.count(), 2) 