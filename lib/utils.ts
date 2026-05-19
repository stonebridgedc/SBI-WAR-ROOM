import type { Deal, Region } from './types'

export function fmtShort(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toLocaleString()
}

export function fmtUnit(n: number | null | undefined): string {
  if (!n) return '—'
  return '$' + Math.round(n).toLocaleString()
}

export function fmtPct(n: number): string {
  return n.toFixed(2) + '%'
}

export function fmtCurrency(n: number | null | undefined): string {
  if (!n) return '—'
  return '$' + n.toLocaleString()
}

export const REGION_MAP: Record<Region, string[]> = {
  DC: ['Washington, DC','Suburban Maryland','Northern Virginia','Richmond, VA','Charlottesville, VA','Virginia Beach, VA','Misc - Mid-Atlantic'],
  Carolinas: ['Charlotte, NC','Raleigh/Durham, NC','Greensboro/Winston-Salem, NC','Wilmington, NC','Charleston, SC','Greenville, SC','Misc - Carolinas'],
  GA: ['Atlanta, GA','Savannah, GA','Misc - Georgia'],
  TX: ['Dallas, TX','Houston, TX','Austin, TX','San Antonio, TX','Misc - Texas'],
  TN: ['Nashville, TN','Misc - Tennessee'],
  FL: ['Jacksonville, FL','Orlando, FL','Tampa, FL','South Florida','Naples/Fort Myers, FL','Misc - Florida'],
  Midwest: ['Chicago, IL','Indianapolis, IN','Minneapolis, MN','Kansas City, MO','Cincinnati, OH','Misc - Midwest'],
  Misc: [],
}

export function getRegion(market: string): Region {
  for (const [region, markets] of Object.entries(REGION_MAP)) {
    if ((markets as string[]).includes(market)) return region as Region
  }
  return 'Misc'
}

export const REGION_LABELS: Record<Region, string> = {
  DC: 'Mid-Atlantic', Carolinas: 'Carolinas', GA: 'Georgia',
  TX: 'Texas', TN: 'Tennessee', FL: 'Florida', Midwest: 'Midwest', Misc: 'Misc',
}

export const STATUS_CLASS: Record<string, string> = {
  '0 - Underwritten': 's-underwritten',
  '1 - New': 's-new',
  '1.5 - Tracking': 's-tracking',
  '2 - Active': 's-active',
  '3 - Bid Placed': 's-bid',
  '5 - Dormant': 's-dormant',
  '6 - Passed': 's-passed',
  '7 - Lost': 's-lost',
  '9 - Exited': 's-exited',
  '10 - Owned Property': 's-owned',
  '11 - Property Comp': 's-comp',
}

export function statusClass(s: string) {
  for (const [k, v] of Object.entries(STATUS_CLASS)) {
    if (s.includes(k.split(' - ')[0] + ' -')) return v
  }
  return 's-passed'
}

export function statusLabel(s: string): string {
  const parts = s.split(' - ')
  return parts.slice(1).join(' - ') || s
}

export function bidDateClass(d: string | null): string {
  if (!d) return ''
  const days = Math.round((new Date(d + 'T12:00:00').getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-500'
  if (days <= 3) return 'text-red-500 font-bold'
  if (days <= 7) return 'text-amber-600 font-semibold'
  return 'text-slate-600'
}

export function formatBidDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d + 'T12:00:00')
  const days = Math.round((date.getTime() - Date.now()) / 86400000)
  const str = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (days < 0) return str + ' (past)'
  if (days === 0) return str + ' (Today)'
  if (days === 1) return str + ' (Tomorrow)'
  if (days <= 7) return str + ` (${days}d)`
  return str
}

export const ALL_STATUSES = [
  '0 - Underwritten','1 - New','1.5 - Tracking','2 - Active','3 - Bid Placed','5 - Dormant','6 - Passed','7 - Lost','9 - Exited','10 - Owned Property','11 - Property Comp'
]

export function sortDeals(deals: Deal[], order: string): Deal[] {
  const d = [...deals]
  switch (order) {
    case 'modified-desc': return d.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''))
    case 'biddate-asc':   return d.sort((a, b) => {
      if (!a.bid_due_date && !b.bid_due_date) return 0
      if (!a.bid_due_date) return 1
      if (!b.bid_due_date) return -1
      return a.bid_due_date.localeCompare(b.bid_due_date)
    })
    case 'price-desc':    return d.sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0))
    case 'price-asc':     return d.sort((a, b) => (a.purchase_price ?? 0) - (b.purchase_price ?? 0))
    case 'units-desc':    return d.sort((a, b) => (b.units ?? 0) - (a.units ?? 0))
    case 'name-asc':      return d.sort((a, b) => a.name.localeCompare(b.name))
    case 'location-asc':  return d.sort((a, b) => (a.market ?? '').localeCompare(b.market ?? ''))
    case 'added-desc':    return d.sort((a, b) => (b.added ?? '').localeCompare(a.added ?? ''))
    case 'added-asc':     return d.sort((a, b) => (a.added ?? '').localeCompare(b.added ?? ''))
    default: return d
  }
}
