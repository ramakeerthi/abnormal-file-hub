export interface File {
  id: string;
  original_filename: string;
  file_type: string;
  size: number;
  uploaded_at: string;
  file: string;
  is_duplicate?: boolean;
  original_file?: string;
}

export interface StorageStats {
  total_storage_used: number;
  total_storage_saved: number;
  total_files: number;
  total_unique_files: number;
  last_updated: string;
  storage_saved_percentage: number;
} 