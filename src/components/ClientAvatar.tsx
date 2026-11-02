import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
export function ClientAvatar({ id, name, className = 'h-12 w-16' }: { id: string; name: string; className?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || !active) return
      try {
        const response = await fetch(`/api/client-logo?client_id=${id}`, { signal: controller.signal, headers: { Authorization: `Bearer ${data.session.access_token}` } })
        if (!response.ok) return
        const result = await response.json()
        if (active) setUrl(result.url)
      } catch { /* Initials identify clients without an uploaded logo. */ }
    })
    return () => { active = false; controller.abort() }
  }, [id])
  const darkLogo = ['589481f6-3a15-4c93-b384-5d33373c20e3','14d33095-9db2-4f7f-b667-10110c52c919'].includes(id)
  return <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] p-1.5`} style={{ backgroundColor: url ? darkLogo ? 'var(--logo-dark-bg)' : 'var(--logo-light-bg)' : undefined }}>
    {url ? <img src={url} alt={`Logo ${name}`} className="h-full w-full object-contain" onError={() => setUrl('')} /> : <span className="text-xs font-bold text-[var(--accent)]" aria-label={name}>{name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>}
  </div>
}
