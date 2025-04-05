import axios from 'axios';
import { File as FileType, StorageStats, FileFilter, SizeRange, DateRange } from '../types/file';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const fileService = {
  // Get all files with optional filtering
  getFiles: async (filters?: FileFilter): Promise<FileType[]> => {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.filename) params.append('filename', filters.filename);
      if (filters.fileType) params.append('file_type', filters.fileType);
      if (filters.minSize) params.append('min_size', filters.minSize.toString());
      if (filters.maxSize) params.append('max_size', filters.maxSize.toString());
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.isDuplicate !== undefined) params.append('is_duplicate', filters.isDuplicate.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.ordering) params.append('ordering', filters.ordering);
    }
    
    const response = await axios.get(`${API_URL}/files/`, { params });
    return response.data;
  },

  // Upload a file
  uploadFile: async (file: Blob): Promise<FileType> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_URL}/files/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete a file
  deleteFile: async (id: string): Promise<void> => {
    await axios.delete(`${API_URL}/files/${id}/`);
  },

  // Download a file
  downloadFile: async (fileUrl: string, filename: string): Promise<void> => {
    const response = await axios.get(`${API_URL}/files/${fileUrl}/download/`, {
      responseType: 'blob',
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // Get storage statistics
  getStorageStats: async (): Promise<StorageStats> => {
    const response = await axios.get(`${API_URL}/files/storage_stats/`);
    return response.data;
  },
  
  // Get unique file types for filtering
  getFileTypes: async (): Promise<string[]> => {
    const response = await axios.get(`${API_URL}/files/file_types/`);
    return response.data;
  },
  
  // Get size ranges for filtering
  getSizeRanges: async (): Promise<SizeRange[]> => {
    const response = await axios.get(`${API_URL}/files/size_ranges/`);
    return response.data;
  },
  
  // Get date ranges for filtering
  getDateRanges: async (): Promise<DateRange[]> => {
    const response = await axios.get(`${API_URL}/files/date_ranges/`);
    return response.data;
  }
};

export { fileService }; 