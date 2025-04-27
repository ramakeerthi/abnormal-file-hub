import axios from 'axios';
import { File as FileType, StorageStats, FileFilter, SizeRange, DateRange } from '../types/file';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Helper function to get file extension from content type
const getExtensionFromContentType = (contentType: string): string | null => {
  // Create a temporary link element to use the browser's built-in MIME type handling
  const link = document.createElement('a');
  link.href = `data:${contentType};base64,`;
  const extension = link.href.split(';')[0].split('/')[1];
  
  // If we got a valid extension, return it with a dot
  if (extension && extension !== '') {
    return `.${extension}`;
  }
  
  // If no extension found, try to extract from the content type
  const match = contentType.match(/\/([^;]+)/);
  if (match && match[1]) {
    return `.${match[1]}`;
  }
  
  return null;
};

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
  downloadFile: async (fileId: string, filename: string): Promise<void> => {
    try {
      const response = await axios.get(`${API_URL}/files/${fileId}/download/`, {
        responseType: 'blob',
      });
      
      // Get the content type from the response
      const contentType = response.headers['content-type'];
      
      // Create a blob with the correct type
      const blob = new Blob([response.data], { type: contentType });
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = url;
      
      // Ensure filename has an extension
      let downloadFilename = filename;
      if (!downloadFilename.includes('.')) {
        // Try to determine extension from content type
        const ext = getExtensionFromContentType(contentType);
        if (ext) {
          downloadFilename += ext;
        }
      }
      
      // Set the download attribute
      link.setAttribute('download', downloadFilename);
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
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