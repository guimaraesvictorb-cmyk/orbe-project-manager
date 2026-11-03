import type { Insight } from './adsReport.js';
type Secrets = { client_id?: unknown; client_secret?: unknown; refresh_token?: unknown; developer_token?: unknown; manager_id?: unknown };
const tokenValue = (value: unknown) => typeof value === 'string' && value.length <= 4096 && !/\s/.test(value) ? value : '';
export function googleAdsFailure(status:number,error:unknown){
 const details=error&&typeof error==='object'&&'details' in error&&Array.isArray(error.details)?error.details:[];
 const codes:string[]=[];
 for(const detail of details){
  if(!detail||typeof detail!=='object')continue;
  if(typeof detail.reason==='string')codes.push(detail.reason);
  if(Array.isArray(detail.errors))for(const item of detail.errors){if(item?.errorCode&&typeof item.errorCode==='object')for(const code of Object.values(item.errorCode))if(typeof code==='string')codes.push(code)}
 }
 if(codes.some(code=>code==='CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION'||/DEVELOPER_TOKEN/.test(code)))return Error('google_cloud_access_required');
 if(codes.includes('SERVICE_DISABLED')||codes.includes('API_NOT_ACTIVATED'))return Error('google_cloud_api_disabled');
 return Error(status===401?'google_oauth_invalid':status===403?'google_permission_denied':'google_unavailable');
}

// Google Ads REST v26: https://developers.google.com/google-ads/api/rest/common/search
// All queries are SELECT-only. Provider bodies/tokens are never returned to callers.
export async function googleAdsReport(account: string, secrets: Secrets, period: { since: string; until: string }) {
  if (!/^[1-9]\d{9}$/.test(account) || !/^\d{4}-\d{2}-\d{2}$/.test(period.since) || !/^\d{4}-\d{2}-\d{2}$/.test(period.until)) throw new Error('invalid_credentials');
  const clientId = tokenValue(secrets.client_id), clientSecret = tokenValue(secrets.client_secret), refresh = tokenValue(secrets.refresh_token), manager = tokenValue(secrets.manager_id);
  if (!refresh) return { status: 'oauth_pending' as const };
  if (!clientId || !clientSecret || (manager && !/^\d{10}$/.test(manager))) throw new Error('invalid_credentials');
  const auth = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refresh }) });
  const oauth = await auth.json() as { access_token?: unknown; error?: string };
  if (!auth.ok || !tokenValue(oauth.access_token)) throw new Error(['invalid_grant','invalid_client'].includes(oauth.error ?? '') ? 'google_oauth_invalid' : 'google_unavailable');
  // Google sunset developer tokens on 2026-09-09. Access is now governed by
  // the Cloud project owning the OAuth client; legacy tokens stay unused.
  // https://developers.google.com/google-ads/api/docs/api-policy/developer-token
  const headers: Record<string,string> = { Authorization: `Bearer ${tokenValue(oauth.access_token)}`, 'Content-Type': 'application/json' };
  if (manager) headers['login-customer-id'] = manager;
  const version = /^v\d+$/.test(process.env.GOOGLE_ADS_API_VERSION ?? '') ? process.env.GOOGLE_ADS_API_VERSION : 'v26';
  async function search(query: string) {
    const results: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10; page++) {
      const response = await fetch(`https://googleads.googleapis.com/${version}/customers/${account}/googleAds:search`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000), headers, body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }) });
      const data = await response.json() as { results?: Record<string,unknown>[]; nextPageToken?: unknown; error?: { details?: { errors?: { errorCode?: Record<string,string> }[] }[] } };
      if (!response.ok || data.error) {
        throw googleAdsFailure(response.status,data.error);
      }
      if (data.results && !Array.isArray(data.results)) throw new Error('invalid_provider_response');
      results.push(...data.results ?? []);
      if (!data.nextPageToken) return results;
      if (typeof data.nextPageToken !== 'string' || data.nextPageToken.length > 8192) throw new Error('invalid_provider_response');
      pageToken = data.nextPageToken;
    }
    throw new Error('report_too_large');
  }
  const [accounts, rows] = await Promise.all([
    search('SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1'),
    search(`SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${period.since}' AND '${period.until}' ORDER BY segments.date`),
  ]);
  const customer = accounts[0]?.customer as Record<string,unknown> | undefined;
  if (!customer || String(customer.id) !== account) throw new Error('google_account_mismatch');
  const currency = String(customer.currencyCode ?? '');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('invalid_provider_response');
  const number = (value: unknown) => { const result = Number(value ?? 0); if (!Number.isFinite(result) || result < 0) throw new Error('invalid_provider_response'); return result; };
  let conversions = 0;
  const daily: Insight[] = rows.map(row => {
    const campaign = row.campaign as Record<string,unknown> | undefined, metrics = row.metrics as Record<string,unknown> | undefined, segments = row.segments as Record<string,unknown> | undefined;
    if (!campaign || !metrics || !segments) throw new Error('invalid_provider_response');
    const micros = number(metrics.costMicros);
    if (!Number.isSafeInteger(micros)) throw new Error('invalid_provider_response');
    conversions += number(metrics.conversions);
    return { campaign_id: String(campaign.id ?? ''), campaign_name: String(campaign.name ?? '').slice(0,250), date_start: String(segments.date ?? ''), spend: micros / 1e6, impressions: number(metrics.impressions), clicks: number(metrics.clicks), link_clicks: number(metrics.clicks) };
  });
  const totals = daily.reduce((sum, row) => ({ ...sum, spend: sum.spend + row.spend, clicks: sum.clicks + row.clicks, impressions: sum.impressions + row.impressions, link_clicks: sum.link_clicks + row.link_clicks }), { campaign_id: '', campaign_name: '', date_start: '', spend: 0, clicks: 0, impressions: 0, link_clicks: 0 });
  return { status: 'ready' as const, account_name: String(customer.descriptiveName ?? 'Google Ads').slice(0,200), currency, timezone: String(customer.timeZone ?? ''), period, daily, totals: { ...totals, reach: null, frequency: null, conversions }, checked_at: new Date().toISOString() };
}
