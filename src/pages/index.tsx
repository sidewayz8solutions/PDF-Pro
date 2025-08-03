import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  DocumentTextIcon, 
  LockClosedIcon, 
  CloudArrowUpIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CheckIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  DocumentMagnifyingGlassIcon,
  PhotoIcon,
  KeyIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Compress PDF',
    description: 'Reduce file size by up to 90% without losing quality',
    icon: ArrowsPointingInIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    name: 'Merge PDFs',
    description: 'Combine multiple PDFs into a single document',
    icon: DocumentDuplicateIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    name: 'Split PDF',
    description: 'Extract pages or split PDFs into multiple files',
    icon: ScissorsIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    name: 'Convert Files',
    description: 'Convert Word, Excel, Images to PDF and vice versa',
    icon: DocumentTextIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    name: 'Extract Content',
    description: 'Extract text, images, and tables from PDFs',
    icon: DocumentMagnifyingGlassIcon,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  {
    name: 'Secure PDFs',
    description: 'Password protect, encrypt, and add watermarks',
    icon: LockClosedIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    credits: '5 PDFs/month',
    features: [
      '5 PDF operations per month',
      'Files up to 10MB',
      'Basic compression',
      'Standard processing',
      'No watermarks',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '$9',
    credits: '100 PDFs/month',
    features: [
      '100 PDF operations per month',
      'Files up to 50MB',
      'Advanced compression',
      'Priority processing',
      'Batch operations',
      'No ads',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$29',
    credits: '500 PDFs/month',
    features: [
      '500 PDF operations per month',
      'Files up to 200MB',
      'Maximum compression',
      'Instant processing',
      'API access',
      'Custom watermarks',
      'OCR included',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$99',
    credits: 'Unlimited',
    features: [
      'Unlimited PDF operations',
      'Files up to 1GB',
      'All features included',
      'Dedicated API limits',
      'Custom integrations',
      'White-label options',
      'SLA guarantee',
      '24/7 phone support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold">PDF Pro</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-gray-900">Features</Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
              <Link href="/api-docs" className="text-gray-600 hover:text-gray-900">API</Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
              <Link href="/app" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                Get Started Free
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
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-4">
              <SparklesIcon className="h-4 w-4 mr-1" />
              No sign-up required for 5 free PDFs
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              All-in-One PDF Tools
              <span className="block text-indigo-600">That Just Work</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Compress, merge, split, convert, and edit PDFs with lightning speed. 
              Trusted by over 100,000 users for secure, professional PDF management.
            </p>

            {/* Drop Zone */}
            <div
              className={`max-w-2xl mx-auto border-2 border-dashed rounded-xl p-12 transition-all ${
                dragActive ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CloudArrowUpIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your PDF here, or{' '}
                <Link href="/app" className="text-indigo-600 hover:text-indigo-700">
                  browse
                </Link>
              </p>
              <p className="text-sm text-gray-500">Support for PDF, Word, Excel, PowerPoint, and images</p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/app" 
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                Start Free - No Signup
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                href="#pricing" 
                className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                View Pricing
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-5 w-5 mr-2 text-green-600" />
                256-bit SSL Encryption
              </div>
              <div className="flex items-center">
                <CloudArrowUpIcon className="h-5 w-5 mr-2 text-blue-600" />
                Files deleted after 1 hour
              </div>
              <div className="flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-purple-600" />
                99.9% Uptime SLA
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for PDFs
            </h2>
            <p className="text-xl text-gray-600">
              Professional PDF tools that save you time and money
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${feature.bgColor} mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.name}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Additional Features */}
          <div className="mt-16 bg-white rounded-2xl p-8 shadow-sm">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">For Individuals</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Quick PDF edits without expensive software</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Prepare documents for job applications</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Compress PDFs for email attachments</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Convert scanned documents to searchable PDFs</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">For Businesses</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">API access for automated workflows</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Batch process thousands of documents</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">White-label solutions available</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span className="text-gray-600">Enterprise-grade security and compliance</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-indigo-600 text-white shadow-xl scale-105'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-sm font-medium mb-4">MOST POPULAR</div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  {plan.price !== '$0' && <span className={plan.highlighted ? 'text-indigo-100' : 'text-gray-600'}>/month</span>}
                </div>
                <p className={`font-medium mb-6 ${plan.highlighted ? 'text-indigo-100' : 'text-gray-700'}`}>
                  {plan.credits}
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckIcon className={`h-5 w-5 mr-2 flex-shrink-0 ${plan.highlighted ? 'text-white' : 'text-green-500'}`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-indigo-100' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === 'Business' ? '/contact' : '/signup'}
                  className={`block text-center py-3 px-4 rounded-lg font-medium transition ${
                    plan.highlighted
                      ? 'bg-white text-indigo-600 hover:bg-gray-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 rounded-full">
              <CurrencyDollarIcon className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">30-day money-back guarantee</span>
            </div>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Powerful API for Developers</h2>
              <p className="text-xl text-gray-300 mb-8">
                Integrate PDF processing into your applications with our simple REST API. 
                Process thousands of documents programmatically.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <CheckIcon className="h-6 w-6 text-green-400 mr-3" />
                  <span>RESTful API with comprehensive documentation</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="h-6 w-6 text-green-400 mr-3" />
                  <span>SDKs for Python, Node.js, PHP, and more</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="h-6 w-6 text-green-400 mr-3" />
                  <span>Webhook notifications for async processing</span>
                </li>
                <li className="flex items-start">
                  <CheckIcon className="h-6 w-6 text-green-400 mr-3" />
                  <span>99.9% uptime SLA for business plans</span>
                </li>
              </ul>
              <Link href="/api-docs" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium">
                View API Documentation
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 font-mono text-sm">
              <div className="text-gray-400 mb-2"># Compress a PDF</div>
              <div className="text-green-400">curl -X POST https://api.pdfpro.com/v1/compress \</div>
              <div className="text-white ml-4">-H "Authorization: Bearer YOUR_API_KEY" \</div>
              <div className="text-white ml-4">-F "file=@document.pdf" \</div>
              <div className="text-white ml-4">-F "compression_level=high"</div>
              <div className="mt-4 text-gray-400"># Response</div>
              <div className="text-white">{'{'}</div>
              <div className="text-white ml-4">"success": true,</div>
              <div className="text-white ml-4">"file_url": "https://api.pdfpro.com/files/abc123.pdf",</div>
              <div className="text-white ml-4">"original_size": 10485760,</div>
              <div className="text-white ml-4">"compressed_size": 2097152,</div>
              <div className="text-white ml-4">"compression_ratio": "80%"</div>
              <div className="text-white">{'}'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Simplify Your PDF Workflow?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join thousands of users who save hours every week with our PDF tools
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app"
              className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 font-medium rounded-lg hover:bg-gray-100 transition"
            >
              Try Free Now
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 bg-indigo-700 text-white font-medium rounded-lg hover:bg-indigo-800 transition"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-indigo-400" />
                <span className="ml-2 text-xl font-bold text-white">PDF Pro</span>
              </div>
              <p className="text-sm">Professional PDF tools for everyone</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="hover:text-white">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/api-docs" className="hover:text-white">API</Link></li>
                <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white">Security</Link></li>
                <li><Link href="/gdpr" className="hover:text-white">GDPR</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2024 PDF Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}