export type BugPreset = {
  id: number;
  name: string;
  bugDomain: string;
  mode: "wildcard" | "sni" | "host";
  isActive: boolean;
  sshInjectConfig?: Record<string, unknown>;
};

export type EasyApp = "darktunnel" | "http-custom";

export const GUIDE_DISMISSED_KEY = "inject_guide_dismissed_v1";
export const GUIDE_COLLAPSED_KEY = "inject_guide_collapsed_v1";
