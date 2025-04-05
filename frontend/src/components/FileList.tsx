import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../services/fileService';
import { File as FileType, FileFilter } from '../types/file';
import { DocumentIcon, TrashIcon, ArrowDownTrayIcon, ChartBarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import FileSearch from './FileSearch';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileList: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FileFilter>({});

  // Query for fetching files with filters
  const { data: files, isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['files', filters],
    queryFn: () => fileService.getFiles(filters),
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Query for fetching storage stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['storageStats'],
    queryFn: fileService.getStorageStats,
    staleTime: 60000, // Consider data fresh for 1 minute
  });

  // Mutation for deleting files
  const deleteMutation = useMutation({
    mutationFn: fileService.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['storageStats'] });
    },
  });

  // Mutation for downloading files
  const downloadMutation = useMutation({
    mutationFn: ({ fileUrl, filename }: { fileUrl: string; filename: string }) =>
      fileService.downloadFile(fileUrl, filename),
  });

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [deleteMutation]);

  const handleDownload = useCallback(async (fileUrl: string, filename: string) => {
    try {
      await downloadMutation.mutateAsync({ fileUrl, filename });
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [downloadMutation]);

  const handleFilterChange = useCallback((newFilters: FileFilter) => {
    setFilters(newFilters);
  }, []);

  // Memoize the loading state to prevent unnecessary re-renders
  const isLoading = useMemo(() => filesLoading || statsLoading, [filesLoading, statsLoading]);

  // Memoize the file list to prevent unnecessary re-renders
  const fileListContent = useMemo(() => {
    if (filesLoading) {
      return (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <div className="h-10 w-10 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }

    if (filesError) {
      return (
        <div className="p-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">Failed to load files. Please try again.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!files || files.length === 0) {
      return (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
          <p className="mt-1 text-sm text-gray-500">
            {Object.keys(filters).length > 0 
              ? "No files match your current filters. Try adjusting your search criteria."
              : "Get started by uploading a file"}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-6 flow-root">
        <ul className="-my-5 divide-y divide-gray-200">
          {files.map((file: FileType) => (
            <li key={file.id} className="py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <DocumentIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.original_filename}
                  </p>
                  <p className="text-sm text-gray-500">
                    {file.file_type} • {formatBytes(file.size)}
                    {file.is_duplicate && (
                      <span className="ml-2 text-xs text-gray-400">(Duplicate)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    Uploaded {new Date(file.uploaded_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDownload(file.file, file.original_filename)}
                    disabled={downloadMutation.isPending}
                    className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }, [files, filesLoading, filesError, filters, handleDelete, handleDownload, deleteMutation.isPending, downloadMutation.isPending]);

  // Memoize the storage stats content to prevent unnecessary re-renders
  const storageStatsContent = useMemo(() => {
    if (!stats) return null;

    return (
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <ChartBarIcon className="h-6 w-6 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Storage Statistics</h3>
          <div className="ml-auto">
            <div className="group relative">
              <InformationCircleIcon className="h-5 w-5 text-gray-400 cursor-help" />
              <div className="absolute right-0 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <p>Storage savings are calculated by comparing the total size of all files (including duplicates) with the actual storage used (only unique files).</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Storage Used</p>
            <p className="text-lg font-semibold text-gray-900">{formatBytes(stats.total_storage_used)}</p>
            <p className="text-xs text-gray-500">Unique files only</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Storage Saved</p>
            <p className="text-lg font-semibold text-green-600">{formatBytes(stats.total_storage_saved)}</p>
            <p className="text-xs text-gray-500">From duplicate files</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Files</p>
            <p className="text-lg font-semibold text-gray-900">{stats.total_files}</p>
            <p className="text-xs text-gray-500">Including duplicates</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Unique Files</p>
            <p className="text-lg font-semibold text-gray-900">{stats.total_unique_files}</p>
            <p className="text-xs text-gray-500">Physical copies</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-500">Storage Efficiency</span>
            <span className="text-sm font-medium text-gray-900">{stats.storage_saved_percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${stats.storage_saved_percentage}%` }}
            ></div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Last updated: {new Date(stats.last_updated).toLocaleString()}
        </p>
      </div>
    );
  }, [stats]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Uploaded Files</h2>
      
      {/* Search and Filter Component */}
      <FileSearch 
        onFilterChange={handleFilterChange}
        currentFilters={filters}
        isLoading={isLoading}
      />
      
      {fileListContent}
      
      {storageStatsContent}
    </div>
  );
}; 