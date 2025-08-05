import React, {
  useCallback,
  useState,
} from 'react';

import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

import ProgressIndicator, {
  ProgressStep,
} from '@/components/ProgressIndicator';
import { usePDFWorker } from '@/hooks/useWebWorker';
import {
  ArrowDownTrayIcon,
  ArrowsPointingInIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface CompressionOptions {
  quality: 'low' | 'medium' | 'high';
  removeImages: boolean;
  grayscale: boolean;
}

interface ProcessedFile {
  id: string;
  originalFile: File;
  compressedBlob?: Blob;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  downloadUrl?: string;
}

const PDFCompressor: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [options, setOptions] = useState<CompressionOptions>({
    quality: 'medium',
    removeImages: false,
    grayscale: false
  });
  const [processingSteps, setProcessingSteps] = useState<ProgressStep[]>([]);

  const pdfWorker = usePDFWorker();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: ProcessedFile[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalFile: file,
      originalSize: file.size,
      status: 'pending'
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`${acceptedFiles.length} file(s) added for compression`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: pdfWorker.isProcessing,
    maxSize: 100 * 1024 * 1024, // 100MB limit
  });

  const compressFile = async (file: ProcessedFile) => {
    setFiles(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'processing' } : f
    ));

    // Set up processing steps
    const steps: ProgressStep[] = [
      { id: 'load', name: 'Loading PDF', status: 'current', progress: 0 },
      { id: 'analyze', name: 'Analyzing document', status: 'pending' },
      { id: 'compress', name: 'Compressing content', status: 'pending' },
      { id: 'optimize', name: 'Optimizing structure', status: 'pending' },
      { id: 'finalize', name: 'Finalizing document', status: 'pending' }
    ];
    setProcessingSteps(steps);

    try {
      const result = await pdfWorker.compressPDF(file.originalFile, {
        quality: options.quality,
        removeImages: options.removeImages
      });

      if (result.success) {
        const compressedBlob = new Blob([result.data], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(compressedBlob);

        setFiles(prev => prev.map(f => 
          f.id === file.id ? {
            ...f,
            status: 'completed',
            compressedBlob,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            downloadUrl
          } : f
        ));

        toast.success(`PDF compressed successfully! ${result.compressionRatio}% size reduction`);
      } else {
        throw new Error(result.error || 'Compression failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compression failed';
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'error', error: errorMessage } : f
      ));

      toast.error(errorMessage);
    } finally {
      setProcessingSteps([]);
    }
  };

  const compressAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await compressFile(file);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.downloadUrl) {
        URL.revokeObjectURL(file.downloadUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const downloadFile = (file: ProcessedFile) => {
    if (!file.downloadUrl) return;
    
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = `compressed_${file.originalFile.name}`;
    link.click();
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalOriginalSize = files.reduce((sum, f) => sum + f.originalSize, 0);
  const totalCompressedSize = files.reduce((sum, f) => sum + (f.compressedSize || 0), 0);
  const overallCompressionRatio = totalOriginalSize > 0 
    ? Math.round((1 - totalCompressedSize / totalOriginalSize) * 100) 
    : 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center space-x-3">
            <ArrowsPointingInIcon className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">PDF Compressor</h1>
              <p className="text-blue-100">Reduce PDF file size with advanced compression</p>
            </div>
          </div>
        </div>

        {/* Compression Options */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Compression Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="qualityLevel" className="block text-sm font-medium text-gray-700 mb-2">
                Quality Level
              </label>
              <select
                id="qualityLevel"
                value={options.quality}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  quality: e.target.value as CompressionOptions['quality'] 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={pdfWorker.isProcessing}
              >
                <option value="low">Low (Highest compression)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Best quality)</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="removeImages"
                checked={options.removeImages}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  removeImages: e.target.checked 
                }))}
                className="mr-2"
                disabled={pdfWorker.isProcessing}
              />
              <label htmlFor="removeImages" className="text-sm text-gray-700">
                Remove images
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="grayscale"
                checked={options.grayscale}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  grayscale: e.target.checked 
                }))}
                className="mr-2"
                disabled={pdfWorker.isProcessing}
              />
              <label htmlFor="grayscale" className="text-sm text-gray-700">
                Convert to grayscale
              </label>
            </div>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            } ${pdfWorker.isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop PDF files here...</p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium mb-2">
                  Drag & drop PDF files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Maximum file size: 100MB per file
                </p>
              </div>
            )}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Files to Compress</h3>
                {files.some(f => f.status === 'pending') && (
                  <button
                    onClick={compressAllFiles}
                    disabled={pdfWorker.isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Compress All
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <DocumentIcon className="w-8 h-8 text-red-500" />
                      <div>
                        <p className="font-medium text-gray-900">{file.originalFile.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Original: {formatFileSize(file.originalSize)}</span>
                          {file.compressedSize && (
                            <>
                              <span>Compressed: {formatFileSize(file.compressedSize)}</span>
                              <span className="text-green-600 font-medium">
                                -{file.compressionRatio}%
                              </span>
                            </>
                          )}
                        </div>
                        {file.error && (
                          <p className="text-sm text-red-600 mt-1">{file.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {file.status === 'completed' && (
                        <>
                          <CheckCircleIcon className="w-5 h-5 text-green-600" />
                          <button
                            onClick={() => downloadFile(file)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download compressed file"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      
                      {file.status === 'pending' && (
                        <button
                          onClick={() => compressFile(file)}
                          disabled={pdfWorker.isProcessing}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Compress
                        </button>
                      )}

                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove file"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary */}
              {files.some(f => f.status === 'completed') && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Compression Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Original Size:</span>
                      <span className="ml-2 font-medium">{formatFileSize(totalOriginalSize)}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Compressed Size:</span>
                      <span className="ml-2 font-medium">{formatFileSize(totalCompressedSize)}</span>
                    </div>
                    <div>
                      <span className="text-green-700">Total Savings:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {formatFileSize(totalOriginalSize - totalCompressedSize)} ({overallCompressionRatio}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      <ProgressIndicator
        isVisible={pdfWorker.isProcessing}
        progress={pdfWorker.progress.progress}
        message={pdfWorker.progress.message}
        operation="Compress"
        steps={processingSteps}
        showDetails={true}
        onCancel={() => pdfWorker.cancelCurrentTask()}
        fileInfo={files.find(f => f.status === 'processing') ? {
          name: files.find(f => f.status === 'processing')!.originalFile.name,
          size: files.find(f => f.status === 'processing')!.originalSize,
          type: 'application/pdf'
        } : undefined}
      />
    </div>
  );
};

export default PDFCompressor;
