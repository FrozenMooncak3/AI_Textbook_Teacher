export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 text-2xl">🔍</div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">找不到该页面</h2>
      <p className="text-sm text-gray-500 mb-6">抱歉，您访问的页面不存在或已被移除。</p>
      <a 
        href="/" 
        className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
      >
        返回首页
      </a>
    </div>
  )
}
