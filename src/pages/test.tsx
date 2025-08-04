export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-8">
          🎨 Tailwind CSS Test
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">✅ Basic Styling</h2>
            <p className="text-gray-600 mb-4">If you can see this card with proper styling, Tailwind CSS is working!</p>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Success</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Working</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">🌈 Gradients</h2>
            <p className="mb-4 opacity-90">Beautiful gradient backgrounds and text effects</p>
            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all">
              Hover me!
            </button>
          </div>

          <div className="bg-white/70 backdrop-blur-sm border border-indigo-200 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-indigo-900 mb-4">🎯 Interactive Elements</h2>
            <div className="space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full w-3/4"></div>
              </div>
              <p className="text-sm text-gray-600">Progress bar example</p>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm border border-green-200 rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-green-900 mb-4">🚀 Animations</h2>
            <div className="animate-pulse bg-green-100 rounded-lg p-4 mb-3">
              Pulsing animation
            </div>
            <div className="animate-bounce bg-green-200 rounded-lg p-2 w-12 h-12 flex items-center justify-center">
              🎾
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            ← Back to Homepage
          </a>
        </div>
      </div>
    </div>
  )
}
