export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/hrms',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Clanio',
  appTagline: process.env.NEXT_PUBLIC_APP_TAGLINE ?? 'Work. Manage. Grow. Together.',
  workspaceName: process.env.NEXT_PUBLIC_WORKSPACE_NAME ?? 'Acme Technologies Pvt. Ltd.',
  workspaceSlug: process.env.NEXT_PUBLIC_WORKSPACE_SLUG ?? 'acme',
  workspaceDomain: process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN ?? 'acme.clanio.com',
} as const
