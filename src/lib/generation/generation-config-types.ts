export type ByokModelCapability = "image" | "video" | "chat";

export type ByokModelPreset = {
  id: string;
  capability: ByokModelCapability;
  displayName?: string;
  vendor?: string;
};

/** Public profile shape — apiKey never leaves the server. */
export type VendorGatewayProfileView = {
  baseUrl: string;
  secretConfigured: boolean;
  /** Display name for custom gateways. */
  name?: string;
};

export type GenerationConfigPublicView = {
  configured: boolean;
  activeVendorId: string;
  baseUrl: string;
  profiles: Record<string, VendorGatewayProfileView>;
  models: ByokModelPreset[];
};
