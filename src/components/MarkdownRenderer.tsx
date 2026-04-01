'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0" {...props} />,
          h2: ({ ...props }) => <h2 className="text-base font-bold text-slate-900 mt-3 mb-2 first:mt-0" {...props} />,
          h3: ({ ...props }) => <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1 first:mt-0" {...props} />,
          p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
          li: ({ ...props }) => <li className="pl-1" {...props} />,
          strong: ({ ...props }) => <strong className="font-bold text-slate-900" {...props} />,
          em: ({ ...props }) => <em className="italic" {...props} />,
          code: ({ ...props }) => (
            <code className="px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-900 font-mono text-[0.8em] border border-slate-200" {...props} />
          ),
          pre: ({ ...props }) => (
            <pre className="p-4 bg-slate-100 rounded-xl overflow-x-auto my-3 border border-slate-200" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="pl-4 border-l-4 border-slate-200 italic my-3 text-slate-500" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
