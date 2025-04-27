import React, { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';

// Create a client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable automatic refetching on window focus
      retry: 1, // Limit retries to 1
      staleTime: 60000, // Consider data fresh for 1 minute by default
    },
  },
});

function App() {
  // Use a simple counter for forcing re-renders when needed
  const [refreshKey, setRefreshKey] = useState(0);

  // Memoize the handler to prevent unnecessary re-renders
  const handleUploadSuccess = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Abnormal File Hub</h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="mb-8">
                <FileUpload onUploadSuccess={handleUploadSuccess} />
              </div>
              <FileList key={refreshKey} />
            </div>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
