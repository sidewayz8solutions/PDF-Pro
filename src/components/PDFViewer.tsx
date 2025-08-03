import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PdfViewerProps {
  file?: File | string // File object or URL
  onClose?: () => void
  showControls?: boolean
  height?: string
  className?: string
}

export default function PdfViewer({
  file,
  onClose,
  showControls = true,
  height = '600px',
  className = '',
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF')
    setLoading(false)
  }

  const previousPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1))
  }

  const nextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1))
  }

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const downloadPdf = () => {
    if (typeof file === 'string') {
      // If file is a URL, open in new tab
      window.open(file, '_blank')
    } else if (file instanceof File) {
      // If file is a File object, create download link
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!file) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${height} ${className}`}>
        <div className="text-center">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No PDF selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-100 rounded-lg overflow-hidden ${className}`} style={{ height }}>
      {/* Controls */}
      {showControls && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Page navigation */}
              <button
                onClick={previousPage}
                disabled={pageNumber <= 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              
              <span className="text-sm text-gray-600">
                Page {pageNumber} of {numPages || '-'}
              </span>
              
              <button
                onClick={nextPage}
                disabled={pageNumber >= (numPages || 1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {/* Zoom controls */}
              <button
                onClick={zoomOut}
                className="p-1 rounded hover:bg-gray-100"
                title="Zoom out"
              >
                <MagnifyingGlassMinusIcon className="h-5 w-5" />
              </button>
              
              <span className="text-sm text-gray-600 min-w-[4rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              
              <button
                onClick={zoomIn}
                className="p-1 rounded hover:bg-gray-100"
                title="Zoom in"
              >
                <MagnifyingGlassPlusIcon className="h-5 w-5" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-2" />

              {/* Download button */}
              <button
                onClick={downloadPdf}
                className="p-1 rounded hover:bg-gray-100"
                title="Download"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>

              {/* Close button */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 rounded hover:bg-gray-100"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Display */}
      <div 
        className="overflow-auto bg-gray-100 flex items-center justify-center"
        style={{ height: showControls ? 'calc(100% - 48px)' : '100%' }}
      >
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="text-center">
            <DocumentIcon className="mx-auto h-12 w-12 text-red-400" />
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  )
}