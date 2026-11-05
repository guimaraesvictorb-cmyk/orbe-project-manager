import { ClientAnalyticsWorkspace } from "./ClientAnalyticsWorkspace";
import { ClientAnalyticsPanels } from "./ClientAnalyticsPanels";
import type { ClientDashboardData, SharedMedia } from "../lib/sharedDashboard";
export function ClientDashboardVisual({
  data,
  channel,
  onChannel,
  media,
}: {
  data: ClientDashboardData;
  channel: string;
  onChannel: (v: string) => void;
  media?: SharedMedia;
}) {
  return (
    <ClientAnalyticsPanels
      data={data}
      section="executive"
      channel={channel}
      onChannel={onChannel}
      media={
        media && ["Meta", "Google"].includes(channel)
          ? { [channel]: media }
          : undefined
      }
    />
  );
}
export function ClientDashboardPage({
  token,
  slug,
  onAccessExpired,
  onLock,
}: {
  token?: string;
  slug?: string;
  onAccessExpired?: () => void;
  onLock?: () => void;
}) {
  return (
    <ClientAnalyticsWorkspace
      token={token}
      slug={slug}
      onAccessExpired={onAccessExpired}
      onLock={onLock}
    />
  );
}
