import { motion } from 'framer-motion'
import { SparklesIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface ToolCardProps {
  tool: {
    id: string
    name: string
    description: string
    icon: any
    color: string
    bgColor: string
    credits: number
    href?: string
  }
  onClick?: () => void
  disabled?: boolean
  featured?: boolean
  compact?: boolean
}

export default function ToolCard({ 
  tool, 
  onClick, 
  disabled = false,
  featured = false,
  compact = false
}: ToolCardProps) {
  const CardWrapper = tool.href ? Link : 'button'
  
  const cardProps = tool.href 
    ? { href: tool.href }
    : { onClick, type: 'button' as const }

  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`relative ${featured ? 'col-span-2 row-span-2' : ''}`}
    >
      <CardWrapper
        {...cardProps}
        disabled={disabled}
        className={`
          block w-full h-full bg-white rounded-xl shadow-sm hover:shadow-md 
          transition-all text-left relative overflow-hidden
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${featured ? 'border-2 border-indigo-200' : 'border border-gray-200'}
          ${compact ? 'p-4' : 'p-6'}
        `}
      >
        {featured && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              Popular
            </span>
          </div>
        )}

        <div className={`flex ${compact ? 'items-center' : 'flex-col'}`}>
          <div 
            className={`
              inline-flex items-center justify-center rounded-lg
              ${compact ? 'w-10 h-10' : 'w-12 h-12 mb-4'}
              ${tool.bgColor}
            `}
          >
            <tool.icon className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} ${tool.color}`} />
          </div>

          <div className={`${compact ? 'ml-4' : ''} flex-1`}>
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-lg mb-2'}`}>
              {tool.name}
            </h3>
            
            {!compact && (
              <p className="text-sm text-gray-600 mb-4">
                {tool.description}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-500">
                <SparklesIcon className="h-4 w-4 mr-1" />
                <span>{tool.credits} credit{tool.credits > 1 ? 's' : ''}</span>
              </div>
              
              {featured && !compact && (
                <span className="text-sm font-medium text-indigo-600">
                  Try now →
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Decorative gradient for featured cards */}
        {featured && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
        )}
      </CardWrapper>
    </motion.div>
  )
}