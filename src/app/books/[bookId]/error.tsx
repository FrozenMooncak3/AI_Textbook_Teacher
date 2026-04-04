'use client'

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl">📚</div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">教材加载出错</h2>
      <p className="text-sm text-gray-500 mb-6">{error.message || '无法加载教材内容，请尝试刷新页面'}</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
        <a href="/" className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          返回书架
        </a>
      </div>
    </div>
  )
}
