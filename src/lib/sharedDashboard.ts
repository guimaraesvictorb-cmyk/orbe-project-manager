export type ClientMetricSet = {
  total: number;
  native: number;
  answered: number;
  won: number;
  waiting: number;
  partial: number;
  late?: number;
  lost?: number;
  review?: number;
  daily: { day: string; value: number }[];
};
export type ClientDashboardData = {
  client: { name: string; logo: string; conversion_event?: string };
  period: { start: string; end: string };
  unit: string;
  total: number;
  identified: number;
  channels: Record<string, number>;
  native_channels?: Record<string, number>;
  segments?: Record<string, ClientMetricSet>;
  unit_segments?: Record<string, ClientMetricSet>;
  units: Record<string, number>;
  campaigns: {
    channel: string;
    name: string;
    leads: number;
    metrics?: ClientMetricSet;
  }[];
  daily: { day: string; value: number }[];
  funnel: {
    won: number;
    answered: number;
    waiting: number;
    partial: number;
    late?: number;
    lost?: number;
    review?: number;
  };
  coverage_start: string | null;
  goals: { unit: string; target: number }[];
  goal_month: string;
  monthly_units: Record<string, number>;
  comparison?: Omit<
    ClientDashboardData,
    | "comparison"
    | "goals"
    | "goal_month"
    | "monthly_units"
    | "client"
    | "updated_at"
  > & { coverage_complete: boolean };
  updated_at: string;
};
export type SharedMedia = {
  status: string;
  currency?: string;
  totals?: {
    spend: number;
    impressions: number;
    clicks: number;
    link_clicks: number;
    reach: number;
    frequency: number;
  };
  daily?: {
    campaign_id: string;
    campaign_name: string;
    spend: number;
    impressions: number;
    link_clicks: number;
  }[];
  checked_at?: string;
};
