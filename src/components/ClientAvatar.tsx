import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {clientLogoCache,useClientLogo} from '../hooks/useClientLogo'
const defaultLogos: Record<string,string> = {
  '589481f6-3a15-4c93-b384-5d33373c20e3': '/brands/rayafit.webp',
  'c719c21c-e530-440b-8526-e6dd2688e2e1': '/client-logos/slr-design-build.png',
  '5058a2a7-68e3-4d40-a84e-78dcc8b23758': '/client-logos/slr-engenharia.png',
  '338243c3-8443-4dd4-bce1-b4011feeb52c': '/client-logos/slr-properties.png',
}
export function ClientAvatar({ id, name, className = 'h-12 w-16', editable = false }: { id: string; name: string; className?: string; editable?: boolean }) {
  const { profile, user } = useAuth()
  const remote = useClientLogo(user?.id, id)
  const [failed, setFailed] = useState<{id:string;urls:string[]}>({id,urls:[]})
  const failedUrls=failed.id===id?failed.urls:[]
  const url = [remote,defaultLogos[id]].find(value=>value&&!failedUrls.includes(value))??''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
      clientLogoCache.put(data.session.user.id,id,{url:result.url,expires_at:result.expires_at??Date.now()+3600000})
      setFailed({id,urls:[]})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o logo.') }
    finally { setBusy(false) }
  }
  const properties=id==='338243c3-8443-4dd4-bce1-b4011feeb52c'
  const evidence=['a3abb995-8e31-4386-be99-01024bed557b','714c847a-e2a4-479b-a574-49d9a7cc2fe1'].includes(id)
  const darkLogo = properties||['589481f6-3a15-4c93-b384-5d33373c20e3','14d33095-9db2-4f7f-b667-10110c52c919'].includes(id)
  return <div className="shrink-0"><div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] ${properties?'p-0':evidence?'p-0.5':'p-1.5'}`} style={{ backgroundColor: url ? darkLogo ? 'var(--logo-dark-bg)' : 'var(--logo-light-bg)' : undefined }}>
    {url ? <img src={url} alt={`Logo ${name}`} width={256} height={256} decoding="async" className={`h-full w-full ${properties?'object-cover':'object-contain'} ${evidence?'scale-[1.6]':''}`} onError={() => setFailed(previous=>({id,urls:[...(previous.id===id?previous.urls:[]),url]}))} /> : <span className="text-xs font-bold text-[var(--accent)]" aria-label={name}>{name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>}
  </div>{editable && profile?.role === 'admin' && <label className="mt-1 block cursor-pointer text-center text-[10px] text-[var(--accent)]">{busy ? 'Salvando…' : url ? 'Trocar logo' : 'Adicionar logo'}<input type="file" aria-label={`Logo de ${name}`} accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }}/></label>}{error && <p role="alert" className="mt-1 max-w-40 text-[10px] text-[var(--danger)]">{error}</p>}</div>
}
