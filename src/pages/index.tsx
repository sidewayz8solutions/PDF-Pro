import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  DocumentTextIcon, 
  CloudArrowUpIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CheckIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  DocumentMagnifyingGlassIcon,
  PhotoIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Compress PDF',
    description: 'Reduce file size by up to 90% without losing quality',
    icon: ArrowsPointingInIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    name: 'Merge PDFs',
    description: 'Combine multiple PDFs into a single document',
    icon: DocumentDuplicateIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    name: 'Split PDF',
    description: 'Extract pages or split PDFs into multiple files',
    icon: ScissorsIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    name: 'Convert Files',
    description: 'Convert Word, Excel, Images to PDF and vice versa',
    icon: DocumentTextIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    name: 'Extract Content',
    description: 'Extract text, images, and tables from PDFs',
    icon: DocumentMagnifyingGlassIcon,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
  },
  {
    name: 'Secure PDFs',
    description: 'Password protect, encrypt, and add watermarks',
    icon: LockClosedIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
]

export default function LandingPage() {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Handle file - redirect to app
      window.location.href = '/app'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg z-50 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                PDF Pro
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-indigo-600 transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-indigo-600 transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-indigo-600 transition-colors">
                Sign In
              </Link>
              <Link 
                href="/app" 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 text-sm font-medium mb-6 border border-indigo-200">
              <SparklesIcon className="h-4 w-4 mr-2" />
              No sign-up required • 5 free PDFs
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Professional PDF Tools
              <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                That Just Work
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Compress, merge, split, convert, and edit PDFs with lightning speed. 
              Trusted by over 100,000 users for secure, professional PDF management.
            </p>

            {/* Drop Zone */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`max-w-2xl mx-auto border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${
                dragActive 
                  ? 'border-indigo-400 bg-indigo-50 shadow-lg' 
                  : 'border-gray-300 bg-white/50 hover:border-indigo-300 hover:bg-white/70'
              } backdrop-blur-sm shadow-xl`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CloudArrowUpIcon className={`h-16 w-16 mx-auto mb-4 transition-colors ${
                dragActive ? 'text-indigo-600' : 'text-gray-400'
              }`} />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Drop your PDF here, or{' '}
                <Link href="/app" className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-2">
                  browse files
                </Link>
              </p>
              <p className="text-sm text-gray-500">
                Support for PDF, Word, Excel, PowerPoint, and images
              </p>
            </motion.div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center bg-white/60 px-4 py-2 rounded-full backdrop-blur-sm">
                <ShieldCheckIcon className="h-5 w-5 mr-2 text-green-600" />
                256-bit SSL Encryption
              </div>
              <div className="flex items-center bg-white/60 px-4 py-2 rounded-full backdrop-blur-sm">
                <CloudArrowUpIcon className="h-5 w-5 mr-2 text-blue-600" />
                Files deleted after 1 hour
              </div>
              <div className="flex items-center bg-white/60 px-4 py-2 rounded-full backdrop-blur-sm">
                <ChartBarIcon className="h-5 w-5 mr-2 text-purple-600" />
                99.9% Uptime SLA
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need for PDFs
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional-grade PDF tools that work instantly in your browser. No downloads, no installations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`${feature.bgColor} ${feature.borderColor} border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm`}
              >
                <div className={`${feature.color} ${feature.bgColor} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.name}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Simplify Your PDF Workflow?
            </h2>
            <p className="text-xl text-indigo-100 mb-8 leading-relaxed">
              Join thousands of users who save hours every week with our PDF tools
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app"
                className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 font-semibold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Try Free Now
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-indigo-600 transition-all"
              >
                View Pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <DocumentTextIcon className="h-8 w-8 text-indigo-400" />
              <span className="ml-2 text-xl font-bold">PDF Pro</span>
            </div>
            <p className="text-gray-400 mb-4">
              Professional PDF tools for everyone
            </p>
            <div className="flex justify-center space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
