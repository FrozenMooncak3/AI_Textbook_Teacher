import { getDb } from '@/lib/db'

interface Log {
  id: number
  created_at: string
  level: string
  action: string
  details: string
}

const levelColor: Record<string, string> = {
  info: 'text-blue-600 bg-blue-50',
  warn: 'text-amber-600 bg-amber-50',
  error: 'text-red-600 bg-red-50',
}

export default function LogsPage() {
  const db = getDb()
  const logs = db
    .prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 200')
    .all() as Log[]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">系统日志</h1>
            <p className="text-xs text-gray-400 mt-0.5">最近 200 条操作记录</p>
          </div>
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 返回首页
          </a>
        </div>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">暂无日志</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${levelColor[log.level] ?? 'text-gray-600 bg-gray-100'}`}>
                    {log.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{log.action}</p>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-0.5 break-all">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{log.created_at}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
