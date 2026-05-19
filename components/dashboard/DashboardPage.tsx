'use client'
import { useMemo, useState, useEffect } from 'react'
import type { Deal, BoeData, CapRate } from '@/lib/types'
import { fmtShort, statusLabel, formatBidDate, bidDateClass, getRegion, REGION_LABELS } from '@/lib/utils'
import dynamic from 'next/dynamic'


interface Props {
  deals: Deal[]
  capRateMap: Record<string, CapRate>
  boeMap: Record<string, BoeData>
  onOpenDeal: (d: Deal) => void
}

const REGION_COLORS: Record<string, string> = {
  'Mid-Atlantic': '#C9A84C', 'Carolinas': '#2E6B9E', 'Georgia': '#2E7D50',
  'Texas': '#8B4513', 'Tennessee': '#6B3FA0', 'Florida': '#1E7A6E', 'Misc': '#8A9BB0'
}

const BROKER_COLORS = ['#C9A84C','#2E6B9E','#2E7D50','#6B3FA0','#1E7A6E','#8B4513','#C0392B','#2C8C8C','#8A4BAF','#5D6D7E']

// Short display names for long market strings
const MARKET_SHORT: Record<string, string> = {
  'Washington, DC-MD-VA': 'Washington DC',
  'Baltimore, MD': 'Baltimore',
  'Richmond-Petersburg, VA': 'Richmond',
  'Charlottesville, VA': 'Charlottesville',
  'Norfolk-Virginia Beach-Newport News, VA-NC': 'Virginia Beach',
  'Raleigh-Durham-Chapel Hill, NC': 'Raleigh/Durham',
  'Charlotte-Gastonia-Rock Hill, NC-SC': 'Charlotte',
  'Greensboro--Winston-Salem--High Point, NC': 'Greensboro',
  'Wilmington, NC': 'Wilmington NC',
  'Charleston-North Charleston, SC': 'Charleston SC',
  'Greenville-Spartanburg-Anderson, SC': 'Greenville SC',
  'Atlanta, GA': 'Atlanta',
  'Savannah, GA': 'Savannah',
  'Dallas-Fort Worth, TX': 'Dallas/Fort Worth',
  'Houston, TX': 'Houston',
  'Austin-San Marcos, TX': 'Austin',
  'San Antonio, TX': 'San Antonio',
  'Nashville, TN': 'Nashville',
  'Orlando, FL': 'Orlando',
  'Tampa-St. Petersburg-Clearwater, FL': 'Tampa',
  'Fort Myers-Cape Coral, FL': 'Fort Myers',
  'Sarasota-Bradenton, FL': 'Sarasota',
  'Naples, FL': 'Naples',
  'Miami-Fort Lauderdale, FL': 'South Florida',
  'Jacksonville, FL': 'Jacksonville',
}

function shortMarket(m: string) { return MARKET_SHORT[m] || m.split(',')[0].replace(/--/g, '/') }

function BrokerLeaderboard({ deals }: { deals: Deal[] }) {
  // Filter to 2026 only
  const deals2026 = useMemo(() => deals.filter(d => {
    if (!d.added) return false
    const y = typeof d.added === 'string' ? d.added : String(d.added)
    return y.includes('2026')
  }), [deals])

  // Build market list sorted by 2026 deal count
  const marketList = useMemo(() => {
    const counts: Record<string, number> = {}
    deals2026.forEach(d => { if (d.broker && d.market) counts[d.market] = (counts[d.market] || 0) + 1 })
    return [
      { market: 'All Markets', count: deals2026.filter(d => d.broker).length },
      ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([market, count]) => ({ market, count }))
    ]
  }, [deals2026])

  const [selectedMarket, setSelectedMarket] = useState<string>('All Markets')

  const brokerRanking = useMemo(() => {
    const filtered = selectedMarket === 'All Markets'
      ? deals2026
      : deals2026.filter(d => d.market === selectedMarket)
    const counts: Record<string, number> = {}
    filtered.forEach(d => { if (d.broker) counts[d.broker.trim()] = (counts[d.broker.trim()] || 0) + 1 })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, count, color: BROKER_COLORS[i % BROKER_COLORS.length] }))
  }, [deals2026, selectedMarket])

  const maxCount = brokerRanking[0]?.count || 1
  const totalInView = brokerRanking.reduce((s, b) => s + b.count, 0)

  return (
    <div style={{ background: '#0D1B2E', borderRadius: 12, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden', marginBottom: 16, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(201,168,76,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>Intelligence · 2026 YTD</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F4EF', fontFamily: "'Cormorant Garamond',serif", marginTop: 2 }}>Broker Activity by Market</div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,244,239,0.3)' }}>{deals2026.filter(d=>d.broker).length} deals tracked</div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Market sidebar */}
        <div style={{ width: 230, borderRight: '1px solid rgba(201,168,76,0.1)', overflowY: 'auto' as const, maxHeight: 460, flexShrink: 0 }}>
          {marketList.map(({ market, count }) => {
            const isSelected = selectedMarket === market
            const isAll = market === 'All Markets'
            return (
              <button
                key={market}
                onClick={() => setSelectedMarket(market)}
                style={{
                  width: '100%', textAlign: 'left' as const, padding: '9px 14px',
                  background: isSelected ? 'rgba(201,168,76,0.1)' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#C9A84C' : 'transparent'}`,
                  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? '#C9A84C' : '#F5F4EF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 160 }}>
                  {isAll ? 'All Markets' : shortMarket(market)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#C9A84C' : 'rgba(245,244,239,0.3)', fontFamily: "'DM Mono',monospace", flexShrink: 0, marginLeft: 6 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Rankings */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Panel subheader */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F4EF', fontFamily: "'Cormorant Garamond',serif" }}>
              {selectedMarket === 'All Markets' ? 'All Markets' : shortMarket(selectedMarket)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(245,244,239,0.3)', letterSpacing: '0.05em' }}>{brokerRanking.length} brokers · {totalInView} deals</div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 44px 44px', gap: 0, padding: '6px 18px', borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
            {['#', 'Broker', 'Share', 'Deals', '%'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(201,168,76,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, textAlign: h === '#' || h === 'Deals' || h === '%' ? 'center' as const : 'left' as const }}>{h}</div>
            ))}
          </div>

          <div style={{ overflowY: 'auto' as const, maxHeight: 394 }}>
            {brokerRanking.length === 0 ? (
              <div style={{ padding: '32px 18px', color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center' as const }}>No 2026 deals for this market</div>
            ) : brokerRanking.map((broker, idx) => {
              const barPct = (broker.count / maxCount) * 100
              const sharePct = ((broker.count / totalInView) * 100).toFixed(0)
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              return (
                <div key={broker.name}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 44px 44px', alignItems: 'center', gap: 0, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Rank */}
                  <div style={{ fontSize: medal ? 14 : 13, fontWeight: 700, color: 'rgba(245,244,239,0.25)', textAlign: 'center' as const }}>{medal || `${idx+1}`}</div>

                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, minWidth: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: broker.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#F5F4EF', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{broker.name}</span>
                  </div>

                  {/* Bar */}
                  <div style={{ paddingRight: 12 }}>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: broker.color, borderRadius: 3, opacity: 0.8 }} />
                    </div>
                  </div>

                  {/* Count */}
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#C9A84C', fontFamily: "'DM Mono',monospace", textAlign: 'center' as const }}>{broker.count}</div>

                  {/* Share % */}
                  <div style={{ fontSize: 12, color: 'rgba(245,244,239,0.3)', fontFamily: "'DM Mono',monospace", textAlign: 'center' as const }}>{sharePct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}



function RateRow({ label, value, change, loading }: { label: string; value: string; change?: string; loading?: boolean }) {
  const up = change ? !change.startsWith('-') && change !== '+0.000' && change !== '+0.00' : null
  const changeColor = up === null ? '#8A9BB0' : up ? '#2E7D50' : '#C0392B'
  const arrow = up === null ? '' : up ? '▲' : '▼'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
      <div style={{ fontSize: 12, color: 'rgba(245,244,239,0.5)', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {change && up !== null && (
          <span style={{ fontSize: 10, color: changeColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 8 }}>{arrow}</span>{change}
          </span>
        )}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C', fontFamily: "'DM Mono',monospace" }}>{loading ? '—' : value}</span>
      </div>
    </div>
  )
}

function TickerRow({ label, value, change, pct, loading }: { label: string; value: string; change: string; pct: string; loading?: boolean }) {
  const up = !change.startsWith('-')
  const color = loading ? '#8A9BB0' : up ? '#2E7D50' : '#C0392B'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto auto', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.08)', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.06em' }}>{label}</div>
      <div />
      <div style={{ fontSize: 13, fontWeight: 700, color: '#F5F4EF', fontFamily: "'DM Mono',monospace" }}>{loading ? '—' : value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color, minWidth: 90, textAlign: 'right' }}>{loading ? '—' : `${change} (${pct})`}</div>
    </div>
  )
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  let cum = 0
  const r = 56, cx = 74, cy = 74
  const slices = data.map((d, i) => {
    const pct = d.value / total, start = cum; cum += pct
    const sa = start * 2 * Math.PI - Math.PI / 2
    const ea = cum * 2 * Math.PI - Math.PI / 2
    const ma = (sa + ea) / 2
    const sw = hoveredIdx === i ? 26 : 20
    return {
      ...d, i, pct, sw,
      path: `M ${cx + r * Math.cos(sa)} ${cy + r * Math.sin(sa)} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(ea)} ${cy + r * Math.sin(ea)}`,
      tx: cx + r * Math.cos(ma), ty: cy + r * Math.sin(ma)
    }
  })

  const hovered = hoveredIdx !== null ? slices[hoveredIdx] : null

  return (
    <svg width={148} height={148} style={{ overflow: 'visible' }}>
      {slices.map((s) => (
        <path key={s.i} d={s.path} fill="none" stroke={s.color} strokeWidth={s.sw}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredIdx(s.i)}
          onMouseLeave={() => setHoveredIdx(null)} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: '#0D1B2E', fontFamily: "'Cormorant Garamond',serif" }}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 8, fill: '#8A9BB0', letterSpacing: '0.1em' }}>DEALS</text>
      {hovered && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={hovered.tx - 38} y={hovered.ty - 22} width={76} height={34} rx={4} fill="rgba(13,27,46,0.95)" />
          <text x={hovered.tx} y={hovered.ty - 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: '#fff', fontFamily: "'Cormorant Garamond',serif" }}>{hovered.value}</text>
          <text x={hovered.tx} y={hovered.ty + 9} textAnchor="middle" style={{ fontSize: 8, fill: '#C9A84C', letterSpacing: '0.06em' }}>{hovered.label.toUpperCase()}</text>
        </g>
      )}
    </svg>
  )
}

export default function DashboardPage({ deals, capRateMap, boeMap, onOpenDeal }: Props) {
  const now = new Date()
  const [rates, setRates] = useState<any>(null)
  const [ratesLoading, setRatesLoading] = useState(true)


  useEffect(() => {
    async function loadRates() {
      try {
        const res = await fetch('/api/rates')
        if (!res.ok) throw new Error(`${res.status}`)
        const d = await res.json()
        if (d && !d.error) setRates(d)
      } catch (e) {
        console.warn('Rates fetch failed:', e)
      }
      setRatesLoading(false)
    }

    loadRates()

    // 5 min during market hours (9:30am-5pm ET Mon-Fri), 30 min otherwise
    function getRefreshMs() {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const day = et.getDay()
      const timeVal = et.getHours() * 60 + et.getMinutes()
      const isWeekday = day >= 1 && day <= 5
      const isMarketHours = timeVal >= 9 * 60 + 30 && timeVal <= 17 * 60
      return isWeekday && isMarketHours ? 5 * 60 * 1000 : 30 * 60 * 1000
    }

    let timer: ReturnType<typeof setTimeout>
    function schedule() {
      timer = setTimeout(() => { loadRates(); schedule() }, getRefreshMs())
    }
    schedule()

    return () => clearTimeout(timer)
  }, [])



  const active = deals.filter(d => d.status.includes('2 -'))
  const newDeals = deals.filter(d => d.status.includes('1 -'))
  const owned = deals.filter(d => d.status.includes('10 -'))
  const passed = deals.filter(d => d.status.includes('6 -') || d.status.includes('7 -'))

  const totalGuidance = useMemo(() => [...newDeals, ...active].filter(d => d.purchase_price).reduce((s, d) => s + d.purchase_price!, 0), [newDeals, active])
  const avgCapRate = useMemo(() => { const crs = Object.values(capRateMap).filter(c => c.noi_cap_rate).map(c => Number(c.noi_cap_rate)); return crs.length ? crs.reduce((s, v) => s + v, 0) / crs.length : 0 }, [capRateMap])

  // Pipeline + UW KPI stats
  const totalPipelineCount = deals.filter(d => ["0 - Underwriting","1 - New","2 - Active","1.5 - Tracking"].includes(d.status)).length
  const uwGuidancePrices = useMemo(() => underwriting.filter(d => d.purchase_price).map(d => d.purchase_price!), [underwriting])
  const avgUwGuidance = uwGuidancePrices.length ? uwGuidancePrices.reduce((s, v) => s + v, 0) / uwGuidancePrices.length : null
  const uwCapRates = useMemo(() => underwriting.map(d => capRateMap[d.name]).filter(cr => cr?.noi_cap_rate).map(cr => Number(cr.noi_cap_rate)), [underwriting, capRateMap])
  const avgUwCapRate = uwCapRates.length ? uwCapRates.reduce((s, v) => s + v, 0) / uwCapRates.length : null

  const allTimeCapRates = useMemo(() => {
    return deals.filter(d => {
      if (!d.added) return false
      const yr = parseInt(d.added.slice(0, 4))
      return yr >= 2025
    }).map(d => capRateMap[d.name]).filter(cr => cr?.noi_cap_rate).map(cr => Number(cr.noi_cap_rate))
  }, [deals, capRateMap])
  const avgAllTimeCapRate = allTimeCapRates.length ? allTimeCapRates.reduce((s, v) => s + v, 0) / allTimeCapRates.length : null

  const underwriting = deals.filter(d => d.status === '0 - Underwriting')
  const activeDealsList = underwriting.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '')).slice(0, 8)
  const marketData = useMemo(() => {
    const counts: Record<string, number> = {}
    deals.filter(d => d.added && new Date(d.added).getFullYear() === 2026).forEach(d => {
      const label = (REGION_LABELS as any)[getRegion(d.market || '')] || 'Other'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: REGION_COLORS[label] || '#8A9BB0' }))
  }, [deals])

  // Cap rate by region for dot scale
  const capRateByRegion = useMemo(() => {
    const map: Record<string, number[]> = {}
    const yr2026 = deals.filter(d => d.added && new Date(d.added).getFullYear() === 2026)
    yr2026.forEach(d => {
      const cr = capRateMap[d.name]?.noi_cap_rate
      if (!cr) return
      const label = (REGION_LABELS as any)[getRegion(d.market || '')] || 'Other'
      if (!map[label]) map[label] = []
      map[label].push(Number(cr))
    })
    return Object.entries(map)
      .map(([label, rates]) => ({ label, avg: rates.reduce((s,v) => s+v, 0) / rates.length, count: rates.length }))
      .filter(r => r.count >= 2)
      .sort((a, b) => a.avg - b.avg)
  }, [deals, capRateMap])

  const avg2026CapRate = useMemo(() => {
    const rates = deals
      .filter(d => d.added && new Date(d.added).getFullYear() === 2026)
      .map(d => capRateMap[d.name]?.noi_cap_rate).filter(Boolean).map(Number)
    return rates.length ? rates.reduce((s,v) => s+v,0) / rates.length : null
  }, [deals, capRateMap])
  const statusCounts = deals.reduce((acc: Record<string, number>, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc }, {})

  // Monthly deal flow — rolling 12 months from current month
  const monthlyFlow = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const months: { label: string; key: string; count: number; avgCapRate: number | null }[] = []
    const baseYear = now.getFullYear()
    const baseMonth = now.getMonth() // 0-indexed
    for (let i = 11; i >= 0; i--) {
      // Calculate month without mutating a shared Date object
      const totalMonths = baseYear * 12 + baseMonth - i
      const yr = Math.floor(totalMonths / 12)
      const mo = totalMonths % 12 // 0-indexed
      const key = `${yr}-${String(mo + 1).padStart(2,'0')}`
      const label = `${MONTHS[mo]}-${String(yr).slice(2)}`
      months.push({ label, key, count: 0, avgCapRate: null })
    }
    deals.forEach(d => {
      if (!d.added) return
      const key = d.added.slice(0, 7)
      const m = months.find(m => m.key === key)
      if (!m) return
      m.count++
    })
    // Compute avg cap rate per month
    months.forEach(m => {
      const monthDeals = deals.filter(d => d.added?.slice(0,7) === m.key)
      const rates = monthDeals.map(d => capRateMap[d.name]?.noi_cap_rate).filter(Boolean).map(Number)
      m.avgCapRate = rates.length ? rates.reduce((s,v) => s+v, 0) / rates.length : null
    })
    return months
  }, [deals, now, capRateMap])

  const maxFlow = Math.max(...monthlyFlow.map(m => m.count), 1)

  const fmtBig = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : '—'
  const fmtR = (v: any, d = 2) => v != null ? `${Number(v).toFixed(d)}%` : '—'
  const fmtDelta = (v: any, d = 3) => v != null ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(d)}` : '—'
  const fmtPct = (v: any) => v != null ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%` : '—'
  const fmtPrice = (v: any, decimals = 2) => v != null ? Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—'

  const card = { background: '#fff', borderRadius: 12, border: '1px solid rgba(13,27,46,0.07)', overflow: 'hidden' as const }
  const dark = { background: '#0D1B2E', borderRadius: 12, border: '1px solid rgba(201,168,76,0.15)', overflow: 'hidden' as const }
  const secLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }

  return (
    <div style={{ padding: '24px 28px', background: '#EEEDE7', minHeight: '100%' }}>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Pipeline', value: totalPipelineCount.toString(), sub: 'currently in pipeline', accent: '#C9A84C' },
          { label: 'Underwritten Deals', value: underwriting.length.toString(), sub: 'currently underwritten', accent: '#2E6B9E' },
          { label: 'Avg UW Guidance', value: avgUwGuidance ? fmtBig(avgUwGuidance) : '—', sub: 'avg ask price · underwriting deals', accent: '#2E7D50' },
          { label: 'Avg UW Cap Rate', value: avgUwCapRate ? `${avgUwCapRate.toFixed(2)}%` : '—', sub: `${uwCapRates.length} UW deals w/ BOE`, accent: '#6B3FA0' },
          { label: 'Avg Cap Rate All Time', value: avgAllTimeCapRate ? `${avgAllTimeCapRate.toFixed(2)}%` : '—', sub: `2025–present · ${allTimeCapRates.length} deals`, accent: '#1E7A6E' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 20px', borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: 11, color: '#8A9BB0', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: '#0D1B2E', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 16 }}>

        {/* Market Intelligence */}
        <div style={{ ...dark, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(201,168,76,0.55)', letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 1 }}>Market Intelligence</div>
            <div style={{ fontSize: 10, color: 'rgba(245,244,239,0.3)' }}>
              {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Live Data
            </div>
          </div>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
            <div style={secLabel}>Reference Rates</div>
            <RateRow label="SOFR" value={fmtR(rates?.sofr?.rate)} change={fmtDelta(rates?.sofr?.change, 2)} loading={ratesLoading} />
            <RateRow label="5Y Treasury" value={fmtR(rates?.fiveY?.rate)} change={fmtDelta(rates?.fiveY?.change, 3)} loading={ratesLoading} />
            <RateRow label="7Y Treasury" value={fmtR(rates?.sevenY?.rate)} change={fmtDelta(rates?.sevenY?.change)} loading={ratesLoading} />
            <RateRow label="10Y Treasury" value={fmtR(rates?.tenY?.rate)} change={fmtDelta(rates?.tenY?.change)} loading={ratesLoading} />
          </div>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
            <div style={secLabel}>Equity Markets</div>
            <TickerRow label="S&P 500" value={rates?.sp500?.price != null ? `$${Number(rates.sp500.price * 10).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} change={fmtDelta(rates?.sp500?.change)} pct={fmtPct(rates?.sp500?.pct)} loading={ratesLoading} />
            <TickerRow label="DOW" value={rates?.dow?.price != null ? `$${Number(rates.dow.price * 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} change={fmtDelta(rates?.dow?.change)} pct={fmtPct(rates?.dow?.pct)} loading={ratesLoading} />
            <TickerRow label="BTC" value={rates?.btc?.price != null ? `$${Number(rates.btc.price).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} change={fmtDelta(rates?.btc?.change)} pct={fmtPct(rates?.btc?.pct)} loading={ratesLoading} />
            <TickerRow label="EUR → USD" value={rates?.eurusd?.price != null ? Number(rates.eurusd.price).toFixed(4) : '—'} change={fmtDelta(rates?.eurusd?.change, 4)} pct={fmtPct(rates?.eurusd?.pct)} loading={ratesLoading} />
            <TickerRow label="USD → EUR" value={rates?.eurusd?.price != null ? Number(1 / rates.eurusd.price).toFixed(4) : '—'} change={rates?.eurusd?.price != null && rates?.eurusd?.change ? fmtDelta(-(rates.eurusd.change / (rates.eurusd.price * rates.eurusd.price)), 4) : '—'} pct={rates?.eurusd?.pct != null ? fmtPct(-rates.eurusd.pct) : '—'} loading={ratesLoading} />
          </div>
          <div style={{ padding: '12px 18px' }}>
            <div style={secLabel}>Multifamily REITs</div>
            {['avb','eqr','maa','ess'].map(t => (
              <TickerRow key={t} label={t.toUpperCase()} value={rates?.[t]?.price != null ? `$${Number(rates[t].price).toFixed(2)}` : '—'} change={fmtDelta(rates?.[t]?.change)} pct={fmtPct(rates?.[t]?.pct)} loading={ratesLoading} />
            ))}
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Donut + Cap Rate Scale + Active Deals */}
          <div style={{ display: 'grid', gridTemplateColumns: '210px 220px 1fr', gap: 16 }}>
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9BB0', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8 }}>2026 by Market</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><DonutChart data={marketData} /></div>
              <div style={{ marginTop: 6 }}>
                {marketData.slice(0, 5).map(d => (
                  <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#8A9BB0' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0D1B2E' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cap Rate by Region — Dot Scale */}
            <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9BB0', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Cap Rate · 2026</div>
              {capRateByRegion.length === 0 ? (
                <div style={{ fontSize: 11, color: '#8A9BB0', flex: 1, display: 'flex', alignItems: 'center' }}>No BOE data yet</div>
              ) : (() => {
                const minR = 4.0
                const maxR = 6.0
                const range = 2.0
                const toPct = (v: number) => Math.min(Math.max(((v - minR) / range) * 100, 0), 100)
                const avgPct = avg2026CapRate ? toPct(avg2026CapRate) : null
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    {/* Scale labels — fixed 4.0 to 6.0 in 50bps increments */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8A9BB0', fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
                      {[4.0,4.5,5.0,5.5,6.0].map(v => <span key={v}>{v.toFixed(1)}%</span>)}
                    </div>
                    {/* Axis with avg line */}
                    <div style={{ position: 'relative', height: 2, background: 'rgba(13,27,46,0.08)', borderRadius: 1, marginBottom: 14 }}>
                      {avgPct !== null && (
                        <>
                          <div style={{ position: 'absolute', left: `${avgPct}%`, top: -6, width: 1, height: 14, background: '#C9A84C' }} />
                          <div style={{ position: 'absolute', left: `${Math.min(Math.max(avgPct - 14, 0), 70)}%`, top: 10, fontSize: 9, color: '#C9A84C', whiteSpace: 'nowrap' as const, fontWeight: 700, letterSpacing: '0.05em' }}>2026 avg</div>
                        </>
                      )}
                    </div>
                    {/* Dots */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
                      {capRateByRegion.map(r => {
                        const pct = toPct(r.avg)
                        const isAbove = avg2026CapRate ? r.avg > avg2026CapRate : false
                        return (
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 11, color: '#8A9BB0', width: 68, flexShrink: 0, textAlign: 'right' as const }}>{r.label}</div>
                            <div style={{ flex: 1, position: 'relative', height: 16 }}>
                              <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: isAbove ? '#C9A84C' : '#0D1B2E', flexShrink: 0 }} />
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#0D1B2E', fontFamily: "'DM Mono',monospace", width: 36, flexShrink: 0 }}>{r.avg.toFixed(2)}%</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: '#8A9BB0', marginTop: 10, borderTop: '1px solid rgba(13,27,46,0.05)', paddingTop: 8 }}>Gold = above 2026 avg · {capRateByRegion.length} markets</div>
                  </div>
                )
              })()}
            </div>

            <div style={card}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(13,27,46,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 700, color: '#0D1B2E' }}>Underwritten Deals</div>
                <div style={{ fontSize: 10, color: '#8A9BB0' }}>{underwriting.length} deals</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 0.8fr 1fr 1fr 1fr', gap: 16, padding: '7px 18px', borderBottom: '1px solid rgba(13,27,46,0.04)', background: 'rgba(13,27,46,0.02)', justifyItems: 'center' }}>
                {['Deal', 'Guidance', 'Cap Rate', 'Seller', 'Broker', 'Bid Due'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: '#8A9BB0', letterSpacing: '0.1em', textTransform: 'uppercase' as const, textAlign: 'left' as const }}>{h}</div>
                ))}
              </div>
              <div style={{ overflowY: 'auto' as const, maxHeight: 290 }}>
                {activeDealsList.length === 0 ? (
                  <div style={{ padding: 16, color: '#8A9BB0', fontSize: 12 }}>No underwritten deals</div>
                ) : activeDealsList.map((deal, i) => {
                  const cr = capRateMap[deal.name]
                  const capRate = cr?.noi_cap_rate ? `${Number(cr.noi_cap_rate).toFixed(2)}%` : '—'
                  return (
                    <div key={deal.id} onClick={() => onOpenDeal(deal)}
                      style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 0.8fr 1fr 1fr 1fr', gap: 16, padding: '13px 18px', alignItems: 'center', borderBottom: i < activeDealsList.length - 1 ? '1px solid rgba(13,27,46,0.05)' : 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ overflow: 'hidden', width: '100%' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.name}</div>
                        <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 2 }}>{deal.market ?? ''}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#334155', textAlign: 'center' as const, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{fmtShort(deal.purchase_price)}</div>
                      <div style={{ fontSize: 13, color: capRate !== '—' ? '#0D1B2E' : '#8A9BB0', textAlign: 'center' as const, fontFamily: "'DM Mono',monospace", fontWeight: capRate !== '—' ? 700 : 400 }}>{capRate}</div>
                      <div style={{ fontSize: 13, color: '#8A9BB0', textAlign: 'center' as const, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.seller ?? '—'}</div>
                      <div style={{ fontSize: 13, color: '#8A9BB0', textAlign: 'center' as const, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.broker ?? '—'}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' as const }} className={bidDateClass(deal.bid_due_date)}>{formatBidDate(deal.bid_due_date)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Monthly Deal Flow */}
          <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Pipeline Intelligence</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 700, color: '#0D1B2E' }}>Monthly Deal Flow</div>
            </div>
            <div style={{ fontSize: 11, color: '#8A9BB0', letterSpacing: '0.06em', textAlign: 'right' as const }}>
              <div>12-month rolling · {monthlyFlow.reduce((s,m) => s+m.count, 0)} total deals</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 160 }}>
            {monthlyFlow.map((m) => {
              const BAR_MAX = 130
              const barH = m.count ? Math.max((m.count / maxFlow) * BAR_MAX, 20) : 0
              const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
              return (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', position: 'relative' as const, height: barH, background: '#0D1B2E', borderRadius: '3px 3px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: barH, cursor: 'default', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2E4A6E')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#0D1B2E')}>
                    {/* Deal count */}
                    <div style={{ fontSize: barH > 28 ? 13 : 11, fontWeight: 700, color: '#F5F4EF', fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{m.count}</div>
                    {/* Cap rate — only if bar tall enough */}
                    {m.avgCapRate && barH > 36 && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#C9A84C', fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{m.avgCapRate.toFixed(1)}%</div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#8A9BB0', fontWeight: 400, whiteSpace: 'nowrap' as const, letterSpacing: '0.03em' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#0D1B2E' }} />
              <span style={{ fontSize: 10, color: '#8A9BB0', letterSpacing: '0.05em' }}>DEALS ADDED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 4, borderRadius: 1, background: '#C9A84C' }} />
              <span style={{ fontSize: 10, color: '#8A9BB0', letterSpacing: '0.05em' }}>AVG BOE CAP RATE</span>
            </div>
          </div>
          </div>

        </div>
      </div>



      {/* Broker Leaderboard */}
      <BrokerLeaderboard deals={deals} />

      {/* Status Breakdown */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: '#0D1B2E', marginBottom: 12 }}>Pipeline by Status</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} style={{ background: 'rgba(13,27,46,0.03)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' as const, border: '1px solid rgba(13,27,46,0.06)' }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: '#0D1B2E' }}>{count}</div>
              <div style={{ fontSize: 9, color: '#8A9BB0', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{statusLabel(status)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
