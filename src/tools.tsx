import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'
import ToolCard from '@/components/ToolCard'
import { motion } from 'framer-motion'
import {
  ArrowsPointingInIcon,
  DocumentDuplicateIcon,
  ScissorsIcon,
  DocumentTextIcon,
  DocumentMagnifyingGlassIcon,
  LockClosedIcon,
  PhotoIcon,
  ArrowPathIcon,
  KeyIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

const tools = [
  {
    id: 'compress',
    name: 'Compress PDF',
    description: 'Reduce file size without losing quality',
    icon: ArrowsPointingInIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    credits: 1,
    href: '/app/tools/compress',
    category: 'optimization',
  },
  {
    id: 'merge',
    name: 'Merge PDFs',
    description: 'Combine multiple PDFs into one document',
    icon: DocumentDuplicateIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    credits: 1,
    href: '/app/tools/merge',
    category: 'organize',
  },
  {
    id: 'split',
    name: 'Split PDF',
    description: 'Extract pages or split into multiple files',
    icon: ScissorsIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    credits: 1,
    href: '/app/tools/split',
    category: 'organize',
  },
  {
    id: 'convert-to',
    name: 'Convert to PDF',
    description: 'Convert Word, Excel, Images to PDF',
    icon: DocumentTextIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    credits: 2,
    href: '/app/tools/convert-to-pdf',
    category: 'convert',
  },
  {
    id: 'convert-from',
    name: 'Convert from PDF',
    description: 'Convert PDF to Word, Excel, Images',
    icon: DocumentTextIcon,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    credits: 2,
    href: '/app/tools/convert-from-pdf',
    category: 'convert',
  },
  {
    id: 'extract',
    name: 'Extract Content',
    description: 'Extract text, images, and tables from PDFs',
    icon: DocumentMagnifyingGlassIcon,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    credits: 2,
    href: '/app/tools/extract',
    category: 'extract',
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    description: 'Add password protection and encryption',
    icon: LockClosedIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    credits: 1,
    href: '/app/tools/protect',
    category: 'security',
  },
  {
    id: 'unlock',
    name: 'Unlock PDF',
    description: 'Remove password from protected PDFs',
    icon: KeyIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    credits: 1,
    href: '/app/tools/unlock',
    category: 'security',
  },
  {
    id: 'watermark',
    name: 'Add Watermark',
    description: 'Add text or image watermarks to PDFs',
    icon: PhotoIcon,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    credits: 1,
    href: '/app/tools/watermark',
    category: 'security',
  },
  {
    id: 'rotate',
    name: 'Rotate PDF',
    description: 'Rotate pages to correct orientation',
    icon: ArrowPathIcon,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    credits: 1,
    href: '/app/tools/rotate',
    category: 'edit',
  },
  {
    id: 'sign',
    name: 'E-Sign PDF',
    description: 'Add electronic signatures to documents',
    icon: PencilSquareIcon,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    credits: 2,
    href: '/app/tools/sign',
    category: 'edit',
    premium: true,
  },
  {
    id: 'ocr',
    name: 'OCR PDF',
    description: 'Make scanned PDFs searchable',
    icon: MagnifyingGlassIcon,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    credits: 3,
    href: '/app/tools/ocr',
    category: 'extract',
    premium: true,
  },
]

const categories = [
  { id: 'all', name: 'All Tools', icon: null },
  { id: 'optimization', name: 'Optimize', icon: ArrowsPointingInIcon },
  { id: 'organize', name: 'Organize', icon: DocumentDuplicateIcon },
  { id: 'convert', name: 'Convert', icon: DocumentTextIcon },
  { id: 'security', name: 'Security', icon: LockClosedIcon },
  { id: 'edit', name: 'Edit', icon: PencilSquareIcon },
  { id: 'extract', name: 'Extract', icon: DocumentMagnifyingGlassIcon },
]

export default function ToolsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTools = tools.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleToolClick = (tool: any) => {
    if (tool.premium && session?.user?.subscription?.plan === 'FREE') {
      router.push('/pricing')
    } else {
      router.push(tool.href)
    }
  }

  return (
    <Layout title="PDF Tools" showUsageBar={true}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PDF Tools</h1>
          <p className="mt-2 text-gray-600">
            Choose a tool to get started with your PDF tasks
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Featured Tools */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Most Popular Tools</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {tools.slice(0, 3).map((tool) => (
              <motion.button
                key={tool.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleToolClick(tool)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-left hover:bg-white/30 transition"
              >
                <tool.icon className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">{tool.name}</h3>
                <p className="text-sm text-white/80 mt-1">{tool.description}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <ToolCard
                tool={tool}
                onClick={() => handleToolClick(tool)}
                disabled={tool.premium && session?.user?.subscription?.plan === 'FREE'}
              />
              {tool.premium && session?.user?.subscription?.plan === 'FREE' && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500">
                    <LockClosedIcon className="inline h-3 w-3 mr-1" />
                    Premium feature
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">No tools found matching your criteria</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-12 bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Usage This Month</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-indigo-600">
                {session?.user?.creditsUsed || 0}
              </p>
              <p className="text-sm text-gray-600">PDFs Processed</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600">
                {session?.user?.creditsRemaining || 5}
              </p>
              <p className="text-sm text-gray-600">Credits Remaining</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-purple-600">
                {tools.filter(t => !t.premium || session?.user?.subscription?.plan !== 'FREE').length}
              </p>
              <p className="text-sm text-gray-600">Tools Available</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-600">
                {session?.user?.subscription?.plan || 'FREE'}
              </p>
              <p className="text-sm text-gray-600">Current Plan</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}