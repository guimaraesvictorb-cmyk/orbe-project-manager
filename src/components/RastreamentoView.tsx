import { useState, useMemo } from 'react'
import { Copy, Check, Trash2, Link2, QrCode } from 'lucide-react'
import { Footer } from './Footer'

const STORAGE_KEY = 'orbe_utms'

interface UTMLink {
  id: string
  url: string
  source: string
  medium: string
  campaign: string
  content: string
  term: string
  createdAt: string
}

function loadHistory(): UTMLink[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(links: UTMLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links.slice(0, 50)))
}

function buildUTM(form: Omit<UTMLink, 'id' | 'createdAt'>) {
  if (!form.url) return ''
  try {
    const u = new URL(form.url.startsWith('http') ? form.url : `https://${form.url}`)
    if (form.source)   u.searchParams.set('utm_source', form.source)
    if (form.medium)   u.searchParams.set('utm_medium', form.medium)
    if (form.campaign) u.searchParams.set('utm_campaign', form.campaign)
    if (form.content)  u.searchParams.set('utm_content', form.content)
    if (form.term)     u.searchParams.set('utm_term', form.term)
    return u.toString()
  } catch { return '' }
}

const SOURCE_PRESETS = ['google', 'facebook', 'instagram', 'tiktok', 'email', 'whatsapp', 'linkedin', 'youtube']
const MEDIUM_PRESETS = ['cpc', 'social', 'email', 'organic', 'referral', 'display', 'video']

function inp(label: string, value: string, onChange: (v: string) => void, placeholder = '', presets?: string[]) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors"
        style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-strong)' }}
      />
      {presets && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {presets.map((p) => (
            <button key={p} onClick={() => onChange(p)}
              className="text-[10px] px-2 py-0.5 rounded transition-colors hover:text-[var(--text-primary)]"
              style={{ backgroundColor: 'var(--bg-surface-2)', color: value === p ? 'var(--accent)' : 'var(--text-quaternary)', border: `1px solid ${value === p ? 'var(--accent-a33)' : 'var(--border)'}` }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RastreamentoView() {
  const [form, setForm] = useState({ url: '', source: '', medium: '', campaign: '', content: '', term: '' })
  const [history, setHistory] = useState<UTMLink[]>(loadHistory)
  const [copied, setCopied] = useState<string | null>(null)

  const generated = useMemo(() => buildUTM(form), [form])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function saveLink() {
    if (!generated) return
    const link: UTMLink = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const next = [link, ...history]
    setHistory(next)
    saveHistory(next)
  }

  function deleteLink(id: string) {
    const next = history.filter((l) => l.id !== id)
    setHistory(next)
    saveHistory(next)
  }

  function loadLink(link: UTMLink) {
    setForm({ url: link.url, source: link.source, medium: link.medium, campaign: link.campaign, content: link.content, term: link.term })
  }

  const s = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: 'var(--accent)' }}>Rastreamento</p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Gerador de Links UTM</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Crie links rastreados para campanhas de anúncio, e-mail ou redes sociais.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Builder */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Parâmetros</p>

            {inp('URL de destino *', form.url, s('url'), 'https://m5marketing.com.br/...')}
            {inp('Fonte (utm_source) *', form.source, s('source'), 'google, facebook...', SOURCE_PRESETS)}
            {inp('Mídia (utm_medium) *', form.medium, s('medium'), 'cpc, social, email...', MEDIUM_PRESETS)}
            {inp('Campanha (utm_campaign)', form.campaign, s('campaign'), 'nome-da-campanha')}

            <div className="grid grid-cols-2 gap-3">
              {inp('Conteúdo (utm_content)', form.content, s('content'), 'banner-topo')}
              {inp('Termo (utm_term)', form.term, s('term'), 'palavra-chave')}
            </div>

            {/* Generated link */}
            <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Link gerado</p>
              {generated ? (
                <>
                  <p className="text-xs break-all leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{generated}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(generated, 'link')}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg flex-1 justify-center"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}
                    >
                      {copied === 'link' ? <Check size={12} /> : <Copy size={12} />}
                      {copied === 'link' ? 'Copiado!' : 'Copiar link'}
                    </button>
                    <button
                      onClick={saveLink}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border"
                      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-tertiary)' }}
                      title="Salvar no histórico"
                    >
                      <Link2 size={12} />
                      Salvar
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>Preencha os campos para gerar o link</p>
              )}
            </div>
          </div>

          {/* History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Histórico recente</p>
              <span className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>{history.length} link{history.length !== 1 ? 's' : ''}</span>
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] py-12 text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <QrCode size={24} className="mx-auto mb-2" style={{ color: '#222' }} />
                <p className="text-sm text-[var(--text-primary)]">Histórico vazio</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-quaternary)' }}>Links salvos aparecem aqui</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {history.map((link) => (
                  <div key={link.id} className="rounded-xl border p-3 group" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {link.source && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--accent)' }}>{link.source}</span>}
                        {link.medium && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}>{link.medium}</span>}
                        {link.campaign && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-tertiary)' }}>{link.campaign}</span>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => loadLink(link)} className="text-[11px] px-2 py-1 rounded hover:text-[var(--text-primary)]" style={{ color: 'var(--text-tertiary)' }}>Usar</button>
                        <button onClick={() => copyText(buildUTM(link), link.id)} className="p-1 rounded hover:text-[var(--text-primary)]" style={{ color: 'var(--text-tertiary)' }}>
                          {copied === link.id ? <Check size={11} style={{ color: 'var(--accent)' }} /> : <Copy size={11} />}
                        </button>
                        <button onClick={() => deleteLink(link.id)} className="p-1 rounded hover:text-red-500" style={{ color: 'var(--text-quaternary)' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-quaternary)' }}>{link.url}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--border-subtle)' }}>
                      {new Date(link.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
