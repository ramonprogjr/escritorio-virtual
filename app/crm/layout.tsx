'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/crm', label: 'Dashboard', icon: '◈', exact: true },
  { href: '/crm/atendimento', label: 'Atendimento', icon: '💬' },
  { href: '/crm/parceiros', label: 'Parceiros', icon: '🤝' },
  { href: '/crm/relatorios', label: 'Relatórios', icon: '📊' },
  { href: '/crm/configuracoes', label: 'Config', icon: '⚙️' },
]

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'#080810', color:'#fff', fontFamily:'var(--font-geist-sans, system-ui)', overflow:'hidden' }}>
        <main style={{ flex:1, overflow:'auto' }}>{children}</main>
        <nav style={{
          display:'flex', background:'rgba(8,8,16,0.97)',
          borderTop:'1px solid rgba(255,255,255,0.08)',
          paddingBottom:'env(safe-area-inset-bottom)',
          flexShrink:0, zIndex:100,
        }}>
          {[
            ...navItems,
            { href:'/office', label:'Escritório', icon:'🏢', exact: false },
          ].map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 4px 8px', textDecoration:'none', color: active ? '#f97316' : 'rgba(255,255,255,0.35)', fontSize:9, gap:3, position:'relative' }}>
                {active && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2, background:'#f97316', borderRadius:1 }} />}
                <span style={{ fontSize:18 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100dvh', background:'#080810', color:'#fff', overflow:'hidden', fontFamily:'var(--font-geist-sans, system-ui)' }}>
      <aside style={{
        width: collapsed ? 60 : 220,
        transition: 'width 0.2s ease',
        background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a14 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 10 }}>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>obra10+</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>CRM Operacional</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '5px 7px', fontSize: 12, lineHeight: 1 }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <Link href="/office" style={{ textDecoration: 'none' }}>
          <div style={{ margin: '10px 8px', padding: collapsed ? '8px 0' : '8px 10px', borderRadius: 8, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start', cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>🏢</span>
            {!collapsed && <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>Escritório Virtual</span>}
          </div>
        </Link>
        <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: active ? 'rgba(249,115,22,0.12)' : 'transparent', borderLeft: active ? '2px solid #f97316' : '2px solid transparent', color: active ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {!collapsed && item.label}
                </div>
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: collapsed ? '14px 0' : '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>G</div>
          {!collapsed && <div><div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Gestor</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Nível 2 · Online</div></div>}
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</main>
    </div>
  )
}
