import type { ReactNode } from 'react'
import { safeSourceUrl } from '../lib/safeSourceUrl'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()[\]]+)/g).map((part,index) => {
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index} className="font-semibold text-[var(--text-primary)]">{part.slice(2,-2)}</strong>
    const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    const address=link?.[2]??(/^https?:\/\//.test(part)?part.replace(/[.,;!]+$/,''):null)
    const href=address?safeSourceUrl(address):null
    return href?<a key={index} href={href} target="_blank" rel="noopener noreferrer" className="break-words text-[var(--accent)] underline underline-offset-2">{link?.[1]??part}</a>:<span key={index}>{part}</span>
  })
}
const cells=(line:string)=>line.trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim())

// React escapes all text. This renderer never executes model HTML or scripts.
export function AssistantMessage({text}:{text:string}) {
  const lines=text.split('\n'),blocks:ReactNode[]=[]
  for(let index=0;index<lines.length;index++) {
    const line=lines[index]
    if(line.includes('|')&&index+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1])&&/^[\s|:-]+$/.test(lines[index+1])) {
      const headers=cells(line),rows:string[][]=[]
      index+=2
      while(index<lines.length&&lines[index].includes('|')){rows.push(cells(lines[index]));index++}
      index--
      blocks.push(<div key={index} className="my-3 max-w-full overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-[var(--bg-surface)]"><tr>{headers.map((cell,i)=><th key={i} className="px-3 py-2 font-semibold text-[var(--text-primary)]">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-t border-[var(--border)]">{headers.map((_,j)=><td key={j} className="px-3 py-2 align-top">{inline(row[j]??'')}</td>)}</tr>)}</tbody></table></div>)
    } else if(/^#{1,6}\s/.test(line))blocks.push(<p key={index} className="mb-1 mt-3 font-semibold text-[var(--text-primary)]">{inline(line.replace(/^#{1,6}\s/,''))}</p>)
    else if(/^\s*[-*]\s/.test(line))blocks.push(<div key={index} className="my-1 flex gap-2"><span aria-hidden="true" className="text-[var(--accent)]">•</span><p className="min-w-0">{inline(line.replace(/^\s*[-*]\s/,''))}</p></div>)
    else if(line.trim())blocks.push(<p key={index} className="my-1 break-words">{inline(line)}</p>)
    else blocks.push(<div key={index} className="h-1"/>)
  }
  return <div className="min-w-0 whitespace-normal">{blocks}</div>
}
