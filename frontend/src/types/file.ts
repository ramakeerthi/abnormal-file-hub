export interface File {
  id: string;
  original_filename: string;
  file_type: string;
  size: number;
  uploaded_at: string;
  file: string;
  is_duplicate: boolean;
  original_file?: string;
  file_hash: string;
}

export interface StorageStats {
  total_storage_used: number;
  total_storage_saved: number;
  total_files: number;
  total_unique_files: number;
  last_updated: string;
  storage_saved_percentage: number;
}

export interface FileFilter {
  filename?: string;
  fileType?: string;
  minSize?: number;
  maxSize?: number;
  startDate?: string;
  endDate?: string;
  isDuplicate?: boolean;
  search?: string;
  ordering?: string;
}

export interface SizeRange {
  label: string;
  min: number;
  max: number | null;
}

export interface DateRange {
  label: string;
  start: string;
  end: string;
} 