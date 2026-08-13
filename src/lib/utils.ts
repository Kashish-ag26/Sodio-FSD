import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getPriorityColor(priority: string): {
  bg: string
  text: string
  border: string
  badge: string
} {
  switch (priority?.toLowerCase()) {
    case 'high':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      }
    case 'medium':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      }
    case 'low':
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      }
  }
}

export function getServiceLineColor(serviceLine: string): {
  bg: string
  text: string
  border: string
} {
  switch (serviceLine?.toLowerCase()) {
    case 'ai':
      return { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' }
    case 'blockchain':
      return { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' }
    case 'web':
      return { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' }
    case 'mobile':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' }
    case 'game':
      return { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30' }
    default:
      return { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' }
  }
}

export function getStatusColor(status: string): {
  bg: string
  text: string
  border: string
} {
  switch (status?.toLowerCase()) {
    case 'new':
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' }
    case 'contacted':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' }
    case 'qualified':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-400/30' }
    case 'dropped':
      return { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' }
    default:
      return { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' }
  }
}
