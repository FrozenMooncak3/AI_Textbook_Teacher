import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import ReviewButton from './ReviewButton'

interface Book {
  id: number
  title: string
  created_at: string
  total_modules: number
  completed_modules: number
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    redirect('/login')
  }

  const user = await getUserFromSession(token)
  if (!user) {
    redirect('/login')
  }

  // Fetch books with module progress
  const books = await query<Book>(
    `SELECT b.id, b.title, b.created_at,
      COUNT(DISTINCT m.id)::int as total_modules,
      COUNT(DISTINCT CASE WHEN m.learning_status = 'completed' THEN m.id END)::int as completed_modules
     FROM books b
     LEFT JOIN modules m ON m.book_id = b.id
     WHERE b.user_id = $1
     GROUP BY b.id, b.title, b.created_at
     ORDER BY b.created_at DESC`,
    [user.id]
  )

  const hasBooks = books.length > 0

  return (
    <main className="min-h-full bg-surface-container-low p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Top Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-on-surface font-headline tracking-tight">
              AI 教材精学老师
            </h1>
            <p className="text-on-surface-variant font-medium mt-1">
              欢迎回来，{user.display_name || user.email}
            </p>
          </div>
          {hasBooks && (
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 text-primary font-bold rounded-full px-6 py-3 shadow-sm hover:bg-surface-container transition-all"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              上传新教材
            </Link>
          )}
        </div>

        <div className="mb-10">
          <ReviewButton />
        </div>

        {!hasBooks ? (
          /* Empty State */
          <div className="flex items-center justify-center py-20">
            <div className="bg-surface-container-lowest rounded-[40px] border border-outline-variant/10 p-12 md:p-20 text-center shadow-sm shadow-orange-900/5 max-w-2xl w-full">
              <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-8">
                <span className="material-symbols-outlined text-6xl text-primary opacity-30">menu_book</span>
              </div>
              <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight mb-4">
                开始你的学习之旅
              </h2>
              <p className="text-on-surface-variant font-medium text-lg mb-10 leading-relaxed">
                上传你的第一本教材，AI 老师会为你规划学习路径，<br />通过 Q&A 和复习帮你真正学透知识点。
              </p>
              <Link
                href="/upload"
                className="amber-glow text-white font-black font-headline text-lg py-5 px-12 rounded-full shadow-xl shadow-orange-900/20 active:scale-95 transition-all inline-flex items-center gap-3"
              >
                <span>上传教材</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        ) : books.length === 1 ? (
          /* Single Book Hero */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {books.map((book) => {
              const progress = book.total_modules > 0 ? Math.round((book.completed_modules / book.total_modules) * 100) : 0
              const dashOffset = 440 - (440 * progress) / 100

              return (
                <div key={book.id} className="bg-surface-container-lowest rounded-[32px] p-10 md:p-16 border border-outline-variant/10 shadow-sm shadow-orange-900/5 relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 text-center md:text-left">
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 block">当前学习教材</span>
                      <h2 className="text-4xl md:text-5xl font-black text-on-surface font-headline tracking-tight mb-6 leading-tight">
                        {book.title}
                      </h2>
                      <div className="flex items-center justify-center md:justify-start gap-4 mb-10 text-on-surface-variant font-medium">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {new Date(book.created_at).toLocaleDateString('zh-CN')}
                        </span>
                        <span className="text-outline-variant">|</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">auto_stories</span>
                          {book.completed_modules} / {book.total_modules} 模块已完成
                        </span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <Link
                          href={`/books/${book.id}`}
                          className="amber-glow text-white font-black font-headline text-lg py-5 px-12 rounded-full shadow-xl shadow-orange-900/20 active:scale-95 transition-all inline-flex items-center gap-3 w-full sm:w-auto justify-center"
                        >
                          <span>继续学习</span>
                          <span className="material-symbols-outlined">play_arrow</span>
                        </Link>
                      </div>
                    </div>

                    <div className="relative flex-shrink-0">
                      {(() => {
                        const radius = 70
                        const circumference = 2 * Math.PI * radius
                        const dashOffset = circumference - (circumference * progress) / 100
                        
                        return (
                          <svg className="w-48 h-48 md:w-64 md:h-64 transform -rotate-90" viewBox="0 0 160 160">
                            <circle className="text-surface-container" cx="80" cy="80" fill="transparent" r={radius} stroke="currentColor" strokeWidth="12"></circle>
                            <circle 
                              className="text-primary transition-all duration-1000 ease-out" 
                              cx="80" cy="80" fill="transparent" r={radius} stroke="currentColor" 
                              strokeDasharray={circumference} 
                              strokeDashoffset={dashOffset} 
                              strokeLinecap="round" strokeWidth="12"
                            ></circle>
                          </svg>
                        )
                      })()}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl md:text-5xl font-black font-headline text-on-surface">{progress}%</span>
                        <span className="text-[10px] uppercase tracking-widest font-black text-on-surface-variant mt-1">总完成度</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative element */}
                  <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700"></div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Multi Book Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {books.map((book) => {
              const progress = book.total_modules > 0 ? Math.round((book.completed_modules / book.total_modules) * 100) : 0
              
              return (
                <Link 
                  key={book.id} 
                  href={`/books/${book.id}`}
                  className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 shadow-sm shadow-orange-900/5 group hover:shadow-md hover:translate-y-[-4px] transition-all flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <span className="material-symbols-outlined text-2xl">book</span>
                    </div>
                    <span className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-widest">
                      {new Date(book.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-black text-on-surface font-headline tracking-tight mb-auto leading-tight group-hover:text-primary transition-colors">
                    {book.title}
                  </h3>
                  
                  <div className="mt-10">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">已完成 {book.completed_modules}/{book.total_modules} 模块</span>
                      <span className="text-sm font-black font-headline text-primary">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(167,72,0,0.3)]" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
