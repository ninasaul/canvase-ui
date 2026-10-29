export type AdminSession = {
  id: string;
  email: string;
};

export type DashboardPeriodSnapshot = {
  requestCount: number;
  succeededCount: number;
  failedCount: number;
  timeoutCount: number;
  pendingCount: number;
  successRate: number;
  customerCharge: string;
  upstreamCost: string;
  margin: string;
  marginRate: number;
};

export type DashboardTrendPoint = {
  date: string;
  label: string;
  requestCount: number;
  customerCharge: string;
  upstreamCost: string;
  margin: string;
};

export type TenantTrendPoint = {
  date: string;
  label: string;
  requestCount: number;
  customerCharge: string;
  rechargeAmount: string;
};

export type DashboardTenantRank = {
  tenantId: string;
  tenantName: string;
  requestCount: number;
  customerCharge: string;
  margin: string;
};

export type DashboardModelRank = {
  modelId: string | null;
  externalId: string;
  displayName: string;
  capability: string | null;
  requestCount: number;
  customerCharge: string;
  successRate: number;
};

export type DashboardCapabilityShare = {
  capability: string;
  requestCount: number;
  customerCharge: string;
};

export type DashboardModelShare = {
  key: string;
  modelId: string | null;
  externalId: string;
  displayName: string;
  requestCount: number;
  customerCharge: string;
  share: number;
};

export type DashboardModelTrendSeries = {
  modelId: string;
  externalId: string;
  displayName: string;
};

export type DashboardModelTrendPoint = {
  date: string;
  label: string;
  series: Array<{
    modelId: string;
    externalId: string;
    displayName: string;
    requestCount: number;
  }>;
};

export type DashboardModelAnalytics = {
  chargeMix: DashboardModelShare[];
  requestMix: DashboardModelShare[];
  callTrend: DashboardModelTrendPoint[];
  callTrendModels: DashboardModelTrendSeries[];
  topModelsByRequestCount: DashboardModelRank[];
};

export type DashboardLowBalanceTenant = {
  id: string;
  name: string;
  balance: string;
};

export type DashboardAttention = {
  failedToday: number;
  timeoutToday: number;
  inProgressVideoTasks: number;
  unpricedListedModels: number;
  disabledProviders: number;
  lowBalanceThreshold: string;
  lowBalanceTenants: DashboardLowBalanceTenant[];
};

export type DashboardRedeemStats = {
  activeCodes: number;
  periodRedemptions: number;
  previousPeriodRedemptions: number;
  periodAmountCredited: string;
  previousPeriodAmountCredited: string;
};

export type DashboardRange =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_30d"
  | "this_month"
  | "custom";

export type DashboardGranularity = "hour" | "day";

export type TenantTrendResponse = {
  range: DashboardRange;
  timezone: string;
  generatedAt: string;
  periodStartsAt: string;
  periodEndsAt: string;
  trendGranularity: DashboardGranularity;
  trend: TenantTrendPoint[];
};

export type DashboardResponse = {
  range: DashboardRange;
  timezone: string;
  generatedAt: string;
  periodStartsAt: string;
  periodEndsAt: string;
  todayStartsAt: string;
  trendGranularity: DashboardGranularity;
  current: DashboardPeriodSnapshot;
  previous: DashboardPeriodSnapshot;
  today: DashboardPeriodSnapshot;
  yesterday: DashboardPeriodSnapshot;
  trend: DashboardTrendPoint[];
  topTenants: DashboardTenantRank[];
  topModels: DashboardModelRank[];
  capabilityMix: DashboardCapabilityShare[];
  modelAnalytics: DashboardModelAnalytics;
  attention: DashboardAttention;
  redeem: DashboardRedeemStats;
  todayRequestCount: number;
  todaySuccessRate: number;
  todayCustomerCharge: string;
  todayUpstreamCost: string;
  todayMargin: string;
  inProgressVideoTasks: number;
};

export type TenantRecord = {
  id: string;
  name: string;
  balance: string;
  status: "enabled" | "disabled";
  defaultChatRpm: number;
  defaultImageRpm: number;
  defaultVideoRpm: number;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantUserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "member";
  status: "enabled" | "disabled";
  quotaBalance: string;
  hasPassword: boolean;
  totalCharge: string;
  requestCount: number;
  apiKey: {
    id: string;
    maskedKey: string;
    status: "active" | "revoked";
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantUserDetailRecord = TenantUserRecord & {
  recentRequests: Array<{
    id: string;
    requestId: string;
    status: string;
    customerCharge: string;
    createdAt: string;
    modelName: string | null;
  }>;
};

export type ApiKeyRecord = {
  id: string;
  tenantId: string;
  tenantUserId: string | null;
  tenantUserEmail: string | null;
  name: string;
  keyPrefix: string;
  keySuffix: string;
  maskedKey: string;
  status: "active" | "revoked";
  chatRpm: number | null;
  imageRpm: number | null;
  videoRpm: number | null;
  createdAt: string;
  revokedAt: string | null;
  plaintext?: string;
};

export type CredentialRecord = {
  id: string;
  providerId: string;
  name: string;
  secrets: Record<string, string>;
  isDefault: boolean;
  status: "enabled" | "disabled" | "retired";
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderRecord = {
  id: string;
  code: string;
  name: string;
  adapterKey: string;
  defaultBaseUrl: string;
  status: "enabled" | "disabled";
  source: "console" | "file";
  configSchema: {
    type: "object";
    required: string[];
    properties: Record<string, { type: "string" }>;
  };
  createdAt: string;
  updatedAt: string;
  credentials: CredentialRecord[];
};

export type CatalogRecord = {
  id: string;
  providerId: string;
  upstreamId: string;
  displayName: string;
  capabilityGuess: string | null;
  stale: boolean;
  lastSeenAt: string;
};

export type PricingRecord = {
  id: string;
  modelId: string;
  currency: string;
  upstreamUnit: "token" | "token_1k" | "token_1m" | "image" | "request" | "second";
  upstreamAmount: string;
  customerUnit: "token" | "token_1k" | "token_1m" | "image" | "request" | "second";
  customerAmount: string;
  upstreamInputAmount: string | null;
  upstreamOutputAmount: string | null;
  upstreamImageInputAmount: string | null;
  customerInputAmount: string | null;
  customerOutputAmount: string | null;
  customerImageInputAmount: string | null;
  sizeMultipliers: Record<string, string | number> | null;
  priceTable: {
    mode: "per_second" | "per_resolution" | "fixed";
    rates: Record<string, Record<string, { customer: string; upstream: string }>>;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ModelRecord = {
  id: string;
  providerId: string;
  providerCode: string;
  credentialId: string | null;
  catalogId: string | null;
  externalId: string;
  upstreamId: string;
  displayName: string;
  vendor: string | null;
  description: string | null;
  capability: string;
  enabled: boolean;
  source: "console" | "file";
  listed?: boolean;
  createdAt: string;
  updatedAt: string;
  pricing: PricingRecord | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestRecord = {
  id: string;
  requestId: string;
  tenantId: string;
  apiKeyId: string;
  modelId: string | null;
  providerId: string | null;
  capability: string | null;
  status: "pending" | "succeeded" | "failed" | "timeout";
  promptTokens: number | null;
  completionTokens: number | null;
  imagesGenerated: number | null;
  seconds: number | null;
  upstreamCost: string;
  customerCharge: string;
  upstreamDurationMs: number | null;
  totalDurationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  assetIds: string[] | null;
  upstreamTaskId?: string | null;
  createdAt: string;
  tenantName?: string;
  modelExternalId?: string | null;
  modelDisplayName?: string | null;
  modelUpstreamId?: string | null;
  providerName?: string | null;
  providerCode?: string | null;
  apiKeyName?: string;
  apiKeyMasked?: string;
  promptText?: string | null;
  requestParams?: Record<string, unknown> | null;
  upstreamRequestParams?: Record<string, unknown> | null;
  upstreamResponseBody?: Record<string, unknown> | unknown | null;
  assets?: Array<{ id: string; publicUrl: string; mimeType: string }>;
  relatedTaskId?: string | null;
  relatedTaskPublicId?: string | null;
};

export type TaskRecord = {
  id: string;
  publicId: string;
  tenantId: string;
  apiKeyId?: string;
  modelId: string;
  providerId: string;
  status:
    | "queued"
    | "running"
    | "transferring"
    | "succeeded"
    | "failed"
    | "timeout";
  progress: number;
  seconds: number | null;
  size: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  upstreamTaskId?: string | null;
  requestParams?: Record<string, unknown> | null;
  upstreamRequestParams?: Record<string, unknown> | null;
  upstreamResponseBody?: Record<string, unknown> | unknown | null;
  tenantName?: string;
  modelExternalId?: string | null;
  modelDisplayName?: string | null;
  capability?: string | null;
  providerName?: string | null;
  providerCode?: string | null;
  apiKeyName?: string;
  apiKeyMasked?: string;
  asset?: { id: string; publicUrl: string; mimeType: string } | null;
  assets?: Array<{ id: string; publicUrl: string; mimeType: string }>;
  relatedRequestId?: string | null;
  relatedRequestPublicId?: string | null;
  /** Present on query-task responses when a poll job was enqueued. */
  polled?: boolean;
};

export type SettingsRecord = {
  assetRetentionDays: number;
  exposeUsageCost: boolean;
  canvasEnabled: boolean;
  storePromptPlaintext: boolean;
  currencySymbol: string;
  allowTenantSelfRegister: boolean;
  referralEnabled: boolean;
  referralCommissionRate: string;
  referralCommissionPerChargeCap: string | null;
  referralCommissionRelationCap: string | null;
  siteTitle: string | null;
  logoUrl: string | null;
  contactTelegram: string | null;
  contactTwitter: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWechat: string | null;
  contactWechatGroup: string | null;
  contactTelegramGroup: string | null;
  contactWechatGroupQrUrl: string | null;
  contactSupportQrUrl: string | null;
};

export type PortalOAuthProvider = "github" | "google";

export type PortalSession = {
  id: string;
  email: string;
  role: "owner" | "member";
  hasPassword: boolean;
  tenant: {
    id: string;
    name: string;
    balance: string;
    status: "enabled" | "disabled";
    defaultChatRpm: number;
    defaultImageRpm: number;
    defaultVideoRpm: number;
  };
};

export type PortalDashboardSnapshot = {
  requestCount: number;
  succeededCount: number;
  failedCount: number;
  timeoutCount: number;
  successRate: number;
  customerCharge: string;
};

export type PortalDashboardAttention = {
  failedCount: number;
  timeoutCount: number;
  inProgressTasks: number;
  activeApiKeyCount: number;
  hasLowBalance: boolean;
  hasNoApiKey: boolean;
};

export type PortalDashboardResponse = {
  range: DashboardRange;
  timezone: string;
  generatedAt: string;
  periodStartsAt: string;
  periodEndsAt: string;
  balance: string;
  tenantName: string;
  tenantStatus: "enabled" | "disabled";
  defaultChatRpm: number;
  defaultImageRpm: number;
  defaultVideoRpm: number;
  lowBalanceThreshold: string;
  current: PortalDashboardSnapshot;
  previous: PortalDashboardSnapshot;
  capabilityCharge: Array<{
    capability: string;
    customerCharge: string;
  }>;
  inProgressTasks: number;
  trendGranularity: DashboardGranularity;
  trend: DashboardTrendPoint[];
  modelAnalytics: DashboardModelAnalytics;
  attention: PortalDashboardAttention;
};

export type PortalPublicModel = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  display_name: string;
  vendor?: string;
  description?: string;
  capability: string;
  pricing?: {
    currency: string;
    unit: string;
    amount: string;
    input_amount?: string;
    output_amount?: string;
    size_multipliers?: Record<string, string>;
    price_table?: {
      mode: "per_second" | "per_resolution" | "fixed";
      rates: Record<string, Record<string, { customer: string }>>;
    };
  };
};

export type RedeemDisplayStatus =
  | "active"
  | "disabled"
  | "expired"
  | "exhausted";

export type RedeemCodeRecord = {
  id: string;
  code: string;
  amount: string;
  maxUses: number;
  usedCount: number;
  status: "active" | "disabled";
  displayStatus: RedeemDisplayStatus;
  expiresAt: string | null;
  note: string | null;
  batchId: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RedeemCodeListResponse = {
  items: RedeemCodeRecord[];
  total: number;
};

export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementLevel = "info" | "warning" | "critical";
export type AnnouncementLocale = "all" | "zh" | "en";

export type AnnouncementRecord = {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  level: AnnouncementLevel;
  locale: AnnouncementLocale;
  priority: number;
  publishAt: string | null;
  expireAt: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementListResponse = {
  items: AnnouncementRecord[];
  total: number;
};

export type RedeemRedemptionRecord = {
  id: string;
  redeemCodeId: string;
  code: string;
  tenantId: string;
  tenantName: string;
  tenantUserId: string;
  tenantUserEmail: string;
  amount: string;
  balanceLedgerId: string;
  createdAt: string;
};

export type BalanceLedgerRecord = {
  id: string;
  tenantId: string;
  type:
    | "admin_recharge"
    | "redeem_code"
    | "tenant_create"
    | "admin_deduct"
    | "usage_charge"
    | "referral_commission"
    | "quota_allocate"
    | "quota_reclaim"
    | "subaccount_usage";
  amount: string;
  balanceAfter: string;
  refType: string | null;
  refId: string | null;
  operatorAdminId: string | null;
  operatorTenantUserId: string | null;
  note: string | null;
  createdAt: string;
};

export type PortalRedeemResult = {
  redemptionId: string;
  amount: string;
  balance: string;
};

export type PortalReferralOverview = {
  enabled: boolean;
  code: string | null;
  inviteUrl: string | null;
  rate: string;
  perChargeCap: string | null;
  relationCap: string | null;
  inviteeCount: number;
  paidTotal: string;
};

export type ReferralRelationRecord = {
  id: string;
  inviterTenantId: string;
  inviterTenantName: string;
  inviteeTenantId: string;
  inviteeTenantName: string;
  inviteCode: string;
  status: "active" | "voided";
  boundAt: string;
  voidedAt: string | null;
  voidNote: string | null;
  commissionPaidTotal: string;
};

export type ReferralCommissionRecord = {
  id: string;
  relationId: string;
  inviterTenantId: string;
  inviteeTenantId: string;
  requestId: string;
  baseAmount: string;
  rate: string;
  amount: string;
  createdAt: string;
};

export type StorageBucketStat = {
  id: "tu-assets" | "playground";
  files: number;
  bytes: number;
  dueFiles: number;
  dueBytes: number;
};

export type StorageOverview = {
  provider: "seaweed" | "r2";
  quotaBytes: number;
  retentionDays: number;
  playgroundRetentionHours: number;
  files: number;
  bytes: number;
  dueFiles: number;
  dueBytes: number;
  nextExpireAt: string | null;
  buckets: StorageBucketStat[];
  kinds: Array<{ id: string; files: number; bytes: number }>;
  tenants: Array<{ id: string; name: string; files: number; bytes: number }>;
  publicBaseUrl: string | null;
  playgroundPublicBaseUrl: string | null;
};

export type StorageCleanupResult = {
  deleted: number;
  bytes: number;
  storageErrors: number;
  truncated: boolean;
};
