import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fileService } from '../services/fileService';
import { FileFilter, SizeRange, DateRange } from '../types/file';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface FileSearchProps {
  onFilterChange: (filters: FileFilter) => void;
  currentFilters: FileFilter;
  isLoading?: boolean;
}

const FileSearch: React.FC<FileSearchProps> = ({ onFilterChange, currentFilters, isLoading = false }) => {
  const [searchTerm, setSearchTerm] = useState(currentFilters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FileFilter>(currentFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<FileFilter>(currentFilters);
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Fetch file types, size ranges, and date ranges for filter options
  const { data: fileTypes } = useQuery({
    queryKey: ['fileTypes'],
    queryFn: fileService.getFileTypes,
  });
  
  const { data: sizeRanges } = useQuery({
    queryKey: ['sizeRanges'],
    queryFn: fileService.getSizeRanges,
  });
  
  const { data: dateRanges } = useQuery({
    queryKey: ['dateRanges'],
    queryFn: fileService.getDateRanges,
  });
  
  // Apply filters when they change with debouncing
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [filters]);
  
  // Notify parent component when debounced filters change
  useEffect(() => {
    onFilterChange(debouncedFilters);
  }, [debouncedFilters, onFilterChange]);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setFilters(prev => ({ ...prev, search: value }));
  }, []);
  
  // Handle file type filter change
  const handleFileTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters(prev => ({ ...prev, fileType: value || undefined }));
  }, []);
  
  // Handle size range filter change
  const handleSizeRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setFilters(prev => ({ ...prev, minSize: undefined, maxSize: undefined }));
      return;
    }
    
    const selectedRange = sizeRanges?.find(range => range.label === value);
    if (selectedRange) {
      setFilters(prev => ({ 
        ...prev, 
        minSize: selectedRange.min, 
        maxSize: selectedRange.max || undefined 
      }));
    }
  }, [sizeRanges]);
  
  // Handle date range filter change
  const handleDateRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }));
      setShowCustomDateRange(false);
      return;
    }
    
    if (value === 'custom') {
      setShowCustomDateRange(true);
      return;
    }
    
    setShowCustomDateRange(false);
    const selectedRange = dateRanges?.find(range => range.label === value);
    if (selectedRange) {
      // The dates from the backend are already in YYYY-MM-DD format
      setFilters(prev => ({ 
        ...prev, 
        startDate: selectedRange.start, 
        endDate: selectedRange.end
      }));
      
      // Force immediate update instead of waiting for debounce
      setDebouncedFilters(prev => ({ 
        ...prev, 
        startDate: selectedRange.start, 
        endDate: selectedRange.end
      }));
    }
  }, [dateRanges]);
  
  // Handle custom date range change
  const handleCustomDateChange = useCallback(() => {
    if (customStartDate && customEndDate) {
      // Ensure dates are in YYYY-MM-DD format
      const formatDate = (dateStr: string) => {
        // If the date is already in YYYY-MM-DD format, return it as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        
        // Otherwise, parse the date and format it
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      };
      
      setFilters(prev => ({
        ...prev,
        startDate: formatDate(customStartDate),
        endDate: formatDate(customEndDate)
      }));
      
      // Force immediate update instead of waiting for debounce
      setDebouncedFilters(prev => ({
        ...prev,
        startDate: formatDate(customStartDate),
        endDate: formatDate(customEndDate)
      }));
    }
  }, [customStartDate, customEndDate]);
  
  // Handle duplicate filter change
  const handleDuplicateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setFilters(prev => ({ ...prev, isDuplicate: undefined }));
    } else {
      setFilters(prev => ({ ...prev, isDuplicate: value === 'true' }));
    }
  }, []);
  
  // Handle sort order change
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters(prev => ({ ...prev, ordering: value || undefined }));
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    const emptyFilters: FileFilter = {};
    setFilters(emptyFilters);
    setSearchTerm('');
    setDebouncedFilters(emptyFilters);
    setShowCustomDateRange(false);
    setCustomStartDate('');
    setCustomEndDate('');
  }, []);
  
  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return (
      filters.fileType !== undefined ||
      filters.minSize !== undefined ||
      filters.maxSize !== undefined ||
      filters.startDate !== undefined ||
      filters.endDate !== undefined ||
      filters.isDuplicate !== undefined ||
      filters.ordering !== undefined
    );
  }, [filters]);
  
  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className={`block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${isLoading ? 'bg-gray-50' : ''}`}
            placeholder="Search files..."
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary-500 rounded-full border-t-transparent"></div>
            </div>
          )}
        </div>
        
        {/* Filter toggle button */}
        <button
          type="button"
          className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md ${
            showFilters ? 'bg-primary-100 text-primary-700 border-primary-300' : 'bg-white text-gray-700 hover:bg-gray-50'
          } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          disabled={isLoading}
        >
          <FunnelIcon className="h-5 w-5 mr-2" />
          Filters {hasActiveFilters() && <span className="ml-1 bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>}
        </button>
      </div>
      
      {/* Filter panel */}
      {showFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            {hasActiveFilters() && (
              <button
                type="button"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
                onClick={clearFilters}
                disabled={isLoading}
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear all
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* File type filter */}
            <div>
              <label htmlFor="fileType" className="block text-sm font-medium text-gray-700 mb-1">
                File Type
              </label>
              <select
                id="fileType"
                className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md ${isLoading ? 'bg-gray-50' : ''}`}
                value={filters.fileType || ''}
                onChange={handleFileTypeChange}
                disabled={isLoading}
              >
                <option value="">All Types</option>
                {fileTypes?.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Size range filter */}
            <div>
              <label htmlFor="sizeRange" className="block text-sm font-medium text-gray-700 mb-1">
                Size Range
              </label>
              <select
                id="sizeRange"
                className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md ${isLoading ? 'bg-gray-50' : ''}`}
                value={sizeRanges?.find(range => 
                  range.min === filters.minSize && 
                  (range.max === filters.maxSize || (range.max === null && filters.maxSize === undefined))
                )?.label || ''}
                onChange={handleSizeRangeChange}
                disabled={isLoading}
              >
                <option value="">All Sizes</option>
                {sizeRanges?.map((range) => (
                  <option key={range.label} value={range.label}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date range filter */}
            <div>
              <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
                Upload Date
              </label>
              <select
                id="dateRange"
                className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md ${isLoading ? 'bg-gray-50' : ''}`}
                value={showCustomDateRange ? 'custom' : dateRanges?.find(range => 
                  range.start === filters.startDate && 
                  range.end === filters.endDate
                )?.label || ''}
                onChange={handleDateRangeChange}
                disabled={isLoading}
              >
                <option value="">All Dates</option>
                {dateRanges?.map((range) => (
                  <option key={range.label} value={range.label}>
                    {range.label}
                  </option>
                ))}
                <option value="custom">Custom Range</option>
              </select>
              
              {/* Custom date range inputs */}
              {showCustomDateRange && (
                <div className="mt-2 flex flex-col space-y-2">
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <input
                      type="date"
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <input
                      type="date"
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={handleCustomDateChange}
                    disabled={isLoading || !customStartDate || !customEndDate}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            
            {/* Duplicate filter */}
            <div>
              <label htmlFor="duplicate" className="block text-sm font-medium text-gray-700 mb-1">
                File Status
              </label>
              <select
                id="duplicate"
                className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md ${isLoading ? 'bg-gray-50' : ''}`}
                value={filters.isDuplicate === undefined ? '' : filters.isDuplicate.toString()}
                onChange={handleDuplicateChange}
                disabled={isLoading}
              >
                <option value="">All Files</option>
                <option value="false">Unique Files</option>
                <option value="true">Duplicate Files</option>
              </select>
            </div>
            
            {/* Sort order */}
            <div>
              <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                id="sort"
                className={`block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md ${isLoading ? 'bg-gray-50' : ''}`}
                value={filters.ordering || ''}
                onChange={handleSortChange}
                disabled={isLoading}
              >
                <option value="">Default (Newest First)</option>
                <option value="uploaded_at">Oldest First</option>
                <option value="original_filename">Name (A-Z)</option>
                <option value="-original_filename">Name (Z-A)</option>
                <option value="size">Size (Smallest)</option>
                <option value="-size">Size (Largest)</option>
                <option value="file_type">Type (A-Z)</option>
                <option value="-file_type">Type (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileSearch; 