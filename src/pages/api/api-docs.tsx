import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  DocumentTextIcon,
  CodeBracketIcon,
  KeyIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

const endpoints = [
  {
    method: 'POST',
    path: '/api/pdf/compress',
    title: 'Compress PDF',
    description: 'Reduce PDF file size while maintaining quality',
    credits: 1,
    params: [
      { name: 'file', type: 'File', required: true, description: 'PDF file to compress' },
      { name: 'quality', type: 'string', required: false, description: 'Compression quality: low, medium, high' },
    ],
    example: `curl -X POST https://api.pdfpro.com/v1/compress \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  -F "quality=medium"`,
    response: `{
  "success": true,
  "downloadUrl": "https://api.pdfpro.com/files/compressed_abc123.pdf",
  "originalSize": 10485760,
  "compressedSize": 2097152,
  "compressionRatio": 80,
  "remainingCredits": 99
}`,
  },
  {
    method: 'POST',
    path: '/api/pdf/merge',
    title: 'Merge PDFs',
    description: 'Combine multiple PDF files into one',
    credits: 1,
    params: [
      { name: 'files', type: 'File[]', required: true, description: 'Array of PDF files to merge' },
      { name: 'insertPageBreaks', type: 'boolean', required: false, description: 'Add blank page between documents' },
    ],
    example: `curl -X POST https://api.pdfpro.com/v1/merge \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "files=@doc1.pdf" \\
  -F "files=@doc2.pdf" \\
  -F "insertPageBreaks=false"`,
    response: `{
  "success": true,
  "downloadUrl": "https://api.pdfpro.com/files/merged_xyz789.pdf",
  "filesCount": 2,
  "totalPages": 10,
  "remainingCredits": 98
}`,
  },
  {
    method: 'POST',
    path: '/api/pdf/split',
    title: 'Split PDF',
    description: 'Extract pages or split PDF into multiple files',
    credits: 1,
    params: [
      { name: 'file', type: 'File', required: true, description: 'PDF file to split' },
      { name: 'pages', type: 'number[]', required: false, description: 'Specific page numbers to extract' },
      { name: 'ranges', type: 'object[]', required: false, description: 'Page ranges to extract' },
      { name: 'splitEvery', type: 'number', required: false, description: 'Split every N pages' },
    ],
    example: `curl -X POST https://api.pdfpro.com/v1/split \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "file=@document.pdf" \\
  -F "pages=[1,3,5]"`,
    response: `{
  "success": true,
  "downloadUrl": "https://api.pdfpro.com/files/split_def456.zip",
  "filesCount": 3,
  "individualFiles": [
    {
      "url": "https://api.pdfpro.com/files/page_1.pdf",
      "filename": "page_1.pdf",
      "size": 524288
    }
  ],
  "remainingCredits": 97
}`,
  },
  {
    method: 'POST',
    path: '/api/pdf/convert',
    title: 'Convert to PDF',
    description: 'Convert Word, Excel, or Images to PDF',
    credits: 2,
    params: [
      { name: 'file', type: 'File', required: true, description: 'File to convert (docx, xlsx, jpg, png)' },
    ],
    example: `curl -X POST https://api.pdfpro.com/v1/convert \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -F "file=@document.docx"`,
    response: `{
  "success": true,
  "downloadUrl": "https://api.pdfpro.com/files/converted_ghi012.pdf",
  "sourceType": ".docx",
  "outputSize": 1048576,
  "remainingCredits": 95
}`,
  },
]

const languages = [
  { name: 'cURL', value: 'curl' },
  { name: 'JavaScript', value: 'javascript' },
  { name: 'Python', value: 'python' },
  { name: 'PHP', value: 'php' },
]

export default function ApiDocsPage() {
  const [selectedLang, setSelectedLang] = useState('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getCodeExample = (endpoint: any, language: string) => {
    switch (language) {
      case 'javascript':
        return `const formData = new FormData();
formData.append('file', fileInput.files[0]);
${endpoint.params.filter((p: any) => p.name !== 'file').map((p: any) => 
  `formData.append('${p.name}', ${p.type === 'boolean' ? 'false' : "'value'"});`
).join('\n')}

const response = await fetch('https://api.pdfpro.com/v1${endpoint.path.split('/').pop()}', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY'
  },
  body: formData
});

const data = await response.json();
console.log(data);`

      case 'python':
        return `import requests

files = {'file': open('document.pdf', 'rb')}
data = {
${endpoint.params.filter((p: any) => p.name !== 'file').map((p: any) => 
  `    '${p.name}': ${p.type === 'boolean' ? 'False' : "'value'"},`
).join('\n')}
}

response = requests.post(
    'https://api.pdfpro.com/v1${endpoint.path.split('/').pop()}',
    headers={'X-API-Key': 'YOUR_API_KEY'},
    files=files,
    data=data
)

print(response.json())`

      case 'php':
        return `<?php
$curl = curl_init();

curl_setopt_array($curl, [
  CURLOPT_URL => "https://api.pdfpro.com/v1${endpoint.path.split('/').pop()}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => [
    'file' => new CURLFile('document.pdf'),
${endpoint.params.filter((p: any) => p.name !== 'file').map((p: any) => 
  `    '${p.name}' => ${p.type === 'boolean' ? 'false' : "'value'"},`
).join('\n')}
  ],
  CURLOPT_HTTPHEADER => [
    "X-API-Key: YOUR_API_KEY"
  ],
]);

$response = curl_exec($curl);
curl_close($curl);

echo $response;
?>`

      default:
        return endpoint.example
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-2" />
                <span className="text-xl font-bold">PDF Pro</span>
              </Link>
              <span className="ml-4 text-gray-500">API Documentation</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/app" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/pricing" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                Get API Key
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Getting Started</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#authentication" className="text-gray-600 hover:text-indigo-600">Authentication</a></li>
                  <li><a href="#rate-limits" className="text-gray-600 hover:text-indigo-600">Rate Limits</a></li>
                  <li><a href="#errors" className="text-gray-600 hover:text-indigo-600">Error Handling</a></li>
                  <li><a href="#credits" className="text-gray-600 hover:text-indigo-600">Credits System</a></li>
                </ul>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Endpoints</h3>
                <ul className="space-y-2 text-sm">
                  {endpoints.map((endpoint) => (
                    <li key={endpoint.path}>
                      <a href={`#${endpoint.path}`} className="text-gray-600 hover:text-indigo-600">
                        {endpoint.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-indigo-50 rounded-lg p-6">
                <RocketLaunchIcon className="h-8 w-8 text-indigo-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Our team is here to help you integrate PDF Pro into your application.
                </p>
                <Link href="/contact" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
                  Contact Support →
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-12">
            {/* Introduction */}
            <section>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">API Documentation</h1>
              <p className="text-lg text-gray-600 mb-6">
                The PDF Pro API allows you to integrate powerful PDF processing capabilities into your applications. 
                Process thousands of documents programmatically with our simple REST API.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <CodeBracketIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900">Base URL</h4>
                    <code className="text-sm text-blue-800">https://api.pdfpro.com/v1</code>
                  </div>
                </div>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
              <p className="text-gray-600 mb-6">
                All API requests require authentication using an API key. Include your API key in the request headers.
              </p>

              <div className="bg-gray-900 rounded-lg p-6 text-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Header</span>
                  <button
                    onClick={() => copyToClipboard('X-API-Key: YOUR_API_KEY', 'auth')}
                    className="text-gray-400 hover:text-white"
                  >
                    {copiedCode === 'auth' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    ) : (
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <code className="text-green-400">X-API-Key: YOUR_API_KEY</code>
              </div>

              <div className="mt-4 flex items-start">
                <KeyIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  You can find your API key in your <Link href="/app" className="text-indigo-600 hover:underline">dashboard</Link>. 
                  Keep it secure and never share it publicly.
                </p>
              </div>
            </section>

            {/* Rate Limits */}
            <section id="rate-limits">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate Limits</h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Hour</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Day</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max File Size</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Starter</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1,000</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">50MB</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Professional</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">500</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5,000</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">200MB</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Business</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2,000</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">20,000</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1GB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Endpoints */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-8">API Endpoints</h2>
              
              {/* Language Selector */}
              <div className="mb-6">
                <div className="flex space-x-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => setSelectedLang(lang.value)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        selectedLang === lang.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint Details */}
              {endpoints.map((endpoint, index) => (
                <motion.div
                  key={endpoint.path}
                  id={endpoint.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="mb-12 scroll-mt-20"
                >
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{endpoint.title}</h3>
                        <span className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                          {endpoint.credits} credit{endpoint.credits > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4">{endpoint.description}</p>
                      <div className="flex items-center space-x-4">
                        <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-lg font-mono text-sm">
                          {endpoint.method}
                        </span>
                        <code className="text-gray-700 font-mono text-sm">{endpoint.path}</code>
                      </div>
                    </div>

                    {/* Parameters */}
                    <div className="p-6 border-b border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-4">Parameters</h4>
                      <div className="space-y-3">
                        {endpoint.params.map((param) => (
                          <div key={param.name} className="flex items-start">
                            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mr-3">
                              {param.name}
                            </code>
                            <div className="flex-1">
                              <span className="text-sm text-gray-600">{param.type}</span>
                              {param.required && (
                                <span className="ml-2 text-xs text-red-600 font-medium">Required</span>
                              )}
                              <p className="text-sm text-gray-500 mt-1">{param.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Code Example */}
                    <div className="p-6 bg-gray-50 border-b border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium text-gray-900">Example Request</h4>
                        <button
                          onClick={() => copyToClipboard(getCodeExample(endpoint, selectedLang), endpoint.path)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {copiedCode === endpoint.path ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <ClipboardDocumentIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm">{getCodeExample(endpoint, selectedLang)}</code>
                      </pre>
                    </div>

                    {/* Response Example */}
                    <div className="p-6">
                      <h4 className="font-medium text-gray-900 mb-4">Example Response</h4>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm">{endpoint.response}</code>
                      </pre>
                    </div>
                  </div>
                </motion.div>
              ))}
            </section>

            {/* Error Handling */}
            <section id="errors">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
              <p className="text-gray-600 mb-6">
                The API returns standard HTTP status codes to indicate success or failure.
              </p>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">200</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Success - Request completed successfully</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">400</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Bad Request - Invalid parameters</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">401</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Unauthorized - Invalid API key</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">402</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Payment Required - Insufficient credits</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">429</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Too Many Requests - Rate limit exceeded</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">500</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Internal Server Error</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 bg-gray-900 rounded-lg p-6">
                <h4 className="text-white font-medium mb-3">Error Response Format</h4>
                <pre className="text-gray-100">
                  <code className="text-sm">{`{
  "success": false,
  "error": "Invalid API key",
  "code": "INVALID_API_KEY",
  "statusCode": 401
}`}</code>
                </pre>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}