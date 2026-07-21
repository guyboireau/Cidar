export type Provider = 'github' | 'gitlab' | 'vercel' | 'cloudflare'

export type HealthStatus = 'success' | 'failure' | 'warning' | 'no_ci' | 'not_found' | 'error' | 'running' | 'unknown'

export interface Profile {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
}

export interface LinkedAccount {
  id: string
  user_id: string
  provider: Provider
  username: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  github_owner: string | null
  github_repo: string | null
  gitlab_namespace: string | null
  gitlab_project: string | null
  vercel_project_id: string | null
  cloudflare_zone_id: string | null
  cloudflare_worker_name: string | null
  check_interval_minutes: number
  last_overall_status: string | null
  enabled: boolean
  created_at: string
}

export interface HealthCheckRun {
  workflow: string
  status: HealthStatus
  branch: string
  url: string
  updated_at: string
}

export interface HealthCheckResult {
  status: HealthStatus
  runs?: HealthCheckRun[]
  url?: string
  branch?: string
  created_at?: string
  error?: string
}

export interface HealthCheck {
  id: string
  project_id: string
  user_id: string
  github_status: HealthStatus | null
  github_data: HealthCheckResult | null
  gitlab_status: HealthStatus | null
  gitlab_data: HealthCheckResult | null
  vercel_status: HealthStatus | null
  vercel_data: HealthCheckResult | null
  cloudflare_status: HealthStatus | null
  cloudflare_data: HealthCheckResult | null
  checked_at: string
}

export interface ProjectRow extends Project {
  overall_status: HealthStatus | null
  github_status: HealthStatus | null
  github_data: HealthCheckResult | null
  gitlab_status: HealthStatus | null
  gitlab_data: HealthCheckResult | null
  vercel_status: HealthStatus | null
  vercel_data: HealthCheckResult | null
  cloudflare_status: HealthStatus | null
  cloudflare_data: HealthCheckResult | null
  checked_at: string | null
}

export interface HttpMonitor {
  id: string
  user_id: string
  org_id: string | null
  project_id: string | null
  name: string
  url: string
  public_name: string | null
  expected_status: number
  interval_minutes: number
  enabled: boolean
  last_status: 'up' | 'down' | null
  last_checked_at: string | null
  last_response_ms: number | null
  created_at: string
}

export interface NotificationSettings {
  user_id: string
  email_on_failure: boolean
  email_on_recovery: boolean
  email_daily: boolean
  slack_webhook: string | null
  discord_webhook: string | null
  updated_at: string
}

export interface StatusPage {
  id: string
  user_id: string
  slug: string
  title: string
  description: string | null
  project_ids: string[]
  http_monitor_ids: string[]
  is_public: boolean
  created_at: string
}

// ── UX Audit (DarkPatternDetector) ───────────────────────────

export interface UxAuditPattern {
  type: string
  name: string
  count: number
  severity: 'high' | 'medium' | 'low'
  regulation: string
  examples: string[]
}

export interface UxAudit {
  id: string
  user_id: string
  org_id: string | null
  project_id: string | null
  url: string
  title: string | null
  total_patterns: number
  severity_score: number
  patterns: UxAuditPattern[]
  screenshot_url: string | null
  created_at: string
}

// ── Dev Tools (DevFlow) ────────────────────────────────────

export interface CodeSnippet {
  id: string
  user_id: string
  org_id: string | null
  title: string
  code: string
  language: string
  tags: string[]
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PrTemplate {
  id: string
  org_id: string
  name: string
  type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'hotfix' | 'chore'
  template: string
  is_default: boolean
  created_at: string
  updated_at: string
}

// ── Accessibility (AccessLens) ───────────────────────────────

export interface AccessibilityIssue {
  type: string
  name: string
  severity: 'critical' | 'error' | 'warning'
  wcag: string
  description: string
  selector?: string
  suggestion?: string
}

export interface AccessibilityAudit {
  id: string
  user_id: string
  org_id: string | null
  project_id: string | null
  url: string
  title: string | null
  wcag_version: string
  conformance_level: 'A' | 'AA' | 'AAA'
  total_issues: number
  score: number
  issues: AccessibilityIssue[]
  screenshot_url: string | null
  created_at: string
}

// ── StyleGuard ─────────────────────────────────────────────

export interface StyleIssue {
  type: string
  severity: 'warning' | 'error'
  message: string
  line?: number
  column?: number
}

export interface StyleGuide {
  id: string
  org_id: string
  name: string
  description: string | null
  rules: {
    tense?: boolean
    tone?: boolean
    terminology?: boolean
    punctuation?: boolean
    capitalization?: boolean
    repetition?: boolean
    passive_voice?: boolean
    jargon?: boolean
    custom_terms?: { wrong: string; right: string }[]
  }
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface StyleCheck {
  id: string
  user_id: string
  org_id: string | null
  style_guide_id: string | null
  title: string
  content: string
  total_issues: number
  score: number
  issues: StyleIssue[]
  created_at: string
}

// ── Organizations & Billing ────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  owner_id: string
  plan_id: string
  created_at: string
  updated_at: string
}

export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  joined_at: string
  profile?: Profile
}

export interface Invitation {
  id: string
  org_id: string
  email: string
  role: OrgRole
  invited_by: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface OrgWithPlan extends Organization {
  plan_name: string
  plan_id: string
  max_projects: number
  max_monitors: number
  max_members: number
  max_status_pages: number
  alerts_slack: boolean
  alerts_discord: boolean
  price_monthly: number
  current_period_end: string | null
  cancel_at_period_end: boolean
  subscription_status: string | null
}

export interface Plan {
  id: string
  name: string
  description: string | null
  max_projects: number
  max_monitors: number
  max_members: number
  max_status_pages: number
  alerts_slack: boolean
  alerts_discord: boolean
  price_monthly: number
  stripe_price_id: string | null
  created_at: string
}

export interface Subscription {
  id: string
  org_id: string
  plan_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export type CronRunStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'unknown'

export interface CronRoutine {
  id: string
  user_id: string
  org_id: string | null
  name: string
  description: string | null
  github_owner: string
  github_repo: string
  workflow_file: string
  enabled: boolean
  cron_expression: string | null
  config: Record<string, unknown>
  last_run_at: string | null
  last_run_status: CronRunStatus | null
  last_run_url: string | null
  created_at: string
  updated_at: string
}

export interface CronRun {
  id: string
  routine_id: string
  user_id: string
  github_run_id: number | null
  trigger_source: 'manual' | 'scheduled'
  status: CronRunStatus
  html_url: string | null
  started_at: string
  finished_at: string | null
  data: Record<string, unknown>
}
