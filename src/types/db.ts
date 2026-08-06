import type { ModuleKey } from "@/lib/modules";

export type MembershipRole = "owner" | "staff" | "agency";

export type Org = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  user_id: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
};

export type Entitlement = {
  id: string;
  org_id: string;
  module: ModuleKey;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type Invite = {
  id: string;
  email: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
  accepted_at: string | null;
};
