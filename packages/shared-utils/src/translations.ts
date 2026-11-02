export const supportedLanguages = ['en', 'es', 'pt', 'nl', 'uk', 'ro', 'lt', 'sv', 'fi', 'nb', 'da', 'zh-CN', 'ja', 'ko'] as const;
export type SharedLanguage = (typeof supportedLanguages)[number];
export type TranslationSource = 'embedded' | 'download';
export type SharedLanguageOption = { code: SharedLanguage; label: string; flag: string; translationSource: TranslationSource };
export type SharedTranslations = Record<'language' | 'chooseLanguage' | 'signIn' | 'signOut' | 'save' | 'cancel' | 'loading', string>;

export const languageOptions: SharedLanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', translationSource: 'embedded' },
  { code: 'es', label: 'Español', flag: '🇪🇸', translationSource: 'embedded' },
  { code: 'pt', label: 'Português', flag: '🇵🇹', translationSource: 'embedded' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', translationSource: 'embedded' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦', translationSource: 'embedded' },
  { code: 'ro', label: 'Română', flag: '🇷🇴', translationSource: 'embedded' },
  { code: 'lt', label: 'Lietuvių', flag: '🇱🇹', translationSource: 'embedded' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪', translationSource: 'embedded' },
  { code: 'fi', label: 'Suomi', flag: '🇫🇮', translationSource: 'embedded' },
  { code: 'nb', label: 'Norsk', flag: '🇳🇴', translationSource: 'embedded' },
  { code: 'da', label: 'Dansk', flag: '🇩🇰', translationSource: 'embedded' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳', translationSource: 'download' },
  { code: 'ja', label: '日本語', flag: '🇯🇵', translationSource: 'download' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', translationSource: 'download' },
];

const translations: Record<SharedLanguage, SharedTranslations> = {
  en: { language: 'Language', chooseLanguage: 'Choose language', signIn: 'Sign in', signOut: 'Sign out', save: 'Save', cancel: 'Cancel', loading: 'Loading' },
  es: { language: 'Idioma', chooseLanguage: 'Elegir idioma', signIn: 'Iniciar sesión', signOut: 'Cerrar sesión', save: 'Guardar', cancel: 'Cancelar', loading: 'Cargando' },
  pt: { language: 'Idioma', chooseLanguage: 'Escolher idioma', signIn: 'Iniciar sessão', signOut: 'Terminar sessão', save: 'Guardar', cancel: 'Cancelar', loading: 'A carregar' },
  nl: { language: 'Taal', chooseLanguage: 'Taal kiezen', signIn: 'Inloggen', signOut: 'Uitloggen', save: 'Opslaan', cancel: 'Annuleren', loading: 'Laden' },
  uk: { language: 'Мова', chooseLanguage: 'Вибрати мову', signIn: 'Увійти', signOut: 'Вийти', save: 'Зберегти', cancel: 'Скасувати', loading: 'Завантаження' },
  ro: { language: 'Limbă', chooseLanguage: 'Alege limba', signIn: 'Autentificare', signOut: 'Deconectare', save: 'Salvează', cancel: 'Anulează', loading: 'Se încarcă' },
  lt: { language: 'Kalba', chooseLanguage: 'Pasirinkite kalbą', signIn: 'Prisijungti', signOut: 'Atsijungti', save: 'Išsaugoti', cancel: 'Atšaukti', loading: 'Kraunama' },
  sv: { language: 'Språk', chooseLanguage: 'Välj språk', signIn: 'Logga in', signOut: 'Logga ut', save: 'Spara', cancel: 'Avbryt', loading: 'Laddar' },
  fi: { language: 'Kieli', chooseLanguage: 'Valitse kieli', signIn: 'Kirjaudu sisään', signOut: 'Kirjaudu ulos', save: 'Tallenna', cancel: 'Peruuta', loading: 'Ladataan' },
  nb: { language: 'Språk', chooseLanguage: 'Velg språk', signIn: 'Logg inn', signOut: 'Logg ut', save: 'Lagre', cancel: 'Avbryt', loading: 'Laster inn' },
  da: { language: 'Sprog', chooseLanguage: 'Vælg sprog', signIn: 'Log ind', signOut: 'Log ud', save: 'Gem', cancel: 'Annuller', loading: 'Indlæser' },
  'zh-CN': { language: '语言', chooseLanguage: '选择语言', signIn: '登录', signOut: '退出登录', save: '保存', cancel: '取消', loading: '正在加载' },
  ja: { language: '言語', chooseLanguage: '言語を選択', signIn: 'ログイン', signOut: 'ログアウト', save: '保存', cancel: 'キャンセル', loading: '読み込み中' },
  ko: { language: '언어', chooseLanguage: '언어 선택', signIn: '로그인', signOut: '로그아웃', save: '저장', cancel: '취소', loading: '로드 중' },
};

export function getSharedTranslations(language: string | null | undefined): SharedTranslations {
  return translations[supportedLanguages.includes(language as SharedLanguage) ? language as SharedLanguage : 'en'];
}
