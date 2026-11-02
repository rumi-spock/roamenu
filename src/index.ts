import { buildMobileAuthUrl, getSharedTranslations, languageOptions, productThemes, brandColors, type SharedLanguage } from '@splitmesa/shared-utils';

export const product = productThemes.roamenu;
export const theme = brandColors;
export const getTranslations = (language: string) => getSharedTranslations(language);
export { languageOptions };
export type { SharedLanguage };
export const createAuthUrl = (provider: 'google' | 'apple', redirectUri: string) => buildMobileAuthUrl({
  productId: product.productId,
  authBaseUrl: process.env.AUTH_BASE_URL ?? 'https://example.invalid',
}, provider, redirectUri);
