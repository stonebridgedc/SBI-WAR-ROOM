'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Deal, BoeData, CapRate } from '@/lib/types'
import DealsPage from './deals/DealsPage'
import DealModal from './deals/DealModal'
import DashboardPage from './dashboard/DashboardPage'
import PipelinePage from './pipeline/PipelinePage'
import CapRatesPage from './caprates/CapRatesPage'
import BrokersPage from './brokers/BrokersPage'
import AnalyticsPage from './analytics/AnalyticsPage'
import dynamic from 'next/dynamic'

const DealsMap = dynamic(() => import('./dashboard/DealsMap'), { ssr: false })

type Page = 'dashboard' | 'deals' | 'pipeline' | 'analytics' | 'map' | 'team' | 'caprates' | 'upload' | 'brokers'

interface Props {
  initialDeals: Deal[]
  initialBoeData: BoeData[]
  initialCapRates: CapRate[]
  userEmail: string
  loadAllDeals?: boolean
}

export default function WarRoom({ initialDeals, initialBoeData, initialCapRates, userEmail, loadAllDeals }: Props) {
  const supabase = createClient()
  const [page, setPage] = useState<Page>('deals')
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [resolvedEmail, setResolvedEmail] = useState(userEmail)
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [boeMap, setBoeMap] = useState<Record<string, BoeData>>(
    Object.fromEntries(initialBoeData.map(b => [b.deal_name, b]))
  )
  const [capRateMap, setCapRateMap] = useState<Record<string, CapRate>>(
    Object.fromEntries(initialCapRates.map(c => [c.deal_name, c]))
  )
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [allDealsLoaded, setAllDealsLoaded] = useState(!loadAllDeals)
  const [loadingAll, setLoadingAll] = useState(false)

  // Real-time subscription to deals
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('deals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, payload => {
        if (payload.eventType === 'INSERT') {
          setDeals(prev => [payload.new as Deal, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setDeals(prev => prev.map(d => d.name === (payload.new as Deal).name ? payload.new as Deal : d))
        } else if (payload.eventType === 'DELETE') {
          setDeals(prev => prev.filter(d => d.id !== (payload.old as Deal).id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boe_data' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const b = payload.new as BoeData
          setBoeMap(prev => ({ ...prev, [b.deal_name]: b }))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cap_rates' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const c = payload.new as CapRate
          setCapRateMap(prev => ({ ...prev, [c.deal_name]: c }))
        } else if (payload.eventType === 'DELETE') {
          const c = payload.old as CapRate
          setCapRateMap(prev => { const n = { ...prev }; delete n[c.deal_name]; return n })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Client-side data fetch — runs after auth confirmed
  useEffect(() => {
    if (!loadAllDeals) return
    async function loadData() {
      setLoadingAll(true)
      const sb = createClient()

      // Get email from sb_auth cookie (set by MSAL portal)
      const match = document.cookie.match(/sb_auth=([^;]+)/)
      if (match) {
        try {
          const payload = JSON.parse(atob(match[1].split('.')[1]))
          setResolvedEmail(payload.email ?? payload.preferred_username ?? '')
        } catch {}
      }

      // Round 1: active deals fast
      const { data: active, error: e1 } = await sb.from('deals')
        .select('*')
        .order('modified', { ascending: false })
        .range(0, 999)
      if (active && active.length > 0) {
        setDeals(active)
        setLoadingAll(false)
      }

      // Round 2: fetch ALL deals in pages of 1000
      let allDeals: any[] = []
      let page = 0
      while (true) {
        const { data: page_data } = await sb.from('deals')
          .select('*')
          .order('modified', { ascending: false })
          .range(page * 1000, (page + 1) * 1000 - 1)
        if (!page_data || page_data.length === 0) break
        allDeals = [...allDeals, ...page_data]
        if (page_data.length < 1000) break
        page++
      }

      const [boeRes, crRes] = await Promise.all([
        sb.from('boe_data').select('*'),
        sb.from('cap_rates').select('*'),
      ])
      if (allDeals.length > 0) {
        setDeals(allDeals)
        setAllDealsLoaded(true)
      }
      if (boeRes.data) setBoeMap(Object.fromEntries(boeRes.data.map((b: any) => [b.deal_name, b])))
      if (crRes.data)  setCapRateMap(Object.fromEntries(crRes.data.map((c: any) => [c.deal_name, c])))
      setLoadingAll(false)
    }
    loadData()
  }, [loadAllDeals])

  const refreshDeals = useCallback(async () => {
    const sb = createClient()
    const [dealsRes, boeRes, crRes] = await Promise.all([
      sb.from('deals').select('*').order('modified', { ascending: false }).limit(2500),
      sb.from('boe_data').select('*'),
      sb.from('cap_rates').select('*'),
    ])
    if (dealsRes.data && dealsRes.data.length > 0) setDeals(dealsRes.data)
    if (boeRes.data) setBoeMap(Object.fromEntries(boeRes.data.map((b: any) => [b.deal_name, b])))
    if (crRes.data)  setCapRateMap(Object.fromEntries(crRes.data.map((c: any) => [c.deal_name, c])))
  }, [])

  const saveDeal = useCallback(async (updates: Partial<Deal> & { name: string; id?: string }) => {
    const res = await fetch('/api/deals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const text = await res.text()
    if (!text) { console.error('saveDeal: empty response', res.status); return }
    const data = JSON.parse(text)
    if (!res.ok) { console.error('saveDeal error:', data); return }
    const updated: Deal = data
    setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))
    if (selectedDeal?.id === updated.id) setSelectedDeal(updated)
    return updated
  }, [selectedDeal])

  const addDeal = useCallback(async (deal: Omit<Deal, 'id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deal),
    })
    if (res.ok) {
      const created: Deal = await res.json()
      setDeals(prev => [created, ...prev])
      return created
    }
  }, [])

  const saveBoe = useCallback(async (boe: BoeData) => {
    const res = await fetch('/api/boe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boe),
    })
    if (res.ok) {
      const saved: BoeData = await res.json()
      const merged = { ...boe, ...saved, t12: saved.t12 ?? boe.t12, adjs: saved.adjs ?? boe.adjs, payroll: saved.payroll ?? boe.payroll, rmi: saved.rmi ?? boe.rmi, tax_helper: saved.tax_helper ?? boe.tax_helper, notes: saved.notes ?? boe.notes, noi_badge: boe.noi_badge, pf_noi_override: boe.pf_noi_override }
      setBoeMap(prev => ({ ...prev, [merged.deal_name]: merged }))

      // Auto-save cap rate whenever BOE is saved with a PF NOI override
      // This ensures the cap rate tracker always reflects the manual NOI entry
      const deal = deals.find(d => d.name === boe.deal_name)
      if (deal?.purchase_price && boe.pf_noi_override) {
        const pfNoi = Number(boe.pf_noi_override)
        const pp = deal.purchase_price
        if (pfNoi > 0 && pp > 0) {
          const capAdj = (pfNoi / pp) * 100
          await fetch('/api/cap-rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deal_name: boe.deal_name,
              noi_cap_rate: capAdj,
              broker_cap_rate: null,
              purchase_price: pp / 1000,
              sold_price: deal.sold_price ? deal.sold_price / 1000 : null,
              delta: deal.sold_price && pp > 0 ? (deal.sold_price - pp) / pp : null,
            }),
          })
        }
      }

      // Refresh cap rates
      setTimeout(async () => {
        const crRes = await fetch('/api/cap-rates')
        if (crRes.ok) {
          const crData = await crRes.json()
          if (Array.isArray(crData)) setCapRateMap(Object.fromEntries(crData.map((c: any) => [c.deal_name, c])))
        }
      }, 800)
      return merged
    }
  }, [deals])

  const saveCapRateFromBoe = useCallback(async (dealName: string, capAdj: number) => {
    const deal = deals.find(d => d.name === dealName)
    if (!deal?.purchase_price) return
    const pp = deal.purchase_price
    const res = await fetch('/api/cap-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_name: dealName,
        noi_cap_rate: capAdj / 100,
        broker_cap_rate: null,
        purchase_price: pp / 1000,
        sold_price: deal.sold_price ? deal.sold_price / 1000 : null,
        delta: deal.sold_price && pp > 0 ? (deal.sold_price - pp) / pp : null,
      }),
    })
    if (res.ok) {
      const cr = await res.json()
      setCapRateMap(prev => ({ ...prev, [cr.deal_name]: cr }))
    }
  }, [deals])

  const saveCapRate = useCallback(async (cr: CapRate) => {
    const res = await fetch('/api/cap-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cr),
    })
    if (res.ok) {
      const saved: CapRate = await res.json()
      setCapRateMap(prev => ({ ...prev, [saved.deal_name]: saved }))
      return saved
    }
  }, [])

  async function handleSignOut() {
    window.location.href = 'https://platform.stonebridgeinvestments.com'
  }

  // Status counts for badges
  const statusCounts = deals.reduce((acc: Record<string, number>, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {})

  const activePipelineCount = (statusCounts['0 - Underwriting'] ?? 0) + (statusCounts['1 - New'] ?? 0) + (statusCounts['2 - Active'] ?? 0) + (statusCounts['1.5 - Tracking'] ?? 0)

    { id: 'dashboard', label: 'Dashboard', icon: <GridIcon /> },
    { id: 'deals', label: 'Deals', icon: <ListIcon />, badgeKey: 'activePipeline' },
    { id: 'pipeline', label: 'Pipeline', icon: <PipeIcon />, badgeKey: '2 - Active' },
    { id: 'analytics',  label: 'Analytics',        icon: <ChartIcon /> },
    { id: 'map',        label: 'Market Map',       icon: <MapIcon /> },
    { id: 'caprates',   label: 'Cap Rate Tracker', icon: <CapIcon /> },
    { id: 'brokers',  label: 'Brokers',          icon: <BrokerIcon /> },
    { id: 'upload', label: 'Upload Pipeline', icon: <UploadIcon /> },
  ]

  if (deals.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0D1B2E', flexDirection:'column', gap:16 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:'#C9A84C', letterSpacing:'0.08em' }}>STONEBRIDGE</div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', letterSpacing:'0.12em', textTransform:'uppercase' }}>Loading War Room…</div>
        <div style={{ width:200, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, marginTop:8, overflow:'hidden' }}>
          <div style={{ width:'40%', height:'100%', background:'#C9A84C', borderRadius:2 }}/>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F4EF', fontFamily: "'DM Sans',sans-serif" }}>
      {/* Mobile menu overlay */}
      {isMobile && showMobileNav && (
        <div onClick={() => setShowMobileNav(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ position:'absolute', top:0, left:0, width:240, height:'100%', background:'#0D1B2E', display:'flex', flexDirection:'column', boxShadow:'4px 0 20px rgba(0,0,0,0.3)' }}>
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(201,168,76,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", color:'#C9A84C', fontSize:15, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' }}>StoneBridge</div>
              <button onClick={() => setShowMobileNav(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:20, cursor:'pointer', padding:'0 4px' }}>✕</button>
            </div>
            <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
              {NAV.map(n => (
                <button key={n.id} onClick={() => { setPage(n.id); setShowMobileNav(false) }} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:10,
                  padding:'12px 20px', border:'none',
                  background: page===n.id ? 'rgba(201,168,76,0.12)' : 'transparent',
                  borderLeft: page===n.id ? '3px solid #C9A84C' : '3px solid transparent',
                  color: page===n.id ? '#F0B429' : 'rgba(255,255,255,0.55)',
                  fontSize:14, fontWeight: page===n.id ? 600 : 400, cursor:'pointer',
                  fontFamily:"'DM Sans',sans-serif", textAlign:'left'
                }}>
                  <span style={{ opacity: page===n.id ? 1 : 0.6 }}>{n.icon}</span>
                  <span style={{ flex:1 }}>{n.label}</span>
                  {n.badgeKey && (n.badgeKey === 'activePipeline' ? activePipelineCount : (statusCounts[n.badgeKey] ?? 0)) > 0 && (
                    <span style={{ background:'#C9A84C', color:'#0D1B2E', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                      {n.badgeKey === 'activePipeline' ? activePipelineCount : statusCounts[n.badgeKey]}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar — desktop only */}
      <aside style={{
        width: isMobile ? 0 : 220, background: '#0D1B2E', display: isMobile ? 'none' : 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'relative', zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <img
              src="https://www.stonebridgeinvestments.com/wp-content/themes/stonebridge/img/menu/logoyellow.svg"
              alt="StoneBridge"
              style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", color: '#C9A84C', fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.1 }}>StoneBridge</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>Investments</div>
            </div>
          </div>
          <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Acquisitions War Room</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', border: 'none', background: page === n.id ? 'rgba(201,168,76,0.12)' : 'transparent',
              borderLeft: page === n.id ? '3px solid #C9A84C' : '3px solid transparent',
              color: page === n.id ? '#F0B429' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: page === n.id ? 600 : 400, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif", textAlign: 'left', transition: 'all .15s'
            }}>
              <span style={{ opacity: page === n.id ? 1 : 0.6 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badgeKey && (n.badgeKey === 'activePipeline' ? activePipelineCount : (statusCounts[n.badgeKey] ?? 0)) > 0 && (
                <span style={{ background: '#C9A84C', color: '#0D1B2E', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  {n.badgeKey === 'activePipeline' ? activePipelineCount : statusCounts[n.badgeKey]}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: '0.05em' }}>Signed in as</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resolvedEmail}</div>
          <button onClick={handleSignOut} style={{
            width: '100%', padding: '7px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.05em'
          }}>Sign Out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          height: 52, background: '#fff', borderBottom: '3px solid #C9A84C',
          display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0
        }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: '#0D1B2E', letterSpacing: '0.04em', flex: 1 }}>
            {({ dashboard: 'Deal Dashboard', deals: 'Deals', pipeline: 'Pipeline', analytics: 'Analytics', map: 'Market Map', team: 'Our Team', caprates: 'Cap Rate Tracker', upload: 'Upload Pipeline', brokers: 'Brokers' } as any)[page]}
          </h1>
          <div style={{ fontSize: 12, color: '#8A9BB0', display:'flex', alignItems:'center', gap:8 }}>
            {loadingAll && <span style={{ fontSize:10, color:'#C9A84C', fontWeight:600, letterSpacing:'0.05em' }}>● Loading all deals…</span>}
            {deals.length.toLocaleString()} deals{!allDealsLoaded ? ' (active)' : ''}
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: page === 'map' ? 'hidden' : 'auto' }}>
          {page === 'dashboard' && (
            <DashboardPage deals={deals} capRateMap={capRateMap} boeMap={boeMap} onOpenDeal={setSelectedDeal} />
          )}
          {page === 'deals' && (
            <DealsPage deals={deals} capRateMap={capRateMap} boeMap={boeMap} onOpenDeal={setSelectedDeal} onAddDeal={addDeal} />
          )}
          {page === 'pipeline' && (
            <PipelinePage deals={deals} onOpenDeal={setSelectedDeal} onSaveDeal={saveDeal} />
          )}
          {page === 'analytics' && (
            <AnalyticsPage deals={deals} boeMap={boeMap} capRateMap={capRateMap} onOpenDeal={setSelectedDeal} />
          )}
          {page === 'map' && (
            <div style={{ height: '100%' }}>
              <DealsMap deals={deals} onOpenDeal={setSelectedDeal} />
            </div>
          )}
          {page === 'brokers' && (
            <BrokersPage />
          )}
          {page === 'caprates' && (
            <CapRatesPage capRateMap={capRateMap} deals={deals} onSave={saveCapRate} />
          )}
          {page === 'upload' && (
            <UploadPipelinePage onDealsImported={refreshDeals} addDeal={addDeal} />
          )}
        </div>
      </main>

      {/* Deal Modal */}
      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          boe={boeMap[selectedDeal.name] ?? null}
          capRate={capRateMap[selectedDeal.name] ?? null}
          onClose={() => setSelectedDeal(null)}
          onSave={saveDeal}
          onSaveBoe={saveBoe}
          onSaveCapRate={saveCapRateFromBoe}
        />
      )}
    </div>
  )
}

// Icons
function GridIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function ListIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }
function PipeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/></svg> }
function ChartIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function BrokerIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function MapIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> }
function CapIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
function UploadIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> }

// Upload Pipeline Page
function UploadPipelinePage({ onDealsImported, addDeal }: { onDealsImported: () => void, addDeal: (deal: any) => Promise<any> }) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'preview' | 'importing' | 'done'>('idle')
  const [preview, setPreview] = useState<any[]>([])
  const [imported, setImported] = useState(0)
  const [insertedCount, setInsertedCount] = useState(0)
  const [updatedCount, setUpdatedCount] = useState(0)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('parsing')
    setError('')
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const ws = wb.Sheets['Deal Log'] ?? wb.Sheets[wb.SheetNames[0]]
      // Find the header row — look for row containing 'Deal Name'
      const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const headerRowIdx = allRows.findIndex(r => r.some((c: any) => String(c).trim() === 'Deal Name'))
      if (headerRowIdx < 0) throw new Error('Could not find Deal Name column in file')
      const headers: string[] = allRows[headerRowIdx].map((c: any) => String(c).trim())
      const dataRows = allRows.slice(headerRowIdx + 1)

      const col = (r: any[], name: string) => {
        const idx = headers.indexOf(name)
        return idx >= 0 ? r[idx] : ''
      }
      const parseDate = (v: any): string | null => {
        if (!v) return null
        // Handle Excel serial numbers (SheetJS returns dates as numbers e.g. 46462)
        if (typeof v === 'number') {
          const d = new Date(Math.round((v - 25569) * 86400 * 1000))
          return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
        }
        const d = new Date(v)
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
      }

      const deals = dataRows.map((r: any[]) => {
        const name = String(col(r, 'Deal Name') || '').trim()
        const status = String(col(r, 'Status') || '1 - New').trim()
        return {
          name,
          status,
          market: String(col(r, 'Market') || '').trim(),
          units: parseInt(String(col(r, 'Units'))) || null,
          year_built: parseInt(String(col(r, 'Year Built'))) || null,
          purchase_price: parseFloat(String(col(r, 'Purchase Price') || '').replace(/[,$]/g, '')) || null,
          price_per_unit: parseFloat(String(col(r, '$ / Unit') || '').replace(/[,$]/g, '')) || null,
          bid_due_date: parseDate(col(r, 'Bid Due Date')),
          comments: String(col(r, 'Comments') || '').trim() || null,
          broker: String(col(r, 'Broker') || '').trim() || null,
          address: String(col(r, 'Address') || '').trim() || null,
          added: parseDate(col(r, 'Added')) ?? new Date().toISOString().split('T')[0],
          modified: new Date().toISOString().split('T')[0],
        }
      }).filter(d => d.name && !['6','7','8','9'].some(n => d.status.startsWith(n + ' -')))

      setPreview(deals)
      setStatus('preview')
    } catch (err: any) {
      setError('Failed to parse file: ' + err.message)
      setStatus('idle')
    }
  }

  async function handleImport() {
    setStatus('importing')
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _batch: true, deals: preview }),
      })
      if (res.ok) {
        const result = await res.json()
        setInsertedCount(result.inserted ?? 0)
        setUpdatedCount(result.updated ?? 0)
        setImported((result.inserted ?? 0) + (result.updated ?? 0))
        onDealsImported()
      }
    } catch {}
    setStatus('done')
  }

  const cardStyle = { background: '#fff', borderRadius: 12, padding: 32, border: '1px solid rgba(13,27,46,0.08)' }
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#8A9BB0', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: '#0D1B2E' }}>Upload Pipeline from Rediq</div>
        <div style={{ fontSize: 13, color: '#8A9BB0', marginTop: 4 }}>Drop your latest Deal Log Excel file to import new deals into the War Room</div>
      </div>

      {status === 'idle' || status === 'parsing' ? (
        <div style={cardStyle}>
          <label style={{ display: 'block', border: '2px dashed rgba(13,27,46,0.15)', borderRadius: 10, padding: '48px 32px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(13,27,46,0.15)')}>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', marginBottom: 6 }}>
              {status === 'parsing' ? 'Parsing file…' : 'Drop your Rediq Deal Log here'}
            </div>
            <div style={{ fontSize: 12, color: '#8A9BB0' }}>Supports .xlsx and .xls files from Rediq</div>
          </label>
          {error && <div style={{ marginTop: 12, color: '#C0392B', fontSize: 13 }}>{error}</div>}
        </div>
      ) : status === 'preview' ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2E' }}>{preview.length} deals found</div>
              <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 2 }}>Review before importing</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStatus('idle')} style={{ padding: '8px 18px', border: '1px solid rgba(13,27,46,0.15)', borderRadius: 7, background: '#fff', color: '#8A9BB0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleImport} style={{ padding: '8px 18px', background: '#0D1B2E', color: '#F0B429', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Import {preview.length} Deals →
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0D1B2E' }}>
                  {['Deal Name', 'Status', 'Market', 'Units', 'Year', 'Price', 'Broker'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#F0B429', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(13,27,46,0.05)', background: i % 2 === 0 ? '#fff' : 'rgba(13,27,46,0.01)' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 500, color: '#0D1B2E', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.status}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.market}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.units ?? '—'}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.year_built ?? '—'}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.purchase_price ? `$${(d.purchase_price/1e6).toFixed(1)}M` : '—'}</td>
                    <td style={{ padding: '7px 12px', color: '#8A9BB0' }}>{d.broker || '—'}</td>
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr><td colSpan={7} style={{ padding: '8px 12px', color: '#8A9BB0', fontSize: 11, textAlign: 'center' }}>…and {preview.length - 20} more deals</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : status === 'importing' ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 64 }}>
          <div style={{ fontSize: 13, color: '#8A9BB0' }}>Importing deals into Supabase…</div>
        </div>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 64 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2E', marginBottom: 6 }}>Done! {imported} deals processed</div>
          <div style={{ fontSize: 13, color: '#8A9BB0', marginBottom: 4 }}><span style={{color:'#27AE60',fontWeight:600}}>{insertedCount} new deals added</span> · <span style={{color:'#F0B429',fontWeight:600}}>{updatedCount} existing deals updated</span></div>
          <div style={{ fontSize: 12, color: '#8A9BB0', marginBottom: 24 }}>BOE data, comments, seller/buyer info preserved on all existing deals</div>
          <button onClick={() => { setStatus('idle'); setPreview([]); setImported(0); setInsertedCount(0); setUpdatedCount(0) }} style={{ padding: '9px 22px', background: '#0D1B2E', color: '#F0B429', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Upload Another</button>
        </div>
      )}
    </div>
  )
}
