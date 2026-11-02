import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
const defaultLogos: Record<string,string> = {
  'c719c21c-e530-440b-8526-e6dd2688e2e1': '/client-logos/slr-design-build.png',
  '5058a2a7-68e3-4d40-a84e-78dcc8b23758': '/client-logos/slr-engenharia.png',
  '338243c3-8443-4dd4-bce1-b4011feeb52c': '/client-logos/slr-properties.png',
}
export function ClientAvatar({ id, name, className = 'h-12 w-16', editable = false }: { id: string; name: string; className?: string; editable?: boolean }) {
  const { profile } = useAuth()
  const [image, setImage] = useState({ id, url: defaultLogos[id] ?? '' })
  const url = image.id === id ? image.url : defaultLogos[id] ?? ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || !active) return
      try {
        const response = await fetch(`/api/client-logo?client_id=${id}`, { signal: controller.signal, headers: { Authorization: `Bearer ${data.session.access_token}` } })
        if (!response.ok) return
        const result = await response.json()
        if (active) setImage({ id, url: result.url })
      } catch { /* Initials identify clients without an uploaded logo. */ }
    })
    return () => { active = false; controller.abort() }
  }, [id])
  async function upload(file: File) {
    setError('')
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Use PNG, JPG ou WebP de até 5 MB.'); return }
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256
      const context = canvas.getContext('2d')
      if (!context) { bitmap.close(); throw new Error('Não foi possível abrir a imagem.') }
      const ratio = Math.min(240 / bitmap.width, 240 / bitmap.height)
      context.drawImage(bitmap, (256 - bitmap.width * ratio) / 2, (256 - bitmap.height * ratio) / 2, bitmap.width * ratio, bitmap.height * ratio); bitmap.close()
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Entre novamente para salvar o logo.')
      const response = await fetch(`/api/client-logo?client_id=${id}`, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ image: canvas.toDataURL('image/png') }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar o logo.')
      setImage({ id, url: result.url })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o logo.') }
    finally { setBusy(false) }
  }
  const darkLogo = ['589481f6-3a15-4c93-b384-5d33373c20e3','14d33095-9db2-4f7f-b667-10110c52c919'].includes(id)
  return <div className="shrink-0"><div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] p-1.5`} style={{ backgroundColor: url ? darkLogo ? 'var(--logo-dark-bg)' : 'var(--logo-light-bg)' : undefined }}>
    {url ? <img src={url} alt={`Logo ${name}`} className="h-full w-full object-contain" onError={() => setImage({ id, url: '' })} /> : <span className="text-xs font-bold text-[var(--accent)]" aria-label={name}>{name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>}
  </div>{editable && profile?.role === 'admin' && <label className="mt-1 block cursor-pointer text-center text-[10px] text-[var(--accent)]">{busy ? 'Salvando…' : url ? 'Trocar logo' : 'Adicionar logo'}<input type="file" aria-label={`Logo de ${name}`} accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }}/></label>}{error && <p role="alert" className="mt-1 max-w-40 text-[10px] text-[var(--danger)]">{error}</p>}</div>
}
