export type Scope = 'public:read' | 'profile:read' | 'analytics:read';

export type AccessTier = 'full' | 'past_due_grace' | 'free' | 'blocked' | 'deleted';

export type LinkStyle = 'big' | 'small';

export interface RateLimit {
  limit: number | null;
  remaining: number | null;
  resetsAt: Date | null;
}

export interface Link {
  title: string | null;
  url: string;
  style: LinkStyle;
  type: string;
}

export interface Avatar {
  shape: string;
  border: boolean;
  border_color: string | null;
  frame: string;
  frame_color: string | null;
}

export interface Badges {
  verified: boolean;
  staff: boolean;
  developer: boolean;
}

export interface ProfileFlags {
  access_code_required: boolean;
  status_dot: boolean;
  discoverable: boolean;
  listable: boolean;
}

export interface Profile {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  theme: string | null;
  avatar: Avatar;
  links: Link[];
  badges: Badges;
  flags: ProfileFlags;
  custom_domain: string | null;
  melo_bio_mode: string;
  updated_at: string | null;
}

export interface OwnProfile extends Profile {
  visibility: {
    is_public: boolean;
    custom_domain_redirect: boolean;
    reserved_style: string;
  };
}

export interface LinkClicks {
  link_id: string;
  title: string | null;
  url: string | null;
  style: LinkStyle | null;
  count: number;
}

export interface Analytics {
  views: number;
  clicks: {
    total: number;
    by_link: LinkClicks[];
  };
  updated_at: string | null;
}

export interface Identity {
  user_id: string;
  username: string | null;
  org_id: string | null;
  account_type: string;
  tier: AccessTier;
  subscribed: boolean;
  token: {
    id: string;
    environment: string;
    scopes: Scope[];
  };
  limits: {
    requests_per_minute: number;
    requests_per_month: number;
  };
}

export interface ScopeInfo {
  scope: Scope;
  description: string;
  requires_subscription: boolean;
}

export interface ClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
}
