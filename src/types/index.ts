import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
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
  KeyIcon,
  CommandLineIcon,
  BoltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Compress PDF',
    description: 'Reduce file size by up to 90% without losing quality',
    icon: ArrowsPointingInIcon,
    color: 'from-blue-500 to-cyan-500',
    shadowColor: 'shadow-blue-500/25',
  },
  {
    name: 'Merge PDFs',
    description: 'Combine multiple PDFs into a single document',
    icon: DocumentDuplicateIcon,
    color: 'from-emerald-500 to-teal-500',
    shadowColor: 'shadow-emerald-500/25',
  },
  {
    name: 'Split PDF',
    description: 'Extract pages or split PDFs into multiple files',
    icon: ScissorsIcon,
    color: 'from-purple-500 to-pink-500',
    shadowColor: 'shadow-purple-500/25',
  },
  {
    name: 'Convert Files',
    description: 'Convert Word, Excel, Images to PDF and vice versa',
    icon: DocumentTextIcon,
    color: 'from-orange-500 to-red-500',
    shadowColor: 'shadow-orange-500/25',
  },
  {
    name: 'Extract Content',
    description: 'Extract text, images, and tables from PDFs',
    icon: DocumentMagnifyingGlassIcon,
    color: 'from-pink-500 to-rose-500',
    shadowColor: 'shadow-pink-500/25',
  },
  {
    name: 'Secure PDFs',
    description: 'Password protect, encrypt, and add watermarks',
    icon: LockClosedIcon,
    color: 'from-indigo-500 to-purple-500',
    shadowColor: 'shadow-indigo-500/25',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: 0,
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
    gradient: 'from-gray-600 to-gray-800',
  },
  {
    name: 'Starter',
    price: 9,
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
    gradient: 'from-blue-600 to-indigo-700',
  },
  {
    name: 'Professional',
    price: 29,
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
    gradient: 'from-purple-600 to-pink-600',
  },
  {
    name: 'Business',
    price: 99,
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
    gradient: 'from-amber-600 to-orange-700',
  },
]

export default function LandingPage() {
  const [dragActive, setDragActive] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

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
      window.location.href = '/app'
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="absolute inset-0">
          {/* Animated gradient orbs */}
          <div 
            className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float"
            style={{
              left: `${mousePosition.x * 0.05}px`,
              top: `${mousePosition.y * 0.05}px`,
            }}
          />
          <div 
            className="absolute right-0 top-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float"
            style={{
              animation: 'float 4s ease-in-out infinite reverse',
            }}
          />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse-slow" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_85%)]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50">
        <div className="absolute inset-0 bg-black/10 backdrop-blur-xl border-b border-white/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-lg opacity-75" />
                <DocumentTextIcon className="relative h-10 w-10 text-white" />
              </div>
              <span className="ml-3 text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                PDF Pro
              </span>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden md:flex items-center space-x-8"
            >
              <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
              <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
              <Link href="/api-docs" className="text-gray-300 hover:text-white transition-colors">API</Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Link 
                href="/app" 
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-md group-hover:blur-lg transition-all" />
                <span className="relative bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full inline-block font-medium">
                  Get Started Free
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 backdrop-blur-sm mb-6"
            >
              <SparklesIcon className="h-5 w-5 mr-2 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">No sign-up required for 5 free PDFs</span>
            </motion.div>
            
            <h1 className="text-6xl md:text-8xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                All-in-One
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
                PDF Tools
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Compress, merge, split, convert, and edit PDFs with lightning speed. 
              Trusted by over 100,000 users for secure, professional PDF management.
            </p>

            {/* Drop Zone */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="relative max-w-2xl mx-auto"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className={`
                relative group cursor-pointer
                ${dragActive ? 'scale-105' : 'scale-100'}
                transition-all duration-300
              `}>
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000" />
                
                {/* Main drop zone */}
                <div className="relative bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-16 hover:border-white/20 transition-all">
                  <CloudArrowUpIcon className="h-20 w-20 mx-auto text-purple-400 mb-6" />
                  <p className="text-2xl font-medium mb-2">
                    Drop your PDF here, or{' '}
                    <span className="text-purple-400 hover:text-purple-300">browse</span>
                  </p>
                  <p className="text-gray-400">Support for PDF, Word, Excel, PowerPoint, and images</p>
                  
                  {/* Animated particles */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 bg-purple-400 rounded-full animate-float"
                        style={{
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${i * 0.5}s`,
                          animationDuration: `${3 + Math.random() * 2}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-col sm:flex-row gap-6 justify-center"
            >
              <Link 
                href="/app" 
                className="group relative inline-flex items-center"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-200" />
                <span className="relative flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full">
                  Start Free - No Signup
                  <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              
              <Link 
                href="#pricing" 
                className="group relative inline-flex items-center"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full blur-sm opacity-50 group-hover:opacity-75 transition duration-200" />
                <span className="relative flex items-center px-8 py-4 bg-gray-900 border border-gray-700 text-white font-semibold rounded-full group-hover:border-gray-600 transition-colors">
                  View Pricing
                  <ChartBarIcon className="ml-2 h-5 w-5" />
                </span>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-16 flex flex-wrap justify-center gap-8"
            >
              {[
                { icon: ShieldCheckIcon, text: '256-bit SSL Encryption', color: 'text-green-400' },
                { icon: BoltIcon, text: 'Lightning Fast Processing', color: 'text-yellow-400' },
                { icon: ChartBarIcon, text: '99.9% Uptime SLA', color: 'text-blue-400' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center space-x-2 px-4 py-2 bg-gray-900/50 backdrop-blur-sm rounded-full border border-gray-800">
                  <badge.icon className={`h-5 w-5 ${badge.color}`} />
                  <span className="text-sm text-gray-300">{badge.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section id="features" className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Powerful Features
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Professional PDF tools that save you time and money
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative"
              >
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.color} rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300`} />
                <div className="relative h-full bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-6`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{feature.name}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats Section */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { number: '100K+', label: 'Active Users' },
              { number: '10M+', label: 'PDFs Processed' },
              { number: '99.9%', label: 'Uptime SLA' },
              { number: '4.9/5', label: 'User Rating' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Simple Pricing
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              Start free, upgrade when you need more
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative group ${plan.highlighted ? 'lg:scale-110 z-10' : ''}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium px-4 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${plan.gradient} rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300`} />
                
                <div className="relative h-full bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-5xl font-bold">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-400">/month</span>}
                  </div>
                  <p className="text-gray-400 mb-8">{plan.credits}</p>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <CheckIcon className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button className={`w-full py-3 px-4 rounded-full font-medium transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}>
                    {plan.cta}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Money Back Guarantee */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center px-6 py-3 bg-green-900/30 backdrop-blur-sm border border-green-800 rounded-full">
              <CurrencyDollarIcon className="h-6 w-6 text-green-400 mr-2" />
              <span className="text-green-400 font-medium">30-day money-back guarantee</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* API Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Powerful API
                </span>
                <br />
                <span className="text-white">for Developers</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Integrate PDF processing into your applications with our simple REST API. 
                Process thousands of documents programmatically.
              </p>
              
              <div className="space-y-4 mb-8">
                {[
                  'RESTful API with comprehensive documentation',
                  'SDKs for Python, Node.js, PHP, and more',
                  'Webhook notifications for async processing',
                  '99.9% uptime SLA for business plans'
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mr-4" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              
              <Link href="/api-docs" className="inline-flex items-center text-purple-400 hover:text-purple-300 font-medium group">
                View API Documentation
                <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl" />
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 font-mono text-sm overflow-hidden">
                <div className="absolute top-4 left-4 flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                
                <div className="mt-8 space-y-2">
                  <div className="text-gray-500"># Compress a PDF</div>
                  <div className="text-green-400">curl -X POST https://api.pdfpro.com/v1/compress \</div>
                  <div className="text-gray-300 ml-4">-H "Authorization: Bearer YOUR_API_KEY" \</div>
                  <div className="text-gray-300 ml-4">-F "file=@document.pdf" \</div>
                  <div className="text-gray-300 ml-4">-F "compression_level=high"</div>
                  <div className="mt-4 text-gray-500"># Response</div>
                  <div className="text-purple-400">{'{'}</div>
                  <div className="text-gray-300 ml-4">"success": <span className="text-green-400">true</span>,</div>
                  <div className="text-gray-300 ml-4">"file_url": <span className="text-amber-400">"https://api.pdfpro.com/files/abc123.pdf"</span>,</div>
                  <div className="text-gray-300 ml-4">"original_size": <span className="text-blue-400">10485760</span>,</div>
                  <div className="text-gray-300 ml-4">"compressed_size": <span className="text-blue-400">2097152</span>,</div>
                  <div className="text-gray-300 ml-4">"compression_ratio": <span className="text-amber-400">"80%"</span></div>
                  <div className="text-purple-400">{'}'}</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/30 to-transparent" />
        
        <div className="relative max-w-4xl mx-auto text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Ready to Simplify Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
                PDF Workflow?
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-12">
              Join thousands of users who save hours every week
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link 
                href="/app" 
                className="group relative inline-flex items-center"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-200" />
                <span className="relative flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full">
                  Try Free Now
                  <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              
              <Link 
                href="/contact" 
                className="group relative inline-flex items-center"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-600 to-gray-800 rounded-full blur-sm opacity-50 group-hover:opacity-75 transition duration-200" />
                <span className="relative flex items-center px-8 py-4 bg-gray-900 border border-gray-700 text-white font-semibold rounded-full group-hover:border-gray-600 transition-colors">
                  Contact Sales
                  <CommandLineIcon className="ml-2 h-5 w-5" />
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-lg opacity-75" />
                  <DocumentTextIcon className="relative h-8 w-8 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold">PDF Pro</span>
              </div>
              <p className="text-gray-400">Professional PDF tools for everyone</p>
            </div>
            
            {[
              {
                title: 'Product',
                links: ['Features', 'Pricing', 'API', 'Changelog']
              },
              {
                title: 'Company',
                links: ['About', 'Blog', 'Contact', 'Careers']
              },
              {
                title: 'Legal',
                links: ['Privacy Policy', 'Terms of Service', 'Security', 'GDPR']
              }
            ].map((column) => (
              <div key={column.title}>
                <h4 className="font-semibold text-white mb-4">{column.title}</h4>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link}>
                      <Link href={`/${link.toLowerCase().replace(' ', '-')}`} className="text-gray-400 hover:text-white transition-colors">
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 PDF Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 6s ease infinite;
        }
      `}</style>
    </div>
  )
}
