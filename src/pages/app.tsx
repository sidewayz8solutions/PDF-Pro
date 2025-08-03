import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'
import {
  ArrowsPointingInIcon,
  DocumentDuplicateIcon,
  ScissorsIcon,
  DocumentTextIcon,
  DocumentMagnifyingGlassIcon,
  LockClosedIcon,
  PhotoIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  DocumentIcon,
  SparklesIcon,
  UserCircleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'

type Tool = {
  id: string
  name: string
  description: string
  icon: any
  color: string
  bgColor: string
  endpoint: string
  credits: number
}

const tools: Tool[] = [
  {
    id: 'compress',
    name: 'Compress PDF',
    description: 'Reduce file size without losing quality',
    icon: ArrowsPointingInIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    endpoint: '/api/pdf/compress',
    credits: 1,
  },
  {
    id: 'merge',
    name: 'Merge PDFs',
    description: 'Combine multiple PDFs into one',
    icon: DocumentDuplicateIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    endpoint: '/api/pdf/merge',
    credits: 1,
  },
  {
    id: 'split',
    name: 'Split PDF',
    description: 'Extract pages or split into multiple files',
    icon: ScissorsIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    endpoint: '/api/pdf/split',
    credits: 1,
  },
  {
    id: 'convert',
    name: 'Convert to PDF',
    description: 'Convert Word, Excel, Images to PDF',
    icon: DocumentTextIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    endpoint: '/api/pdf/convert',
    credits: 2,
  },
  {
    id: 'extract',
    name: 'Extract Content',
    description: 'Extract text, images, and tables',
    icon: DocumentMagnifyingGlassIcon,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    endpoint: '/api/pdf/extract',
    credits: 2,
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    description: 'Add password and encryption',
    icon: LockClosedIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    endpoint: '/api/pdf/protect',
    credits: 1,
  },
]

type FileUpload = {
  file: File
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: any
  error?: string
}

export default function AppDashboard() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [files, setFiles] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [credits, setCredits] = useState(5) // Free tier credits
  const [showUpgrade, setShowUpgrade] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: selectedTool?.id === 'convert' 
      ? {
          'application/pdf': ['.pdf'],
          'application/msword': ['.doc', '.docx'],
          'application/vnd.ms-excel': ['.xls', '.xlsx'],
          'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
        }
      : { 'application/pdf': ['.pdf'] },
    disabled: isProcessing,
  })

  const processFiles = async () => {
    if (!selectedTool || files.length === 0) return

    // Check credits
    const requiredCredits = files.length * selectedTool.credits
    if (credits < requiredCredits) {
      setShowUpgrade(true)
      toast.error(`Not enough credits. You need ${requiredCredits} credits for this operation.`)
      return
    }

    setIsProcessing(true)

    for (const fileUpload of files) {
      if (fileUpload.status !== 'pending') continue

      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id ? { ...f, status: 'processing' } : f
      ))

      try {
        const formData = new FormData()
        formData.append('file', fileUpload.file)

        const response = await fetch(selectedTool.endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        const result = await response.json()

        if (response.ok) {
          setFiles(prev => prev.map(f => 
            f.id === fileUpload.id ? { ...f, status: 'completed', result } : f
          ))
          setCredits(prev => prev - selectedTool.credits)
          toast.success(`${selectedTool.name} completed!`)
        } else {
          throw new Error(result.error || 'Processing failed')
        }
      } catch (error: any) {
        setFiles(prev => prev.map(f => 
          f.id === fileUpload.id ? { ...f, status: 'error', error: error.message } : f
        ))
        toast.error(error.message)
      }
    }

    setIsProcessing(false)
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const downloadResult = (fileUpload: FileUpload) => {
    if (!fileUpload.result?.downloadUrl) return
    
    const link = document.createElement('a')
    link.href = fileUpload.result.downloadUrl
    link.download = fileUpload.result.filename || 'processed.pdf'
    link.click()
  }

  const resetTool = () => {
    setSelectedTool(null)
    setFiles([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-2" />
              <span className="text-xl font-bold">PDF Pro</span>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Credits Display */}
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">{credits} Credits</span>
              </div>
              
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Upgrade
              </button>
              
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <UserCircleIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedTool ? (
          // Tool Selection
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                What would you like to do?
              </h1>
              <p className="text-gray-600">Choose a tool to get started</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {tools.map((tool) => (
                <motion.button
                  key={tool.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTool(tool)}
                  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${tool.bgColor} mb-4`}>
                    <tool.icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <SparklesIcon className="h-4 w-4 mr-1" />
                    {tool.credits} credit{tool.credits > 1 ? 's' : ''}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          // Tool Interface
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6">
              <button
                onClick={resetTool}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Back to tools
              </button>
              
              <div className="flex items-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${selectedTool.bgColor} mr-4`}>
                  <selectedTool.icon className={`h-6 w-6 ${selectedTool.color}`} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedTool.name}</h1>
                  <p className="text-gray-600">{selectedTool.description}</p>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`bg-white rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or <span className="text-indigo-600">browse</span> to choose files
              </p>
              <p className="text-xs text-gray-400">
                {selectedTool.id === 'convert' 
                  ? 'Supports PDF, Word, Excel, and Images'
                  : 'PDF files only'}
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 bg-white rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Files ({files.length})
                </h3>
                <div className="space-y-3">
                  {files.map((fileUpload) => (
                    <div
                      key={fileUpload.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center flex-1">
                        <DocumentIcon className="h-8 w-8 text-gray-400 mr-3" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {fileUpload.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {fileUpload.status === 'processing' && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        )}
                        {fileUpload.status === 'completed' && (
                          <>
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            <button
                              onClick={() => downloadResult(fileUpload)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <ArrowDownTrayIcon className="h-5 w-5 text-gray-600" />
                            </button>
                          </>
                        )}
                        {fileUpload.status === 'error' && (
                          <span className="text-xs text-red-600">{fileUpload.error}</span>
                        )}
                        {fileUpload.status === 'pending' && (
                          <button
                            onClick={() => removeFile(fileUpload.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <XMarkIcon className="h-5 w-5 text-gray-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Total credits required: {files.length * selectedTool.credits}
                  </div>
                  <button
                    onClick={processFiles}
                    disabled={isProcessing || files.every(f => f.status !== 'pending')}
                    className={`px-6 py-2 rounded-lg font-medium transition ${
                      isProcessing || files.every(f => f.status !== 'pending')
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isProcessing ? 'Processing...' : `Process ${files.length} file${files.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowUpgrade(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
                  <p className="text-gray-600 mt-1">Get more credits and unlock all features</p>
                </div>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-indigo-900">Starter Plan</h3>
                    <span className="text-2xl font-bold text-indigo-900">$9/mo</span>
                  </div>
                  <ul className="text-sm text-indigo-700 space-y-1">
                    <li>• 100 PDF operations per month</li>
                    <li>• Files up to 50MB</li>
                    <li>• Priority processing</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-900">Professional Plan</h3>
                    <span className="text-2xl font-bold text-gray-900">$29/mo</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 500 PDF operations per month</li>
                    <li>• Files up to 200MB</li>
                    <li>• API access included</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => window.location.href = '/pricing'}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  View All Plans
                </button>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}