import { getSharedTranslations, languageOptions, productThemes, brandColors, type SharedLanguage } from '@roamenu/shared-utils';

export const product = productThemes.roamenu;
export const theme = brandColors;
export const getTranslations = (language: string) => getSharedTranslations(language);
export { languageOptions };
export type { SharedLanguage };
