export type AuthProvider = 'google' | 'apple';

export type AuthProductConfig = {
  productId: string;
  authBaseUrl: string;
};

export function buildMobileAuthUrl(
  config: AuthProductConfig,
  provider: AuthProvider,
  redirectUri: string,
): string {
  const authBaseUrl = config.authBaseUrl.replace(/\/+$/, '');
  const callbackUrl = `${authBaseUrl}/api/mobile-auth/callback?redirect_uri=${encodeURIComponent(redirectUri)}`;
  return `${authBaseUrl}/api/mobile-auth/start/${encodeURIComponent(provider)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
