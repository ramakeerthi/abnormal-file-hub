from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import File, StorageStats
from .serializers import FileSerializer
import os
import mimetypes
from django.db.models import Sum
from django.db import transaction
import tempfile
import hashlib

# Create your views here.

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['file_type']
    search_fields = ['original_filename']
    ordering_fields = ['uploaded_at', 'original_filename', 'size']
    ordering = ['-uploaded_at']

    def _update_storage_stats(self):
        """Update storage statistics"""
        stats, _ = StorageStats.objects.get_or_create(pk=1)
        
        # Calculate total storage used (only counting unique files)
        total_storage = File.objects.filter(is_duplicate=False).aggregate(
            total=Sum('size'))['total'] or 0
        
        # Calculate total storage that would have been used without deduplication
        # This is the sum of all file sizes (including duplicates)
        total_potential_storage = File.objects.aggregate(
            total=Sum('size'))['total'] or 0
        
        # Calculate storage saved (only from duplicates)
        # This is the difference between what would have been used and what is actually used
        storage_saved = total_potential_storage - total_storage
        
        # Update stats
        stats.total_storage_used = total_storage
        stats.total_storage_saved = storage_saved
        stats.total_files = File.objects.count()
        stats.total_unique_files = File.objects.filter(is_duplicate=False).count()
        stats.save()

    def _calculate_file_hash(self, file_obj):
        """Calculate hash of a file object without saving it"""
        sha256_hash = hashlib.sha256()
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            for chunk in file_obj.chunks():
                temp_file.write(chunk)
                sha256_hash.update(chunk)
            temp_file_path = temp_file.name
        
        try:
            os.unlink(temp_file_path)
        except:
            pass
            
        return sha256_hash.hexdigest()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Calculate file hash before saving
            file_hash = self._calculate_file_hash(file_obj)
            
            # Check for existing file with same hash
            existing_file = File.objects.filter(file_hash=file_hash).first()
            
            if existing_file:
                # This is a duplicate file
                file_instance = File(
                    original_filename=file_obj.name,
                    file_type=file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream',
                    size=file_obj.size,
                    file_hash=file_hash,
                    is_duplicate=True,
                    original_file=existing_file
                )
                file_instance.save()
                
                response_data = {
                    'message': 'Duplicate file detected',
                    'original_file_id': str(existing_file.id),
                    'is_duplicate': True
                }
            else:
                # This is a unique file
                file_instance = File(
                    file=file_obj,
                    original_filename=file_obj.name,
                    file_type=file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream',
                    size=file_obj.size,
                    file_hash=file_hash,
                    is_duplicate=False
                )
                file_instance.save()
                response_data = {'is_duplicate': False}
            
            # Update storage statistics
            self._update_storage_stats()
            
            # Add file data to response
            serializer = self.get_serializer(file_instance)
            response_data.update(serializer.data)
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error processing file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        self._update_storage_stats()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        file_obj = self.get_object()
        if file_obj.is_duplicate:
            file_obj = file_obj.original_file
            
        if not os.path.exists(file_obj.file.path):
            return Response(
                {'error': 'File not found on server'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        response = Response()
        response['Content-Disposition'] = f'attachment; filename="{file_obj.original_filename}"'
        response['X-Accel-Buffering'] = 'no'
        return response

    @action(detail=False, methods=['get'])
    def storage_stats(self, request):
        """Get storage statistics"""
        stats = StorageStats.objects.first()
        if not stats:
            stats = StorageStats.objects.create()
        
        return Response({
            'total_storage_used': stats.total_storage_used,
            'total_storage_saved': stats.total_storage_saved,
            'total_files': stats.total_files,
            'total_unique_files': stats.total_unique_files,
            'last_updated': stats.last_updated,
            'storage_saved_percentage': (stats.total_storage_saved / (stats.total_storage_used + stats.total_storage_saved) * 100) if (stats.total_storage_used + stats.total_storage_saved) > 0 else 0
        })

    def get_queryset(self):
        queryset = File.objects.all()
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(original_filename__icontains=search_query)
        return queryset
