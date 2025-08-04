import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

// Local utility function for formatting bytes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

interface PdfUploaderProps {
  onFilesSelected: (files: File[]) => void
  multiple?: boolean
  maxFiles?: number
  maxSize?: number // in MB
  acceptedFormats?: string[]
  processing?: boolean
  className?: string
}

export default function PdfUploader({
  onFilesSelected,
  multiple = false,
  maxFiles = 10,
  maxSize = 200, // MB
  acceptedFormats = ['.pdf'],
  processing = false,
  className = '',
}: PdfUploaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setErrors([])
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const newErrors = rejectedFiles.map(rejection => {
        if (rejection.errors[0]?.code === 'file-too-large') {
          return `${rejection.file.name} is too large. Max size is ${maxSize}MB.`
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          return `${rejection.file.name} is not a supported format.`
        }
        return `${rejection.file.name} was rejected.`
      })
      setErrors(newErrors)
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const newFiles = multiple 
        ? [...files, ...acceptedFiles].slice(0, maxFiles)
        : acceptedFiles.slice(0, 1)
      
      setFiles(newFiles)
      onFilesSelected(newFiles)
    }
  }, [files, multiple, maxFiles, maxSize, onFilesSelected])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => {
      if (format === '.pdf') acc['application/pdf'] = ['.pdf']
      else if (format === '.doc' || format === '.docx') {
        acc['application/msword'] = ['.doc']
        acc['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = ['.docx']
      }
      else if (format === '.xls' || format === '.xlsx') {
        acc['application/vnd.ms-excel'] = ['.xls']
        acc['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] = ['.xlsx']
      }
      else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(format)) {
        acc['image/*'] = [format]
      }
      return acc
    }, {} as Record<string, string[]>),
    multiple,
    maxSize: maxSize * 1024 * 1024, // Convert MB to bytes
    disabled: processing,
  })

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFilesSelected(newFiles)
  }

  const clearAll = () => {
    setFiles([])
    setErrors([])
    onFilesSelected([])
  }

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-indigo-600 bg-indigo-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        <CloudArrowUpIcon 
          className={`mx-auto h-12 w-12 ${
            isDragActive ? 'text-indigo-600' : 'text-gray-400'
          }`}
        />
        
        <p className="mt-4 text-lg font-medium text-gray-900">
          {isDragActive
            ? 'Drop files here...'
            : `Drag & drop ${multiple ? 'files' : 'a file'} here`}
        </p>
        
        <p className="mt-2 text-sm text-gray-600">
          or <span className="text-indigo-600 hover:text-indigo-700">browse</span> to upload
        </p>
        
        <p className="mt-4 text-xs text-gray-500">
          {acceptedFormats.length > 1
            ? `Supported formats: ${acceptedFormats.join(', ')}`
            : `PDF files only`} • 
          {' • '}
          Max size: {maxSize}MB
          {multiple && ` • Max ${maxFiles} files`}
        </p>
      </div>

      {/* Error messages */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 space-y-2"
          >
            {errors.map((error, index) => (
              <div
                key={index}
                className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">
                Selected {files.length === 1 ? 'file' : `files (${files.length})`}
              </h3>
              {files.length > 1 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={processing}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center flex-1">
                    <DocumentIcon className="h-8 w-8 text-gray-400 mr-3" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center ml-4">
                    {processing ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <XMarkIcon className="h-5 w-5 text-gray-500" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}