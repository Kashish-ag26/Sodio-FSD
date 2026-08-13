import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Database, ShieldCheck, LayoutDashboard, Home } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sodio Enquiry Triage Tool',
  description: 'AI-assisted unstructured enquiry ingestion, LLM extraction, and priority scoring console.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '')

  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen flex flex-col antialiased">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
                  <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <div>
                  <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                    Sodio Triage
                  </span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    AI-Assisted
                  </span>
                </div>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-1 text-xs font-medium">
                <Link
                  href="/"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home</span>
                </Link>
                <Link
                  href="/enquiries"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20 transition-colors font-semibold"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Triage Console</span>
                </Link>
              </nav>
            </div>

            {/* Header Right Status Indicators */}
            <div className="flex items-center space-x-4 text-xs">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">SQLite Connected</span>
              </div>

              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <ShieldCheck className={`w-3.5 h-3.5 ${hasApiKey ? 'text-cyan-400' : 'text-amber-400'}`} />
                <span className="text-slate-300">
                  LLM Mode: {hasApiKey ? <strong className="text-cyan-300 font-medium">Anthropic / OpenRouter API</strong> : <strong className="text-amber-400 font-medium">Fallback Stub</strong>}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 py-4 bg-[#060911]/80 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Sodio Enquiry Triage Tool &bull; Take-Home Project Submission
            </div>
            <div className="flex items-center space-x-4 text-slate-400">
              <span>Next.js 14 App Router</span>
              <span>&bull;</span>
              <span>Prisma ORM</span>
              <span>&bull;</span>
              <span>Anthropic / OpenRouter API</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
