from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter, NumberFilter, DateFilter
from .models import File, StorageStats
from .serializers import FileSerializer
import os
import mimetypes
from django.db.models import Sum, Q
from django.db import transaction
import tempfile
import hashlib
from datetime import datetime, timedelta
from django.utils import timezone
import logging

logger = logging.getLogger('files')  # Get logger specific to files app

# Create your views here.

class FileFilter(FilterSet):
    """Custom filter for File model"""
    filename = CharFilter(field_name='original_filename', lookup_expr='icontains')
    min_size = NumberFilter(field_name='size', lookup_expr='gte')
    max_size = NumberFilter(field_name='size', lookup_expr='lte')
    start_date = DateFilter(method='filter_start_date')
    end_date = DateFilter(method='filter_end_date')
    file_type = CharFilter(field_name='file_type', lookup_expr='icontains')
    is_duplicate = CharFilter(method='filter_is_duplicate')
    
    def filter_is_duplicate(self, queryset, name, value):
        if value.lower() == 'true':
            return queryset.filter(is_duplicate=True)
        elif value.lower() == 'false':
            return queryset.filter(is_duplicate=False)
        return queryset
    
    def filter_start_date(self, queryset, name, value):        
        try:
            # Convert to datetime and make timezone-aware
            start_datetime = timezone.make_aware(
                datetime.combine(value, datetime.min.time())
            )
            logger.debug(f"Timezone-aware start_datetime: {start_datetime}")
            
            # Filter files uploaded on or after this date
            filtered = queryset.filter(uploaded_at__gte=start_datetime)
            logger.debug(f"SQL Query: {filtered.query}")
            logger.debug(f"Final filtered count: {filtered.count()}")
            
            # Log sample of matching records
            sample = filtered[:5]
            logger.debug("Sample matching records:")
            for record in sample:
                logger.debug(f"- {record.original_filename}: {record.uploaded_at}")
            
            return filtered
        except Exception as e:
            logger.error(f"Error in filter_start_date: {str(e)}")
            return queryset
    
    def filter_end_date(self, queryset, name, value):        
        try:
            # Convert to datetime and make timezone-aware
            end_datetime = timezone.make_aware(
                datetime.combine(value, datetime.max.time())
            )
            logger.debug(f"Timezone-aware end_datetime: {end_datetime}")
            
            # Filter files uploaded on or before this date
            filtered = queryset.filter(uploaded_at__lte=end_datetime)
            logger.debug(f"SQL Query: {filtered.query}")
            logger.debug(f"Final filtered count: {filtered.count()}")
            
            # Log sample of matching records
            sample = filtered[:5]
            logger.debug("Sample matching records:")
            for record in sample:
                logger.debug(f"- {record.original_filename}: {record.uploaded_at}")
            
            return filtered
        except Exception as e:
            logger.error(f"Error in filter_end_date: {str(e)}")
            return queryset
    
    class Meta:
        model = File
        fields = ['filename', 'file_type', 'min_size', 'max_size', 'start_date', 'end_date', 'is_duplicate']

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FileFilter
    search_fields = ['original_filename']
    ordering_fields = ['uploaded_at', 'original_filename', 'size', 'file_type']
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
    
    @action(detail=False, methods=['get'])
    def file_types(self, request):
        """Get list of unique file types"""
        # Use distinct() to ensure we get unique file types
        file_types = File.objects.values_list('file_type', flat=True).distinct().order_by('file_type')
        # Convert to list and remove any duplicates that might still exist
        file_types_list = list(file_types)
        unique_file_types = list(dict.fromkeys(file_types_list))
        return Response(unique_file_types)
    
    @action(detail=False, methods=['get'])
    def size_ranges(self, request):
        """Get file size ranges for filtering"""
        ranges = [
            {'label': '0-1MB', 'min': 0, 'max': 1024 * 1024},
            {'label': '1-5MB', 'min': 1024 * 1024, 'max': 5 * 1024 * 1024},
            {'label': '5-10MB', 'min': 5 * 1024 * 1024, 'max': 10 * 1024 * 1024},
            {'label': '10-50MB', 'min': 10 * 1024 * 1024, 'max': 50 * 1024 * 1024},
            {'label': '50MB+', 'min': 50 * 1024 * 1024, 'max': None}
        ]
        return Response(ranges)
    
    @action(detail=False, methods=['get'])
    def date_ranges(self, request):
        """Get date ranges for filtering"""
        today = datetime.now().date()
        ranges = [
            {'label': 'Today', 'start': today.isoformat(), 'end': today.isoformat()},
            {'label': 'Last 7 days', 'start': (today - timedelta(days=7)).isoformat(), 'end': today.isoformat()},
            {'label': 'Last 30 days', 'start': (today - timedelta(days=30)).isoformat(), 'end': today.isoformat()},
            {'label': 'Last 90 days', 'start': (today - timedelta(days=90)).isoformat(), 'end': today.isoformat()},
            {'label': 'This year', 'start': today.replace(month=1, day=1).isoformat(), 'end': today.isoformat()}
        ]
        return Response(ranges)

    def get_queryset(self):
        queryset = File.objects.all()
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(original_filename__icontains=search_query)
        return queryset
