// A contact's wording is useful context, but is never promoted to a verified
// click, campaign, platform or UTM by this helper.
export function messageOriginStatement(text:unknown) {
 const value=String(text??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase()
 if(/^(?:ola[!,.\s]*)?vim do site\b/u.test(value))return 'Site, declarado pelo contato; clique e campanha não confirmados.'
 if(/^(?:ola[!,.\s]*)?vi o anuncio\b/u.test(value))return 'Anúncio, declarado pelo contato; plataforma e campanha não confirmadas.'
 return ''
}
