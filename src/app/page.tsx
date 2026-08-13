import Link from 'next/link'
import { Sparkles, Inbox, ArrowRight, ShieldCheck, Zap, Database, TrendingUp, Layers, CheckCircle2 } from 'lucide-react'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

export const revalidate = 0 // Dynamic data fetch on request

async function getStats() {
  try {
    const total = await db.enquiry.count()
    const unreviewed = await db.enquiry.count({ where: { status: 'new' } })
    const highPriority = await db.enquiry.count({ where: { priority: 'high' } })
    const genuine = await db.enquiry.count({ where: { isGenuineEnquiry: true } })

    const rawRecords = await db.enquiry.findMany({
      select: { budgetNormalized: true }
    })
    const totalPipeline = rawRecords.reduce((sum, r) => sum + (r.budgetNormalized || 0), 0)

    return { total, unreviewed, highPriority, genuine, totalPipeline }
  } catch (error) {
    console.error('Error loading home page stats:', error)
    return { total: 0, unreviewed: 0, highPriority: 0, genuine: 0, totalPipeline: 0 }
  }
}

export default async function HomePage() {
  const stats = await getStats()

  return (
    <div className="py-8 space-y-12 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="relative glass-panel rounded-3xl p-8 sm:p-12 border-slate-800 overflow-hidden shadow-2xl space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Internal Agency Operations Tool</span>
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
            Sodio Project Enquiry <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Triage &amp; Extraction Console
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Sodio receives unstructured project enquiries via website contact forms. This console ingests messy raw messages, runs AI structured extraction via Claude, computes deterministic priority scores, and protects human edits during re-evaluations.
          </p>
        </div>

        {/* Primary Call to Action */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            href="/enquiries"
            className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all group"
          >
            <span>Launch Triage Console</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Live DB Statistics Bar */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Live Workspace Summary</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 font-medium">Total Ingested Enquiries</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-bold text-slate-100">{stats.total}</h3>
              <span className="text-[11px] text-slate-500">records</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 font-medium">Unreviewed ("New")</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-bold text-blue-400">{stats.unreviewed}</h3>
              <span className="text-[11px] text-blue-400/70 font-medium">pending triage</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 font-medium">High Priority Deals</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-bold text-rose-400">{stats.highPriority}</h3>
              <span className="text-[11px] text-rose-400/70 font-medium">urgent score</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 font-medium">Est. Pipeline Value</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-bold text-cyan-400">{formatCurrency(stats.totalPipeline)}</h3>
              <span className="text-[11px] text-cyan-400/70 font-medium">USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">1. Multiform Ingestion</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ingest single raw text entries, paste demo enquiries, or bulk upload <code className="text-indigo-300">.txt</code> and <code className="text-indigo-300">.pdf</code> files with server-side text extraction.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">2. LLM Extraction &amp; Security</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pulls structured fields (company, email, budget, timeline, service line) while treating raw input as untrusted data to flag prompt injection attempts.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">3. Non-Destructive Re-Extraction</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Human corrections are protected during re-extraction. Compare previous snapshots and accept AI suggestions without clobbering human edits.
          </p>
        </div>
      </div>
    </div>
  )
}
