export type BugPreset = {
  id: number;
  name: string;
  bugDomain: string;
  mode: "wildcard" | "sni" | "host";
  isActive: boolean;
  sshInjectConfig?: Record<string, unknown>;
};

export type EasyApp = "darktunnel" | "http-custom";
