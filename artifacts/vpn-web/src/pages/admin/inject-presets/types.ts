export type RequiredAccountKind = "normal" | "cloudfront";
export type InjectMode = "PROXY" | "PROXY_SNI";
export type SniPolicy = "none" | "account_host" | "custom";
export type FormMode = "create" | "edit" | "duplicate";

export type EasyInjectPreset = {
  id: number;
  slug: string;
  name: string;
  description: string;
  accountLabel: string;
  requiredAccountKind: RequiredAccountKind;
  sshPort: number;
  mode: InjectMode;
  proxyHost: string;
  proxyPort: number;
  payload: string;
  sniPolicy: SniPolicy;
  customSni: string | null;
  usePayload: boolean;
  ssl: boolean;
  supportsDarkTunnel: boolean;
  supportsHttpCustom: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type EasyInjectPresetRevision = {
  id: number;
  presetId: number;
  version: number;
  snapshot: Record<string, unknown>;
  action: string;
  createdAt: string;
};

export type EasyInjectPresetInput = Pick<
  EasyInjectPreset,
  | "slug"
  | "name"
  | "description"
  | "accountLabel"
  | "requiredAccountKind"
  | "sshPort"
  | "mode"
  | "proxyHost"
  | "proxyPort"
  | "payload"
  | "sniPolicy"
  | "customSni"
  | "usePayload"
  | "ssl"
  | "supportsDarkTunnel"
  | "supportsHttpCustom"
  | "isActive"
  | "sortOrder"
>;

export type PresetForm = Omit<
  EasyInjectPresetInput,
  "sshPort" | "proxyPort" | "sortOrder" | "customSni"
> & {
  sshPort: string;
  proxyPort: string;
  sortOrder: string;
  customSni: string;
};

export type ApiListResponse<T> = T[] | { data: T[] };
export type FormErrors = Partial<Record<keyof PresetForm, string>>;
