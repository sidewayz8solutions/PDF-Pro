import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

interface ProcessingOptions {
  quality?: 'low' | 'medium' | 'high'
  dpi?: number
  grayscale?: boolean
  removeImages?: boolean
  imageQuality?: number
}

interface WatermarkOptions {
  text?: string
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity?: number
  fontSize?: number
  color?: string
  rotation?: number
  pages?: 'all' | 'first' | 'last' | number[]
}

interface ExtractionOptions {
  extractText?: boolean
  extractImages?: boolean
  extractMetadata?: boolean
  extractForms?: boolean
  pages?: 'all' | number[]
  imageFormat?: 'png' | 'jpg'
  imageQuality?: number
}

interface ProtectionOptions {
  userPassword?: string
  ownerPassword?: string
  permissions?: {
    printing?: 'none' | 'lowQuality' | 'highQuality'
    modifying?: boolean
    copying?: boolean
    annotating?: boolean
    fillingForms?: boolean
    contentAccessibility?: boolean
    documentAssembly?: boolean
  }
  encryptionLevel?: 'standard' | 'high'
}

interface SignatureOptions {
  fieldName?: string
  page?: number
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  reason?: string
  location?: string
  contactInfo?: string
  signatureText?: string
  signatureImage?: string
  certificateInfo?: {
    name: string
    organization?: string
    email?: string
    country?: string
  }
}

interface ProcessingResult {
  success: boolean
  downloadUrl?: string
  originalSize?: number
  processedSize?: number
  processingTime?: number
  remainingCredits?: number
  error?: string
  metadata?: any
}

interface ProcessingState {
  isProcessing: boolean
  progress: number
  currentOperation: string | null
  error: string | null
}

export function usePdfTools() {
  const { user, hasCredits, canAccessFeature, refreshSession } = useAuth()
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    currentOperation: null,
    error: null,
  })

  // Generic processing function
  const processFile = useCallback(async (
    endpoint: string,
    file: File,
    options: any = {},
    requiredCredits: number = 1
  ): Promise<ProcessingResult> => {
    try {
      // Check credits
      if (!hasCredits(requiredCredits)) {
        throw new Error(`Insufficient credits. ${requiredCredits} credits required.`)
      }

      setProcessingState({
        isProcessing: true,
        progress: 0,
        currentOperation: endpoint.replace('/api/pdf/', ''),
        error: null,
      })

      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      
      // Add options to form data
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
        }
      })

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProcessingState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }))
      }, 500)

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Processing failed')
      }

      setProcessingState({
        isProcessing: false,
        progress: 100,
        currentOperation: null,
        error: null,
      })

      // Refresh session to update credits
      await refreshSession()

      toast.success('File processed successfully!')
      return { success: true, ...result }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed'
      
      setProcessingState({
        isProcessing: false,
        progress: 0,
        currentOperation: null,
        error: errorMessage,
      })

      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [hasCredits, refreshSession])

  // Compress PDF
  const compressPdf = useCallback(async (
    file: File,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> => {
    return processFile('/api/pdf/compress', file, options, 1)
  }, [processFile])

  // Add watermark
  const addWatermark = useCallback(async (
    file: File,
    options: WatermarkOptions = {}
  ): Promise<ProcessingResult> => {
    if (!canAccessFeature('watermark')) {
      return {
        success: false,
        error: 'Watermark feature not available in your plan',
      }
    }

    return processFile('/api/pdf/watermark', file, options, 1)
  }, [processFile, canAccessFeature])

  // Extract content
  const extractContent = useCallback(async (
    file: File,
    options: ExtractionOptions = {}
  ): Promise<ProcessingResult> => {
    if (!canAccessFeature('extract')) {
      return {
        success: false,
        error: 'Content extraction requires STARTER plan or higher',
      }
    }

    return processFile('/api/pdf/extract', file, options, 2)
  }, [processFile, canAccessFeature])

  // Protect PDF
  const protectPdf = useCallback(async (
    file: File,
    options: ProtectionOptions = {}
  ): Promise<ProcessingResult> => {
    if (!canAccessFeature('protect')) {
      return {
        success: false,
        error: 'PDF protection requires PROFESSIONAL plan or higher',
      }
    }

    return processFile('/api/pdf/protect', file, options, 3)
  }, [processFile, canAccessFeature])

  // Sign PDF
  const signPdf = useCallback(async (
    file: File,
    options: SignatureOptions = {}
  ): Promise<ProcessingResult> => {
    if (!canAccessFeature('sign')) {
      return {
        success: false,
        error: 'Digital signature requires BUSINESS plan',
      }
    }

    return processFile('/api/pdf/sign', file, options, 5)
  }, [processFile, canAccessFeature])

  // Merge PDFs
  const mergePdfs = useCallback(async (
    files: File[],
    options: any = {}
  ): Promise<ProcessingResult> => {
    if (files.length < 2) {
      return {
        success: false,
        error: 'At least 2 files are required for merging',
      }
    }

    try {
      setProcessingState({
        isProcessing: true,
        progress: 0,
        currentOperation: 'merge',
        error: null,
      })

      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })
      
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      })

      const response = await fetch('/api/pdf/merge', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Merge failed')
      }

      setProcessingState({
        isProcessing: false,
        progress: 100,
        currentOperation: null,
        error: null,
      })

      await refreshSession()
      toast.success('Files merged successfully!')
      return { success: true, ...result }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Merge failed'
      
      setProcessingState({
        isProcessing: false,
        progress: 0,
        currentOperation: null,
        error: errorMessage,
      })

      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [refreshSession])

  // Split PDF
  const splitPdf = useCallback(async (
    file: File,
    options: { pages?: number[]; ranges?: Array<{ start: number; end: number }>; splitEvery?: number } = {}
  ): Promise<ProcessingResult> => {
    return processFile('/api/pdf/split', file, options, 2)
  }, [processFile])

  // Convert to PDF
  const convertToPdf = useCallback(async (
    file: File,
    options: any = {}
  ): Promise<ProcessingResult> => {
    return processFile('/api/pdf/convert', file, options, 2)
  }, [processFile])

  // Cancel current operation
  const cancelOperation = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      progress: 0,
      currentOperation: null,
      error: null,
    })
    toast.info('Operation cancelled')
  }, [])

  // Reset state
  const resetState = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      progress: 0,
      currentOperation: null,
      error: null,
    })
  }, [])

  // Get operation display name
  const getOperationName = useCallback((operation: string): string => {
    const names: Record<string, string> = {
      compress: 'Compressing PDF',
      watermark: 'Adding Watermark',
      extract: 'Extracting Content',
      protect: 'Protecting PDF',
      sign: 'Adding Digital Signature',
      merge: 'Merging PDFs',
      split: 'Splitting PDF',
      convert: 'Converting to PDF',
    }
    return names[operation] || 'Processing'
  }, [])

  return {
    // State
    ...processingState,
    
    // Operations
    compressPdf,
    addWatermark,
    extractContent,
    protectPdf,
    signPdf,
    mergePdfs,
    splitPdf,
    convertToPdf,
    
    // Utilities
    cancelOperation,
    resetState,
    getOperationName,
    
    // User info
    remainingCredits: user?.creditsRemaining || 0,
    canUseFeature: canAccessFeature,
  }
}
