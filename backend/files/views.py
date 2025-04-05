from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import File
from .serializers import FileSerializer
import os
import mimetypes

# Create your views here.

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['file_type']
    search_fields = ['original_filename']
    ordering_fields = ['uploaded_at', 'original_filename', 'size']
    ordering = ['-uploaded_at']

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Create a new file instance directly
            file_instance = File(
                file=file_obj,
                original_filename=file_obj.name,
                file_type=file_obj.content_type or mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream',
                size=file_obj.size
            )
            file_instance.save()
            
            # Serialize the created instance
            serializer = self.get_serializer(file_instance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error processing file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        file_obj = self.get_object()
        if not os.path.exists(file_obj.file.path):
            return Response(
                {'error': 'File not found on server'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        response = Response()
        response['Content-Disposition'] = f'attachment; filename="{file_obj.original_filename}"'
        response['X-Accel-Buffering'] = 'no'
        return response

    def get_queryset(self):
        queryset = File.objects.all()
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(original_filename__icontains=search_query)
        return queryset
