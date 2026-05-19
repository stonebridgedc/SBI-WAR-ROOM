'use client'
import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import type { Deal, BoeData, CapRate } from '@/lib/types'
import { fmtShort, fmtUnit, fmtPct, formatBidDate, bidDateClass, statusClass, statusLabel, getRegion, REGION_LABELS, REGION_MAP, sortDeals, ALL_STATUSES } from '@/lib/utils'
import type { Region } from '@/lib/types'

const PER_PAGE = 100

interface Props {
  deals: Deal[]
  capRateMap: Record<string, CapRate>
  boeMap: Record<string, BoeData>
  onOpenDeal: (d: Deal) => void
  onAddDeal: (d: any) => Promise<any>
}

export default function DealsPage({ deals, capRateMap, boeMap, onOpenDeal, onAddDeal }: Props) {
  const [filters, setFilters] = useState<Set<string>>(new Set(['all']))
  const [regions, setRegions] = useState<Set<string>>(new Set(['all']))
  const [brokers, setBrokers] = useState<Set<string>>(new Set(['all']))
  const [sort, setSort] = useState('modified-desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [newDeal, setNewDeal] = useState({ name: '', street: '', city: '', state: '', zip: '', market: '', units: '', yearBuilt: '', purchasePrice: '', status: '1 - New', broker: '' })
  const [newDealRegion, setNewDealRegion] = useState<Region | ''>('')
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function handleExport() {
    const rows = filtered.map(d => ({
      'Deal Name': d.name,
      'Status': d.status,
      'Market': d.market ?? '',
      'Region': REGION_LABELS[getRegion(d.market)] ?? '',
      'Units': d.units ?? '',
      'Year Built': d.year_built ?? '',
      'Guidance ($)': d.purchase_price ?? '',
      '$/Unit': d.price_per_unit ?? '',
      'Cap Rate': capRateMap[d.name]?.noi_cap_rate ?? capRateMap[d.name]?.broker_cap_rate ?? '',
      'Bid Due Date': d.bid_due_date ?? '',
      'Broker': d.broker ?? '',
      'Seller': d.seller ?? '',
      'Buyer': d.buyer ?? '',
      'Sold Price ($)': d.sold_price ?? '',
      'Address': d.address ?? '',
      'Comments': d.comments ?? '',
      'Added': d.added ?? '',
      'Modified': d.modified ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Deals')
    const statusLabel = filters.has('all') ? 'All' : Array.from(filters).map(f => f.replace(/^\d+ - /, '')).join('+')
    const regionLabel = regions.has('all') ? 'All Regions' : Array.from(regions).map(r => (REGION_LABELS as any)[r] ?? r).join('+')
    const brokerLabel = brokers.has('all') ? '' : ' - ' + Array.from(brokers).join('+')
    const filename = `SBI War Room - ${statusLabel} - ${regionLabel}${brokerLabel}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const filtered = useMemo(() => {
    let d = deals
    if (!filters.has('all')) d = d.filter(x => Array.from(filters).some(f => x.status === f))
    if (!regions.has('all')) d = d.filter(x => regions.has(getRegion(x.market)))
    if (!brokers.has('all')) d = d.filter(x => brokers.has(getBrokerBucket(x.broker)))
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(x => x.name.toLowerCase().includes(q) || x.market?.toLowerCase().includes(q) || x.broker?.toLowerCase().includes(q))
    }
    return sortDeals(d, sort)
  }, [deals, filters, regions, brokers, sort, search])

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  function crCell(deal: Deal) {
    const cr = capRateMap[deal.name]
    const boe = boeMap[deal.name]
    const badge = (boe as any)?.noi_badge ?? 'BOE'

    if (cr?.noi_cap_rate) {
      const pct = Number(cr.noi_cap_rate)
      return (
        <span style={{fontSize:13,fontWeight:600,color:'#0D1B2E'}}>
          {fmtPct(pct)}
          <sup style={{fontSize:7,opacity:.5,marginLeft:1}}>{badge}</sup>
        </span>
      )
    }
    if (cr?.broker_cap_rate) {
      const pct = Number(cr.broker_cap_rate)
      return <span style={{fontSize:13,fontWeight:600,color:'#0D1B2E'}}>{fmtPct(pct)}</span>
    }
    return <span className="cr-none">—</span>
  }

  async function submitAdd() {
    if (!newDeal.name || !newDeal.market) return
    const addressParts = [newDeal.street, newDeal.city, newDeal.state, newDeal.zip].filter(Boolean)
    const address = addressParts.length > 0 ? addressParts.join(', ') : null
    await onAddDeal({
      name: newDeal.name, market: newDeal.market,
      address,
      units: newDeal.units ? parseInt(newDeal.units) : null,
      year_built: newDeal.yearBuilt?.trim() || null,
      purchase_price: newDeal.purchasePrice ? parseFloat(newDeal.purchasePrice) : null,
      price_per_unit: (newDeal.purchasePrice && newDeal.units) ? Math.round(parseFloat(newDeal.purchasePrice) / parseInt(newDeal.units)) : null,
      status: newDeal.status, broker: newDeal.broker || null,
      added: new Date().toISOString().slice(0,10), modified: new Date().toISOString().slice(0,10),
      flagged: false, hot: false,
    })
    setShowAdd(false)
    setNewDeal({ name:'',street:'',city:'',state:'',zip:'',market:'',units:'',yearBuilt:'',purchasePrice:'',status:'1 - New',broker:'' }); setNewDealRegion('')
  }

  const FILTER_CHIPS = [
    { label: 'All', value: 'all' },
    { label: 'Underwritten', value: '0 - Underwritten' },
    { label: 'Active', value: '2 - Active' },
    { label: 'New', value: '1 - New' },
    { label: 'Tracking', value: '1.5 - Tracking' },
    { label: 'Bid Placed', value: '3 - Bid Placed' },
    { label: 'Dormant', value: '5 - Dormant' },
    { label: 'Passed', value: '6 - Passed' },
    { label: 'Lost', value: '7 - Lost' },
    { label: 'Owned', value: '10 - Owned Property' },
    { label: 'Comp', value: '11 - Property Comp' },
  ]
  const REGIONS = ['all','DC','Carolinas','GA','TX','TN','FL','Midwest','Misc']
  const REGION_DISPLAY: Record<string, string> = {
    DC: 'Mid-Atlantic', Carolinas: 'Carolinas', GA: 'Georgia',
    TX: 'Texas', TN: 'Tennessee', FL: 'Florida', Midwest: 'Midwest', Misc: 'Misc',
  }

  const NAMED_BROKERS = ['CBRE', 'Newmark', 'JLL', 'W&D', 'Northmarq', 'C&W', 'Berkadia', 'Eastdil', 'IPA']
  const BROKER_CHIPS = ['all', ...NAMED_BROKERS, 'Misc']

  function getBrokerBucket(broker: string | null | undefined): string {
    if (!broker) return 'Misc'
    const b = broker.trim()
    // Exact or starts-with matches for each named broker
    if (/^CBRE/i.test(b) || /CBRE/i.test(b)) return 'CBRE'
    if (/^Newmark/i.test(b) || /^NGKF/i.test(b) || /NewMark/i.test(b)) return 'Newmark'
    if (/^JLL/i.test(b)) return 'JLL'
    if (/^W&D/i.test(b) || /^Walker.*Dunlop/i.test(b) || /W&D/i.test(b)) return 'W&D'
    if (/^Northmarq/i.test(b) || /^NorthMarq/i.test(b) || /^North Marq/i.test(b)) return 'Northmarq'
    if (/^C&W/i.test(b) || /^Cushman/i.test(b)) return 'C&W'
    if (/^Berkadia/i.test(b)) return 'Berkadia'
    if (/^Eastdil/i.test(b)) return 'Eastdil'
    if (/^IPA/i.test(b) || /^Institutional Property/i.test(b)) return 'IPA'
    return 'Misc'
  }

  return (
    <div style={{ padding: isMobile ? '12px 14px' : '24px 28px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search deals, markets, brokers…"
          style={{ flex: '1 1 260px', padding: '8px 14px', border: '1px solid rgba(13,27,46,0.12)', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
        />
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 12px', border: '1px solid rgba(13,27,46,0.12)', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", background:'#fff' }}>
          <option value="modified-desc">Recently Modified</option>
          <option value="biddate-asc">Bid Date (Soonest)</option>
          <option value="price-desc">Price (High–Low)</option>
          <option value="price-asc">Price (Low–High)</option>
          <option value="units-desc">Units (Most)</option>
          <option value="name-asc">Name A–Z</option>
          <option value="location-asc">Location A–Z</option>
          <option value="added-desc">Date Added (Newest)</option>
          <option value="added-asc">Date Added (Oldest)</option>
        </select>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', background: '#0D1B2E', color: '#F0B429', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'DM Sans',sans-serif" }}>
          + Add Deal
        </button>
        <button onClick={handleExport} title={`Export ${filtered.length} deals to Excel`} style={{ padding: '8px 16px', background: '#fff', color: '#0D1B2E', border: '1px solid rgba(13,27,46,0.15)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: "'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
          ↓ Export ({filtered.length})
        </button>
      </div>

      {/* Broker chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', marginBottom: isMobile ? 6 : 16, paddingBottom: isMobile ? 2 : 0 }}>
        {BROKER_CHIPS.map(b => {
          const active = b === 'all' ? brokers.has('all') : brokers.has(b)
          return (
            <button key={b} onClick={() => {
              setPage(1)
              if (b === 'all') { setBrokers(new Set(['all'])); return }
              setBrokers(prev => {
                const next = new Set(prev)
                next.delete('all')
                if (next.has(b)) { next.delete(b); if (next.size === 0) next.add('all') }
                else next.add(b)
                return next
              })
            }} style={{
              padding: '3px 10px', borderRadius: 16, border: '1px solid',
              borderColor: active ? '#2E6B9E' : 'rgba(13,27,46,0.1)',
              background: active ? 'rgba(46,107,158,0.1)' : 'transparent',
              color: active ? '#2E6B9E' : '#8A9BB0',
              fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
            }}>{b === 'all' ? 'All Brokers' : b}</button>
          )
        })}
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', marginBottom: 8, paddingBottom: isMobile ? 2 : 0 }}>
        {FILTER_CHIPS.map(c => {
          const active = c.value === 'all' ? filters.has('all') : filters.has(c.value)
          return (
            <button key={c.value} onClick={() => {
              setPage(1)
              if (c.value === 'all') { setFilters(new Set(['all'])); return }
              setFilters(prev => {
                const next = new Set(prev)
                next.delete('all')
                if (next.has(c.value)) { next.delete(c.value); if (next.size === 0) next.add('all') }
                else next.add(c.value)
                return next
              })
            }} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid',
              borderColor: active ? '#0D1B2E' : 'rgba(13,27,46,0.15)',
              background: active ? '#0D1B2E' : '#fff',
              color: active ? '#F0B429' : '#8A9BB0',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
            }}>{c.label}</button>
          )
        })}
      </div>

      {/* Region chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', marginBottom: isMobile ? 6 : 16, paddingBottom: isMobile ? 2 : 0 }}>
        {REGIONS.map(r => {
          const active = r === 'all' ? regions.has('all') : regions.has(r)
          return (
            <button key={r} onClick={() => {
              setPage(1)
              if (r === 'all') { setRegions(new Set(['all'])); return }
              setRegions(prev => {
                const next = new Set(prev)
                next.delete('all')
                if (next.has(r)) { next.delete(r); if (next.size === 0) next.add('all') }
                else next.add(r)
                return next
              })
            }} style={{
              padding: '3px 10px', borderRadius: 16, border: '1px solid',
              borderColor: active ? '#C9A84C' : 'rgba(13,27,46,0.1)',
              background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
              color: active ? '#8A6500' : '#8A9BB0',
              fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif"
            }}>{r === 'all' ? 'All Regions' : REGION_DISPLAY[r] || r}</button>
          )
        })}
      </div>


      {/* Mobile card view — 2-col portrait grid */}
      {isMobile && (
        <div>
          {paginated.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#8A9BB0', fontSize:13 }}>No deals match your filters</div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {paginated.map(deal => {
              const sc = statusClass(deal.status)
              const sl = statusLabel(deal.status)
              const cr = capRateMap[deal.name]
              const crVal = cr?.noi_cap_rate || cr?.broker_cap_rate
              const boe = boeMap[deal.name]
              const badge = (boe as any)?.noi_badge ?? 'BOE'
              const bidClass = bidDateClass(deal.bid_due_date)
              const isUrgent = bidClass.includes('red')
              const statusColor = sc==='s-bid' ? '#6d28d9' : sc==='s-new' ? '#b87200' : sc==='s-active' ? '#2E7D50' : sc==='s-owned' ? '#0070C0' : '#8A9BB0'
              const statusBg = sc==='s-bid' ? 'rgba(124,58,237,0.1)' : sc==='s-new' ? 'rgba(240,180,41,0.15)' : sc==='s-active' ? 'rgba(46,125,80,0.1)' : sc==='s-owned' ? 'rgba(0,112,192,0.1)' : 'rgba(13,27,46,0.06)'
              return (
                <div key={deal.id} onClick={() => onOpenDeal(deal)}
                  style={{ background:'#fff', borderRadius:10, border:'1px solid rgba(13,27,46,0.08)', overflow:'hidden', cursor:'pointer', display:'flex', alignItems:'stretch' }}>
                  {/* Left color bar = status */}
                  <div style={{ width:4, background:statusColor, flexShrink:0 }} />
                  {/* Name + badge */}
                  <div style={{ padding:'8px 10px', flex:'0 0 38%', minWidth:0, borderRight:'1px solid rgba(13,27,46,0.06)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#0D1B2E', lineHeight:1.3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deal.name}</div>
                    <div style={{ fontSize:9, color:'#8A9BB0', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deal.market}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 5px', borderRadius:5, fontSize:8, fontWeight:700, background:statusBg, color:statusColor, alignSelf:'flex-start' }}>
                      <span style={{ width:4, height:4, borderRadius:'50%', background:'currentColor' }}/>{sl}
                    </div>
                  </div>
                  {/* Stats — 5 across */}
                  <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(5,1fr)' }}>
                    {[
                      { label:'Price',    val:fmtShort(deal.purchase_price), color:'#0D1B2E' },
                      { label:'$/Unit',   val:fmtUnit(deal.price_per_unit),  color:'#0D1B2E' },
                      { label:'Yr Built', val:deal.year_built ?? '—',        color:'#0D1B2E' },
                      { label:'Cap',      val:crVal ? `${Number(crVal).toFixed(2)}%` : '—', color:crVal?'#C9A84C':'#8A9BB0' },
                      { label:'Bid Due',  val:deal.bid_due_date ? formatBidDate(deal.bid_due_date) : '—', color:'#0D1B2E', cls:bidClass },
                    ].map((st,i) => (
                      <div key={st.label} style={{ padding:'6px 6px', borderRight: i<4 ? '1px solid rgba(13,27,46,0.05)' : 'none', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                        <div style={{ fontSize:7, fontWeight:700, color:'#8A9BB0', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:2 }}>{st.label}</div>
                        <div className={st.cls||''} style={{ fontSize:10, fontWeight:700, color:st.cls?undefined:st.color, lineHeight:1.2 }}>{st.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table — desktop only */}
      <div style={{ display: isMobile ? 'none' : 'block', background: '#fff', border: '1px solid rgba(13,27,46,0.08)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0D1B2E' }}>
                {['Deal Name','Status','Units','Year','Guidance','$/Unit','Cap Rate','Bid Date','Seller','Buyer','Sold Price','+/− Guidance'].map((h, i) => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F0B429', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(deal => {
                const sc = statusClass(deal.status)
                const sl = statusLabel(deal.status)
                const reg = getRegion(deal.market)
                const guidanceDiff = deal.sold_price && deal.purchase_price ? deal.sold_price - deal.purchase_price : null
                return (
                  <tr key={deal.id} onClick={() => onOpenDeal(deal)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(13,27,46,0.05)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0D1B2E', maxWidth: 220 }}>
                      {deal.name}
                      <small style={{ display: 'block', fontSize: 12, color: '#8A9BB0', fontWeight: 400, marginTop: 1 }}>
                        {deal.market}
                        {reg !== 'Misc' && <span style={{ marginLeft: 4, background: 'rgba(13,27,46,0.06)', color: '#8A9BB0', fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3 }}>{REGION_LABELS[reg]}</span>}
                        {deal.broker && (deal.status.includes('0 -') || deal.status.includes('1 -') || deal.status.includes('1.5 -') || deal.status.includes('2 -') || deal.status.includes('3 -')) && (
                          <span style={{ marginLeft: 4, background: 'rgba(240,151,10,0.12)', color: '#b87200', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>{deal.broker}</span>
                        )}
                      </small>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`status-badge ${sc}`} style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:12,fontSize:12,fontWeight:600,whiteSpace:'nowrap',
                        ...(sc === 's-bid' ? { background:'rgba(124,58,237,0.1)', color:'#6d28d9' } : {}) }}>
                        <span style={{ width:6,height:6,borderRadius:'50%',background:'currentColor',opacity:.7 }}/>
                        {sl}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{deal.units?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{deal.year_built ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtShort(deal.purchase_price)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmtUnit(deal.price_per_unit)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>{crCell(deal)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, whiteSpace: 'nowrap', textAlign: 'center' }} className={bidDateClass(deal.bid_due_date)}>{formatBidDate(deal.bid_due_date)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, color: '#8A9BB0', textAlign: 'center' }}>{deal.seller || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, color: '#8A9BB0', textAlign: 'center' }}>{deal.buyer || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{deal.sold_price ? fmtShort(deal.sold_price) : '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {guidanceDiff !== null ? (
                        <span className={guidanceDiff > 0 ? 'guidance-pos' : guidanceDiff < 0 ? 'guidance-neg' : 'guidance-zero'}>
                          {guidanceDiff >= 0 ? '+' : ''}{fmtShort(guidanceDiff)}
                          <small style={{ display: 'block', fontSize: 9, fontWeight: 400 }}>
                            {guidanceDiff >= 0 ? '+' : ''}{((guidanceDiff / deal.purchase_price!) * 100).toFixed(1)}%
                          </small>
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: '#8A9BB0' }}>Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length} deals</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => (
            <button key={i+1} onClick={() => setPage(i+1)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', borderColor: page===i+1 ? '#0D1B2E' : 'rgba(13,27,46,0.15)', background: page===i+1 ? '#0D1B2E' : '#fff', color: page===i+1 ? '#F0B429' : '#8A9BB0', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{i+1}</button>
          ))}
          {totalPages > 7 && <>
            <span style={{ padding: '5px 4px', color: '#8A9BB0' }}>…</span>
            <button onClick={() => setPage(totalPages)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(13,27,46,0.15)', background: '#fff', color: '#8A9BB0', fontSize: 12, cursor: 'pointer' }}>{totalPages}</button>
          </>}
        </div>
      </div>

      {/* Add Deal Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(false)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: 480, maxWidth: '94vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: '#0D1B2E', marginBottom: 24 }}>Add New Deal</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Deal Name */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Deal Name</label>
                <input type="text" value={newDeal.name} onChange={e => setNewDeal(p => ({ ...p, name: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
              </div>
              {/* Address */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Street Address</label>
                <input type="text" value={newDeal.street} onChange={e => setNewDeal(p => ({ ...p, street: e.target.value }))}
                  placeholder="123 Main St"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>City</label>
                <input type="text" value={newDeal.city} onChange={e => setNewDeal(p => ({ ...p, city: e.target.value }))}
                  placeholder="Tampa"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>State</label>
                <select value={newDeal.state} onChange={e => setNewDeal(p => ({ ...p, state: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", background:'#fff', color: newDeal.state ? '#0D1B2E' : '#8A9BB0' }}>
                  <option value="">State…</option>
                  {['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Zip Code</label>
                <input type="text" value={newDeal.zip} onChange={e => setNewDeal(p => ({ ...p, zip: e.target.value }))}
                  placeholder="33601"
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
              </div>
              {/* Region → Market two-level dropdown */}
              <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Region</label>
                  <select
                    value={newDealRegion}
                    onChange={e => { setNewDealRegion(e.target.value as Region | 'Misc'); setNewDeal(p => ({ ...p, market: '' })) }}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", background:'#fff', color: newDealRegion ? '#0D1B2E' : '#8A9BB0' }}>
                    <option value="">Select region…</option>
                    {(Object.keys(REGION_MAP) as Region[]).filter(r => r !== 'Misc').map(r => (
                      <option key={r} value={r}>{REGION_LABELS[r]}</option>
                    ))}
                    <option value="Misc">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Market</label>
                  {newDealRegion === 'Misc' ? (
                    <input
                      type="text"
                      value={newDeal.market}
                      onChange={e => setNewDeal(p => ({ ...p, market: e.target.value }))}
                      placeholder="Type market name…"
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
                  ) : (
                    <select
                      value={newDeal.market}
                      onChange={e => setNewDeal(p => ({ ...p, market: e.target.value }))}
                      disabled={!newDealRegion}
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", background: newDealRegion ? '#fff' : '#f5f5f5', color: newDeal.market ? '#0D1B2E' : '#8A9BB0' }}>
                      <option value="">{newDealRegion ? 'Select market…' : '— pick region first —'}</option>
                      {newDealRegion === 'DC' && (<>
                        <option value="Washington, DC">Washington, DC</option>
                        <option value="Suburban Maryland">Suburban Maryland</option>
                        <option value="Northern Virginia">Northern Virginia</option>
                        <option value="Richmond, VA">Richmond, VA</option>
                        <option value="Charlottesville, VA">Charlottesville, VA</option>
                        <option value="Virginia Beach, VA">Virginia Beach, VA</option>
                        <option value="Misc - Mid-Atlantic">Misc</option>
                      </>)}
                      {newDealRegion === 'Carolinas' && (<>
                        <option value="Charlotte, NC">Charlotte, NC</option>
                        <option value="Raleigh/Durham, NC">Raleigh/Durham, NC</option>
                        <option value="Greensboro/Winston-Salem, NC">Greensboro/Winston-Salem, NC</option>
                        <option value="Wilmington, NC">Wilmington, NC</option>
                        <option value="Charleston, SC">Charleston, SC</option>
                        <option value="Greenville, SC">Greenville, SC</option>
                        <option value="Misc - Carolinas">Misc</option>
                      </>)}
                      {newDealRegion === 'GA' && (<>
                        <option value="Atlanta, GA">Atlanta, GA</option>
                        <option value="Savannah, GA">Savannah, GA</option>
                        <option value="Misc - Georgia">Misc</option>
                      </>)}
                      {newDealRegion === 'TX' && (<>
                        <option value="Dallas, TX">Dallas, TX</option>
                        <option value="Houston, TX">Houston, TX</option>
                        <option value="Austin, TX">Austin, TX</option>
                        <option value="San Antonio, TX">San Antonio, TX</option>
                        <option value="Misc - Texas">Misc</option>
                      </>)}
                      {newDealRegion === 'TN' && (<>
                        <option value="Nashville, TN">Nashville, TN</option>
                        <option value="Misc - Tennessee">Misc</option>
                      </>)}
                      {newDealRegion === 'FL' && (<>
                        <option value="Jacksonville, FL">Jacksonville, FL</option>
                        <option value="Orlando, FL">Orlando, FL</option>
                        <option value="Tampa, FL">Tampa, FL</option>
                        <option value="South Florida">South Florida</option>
                        <option value="Naples/Fort Myers, FL">Naples/Fort Myers, FL</option>
                        <option value="Misc - Florida">Misc</option>
                      </>)}
                    {newDealRegion === 'Midwest' && (<>
                      <option value="Chicago, IL">Chicago, IL</option>
                      <option value="Indianapolis, IN">Indianapolis, IN</option>
                      <option value="Minneapolis, MN">Minneapolis, MN</option>
                      <option value="Kansas City, MO">Kansas City, MO</option>
                      <option value="Cincinnati, OH">Cincinnati, OH</option>
                      <option value="Misc - Midwest">Misc</option>
                      <option value="__custom__">Other (type below)…</option>
                    </>)}
                    </select>
                  )}
                  {newDeal.market === '__custom__' && (
                    <input
                      type="text"
                      placeholder="Type market name…"
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", marginTop: 6 }}
                      onChange={e => setNewDeal(p => ({ ...p, market: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              {/* Rest of fields */}
              {[
                { label:'Units', key:'units', type:'number' },
                { label:'Year Built', key:'yearBuilt', type:'number' },
                { label:'Purchase Price ($)', key:'purchasePrice', type:'number' },
                { label:'Broker', key:'broker' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>{f.label}</label>
                  <input type={f.type || 'text'} value={(newDeal as any)[f.key]} onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:600, color:'#8A9BB0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Status</label>
                <select value={newDeal.status} onChange={e => setNewDeal(p => ({ ...p, status: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(13,27,46,0.12)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif", background:'#fff' }}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding:'8px 20px', border:'1px solid rgba(13,27,46,0.15)', borderRadius:8, background:'#fff', color:'#8A9BB0', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={submitAdd} style={{ padding:'8px 20px', background:'#0D1B2E', color:'#F0B429', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Save Deal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
