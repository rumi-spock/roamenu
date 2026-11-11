import * as AsyncStorageModule from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Speech from 'expo-speech';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AccessTokenRequest, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { languageOptions, type SharedLanguage } from '@roamenu/shared-utils/translations';
import { applyPreferenceMatches, formatMenuPrice, normalisePreferenceLabel, translateMenuSection, type MenuItem, type MenuPreference, type MenuScanResult } from './menu-domain';
import { loadAuthToken, MenuApi, saveAuthToken, type UserProfile } from './menu-api';
import { extractSharedMenuId } from './shared-menu-link';
import { findOcrBounds, inspectMenuImage } from './services/mobile-ocr';

const activeScanKey = 'roamenu.active-menu-scan';
const languageKey = 'roamenu-language';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
const publicSiteUrl = (process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim() || 'https://roamenu.vercel.app').replace(/\/+$/, '');
const translationPackRequestVersion = '2';
const translationFetchCache = process.env.NODE_ENV === 'production' ? 'default' : 'no-store';
const mockAuthEnabled = process.env.EXPO_PUBLIC_MOCK_AUTH === '1';
const mockUserName = process.env.EXPO_PUBLIC_MOCK_USER_NAME?.trim() || 'Local User';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || '';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
const googleWebRedirectUri = process.env.EXPO_PUBLIC_GOOGLE_WEB_REDIRECT_URI?.trim() || '';
const googleNativeClientId = Platform.OS === 'ios' ? googleIosClientId : googleAndroidClientId;
const googleNativeRedirectUri = googleNativeClientId
  ? `com.googleusercontent.apps.${googleNativeClientId.replace(/\.apps\.googleusercontent\.com$/, '')}:/oauthredirect`
  : 'roamenu:/oauthredirect';
const scanLanguages = new Set(['en', 'es', 'pt', 'nl', 'uk', 'ro', 'lt', 'sv', 'fi', 'nb', 'da', 'ko']);
const maxScanPages = 5;
const speechLocales: Record<string, string> = {
  en: 'en-US', es: 'es-ES', pt: 'pt-PT', nl: 'nl-NL', uk: 'uk-UA', ro: 'ro-RO', lt: 'lt-LT', sv: 'sv-SE', fi: 'fi-FI', nb: 'nb-NO', da: 'da-DK',
  'zh-CN': 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
};

function getSpeechLocale(language: string): string {
  return speechLocales[language] ?? language;
}

const uiText = {
  en: { intelligentScan: 'Intelligent menu scan', chooseConfidence: 'Choose with confidence.', description: 'Go beyond translation. Understand each dish, its ingredients, and whether it suits your preferences.', scanMenu: 'Scan the menu', scanHint: 'Translate, understand, and choose', howItWorks: 'See how Roamenu helps you choose', howItWorksHint: 'A quick look at what happens after you scan.', howItWorksCapture: 'Capture the menu', howItWorksCaptureHint: 'Take a clear photo of the dishes.', howItWorksUnderstand: 'Understand each dish', howItWorksUnderstandHint: 'See translations, ingredients, and useful details.', howItWorksChoose: 'Choose what suits you', howItWorksChooseHint: 'Use your preferences to find a better match.', scanAnotherPage: 'Scan another page', recent: 'Return to recent menu', scannedItems: 'menu items scanned', yourMenu: 'Your menu', viewList: 'List', viewImage: 'On image', selectedItems: 'Selected', selectItem: 'Select item', deselectItem: 'Remove item', imageLocationsUnavailable: 'Item locations were not returned for this scan.', account: 'Account', close: 'Close', preferences: 'Food preferences', preferenceHint: 'Separate preferences with commas, such as nuts, dairy, shellfish.', language: 'Language', languageHint: 'Used for menu translation and scan results.', savePreferences: 'Save preferences', logOut: 'Log out', deleteAccount: 'Delete account', beforeScan: 'Before we scan', promptHint: 'Tell us about any food preferences or ingredients that may not suit you so we can highlight matching dishes.', saveNextTime: 'Save for next time', cancel: 'Cancel', analysing: 'Analysing your menu', analysingHint: 'We are translating dishes, checking ingredients, and organising the results.', authSubtitle: 'Sign in to scan menus with AI and save your food preferences.', continueGoogle: 'Continue with Google', continueApple: 'Continue with Apple', localAuth: 'Continue as local user', copyMenuLink: 'Copy menu link', shareOnWhatsApp: 'Share on WhatsApp', showQr: 'Show QR', allergens: 'May contain:', sayIt: 'Say it:', saveForNextTime: 'Save for next time' },
  es: { intelligentScan: 'Escaneo inteligente del menú', chooseConfidence: 'Elige con confianza.', description: 'Ve más allá de la traducción. Entiende cada plato, sus ingredientes y si se adapta a tus preferencias.', scanMenu: 'Escanear el menú', scanHint: 'Traduce, entiende y elige', recent: 'Volver al menú reciente', scannedItems: 'platos escaneados', yourMenu: 'Tu menú', account: 'Cuenta', close: 'Cerrar', preferences: 'Preferencias alimentarias', preferenceHint: 'Separa las preferencias con comas, como frutos secos, lácteos o marisco.', language: 'Idioma', languageHint: 'Se usa para traducir el menú y los resultados del escaneo.', savePreferences: 'Guardar preferencias', logOut: 'Cerrar sesión', deleteAccount: 'Eliminar cuenta', beforeScan: 'Antes de escanear', promptHint: 'Indica tus preferencias o alergias para destacar los platos relevantes.', saveNextTime: 'Guardar para la próxima vez', cancel: 'Cancelar', analysing: 'Analizando tu menú', analysingHint: 'Estamos traduciendo los platos, comprobando alérgenos y organizando los resultados.' },
  pt: { intelligentScan: 'Leitura inteligente do menu', chooseConfidence: 'Escolha com confiança.', description: 'Vá além da tradução. Compreenda cada prato, os seus ingredientes e se corresponde às suas preferências.', scanMenu: 'Ler o menu', scanHint: 'Traduza, compreenda e escolha', recent: 'Voltar ao menu recente', scannedItems: 'itens do menu lidos', yourMenu: 'O seu menu', account: 'Conta', close: 'Fechar', preferences: 'Preferências alimentares', preferenceHint: 'Separe as preferências por vírgulas, como frutos secos, laticínios ou marisco.', language: 'Idioma', languageHint: 'Usado para a tradução do menu e os resultados da leitura.', savePreferences: 'Guardar preferências', logOut: 'Terminar sessão', deleteAccount: 'Eliminar conta', beforeScan: 'Antes de ler', promptHint: 'Indique as suas preferências ou alergias para destacarmos os pratos relevantes.', saveNextTime: 'Guardar para a próxima vez', cancel: 'Cancelar', analysing: 'A analisar o seu menu', analysingHint: 'Estamos a traduzir os pratos, a verificar alergénios e a organizar os resultados.' },
  nl: { intelligentScan: 'Intelligente menuscanner', chooseConfidence: 'Kies met vertrouwen.', description: 'Ga verder dan vertalen. Begrijp elk gerecht, de ingrediënten en of het bij je voorkeuren past.', scanMenu: 'Menu scannen', scanHint: 'Vertaal, begrijp en kies', recent: 'Recent menu openen', scannedItems: 'menu-items gescand', yourMenu: 'Jouw menu', account: 'Account', close: 'Sluiten', preferences: 'Voedselvoorkeuren', preferenceHint: 'Scheid voorkeuren met komma’s, zoals noten, zuivel of schaaldieren.', language: 'Taal', languageHint: 'Gebruikt voor menuvertaling en scanresultaten.', savePreferences: 'Voorkeuren opslaan', logOut: 'Uitloggen', deleteAccount: 'Account verwijderen', beforeScan: 'Voor we scannen', promptHint: 'Geef je voorkeuren of allergieën op zodat we passende gerechten kunnen markeren.', saveNextTime: 'Bewaren voor de volgende keer', cancel: 'Annuleren', analysing: 'Je menu wordt geanalyseerd', analysingHint: 'We vertalen gerechten, controleren allergenen en ordenen de resultaten.' },
  uk: { intelligentScan: 'Інтелектуальне сканування меню', chooseConfidence: 'Обирайте впевнено.', description: 'Дізнайтеся про кожну страву, її інгредієнти та відповідність вашим уподобанням.', scanMenu: 'Сканувати меню', scanHint: 'Перекладайте, розумійте та обирайте', recent: 'Повернутися до останнього меню', scannedItems: 'просканованих страв', yourMenu: 'Ваше меню', account: 'Обліковий запис', close: 'Закрити', preferences: 'Харчові уподобання', preferenceHint: 'Вкажіть через кому продукти або інгредієнти, яких ви уникаєте.', language: 'Мова', languageHint: 'Використовується для перекладу меню та результатів сканування.', savePreferences: 'Зберегти уподобання', logOut: 'Вийти', deleteAccount: 'Видалити обліковий запис', beforeScan: 'Перед скануванням', promptHint: 'Вкажіть уподобання або алергії, щоб ми виділили відповідні страви.', saveNextTime: 'Зберегти наступного разу', cancel: 'Скасувати', analysing: 'Аналізуємо ваше меню', analysingHint: 'Перекладаємо страви, перевіряємо алергени та впорядковуємо результати.' },
  ro: { intelligentScan: 'Scanare inteligentă a meniului', chooseConfidence: 'Alege cu încredere.', description: 'Află detalii despre fiecare preparat, ingredientele sale și dacă ți se potrivește.', scanMenu: 'Scanează meniul', scanHint: 'Tradu, înțelege și alege', recent: 'Revino la meniul recent', scannedItems: 'preparate scanate', yourMenu: 'Meniul tău', account: 'Cont', close: 'Închide', preferences: 'Preferințe alimentare', preferenceHint: 'Separă prin virgulă alimentele sau ingredientele pe care le eviți.', language: 'Limbă', languageHint: 'Folosit pentru traducerea meniului și rezultatele scanării.', savePreferences: 'Salvează preferințele', logOut: 'Deconectare', deleteAccount: 'Șterge contul', beforeScan: 'Înainte de scanare', promptHint: 'Adaugă preferințele sau alergiile pentru a evidenția preparatele potrivite.', saveNextTime: 'Salvează pentru data viitoare', cancel: 'Anulează', analysing: 'Îți analizăm meniul', analysingHint: 'Traducem preparatele, verificăm alergenii și organizăm rezultatele.' },
  lt: { intelligentScan: 'Išmanusis meniu skenavimas', chooseConfidence: 'Rinkitės užtikrintai.', description: 'Sužinokite apie kiekvieną patiekalą, jo ingredientus ir ar jis atitinka jūsų poreikius.', scanMenu: 'Skenuoti meniu', scanHint: 'Verskite, supraskite ir rinkitės', recent: 'Grįžti į naujausią meniu', scannedItems: 'nuskenuotų patiekalų', yourMenu: 'Jūsų meniu', account: 'Paskyra', close: 'Uždaryti', preferences: 'Maisto nuostatos', preferenceHint: 'Kableliais atskirkite maisto produktus ar ingredientus, kurių vengiate.', language: 'Kalba', languageHint: 'Naudojama meniu vertimui ir skenavimo rezultatams.', savePreferences: 'Išsaugoti nuostatas', logOut: 'Atsijungti', deleteAccount: 'Ištrinti paskyrą', beforeScan: 'Prieš skenuojant', promptHint: 'Nurodykite nuostatas ar alergijas, kad išskirtume tinkamus patiekalus.', saveNextTime: 'Išsaugoti kitam kartui', cancel: 'Atšaukti', analysing: 'Analizuojame jūsų meniu', analysingHint: 'Verčiame patiekalus, tikriname alergenus ir tvarkome rezultatus.' },
  sv: { intelligentScan: 'Smart menyskanning', chooseConfidence: 'Välj med trygghet.', description: 'Förstå varje rätt, dess ingredienser och om den passar dina önskemål.', scanMenu: 'Skanna menyn', scanHint: 'Översätt, förstå och välj', recent: 'Återgå till senaste menyn', scannedItems: 'skannade menyrätter', yourMenu: 'Din meny', account: 'Konto', close: 'Stäng', preferences: 'Matpreferenser', preferenceHint: 'Separera mat eller ingredienser du undviker med kommatecken.', language: 'Språk', languageHint: 'Används för menyöversättning och skanningsresultat.', savePreferences: 'Spara preferenser', logOut: 'Logga ut', deleteAccount: 'Ta bort konto', beforeScan: 'Innan vi skannar', promptHint: 'Ange preferenser eller allergier så markerar vi relevanta rätter.', saveNextTime: 'Spara till nästa gång', cancel: 'Avbryt', analysing: 'Analyserar din meny', analysingHint: 'Vi översätter rätter, kontrollerar allergener och ordnar resultaten.' },
  fi: { intelligentScan: 'Älykäs ruokalistan skannaus', chooseConfidence: 'Valitse luottavaisin mielin.', description: 'Tutustu jokaiseen annokseen, sen ainesosiin ja siihen, sopiiko se mieltymyksiisi.', scanMenu: 'Skannaa ruokalista', scanHint: 'Käännä, ymmärrä ja valitse', recent: 'Palaa viimeisimpään ruokalistaan', scannedItems: 'skannattua ruokalistan annosta', yourMenu: 'Ruokalistasi', account: 'Tili', close: 'Sulje', preferences: 'Ruokamieltymykset', preferenceHint: 'Erota vältettävät ruoat tai ainesosat pilkuilla.', language: 'Kieli', languageHint: 'Käytetään ruokalistan kääntämiseen ja skannaustuloksiin.', savePreferences: 'Tallenna mieltymykset', logOut: 'Kirjaudu ulos', deleteAccount: 'Poista tili', beforeScan: 'Ennen skannausta', promptHint: 'Kerro mieltymyksesi tai allergiasi, jotta voimme korostaa sopivat annokset.', saveNextTime: 'Tallenna seuraavaa kertaa varten', cancel: 'Peruuta', analysing: 'Analysoimme ruokalistaasi', analysingHint: 'Käännämme annoksia, tarkistamme allergeenit ja järjestämme tulokset.' },
  nb: { intelligentScan: 'Intelligent menyskanning', chooseConfidence: 'Velg med trygghet.', description: 'Forstå hver rett, ingrediensene og om den passer for deg.', scanMenu: 'Skann menyen', scanHint: 'Oversett, forstå og velg', recent: 'Gå tilbake til siste meny', scannedItems: 'skannede retter', yourMenu: 'Menyen din', account: 'Konto', close: 'Lukk', preferences: 'Matpreferanser', preferenceHint: 'Skill mat eller ingredienser du unngår med komma.', language: 'Språk', languageHint: 'Brukes til menyoversettelse og skanneresultater.', savePreferences: 'Lagre preferanser', logOut: 'Logg ut', deleteAccount: 'Slett konto', beforeScan: 'Før vi skanner', promptHint: 'Oppgi preferanser eller allergier, så fremhever vi relevante retter.', saveNextTime: 'Lagre til neste gang', cancel: 'Avbryt', analysing: 'Analyserer menyen din', analysingHint: 'Vi oversetter retter, sjekker allergener og organiserer resultatene.' },
  da: { intelligentScan: 'Intelligent menuskanning', chooseConfidence: 'Vælg med tryghed.', description: 'Forstå hver ret, dens ingredienser, og om den passer til dine præferencer.', scanMenu: 'Scan menuen', scanHint: 'Oversæt, forstå og vælg', recent: 'Gå tilbage til seneste menu', scannedItems: 'scannede retter', yourMenu: 'Din menu', account: 'Konto', close: 'Luk', preferences: 'Madpræferencer', preferenceHint: 'Adskil mad eller ingredienser, du undgår, med kommaer.', language: 'Sprog', languageHint: 'Bruges til menuoversættelse og scanningsresultater.', savePreferences: 'Gem præferencer', logOut: 'Log ud', deleteAccount: 'Slet konto', beforeScan: 'Før vi scanner', promptHint: 'Angiv præferencer eller allergier, så fremhæver vi relevante retter.', saveNextTime: 'Gem til næste gang', cancel: 'Annuller', analysing: 'Analyserer din menu', analysingHint: 'Vi oversætter retter, tjekker allergener og organiserer resultaterne.' },
  ko: { intelligentScan: '지능형 메뉴 스캔', chooseConfidence: '안심하고 선택하세요.', description: '번역을 넘어 각 요리와 재료를 이해하고, 나의 선호에 맞는지 확인하세요.', scanMenu: '메뉴 스캔', scanHint: '번역하고, 이해하고, 선택하세요', recent: '최근 메뉴로 돌아가기', scannedItems: '개 메뉴 스캔됨', yourMenu: '내 메뉴', account: '계정', close: '닫기', preferences: '음식 선호', preferenceHint: '피하는 음식이나 재료를 쉼표로 구분해 입력하세요.', language: '언어', languageHint: '메뉴 번역과 스캔 결과에 사용됩니다.', savePreferences: '선호 저장', logOut: '로그아웃', deleteAccount: '계정 삭제', beforeScan: '스캔하기 전에', promptHint: '선호 음식이나 알레르기를 알려주시면 관련 요리를 표시해 드립니다.', saveNextTime: '다음에도 저장', cancel: '취소', analysing: '메뉴를 분석하는 중', analysingHint: '요리를 번역하고 알레르기 유발 성분을 확인하는 중입니다.', authTitle: '메뉴를 스캔하고, 무엇을 주문하는지 알아보세요.', authSubtitle: 'AI로 메뉴를 스캔하고 음식 선호를 저장하려면 로그인하세요.', continueGoogle: 'Google로 계속하기', continueApple: 'Apple로 계속하기', localAuth: '로컬 사용자로 계속하기' },
} as const;
type LegalUiText = { sectionTitle: string; privacyPolicy: string; termsAndConditions: string };
const legalUiText: Record<SharedLanguage, LegalUiText> = {
  en: { sectionTitle: 'Legal', privacyPolicy: 'Privacy Policy', termsAndConditions: 'Terms and Conditions' },
  es: { sectionTitle: 'Información legal', privacyPolicy: 'Política de privacidad', termsAndConditions: 'Términos y condiciones' },
  pt: { sectionTitle: 'Informação legal', privacyPolicy: 'Política de privacidade', termsAndConditions: 'Termos e condições' },
  nl: { sectionTitle: 'Juridische informatie', privacyPolicy: 'Privacybeleid', termsAndConditions: 'Algemene voorwaarden' },
  uk: { sectionTitle: 'Юридична інформація', privacyPolicy: 'Політика конфіденційності', termsAndConditions: 'Умови використання' },
  ro: { sectionTitle: 'Informații juridice', privacyPolicy: 'Politica de confidențialitate', termsAndConditions: 'Termeni și condiții' },
  lt: { sectionTitle: 'Teisinė informacija', privacyPolicy: 'Privatumo politika', termsAndConditions: 'Naudojimo sąlygos' },
  sv: { sectionTitle: 'Juridisk information', privacyPolicy: 'Integritetspolicy', termsAndConditions: 'Villkor' },
  fi: { sectionTitle: 'Oikeudelliset tiedot', privacyPolicy: 'Tietosuojakäytäntö', termsAndConditions: 'Käyttöehdot' },
  nb: { sectionTitle: 'Juridisk informasjon', privacyPolicy: 'Personvernerklæring', termsAndConditions: 'Vilkår og betingelser' },
  da: { sectionTitle: 'Juridiske oplysninger', privacyPolicy: 'Privatlivspolitik', termsAndConditions: 'Vilkår og betingelser' },
  'zh-CN': { sectionTitle: '法律信息', privacyPolicy: '隐私政策', termsAndConditions: '条款和条件' },
  ja: { sectionTitle: '法的情報', privacyPolicy: 'プライバシーポリシー', termsAndConditions: '利用規約' },
  ko: { sectionTitle: '법률 정보', privacyPolicy: '개인정보 처리방침', termsAndConditions: '이용약관' },
};
type AuthUiText = { authTitle: string; authSubtitle: string; continueGoogle: string; continueApple: string };
const authUiText: Partial<Record<SharedLanguage, AuthUiText>> = {
  es: { authTitle: 'Escanea un menú. Descubre qué estás pidiendo.', authSubtitle: 'Inicia sesión para escanear menús con IA y guardar tus preferencias alimentarias.', continueGoogle: 'Continuar con Google', continueApple: 'Continuar con Apple' },
  pt: { authTitle: 'Leia um menu. Saiba o que está a pedir.', authSubtitle: 'Inicie sessão para ler menus com IA e guardar as suas preferências alimentares.', continueGoogle: 'Continuar com o Google', continueApple: 'Continuar com a Apple' },
  nl: { authTitle: 'Scan een menu. Weet wat je bestelt.', authSubtitle: 'Log in om menu’s met AI te scannen en je voedselvoorkeuren op te slaan.', continueGoogle: 'Doorgaan met Google', continueApple: 'Doorgaan met Apple' },
  uk: { authTitle: 'Скануйте меню. Знайте, що замовляєте.', authSubtitle: 'Увійдіть, щоб сканувати меню за допомогою ШІ та зберігати свої харчові уподобання.', continueGoogle: 'Продовжити через Google', continueApple: 'Продовжити через Apple' },
  ro: { authTitle: 'Scanează un meniu. Află ce comanzi.', authSubtitle: 'Autentifică-te pentru a scana meniuri cu ajutorul inteligenței artificiale și a salva preferințele alimentare.', continueGoogle: 'Continuă cu Google', continueApple: 'Continuă cu Apple' },
  lt: { authTitle: 'Nuskenuokite meniu. Žinokite, ką užsisakote.', authSubtitle: 'Prisijunkite, kad galėtumėte skenuoti meniu su dirbtiniu intelektu ir išsaugoti maisto nuostatas.', continueGoogle: 'Tęsti su „Google“', continueApple: 'Tęsti su „Apple“' },
  sv: { authTitle: 'Skanna en meny. Vet vad du beställer.', authSubtitle: 'Logga in för att skanna menyer med AI och spara dina matpreferenser.', continueGoogle: 'Fortsätt med Google', continueApple: 'Fortsätt med Apple' },
  fi: { authTitle: 'Skannaa ruokalista. Tiedä, mitä tilaat.', authSubtitle: 'Kirjaudu sisään skannataksesi ruokalistoja tekoälyn avulla ja tallentaaksesi ruokamieltymyksesi.', continueGoogle: 'Jatka Googlella', continueApple: 'Jatka Applella' },
  nb: { authTitle: 'Skann en meny. Vit hva du bestiller.', authSubtitle: 'Logg inn for å skanne menyer med kunstig intelligens og lagre matpreferansene dine.', continueGoogle: 'Fortsett med Google', continueApple: 'Fortsett med Apple' },
  da: { authTitle: 'Scan en menu. Vær sikker på, hvad du bestiller.', authSubtitle: 'Log ind for at scanne menuer med AI og gemme dine madpræferencer.', continueGoogle: 'Fortsæt med Google', continueApple: 'Fortsæt med Apple' },
  'zh-CN': { authTitle: '扫描菜单，了解你点的是什么。', authSubtitle: '登录后即可使用 AI 扫描菜单并保存你的饮食偏好。', continueGoogle: '继续使用 Google', continueApple: '继续使用 Apple' },
  ja: { authTitle: 'メニューをスキャンして、注文する料理を知りましょう。', authSubtitle: 'ログインすると、AIでメニューをスキャンして食の好みを保存できます。', continueGoogle: 'Googleで続行', continueApple: 'Appleで続行' },
};
type UiLanguage = keyof typeof uiText;
type UiText = typeof uiText.en;
type LocalizedUiText = Record<'howItWorks' | 'howItWorksHint' | 'howItWorksCapture' | 'howItWorksCaptureHint' | 'howItWorksUnderstand' | 'howItWorksUnderstandHint' | 'howItWorksChoose' | 'howItWorksChooseHint' | 'promptHint' | 'analysingHint' | 'allergens' | 'sayIt', string>;
const localizedUiText: Record<SharedLanguage, LocalizedUiText> = {
  en: { howItWorks: uiText.en.howItWorks, howItWorksHint: uiText.en.howItWorksHint, howItWorksCapture: uiText.en.howItWorksCapture, howItWorksCaptureHint: uiText.en.howItWorksCaptureHint, howItWorksUnderstand: uiText.en.howItWorksUnderstand, howItWorksUnderstandHint: uiText.en.howItWorksUnderstandHint, howItWorksChoose: uiText.en.howItWorksChoose, howItWorksChooseHint: uiText.en.howItWorksChooseHint, promptHint: uiText.en.promptHint, analysingHint: uiText.en.analysingHint, allergens: uiText.en.allergens, sayIt: uiText.en.sayIt },
  es: { howItWorks: 'Así te ayuda Roamenu a elegir', howItWorksHint: 'Un vistazo rápido a lo que ocurre después de escanear.', howItWorksCapture: 'Captura el menú', howItWorksCaptureHint: 'Haz una foto clara de los platos.', howItWorksUnderstand: 'Entiende cada plato', howItWorksUnderstandHint: 'Consulta traducciones, ingredientes y detalles útiles.', howItWorksChoose: 'Elige lo que te conviene', howItWorksChooseHint: 'Usa tus preferencias para encontrar una mejor opción.', promptHint: 'Indica tus preferencias o ingredientes que podrían no sentarte bien para destacar los platos adecuados.', analysingHint: 'Traducimos los platos, comprobamos los ingredientes y organizamos los resultados.', allergens: 'Puede contener:', sayIt: 'Cómo decirlo:' },
  pt: { howItWorks: 'Veja como o Roamenu ajuda a escolher', howItWorksHint: 'Uma visão rápida do que acontece depois de digitalizar.', howItWorksCapture: 'Capture o menu', howItWorksCaptureHint: 'Tire uma fotografia nítida dos pratos.', howItWorksUnderstand: 'Compreenda cada prato', howItWorksUnderstandHint: 'Veja traduções, ingredientes e detalhes úteis.', howItWorksChoose: 'Escolha o que lhe convém', howItWorksChooseHint: 'Use as suas preferências para encontrar uma opção melhor.', promptHint: 'Indique as suas preferências ou ingredientes que podem não lhe fazer bem para destacarmos os pratos adequados.', analysingHint: 'Estamos a traduzir os pratos, a verificar os ingredientes e a organizar os resultados.', allergens: 'Pode conter:', sayIt: 'Como dizer:' },
  nl: { howItWorks: 'Zo helpt Roamenu je kiezen', howItWorksHint: 'Een korte blik op wat er na het scannen gebeurt.', howItWorksCapture: 'Scan het menu', howItWorksCaptureHint: 'Maak een duidelijke foto van de gerechten.', howItWorksUnderstand: 'Begrijp elk gerecht', howItWorksUnderstandHint: 'Bekijk vertalingen, ingrediënten en nuttige details.', howItWorksChoose: 'Kies wat bij je past', howItWorksChooseHint: 'Gebruik je voorkeuren om een betere keuze te vinden.', promptHint: 'Geef je voorkeuren of ingrediënten op die mogelijk niet bij je passen, zodat we geschikte gerechten kunnen markeren.', analysingHint: 'We vertalen gerechten, controleren ingrediënten en ordenen de resultaten.', allergens: 'Kan bevatten:', sayIt: 'Zo zeg je het:' },
  uk: { howItWorks: 'Як Roamenu допомагає обирати', howItWorksHint: 'Коротко про те, що відбувається після сканування.', howItWorksCapture: 'Сфотографуйте меню', howItWorksCaptureHint: 'Зробіть чітке фото страв.', howItWorksUnderstand: 'Зрозумійте кожну страву', howItWorksUnderstandHint: 'Переглядайте переклади, інгредієнти та корисні деталі.', howItWorksChoose: 'Оберіть те, що вам підходить', howItWorksChooseHint: 'Використовуйте свої уподобання, щоб знайти кращий варіант.', promptHint: 'Вкажіть свої уподобання або інгредієнти, які можуть вам не підходити, щоб ми виділили відповідні страви.', analysingHint: 'Перекладаємо страви, перевіряємо інгредієнти та впорядковуємо результати.', allergens: 'Може містити:', sayIt: 'Як вимовити:' },
  ro: { howItWorks: 'Vezi cum te ajută Roamenu să alegi', howItWorksHint: 'O privire rapidă asupra a ceea ce se întâmplă după scanare.', howItWorksCapture: 'Fotografiază meniul', howItWorksCaptureHint: 'Fă o fotografie clară a preparatelor.', howItWorksUnderstand: 'Înțelege fiecare preparat', howItWorksUnderstandHint: 'Vezi traduceri, ingrediente și detalii utile.', howItWorksChoose: 'Alege ce ți se potrivește', howItWorksChooseHint: 'Folosește preferințele pentru a găsi o opțiune mai potrivită.', promptHint: 'Adaugă preferințele sau ingredientele care s-ar putea să nu ți se potrivească pentru a evidenția preparatele potrivite.', analysingHint: 'Traducem preparatele, verificăm ingredientele și organizăm rezultatele.', allergens: 'Poate conține:', sayIt: 'Cum se spune:' },
  lt: { howItWorks: 'Sužinokite, kaip Roamenu padeda rinktis', howItWorksHint: 'Trumpai apie tai, kas vyksta nuskaičius meniu.', howItWorksCapture: 'Nufotografuokite meniu', howItWorksCaptureHint: 'Aiškiai nufotografuokite patiekalus.', howItWorksUnderstand: 'Supraskite kiekvieną patiekalą', howItWorksUnderstandHint: 'Peržiūrėkite vertimus, ingredientus ir naudingą informaciją.', howItWorksChoose: 'Rinkitės tai, kas jums tinka', howItWorksChooseHint: 'Naudokite savo nuostatas, kad rastumėte tinkamesnį variantą.', promptHint: 'Nurodykite nuostatas ar ingredientus, kurie jums gali netikti, kad išskirtume tinkamus patiekalus.', analysingHint: 'Verčiame patiekalus, tikriname ingredientus ir tvarkome rezultatus.', allergens: 'Gali būti:', sayIt: 'Kaip ištarti:' },
  sv: { howItWorks: 'Se hur Roamenu hjälper dig att välja', howItWorksHint: 'En snabb titt på vad som händer efter skanningen.', howItWorksCapture: 'Fota menyn', howItWorksCaptureHint: 'Ta ett tydligt foto av rätterna.', howItWorksUnderstand: 'Förstå varje rätt', howItWorksUnderstandHint: 'Se översättningar, ingredienser och användbara detaljer.', howItWorksChoose: 'Välj det som passar dig', howItWorksChooseHint: 'Använd dina önskemål för att hitta ett bättre alternativ.', promptHint: 'Ange önskemål eller ingredienser som kanske inte passar dig, så markerar vi relevanta rätter.', analysingHint: 'Vi översätter rätter, kontrollerar ingredienser och ordnar resultaten.', allergens: 'Kan innehålla:', sayIt: 'Så uttalas det:' },
  fi: { howItWorks: 'Näin Roamenu auttaa sinua valitsemaan', howItWorksHint: 'Nopea katsaus siihen, mitä skannauksen jälkeen tapahtuu.', howItWorksCapture: 'Kuvaa ruokalista', howItWorksCaptureHint: 'Ota selkeä kuva annoksista.', howItWorksUnderstand: 'Ymmärrä jokainen annos', howItWorksUnderstandHint: 'Näe käännökset, ainesosat ja hyödylliset tiedot.', howItWorksChoose: 'Valitse sinulle sopiva', howItWorksChooseHint: 'Käytä mieltymyksiäsi löytääksesi paremman vaihtoehdon.', promptHint: 'Kerro mieltymyksesi tai ainesosat, jotka eivät ehkä sovi sinulle, jotta voimme korostaa sopivia annoksia.', analysingHint: 'Käännämme annokset, tarkistamme ainesosat ja järjestämme tulokset.', allergens: 'Saattaa sisältää:', sayIt: 'Lausutaan:' },
  nb: { howItWorks: 'Se hvordan Roamenu hjelper deg å velge', howItWorksHint: 'En rask titt på hva som skjer etter skanningen.', howItWorksCapture: 'Ta bilde av menyen', howItWorksCaptureHint: 'Ta et tydelig bilde av rettene.', howItWorksUnderstand: 'Forstå hver rett', howItWorksUnderstandHint: 'Se oversettelser, ingredienser og nyttige detaljer.', howItWorksChoose: 'Velg det som passer deg', howItWorksChooseHint: 'Bruk preferansene dine for å finne et bedre alternativ.', promptHint: 'Oppgi preferanser eller ingredienser som kanskje ikke passer for deg, så fremhever vi relevante retter.', analysingHint: 'Vi oversetter retter, sjekker ingredienser og organiserer resultatene.', allergens: 'Kan inneholde:', sayIt: 'Slik sier du det:' },
  da: { howItWorks: 'Se hvordan Roamenu hjælper dig med at vælge', howItWorksHint: 'Et hurtigt kig på, hvad der sker efter scanningen.', howItWorksCapture: 'Fotografér menuen', howItWorksCaptureHint: 'Tag et tydeligt billede af retterne.', howItWorksUnderstand: 'Forstå hver ret', howItWorksUnderstandHint: 'Se oversættelser, ingredienser og nyttige detaljer.', howItWorksChoose: 'Vælg det, der passer til dig', howItWorksChooseHint: 'Brug dine præferencer til at finde et bedre valg.', promptHint: 'Angiv præferencer eller ingredienser, der måske ikke passer til dig, så fremhæver vi relevante retter.', analysingHint: 'Vi oversætter retter, tjekker ingredienser og organiserer resultaterne.', allergens: 'Kan indeholde:', sayIt: 'Sådan siger du det:' },
  'zh-CN': { howItWorks: '看看 Roamenu 如何帮助你选择', howItWorksHint: '快速了解扫描后会发生什么。', howItWorksCapture: '拍摄菜单', howItWorksCaptureHint: '清晰拍下菜品菜单。', howItWorksUnderstand: '了解每道菜', howItWorksUnderstandHint: '查看翻译、配料和实用信息。', howItWorksChoose: '选择适合你的菜品', howItWorksChooseHint: '使用你的偏好找到更合适的选择。', promptHint: '告诉我们你的饮食偏好或可能不适合你的配料，以便突出合适的菜品。', analysingHint: '正在翻译菜品、检查配料并整理结果。', allergens: '可能含有：', sayIt: '读法：' },
  ja: { howItWorks: 'Roamenu の選び方サポートを見る', howItWorksHint: 'スキャン後に何が起こるかを簡単に紹介します。', howItWorksCapture: 'メニューを撮影', howItWorksCaptureHint: '料理がはっきり見える写真を撮ります。', howItWorksUnderstand: '料理を理解', howItWorksUnderstandHint: '翻訳、食材、役立つ詳細を確認できます。', howItWorksChoose: '自分に合う料理を選ぶ', howItWorksChooseHint: '好みを使って、より合う選択肢を見つけます。', promptHint: '好みや合わない可能性のある食材を入力すると、合う料理を目立たせます。', analysingHint: '料理を翻訳し、食材を確認して結果を整理しています。', allergens: '含まれる可能性：', sayIt: '読み方：' },
  ko: { howItWorks: 'Roamenu가 선택을 돕는 방법', howItWorksHint: '스캔 후 어떤 일이 일어나는지 간단히 확인하세요.', howItWorksCapture: '메뉴 촬영하기', howItWorksCaptureHint: '요리가 잘 보이도록 선명하게 촬영하세요.', howItWorksUnderstand: '요리 이해하기', howItWorksUnderstandHint: '번역, 재료와 유용한 정보를 확인하세요.', howItWorksChoose: '나에게 맞는 요리 선택하기', howItWorksChooseHint: '선호를 사용해 더 잘 맞는 선택을 찾아보세요.', promptHint: '선호 음식이나 나에게 맞지 않을 수 있는 재료를 알려주시면 관련 요리를 표시합니다.', analysingHint: '요리를 번역하고 재료를 확인한 뒤 결과를 정리하는 중입니다.', allergens: '포함될 수 있음:', sayIt: '발음:' },
};
const preferenceWarningHints: Record<SharedLanguage, string> = {
  en: 'Spot dishes that may not suit your preferences.', es: 'Detecta platos que quizá no se adapten a tus preferencias.', pt: 'Identifique pratos que podem não se adequar às suas preferências.', nl: 'Spot gerechten die misschien niet bij je voorkeuren passen.', uk: 'Помічайте страви, які можуть не відповідати вашим уподобанням.', ro: 'Identifică preparatele care s-ar putea să nu se potrivească preferințelor tale.', lt: 'Pastebėkite patiekalus, kurie gali neatitikti jūsų nuostatų.', sv: 'Se vilka rätter som kanske inte passar dina önskemål.', fi: 'Tunnista annokset, jotka eivät ehkä sovi mieltymyksiisi.', nb: 'Se hvilke retter som kanskje ikke passer preferansene dine.', da: 'Se, hvilke retter der måske ikke passer til dine præferencer.', 'zh-CN': '发现可能不符合你偏好的菜品。', ja: '好みに合わない可能性のある料理を見つけます。', ko: '내 선호에 맞지 않을 수 있는 요리를 확인하세요.',
};
for (const language of Object.keys(preferenceWarningHints) as SharedLanguage[]) localizedUiText[language].howItWorksChooseHint = preferenceWarningHints[language];
type ExtraUiText = Record<'copyMenuLink' | 'shareOnWhatsApp' | 'showQr' | 'allergens' | 'saveForNextTime', string>;
type PasswordAuthLabels = {
  signIn: string;
  createAccount: string;
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  useAtLeast: string;
  switchToRegister: string;
  switchToSignIn: string;
  orContinueWith: string;
  emailRequired: string;
  passwordTooShort: string;
  nameLength: string;
  passwordsMismatch: string;
  authFailed: string;
};

const passwordAuthLabels: Record<SharedLanguage, PasswordAuthLabels> = {
  en: { signIn: 'Sign in with email', createAccount: 'Create account', displayName: 'Name', email: 'Email', password: 'Password', confirmPassword: 'Confirm password', useAtLeast: 'Use at least 12 characters.', switchToRegister: 'Need an account? Create one', switchToSignIn: 'Already have an account? Sign in', orContinueWith: 'or continue with', emailRequired: 'Enter a valid email address.', passwordTooShort: 'Password must be at least 12 characters.', nameLength: 'Name must be between 2 and 80 characters.', passwordsMismatch: 'Passwords do not match.', authFailed: 'Authentication failed.' },
  es: { signIn: 'Iniciar sesión con email', createAccount: 'Crear cuenta', displayName: 'Nombre', email: 'Email', password: 'Contraseña', confirmPassword: 'Confirmar contraseña', useAtLeast: 'Usa al menos 12 caracteres.', switchToRegister: '¿Necesitas una cuenta? Créala', switchToSignIn: '¿Ya tienes una cuenta? Inicia sesión', orContinueWith: 'o continúa con', emailRequired: 'Introduce una dirección de email válida.', passwordTooShort: 'La contraseña debe tener al menos 12 caracteres.', nameLength: 'El nombre debe tener entre 2 y 80 caracteres.', passwordsMismatch: 'Las contraseñas no coinciden.', authFailed: 'La autenticación ha fallado.' },
  pt: { signIn: 'Iniciar sessão com email', createAccount: 'Criar conta', displayName: 'Nome', email: 'Email', password: 'Palavra-passe', confirmPassword: 'Confirmar palavra-passe', useAtLeast: 'Use pelo menos 12 caracteres.', switchToRegister: 'Precisa de uma conta? Crie uma', switchToSignIn: 'Já tem uma conta? Inicie sessão', orContinueWith: 'ou continue com', emailRequired: 'Introduza um endereço de email válido.', passwordTooShort: 'A palavra-passe deve ter pelo menos 12 caracteres.', nameLength: 'O nome deve ter entre 2 e 80 caracteres.', passwordsMismatch: 'As palavras-passe não coincidem.', authFailed: 'A autenticação falhou.' },
  nl: { signIn: 'Inloggen met e-mail', createAccount: 'Account aanmaken', displayName: 'Naam', email: 'E-mail', password: 'Wachtwoord', confirmPassword: 'Wachtwoord bevestigen', useAtLeast: 'Gebruik minstens 12 tekens.', switchToRegister: 'Nog geen account? Maak er een', switchToSignIn: 'Heb je al een account? Log in', orContinueWith: 'of ga door met', emailRequired: 'Voer een geldig e-mailadres in.', passwordTooShort: 'Het wachtwoord moet minstens 12 tekens bevatten.', nameLength: 'De naam moet tussen 2 en 80 tekens bevatten.', passwordsMismatch: 'De wachtwoorden komen niet overeen.', authFailed: 'Authenticatie mislukt.' },
  uk: { signIn: 'Увійти за допомогою email', createAccount: 'Створити обліковий запис', displayName: 'Ім’я', email: 'Email', password: 'Пароль', confirmPassword: 'Підтвердіть пароль', useAtLeast: 'Використайте щонайменше 12 символів.', switchToRegister: 'Потрібен обліковий запис? Створіть його', switchToSignIn: 'Вже маєте обліковий запис? Увійдіть', orContinueWith: 'або продовжте через', emailRequired: 'Введіть дійсну адресу email.', passwordTooShort: 'Пароль має містити щонайменше 12 символів.', nameLength: 'Ім’я має містити від 2 до 80 символів.', passwordsMismatch: 'Паролі не збігаються.', authFailed: 'Помилка автентифікації.' },
  ro: { signIn: 'Autentificare cu email', createAccount: 'Creează cont', displayName: 'Nume', email: 'Email', password: 'Parolă', confirmPassword: 'Confirmă parola', useAtLeast: 'Folosește cel puțin 12 caractere.', switchToRegister: 'Ai nevoie de un cont? Creează unul', switchToSignIn: 'Ai deja un cont? Autentifică-te', orContinueWith: 'sau continuă cu', emailRequired: 'Introdu o adresă de email validă.', passwordTooShort: 'Parola trebuie să aibă cel puțin 12 caractere.', nameLength: 'Numele trebuie să aibă între 2 și 80 de caractere.', passwordsMismatch: 'Parolele nu coincid.', authFailed: 'Autentificarea a eșuat.' },
  lt: { signIn: 'Prisijungti el. paštu', createAccount: 'Sukurti paskyrą', displayName: 'Vardas', email: 'El. paštas', password: 'Slaptažodis', confirmPassword: 'Patvirtinkite slaptažodį', useAtLeast: 'Naudokite bent 12 simbolių.', switchToRegister: 'Neturite paskyros? Sukurkite ją', switchToSignIn: 'Jau turite paskyrą? Prisijunkite', orContinueWith: 'arba tęskite naudodami', emailRequired: 'Įveskite galiojantį el. pašto adresą.', passwordTooShort: 'Slaptažodį turi sudaryti bent 12 simbolių.', nameLength: 'Vardą turi sudaryti nuo 2 iki 80 simbolių.', passwordsMismatch: 'Slaptažodžiai nesutampa.', authFailed: 'Nepavyko autentifikuoti.' },
  sv: { signIn: 'Logga in med e-post', createAccount: 'Skapa konto', displayName: 'Namn', email: 'E-post', password: 'Lösenord', confirmPassword: 'Bekräfta lösenord', useAtLeast: 'Använd minst 12 tecken.', switchToRegister: 'Behöver du ett konto? Skapa ett', switchToSignIn: 'Har du redan ett konto? Logga in', orContinueWith: 'eller fortsätt med', emailRequired: 'Ange en giltig e-postadress.', passwordTooShort: 'Lösenordet måste innehålla minst 12 tecken.', nameLength: 'Namnet måste innehålla 2 till 80 tecken.', passwordsMismatch: 'Lösenorden matchar inte.', authFailed: 'Autentiseringen misslyckades.' },
  fi: { signIn: 'Kirjaudu sähköpostilla', createAccount: 'Luo tili', displayName: 'Nimi', email: 'Sähköposti', password: 'Salasana', confirmPassword: 'Vahvista salasana', useAtLeast: 'Käytä vähintään 12 merkkiä.', switchToRegister: 'Eikö sinulla ole tiliä? Luo tili', switchToSignIn: 'Onko sinulla jo tili? Kirjaudu sisään', orContinueWith: 'tai jatka käyttäen', emailRequired: 'Anna kelvollinen sähköpostiosoite.', passwordTooShort: 'Salasanassa on oltava vähintään 12 merkkiä.', nameLength: 'Nimessä on oltava 2–80 merkkiä.', passwordsMismatch: 'Salasanat eivät täsmää.', authFailed: 'Todennus epäonnistui.' },
  nb: { signIn: 'Logg inn med e-post', createAccount: 'Opprett konto', displayName: 'Navn', email: 'E-post', password: 'Passord', confirmPassword: 'Bekreft passord', useAtLeast: 'Bruk minst 12 tegn.', switchToRegister: 'Trenger du en konto? Opprett en', switchToSignIn: 'Har du allerede en konto? Logg inn', orContinueWith: 'eller fortsett med', emailRequired: 'Skriv inn en gyldig e-postadresse.', passwordTooShort: 'Passordet må ha minst 12 tegn.', nameLength: 'Navnet må ha mellom 2 og 80 tegn.', passwordsMismatch: 'Passordene samsvarer ikke.', authFailed: 'Autentiseringen mislyktes.' },
  da: { signIn: 'Log ind med e-mail', createAccount: 'Opret konto', displayName: 'Navn', email: 'E-mail', password: 'Adgangskode', confirmPassword: 'Bekræft adgangskode', useAtLeast: 'Brug mindst 12 tegn.', switchToRegister: 'Har du brug for en konto? Opret en', switchToSignIn: 'Har du allerede en konto? Log ind', orContinueWith: 'eller fortsæt med', emailRequired: 'Indtast en gyldig e-mailadresse.', passwordTooShort: 'Adgangskoden skal have mindst 12 tegn.', nameLength: 'Navnet skal have mellem 2 og 80 tegn.', passwordsMismatch: 'Adgangskoderne er ikke ens.', authFailed: 'Godkendelsen mislykkedes.' },
  'zh-CN': { signIn: '使用邮箱登录', createAccount: '创建账户', displayName: '姓名', email: '邮箱', password: '密码', confirmPassword: '确认密码', useAtLeast: '请至少使用 12 个字符。', switchToRegister: '还没有账户？创建账户', switchToSignIn: '已有账户？登录', orContinueWith: '或继续使用', emailRequired: '请输入有效的邮箱地址。', passwordTooShort: '密码至少需要 12 个字符。', nameLength: '姓名长度必须为 2 到 80 个字符。', passwordsMismatch: '两次输入的密码不一致。', authFailed: '身份验证失败。' },
  ja: { signIn: 'メールアドレスでログイン', createAccount: 'アカウントを作成', displayName: '名前', email: 'メールアドレス', password: 'パスワード', confirmPassword: 'パスワードを確認', useAtLeast: '12文字以上で入力してください。', switchToRegister: 'アカウントが必要ですか？作成する', switchToSignIn: 'すでにアカウントをお持ちですか？ログイン', orContinueWith: 'または次で続行', emailRequired: '有効なメールアドレスを入力してください。', passwordTooShort: 'パスワードは12文字以上で入力してください。', nameLength: '名前は2～80文字で入力してください。', passwordsMismatch: 'パスワードが一致しません。', authFailed: '認証に失敗しました。' },
  ko: { signIn: '이메일로 로그인', createAccount: '계정 만들기', displayName: '이름', email: '이메일', password: '비밀번호', confirmPassword: '비밀번호 확인', useAtLeast: '12자 이상 입력하세요.', switchToRegister: '계정이 없나요? 계정 만들기', switchToSignIn: '이미 계정이 있나요? 로그인', orContinueWith: '또는 다음으로 계속하기', emailRequired: '유효한 이메일 주소를 입력하세요.', passwordTooShort: '비밀번호는 12자 이상이어야 합니다.', nameLength: '이름은 2~80자여야 합니다.', passwordsMismatch: '비밀번호가 일치하지 않습니다.', authFailed: '인증에 실패했습니다.' },
};

function localiseAuthError(error: string, labels: PasswordAuthLabels): string {
  if (error.startsWith('Google ')) return error;
  if (error.startsWith('Mock ')) return error;
  if (error.includes('valid email') || error.includes('Email and password')) return labels.emailRequired;
  if (error.includes('at least 12')) return labels.passwordTooShort;
  if (error.includes('between 2 and 80')) return labels.nameLength;
  if (error.includes('Passwords do not match')) return labels.passwordsMismatch;
  if (error === 'Network request failed.') return 'Unable to reach the authentication server.';
  if (error === 'Authentication failed.' || error === 'Sign-in failed.' || error.includes('Authentication succeeded') || error.includes('Unable to')) return labels.authFailed;
  return labels.authFailed;
}

const extraUiText: Partial<Record<UiLanguage, ExtraUiText>> = {
  es: { copyMenuLink: 'Copiar enlace del menú', shareOnWhatsApp: 'Compartir por WhatsApp', showQr: 'Mostrar QR', allergens: 'Puede contener:', saveForNextTime: 'Guardar para la próxima vez' },
  pt: { copyMenuLink: 'Copiar link do menu', shareOnWhatsApp: 'Partilhar no WhatsApp', showQr: 'Mostrar QR', allergens: 'Pode conter:', saveForNextTime: 'Guardar para a próxima vez' },
  nl: { copyMenuLink: 'Menulink kopiëren', shareOnWhatsApp: 'Delen via WhatsApp', showQr: 'QR tonen', allergens: 'Kan bevatten:', saveForNextTime: 'Bewaren voor de volgende keer' },
  uk: { copyMenuLink: 'Копіювати посилання на меню', shareOnWhatsApp: 'Поділитися у WhatsApp', showQr: 'Показати QR', allergens: 'Може містити:', saveForNextTime: 'Зберегти наступного разу' },
  ro: { copyMenuLink: 'Copiază linkul meniului', shareOnWhatsApp: 'Distribuie pe WhatsApp', showQr: 'Afișează QR', allergens: 'Poate conține:', saveForNextTime: 'Salvează pentru data viitoare' },
  lt: { copyMenuLink: 'Kopijuoti meniu nuorodą', shareOnWhatsApp: 'Bendrinti per WhatsApp', showQr: 'Rodyti QR', allergens: 'Gali būti:', saveForNextTime: 'Išsaugoti kitam kartui' },
  sv: { copyMenuLink: 'Kopiera menylänk', shareOnWhatsApp: 'Dela på WhatsApp', showQr: 'Visa QR', allergens: 'Kan innehålla:', saveForNextTime: 'Spara till nästa gång' },
  fi: { copyMenuLink: 'Kopioi ruokalistan linkki', shareOnWhatsApp: 'Jaa WhatsAppissa', showQr: 'Näytä QR', allergens: 'Saattaa sisältää:', saveForNextTime: 'Tallenna seuraavaa kertaa varten' },
  nb: { copyMenuLink: 'Kopier menylenke', shareOnWhatsApp: 'Del på WhatsApp', showQr: 'Vis QR', allergens: 'Kan inneholde:', saveForNextTime: 'Lagre til neste gang' },
  da: { copyMenuLink: 'Kopiér menulink', shareOnWhatsApp: 'Del på WhatsApp', showQr: 'Vis QR', allergens: 'Kan indeholde:', saveForNextTime: 'Gem til næste gang' },
  ko: { copyMenuLink: '메뉴 링크 복사', shareOnWhatsApp: 'WhatsApp으로 공유', showQr: 'QR 표시', allergens: '포함될 수 있음:', saveForNextTime: '다음에도 저장' },
};

type RemoteTranslationPack = { language: string; translations: Record<string, unknown> };

function mapRemoteText(pack: RemoteTranslationPack): Partial<UiText> {
  const values = pack.translations;
  const value = (key: string) => typeof values[key] === 'string' ? values[key] as string : undefined;
  const translated = <K extends keyof UiText>(key: K, candidate: string | undefined) => candidate && candidate !== uiText.en[key] ? { [key]: candidate } as Pick<UiText, K> : {};
  return {
    ...translated('intelligentScan', value('menuKicker')), ...translated('chooseConfidence', value('menuLead')), ...translated('description', value('menuDescription')), ...translated('scanMenu', value('scanMenu')), ...translated('scanHint', value('scanMenuHint')), ...translated('howItWorks', value('howItWorks')), ...translated('howItWorksHint', value('howItWorksHint')), ...translated('howItWorksCapture', value('howItWorksCapture')), ...translated('howItWorksCaptureHint', value('howItWorksCaptureHint')), ...translated('howItWorksUnderstand', value('howItWorksUnderstand')), ...translated('howItWorksUnderstandHint', value('howItWorksUnderstandHint')), ...translated('howItWorksChoose', value('howItWorksChoose')), ...translated('howItWorksChooseHint', value('howItWorksChooseHint')),
    ...translated('recent', value('returnToMenu')), ...translated('yourMenu', value('menuTitle')), ...translated('account', value('accountSettings') ?? value('accountLabel')), ...translated('close', value('close')), ...translated('preferences', value('foodPreferences')), ...translated('preferenceHint', value('foodPreferencesHint')),
    ...translated('language', value('languageLabel')), ...translated('languageHint', value('languageHint')), ...translated('savePreferences', value('saveChanges')), ...translated('logOut', value('logout')), ...translated('deleteAccount', value('deleteAccount')), ...translated('beforeScan', value('beforeScan')), ...translated('promptHint', value('preferencesHint')),
    ...translated('saveNextTime', value('saveNextTime')), ...translated('saveForNextTime', value('saveNextTime')), ...translated('copyMenuLink', value('copyMenuLink')), ...translated('shareOnWhatsApp', value('shareOnWhatsApp')), ...translated('showQr', value('showMenuQr')), ...translated('allergens', value('sharedMenuAllergens')), ...translated('sayIt', value('sharedMenuSayIt')), ...translated('cancel', value('cancel')), ...translated('analysing', value('analysingMenu')), ...translated('analysingHint', value('analysingMenuHint')), ...translated('authSubtitle', value('authSubtitle')), ...translated('continueGoogle', value('continueWithGoogle')), ...translated('continueApple', value('continueWithApple')), ...translated('localAuth', value('localAuth')),
  };
}

type SavedScan = {
  sourceLanguage: string;
  currency: string | null;
  sections: string[];
  items: Omit<MenuItem, 'matchedPreferences'>[];
  shareId: string | null;
  imageUri?: string;
  imageAspectRatio?: number;
  pageCount?: number;
};

function comparableMenuItem(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

type OverlayLayout = { x: number; y: number; width: number; height: number };

function getOverlayLayout(item: MenuItem, items: MenuItem[]): OverlayLayout | null {
  if (!item.bounds) return null;
  const { x, y, width, height } = item.bounds;
  const otherBounds = items.flatMap((candidate) => candidate.id === item.id || !candidate.bounds ? [] : [candidate.bounds]);
  const rightLimit = Math.min(1, ...otherBounds
    .filter((candidate) => candidate.x > x && candidate.y < y + height && candidate.y + candidate.height > y)
    .map((candidate) => candidate.x));
  const bottomLimit = Math.min(1, ...otherBounds
    .filter((candidate) => candidate.y > y && candidate.x < x + width && candidate.x + candidate.width > x)
    .map((candidate) => candidate.y));
  const textLength = item.translatedName.length;
  const desiredWidth = Math.min(0.9, Math.max(width, 0.02 + Math.min(textLength, 48) * 0.018));
  const desiredHeight = height;
  const availableWidth = Math.max(width, rightLimit - x);
  const availableHeight = Math.max(height, bottomLimit - y);
  const layoutWidth = Math.min(desiredWidth, availableWidth, 1 - x);
  const layoutHeight = Math.min(desiredHeight, availableHeight, 1 - y);
  return { x, y, width: layoutWidth, height: layoutHeight };
}

function menuItemKey(item: MenuItem): string {
  return [item.originalName, item.translatedName, item.priceInPence ?? ''].map((value) => comparableMenuItem(String(value))).join('|');
}

const api = new MenuApi(apiUrl);
type StorageApi = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};
const AsyncStorage = AsyncStorageModule.default as unknown as StorageApi;

export default function MenuScanner() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [passwordAuthMode, setPasswordAuthMode] = useState<'signIn' | 'register'>('signIn');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authPasswordConfirmation, setAuthPasswordConfirmation] = useState('');
  const [passwordAuthBusy, setPasswordAuthBusy] = useState(false);
  const [preferences, setPreferences] = useState<MenuPreference[]>([]);
  const [preferenceInput, setPreferenceInput] = useState('');
  const [savePreferences, setSavePreferences] = useState(true);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recentScan, setRecentScan] = useState<SavedScan | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [detectedCurrency, setCurrency] = useState<string | null>('__UNKNOWN__');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [scanImageUri, setScanImageUri] = useState<string | null>(null);
  const [scanImageAspectRatio, setScanImageAspectRatio] = useState(1);
  const [scanPageCount, setScanPageCount] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [resultView, setResultView] = useState<'list' | 'image'>('list');
  const [shareId, setShareId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [saveForNextTime, setSaveForNextTime] = useState(true);
  const [accountVisible, setAccountVisible] = useState(false);
  const [displayNameEditing, setDisplayNameEditing] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [language, setLanguage] = useState<SharedLanguage>('en');
  const [accountBusy, setAccountBusy] = useState(false);
  const [downloadedText, setDownloadedText] = useState<Partial<UiText>>({});
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const speechRequestId = useRef(0);
  const speechOperation = useRef(Promise.resolve());
  const text = { ...uiText.en, ...uiText[language as UiLanguage], ...localizedUiText[language as UiLanguage], ...authUiText[language], ...extraUiText[language as UiLanguage], ...downloadedText };
  const authLabels = passwordAuthLabels[language];
  const legalText = legalUiText[language];
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    webClientId: googleWebClientId,
    ...(Platform.OS === 'web' && googleWebRedirectUri ? { redirectUri: googleWebRedirectUri } : {}),
    ...(Platform.OS !== 'web' ? { redirectUri: makeRedirectUri({ native: googleNativeRedirectUri }) } : {}),
    shouldAutoExchangeCode: false,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => () => {
    speechRequestId.current += 1;
    void Speech.stop();
  }, []);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    let active = true;
    const loadSharedMenu = async (url: string) => {
      const shareId = extractSharedMenuId(url);
      if (!shareId) return;
      setLoading(true);
      const result = await api.getMenuShare(shareId);
      if (!active) return;
      if (!result.menu) {
        setLoading(false);
        Alert.alert('Shared menu', result.error ?? 'Unable to load the shared menu.');
        return;
      }
      const sharedItems = applyPreferenceMatches(result.menu.items.map((item) => ({ ...item, matchedPreferences: [] })), preferences);
      setItems(sharedItems);
      setSections(result.menu.sections);
      setCurrency(result.menu.currency ?? '__UNKNOWN__');
      setSourceLanguage(result.menu.sourceLanguage || 'en');
      setShareId(shareId);
      setSelectedSection(null);
      const saved: SavedScan = { sourceLanguage: result.menu.sourceLanguage, currency: result.menu.currency, sections: result.menu.sections, items: result.menu.items, shareId };
      setRecentScan(saved);
      await AsyncStorage.setItem(activeScanKey, JSON.stringify(saved));
      setLoading(false);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) return loadSharedMenu(url);
      return undefined;
    });
    const subscription = Linking.addEventListener('url', (event) => void loadSharedMenu(event.url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [preferences]);

  const menuUrl = shareId ? `${publicSiteUrl}/menu/${shareId}` : null;
  const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
  const visibleItems = selectedSection === -1 ? [] : selectedSection === null ? items : items.filter((item) => item.section === selectedSection);
  const canViewItemsOnImage = Boolean(scanPageCount <= 1 && scanImageUri && items.some((item) => item.bounds));
  const qrCodeMatrix = useMemo(() => {
    if (!menuUrl) return null;
    try {
      const qr = QRCode.create(menuUrl, { errorCorrectionLevel: 'M' });
      return { data: Array.from(qr.modules.data), size: qr.modules.size };
    } catch {
      return null;
    }
  }, [menuUrl]);

  useEffect(() => {
    void (async () => {
      const token = await loadAuthToken();
      const savedLanguage = await AsyncStorage.getItem(languageKey);
      if (languageOptions.some((option) => option.code === savedLanguage)) setLanguage(savedLanguage as SharedLanguage);
      if (token) {
        await saveAuthToken(token);
        api.setAuthToken(token);
        const result = await api.getProfile();
        if (result.profile) {
          setProfile(result.profile);
          setPreferences(result.profile.foodPreferences);
          setPreferenceInput(result.profile.foodPreferences.map((preference) => preference.label).join(', '));
        } else {
          api.setAuthToken(null);
        }
      }
      const saved = await AsyncStorage.getItem(activeScanKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SavedScan;
          if (Array.isArray(parsed.items)) {
            setRecentScan({ ...parsed, sections: parsed.sections ?? [], shareId: parsed.shareId ?? null });
          }
        } catch {
          await AsyncStorage.removeItem(activeScanKey);
        }
      }
      setAuthLoading(false);
    })().catch(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'error') {
      setAuthError(googleResponse.error?.message ?? googleResponse.params.error_description ?? googleResponse.params.error ?? 'Google sign-in was not completed.');
      setGoogleBusy(false);
      return;
    }
    if (googleResponse.type !== 'success') {
      setGoogleBusy(false);
      return;
    }
    const completeGoogleSignIn = async () => {
      let authentication = googleResponse.authentication;
      if (!authentication && googleResponse.params.code && googleRequest) {
        authentication = await new AccessTokenRequest({
          clientId: googleNativeClientId,
          code: googleResponse.params.code,
          redirectUri: googleNativeRedirectUri,
          extraParams: { code_verifier: googleRequest.codeVerifier ?? '' },
        }).performAsync(Google.discovery);
      }
      return authentication?.accessToken ?? googleResponse.params.access_token;
    };

    setGoogleBusy(true);
    void completeGoogleSignIn().then((accessToken) => {
      if (!accessToken) {
        setAuthError('Google did not return an access token.');
        setGoogleBusy(false);
        return;
      }
      return api.googleLogin(accessToken).then(async (result) => {
        if (!result.token) {
          setAuthError(localiseAuthError(result.error ?? 'Sign-in failed.', authLabels));
          setGoogleBusy(false);
          return;
        }
        await saveAuthToken(result.token);
        api.setAuthToken(result.token);
        const nextProfile = result.profile ?? (await api.getProfile()).profile;
        if (nextProfile) {
          setProfile(nextProfile);
          setPreferences(nextProfile.foodPreferences);
          setPreferenceInput(nextProfile.foodPreferences.map((preference) => preference.label).join(', '));
        } else {
          api.setAuthToken(null);
          setAuthError(authLabels.authFailed);
        }
        setGoogleBusy(false);
      });
    }).catch((error) => {
      setAuthError(`Google token exchange failed: ${error instanceof Error ? error.message : 'Unknown error.'}`);
      setGoogleBusy(false);
    });
  }, [googleRequest, googleResponse, authLabels]);

  useEffect(() => {
    const option = languageOptions.find((candidate) => candidate.code === language);
    if (option?.translationSource !== 'download') {
      setDownloadedText({});
      return;
    }
    const controller = new AbortController();
    const cacheKey = `roamenu-translations.v2.${language}`;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as RemoteTranslationPack;
          if (parsed.language === language && parsed.translations) setDownloadedText(mapRemoteText(parsed));
        }
        const response = await fetch(`${apiUrl}/api/mobile/translations/${encodeURIComponent(language)}?v=${translationPackRequestVersion}`, { cache: translationFetchCache, signal: controller.signal });
        if (!response.ok) throw new Error('Translation pack unavailable');
        const parsed = await response.json() as RemoteTranslationPack;
        if (parsed.language !== language || !parsed.translations) throw new Error('Invalid translation pack');
        await AsyncStorage.setItem(cacheKey, JSON.stringify(parsed));
        if (!controller.signal.aborted) setDownloadedText(mapRemoteText(parsed));
      } catch {
        // Keep the embedded fallback when the on-demand pack is unavailable.
      }
    })();
    return () => controller.abort();
  }, [language]);

  const submitPasswordAuth = async () => {
    setAuthError('');
    const email = authEmail.trim().toLowerCase();
    const displayName = authDisplayName.trim();
    if (!email || !email.includes('@')) {
      setAuthError(authLabels.emailRequired);
      return;
    }
    if (authPassword.length < 12) {
      setAuthError(authLabels.passwordTooShort);
      return;
    }
    if (passwordAuthMode === 'register' && (displayName.length < 2 || displayName.length > 80)) {
      setAuthError(authLabels.nameLength);
      return;
    }
    if (passwordAuthMode === 'register' && authPassword !== authPasswordConfirmation) {
      setAuthError(authLabels.passwordsMismatch);
      return;
    }
    setPasswordAuthBusy(true);
    const result = passwordAuthMode === 'register'
      ? await api.passwordRegister(email, authPassword, displayName)
      : await api.passwordLogin(email, authPassword);
    if (!result.token) {
      setAuthError(localiseAuthError(result.error ?? 'Authentication failed.', authLabels));
      setPasswordAuthBusy(false);
      return;
    }
    await saveAuthToken(result.token);
    api.setAuthToken(result.token);
    const nextProfile = result.profile ?? (await api.getProfile()).profile;
    if (!nextProfile) {
      api.setAuthToken(null);
      setAuthError(authLabels.authFailed);
      setPasswordAuthBusy(false);
      return;
    }
    setProfile(nextProfile);
    setPreferences(nextProfile.foodPreferences);
    setPreferenceInput(nextProfile.foodPreferences.map((preference) => preference.label).join(', '));
    setPasswordAuthBusy(false);
  };

  const mockSignIn = async () => {
    try {
      setAuthError('');
      const result = await api.mockLogin(mockUserName);
      if (!result.token) {
        setAuthError(localiseAuthError(result.error ?? 'Mock login failed.', authLabels));
        return;
      }
      await saveAuthToken(result.token);
      api.setAuthToken(result.token);
      const profileResult = result.profile ? result : await api.getProfile();
      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setPreferences(profileResult.profile.foodPreferences);
        setPreferenceInput(profileResult.profile.foodPreferences.map((preference) => preference.label).join(', '));
      } else {
        api.setAuthToken(null);
        setAuthError(localiseAuthError(profileResult.error ?? 'Mock login did not return a profile.', authLabels));
      }
    } catch (error) {
      setAuthError(`Mock login failed: ${error instanceof Error ? error.message : 'Unknown error.'}`);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError('');
    if (!googleRequest) {
      setAuthError('Google sign-in is not configured for this build.');
      return;
    }
    await promptGoogle();
  };

  const signInWithApple = async () => {
    setAuthError('');
    if (!appleAvailable) {
      setAuthError('Apple sign-in is only available on a supported iOS device.');
      return;
    }
    setAppleBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        setAuthError('Apple did not return an identity token.');
        return;
      }
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
      const result = await api.appleLogin(credential.identityToken, name || undefined);
      if (!result.token) {
        setAuthError(localiseAuthError(result.error ?? 'Sign-in failed.', authLabels));
        return;
      }
      await saveAuthToken(result.token);
      api.setAuthToken(result.token);
      const nextProfile = result.profile ?? (await api.getProfile()).profile;
      if (!nextProfile) {
        api.setAuthToken(null);
        setAuthError(authLabels.authFailed);
        return;
      }
      setProfile(nextProfile);
      setPreferences(nextProfile.foodPreferences);
      setPreferenceInput(nextProfile.foodPreferences.map((preference) => preference.label).join(', '));
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        setAuthError(localiseAuthError(error instanceof Error ? error.message : 'Sign-in failed.', authLabels));
      }
    } finally {
      setAppleBusy(false);
    }
  };

  const prepareImage = async (asset: ImagePicker.ImagePickerAsset) => {
    const scale = Math.min(1, 2400 / Math.max(asset.width, asset.height));
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    if (scale < 1) context.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
    const rendered = await context.renderAsync();
    return rendered.saveAsync({ compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
  };

  const saveScanResult = async (result: MenuScanResult, imageUri: string | undefined, imageAspectRatio: number | undefined, pageCount: number, isAdditionalPage: boolean) => {
    if (result.error) {
      Alert.alert('Scan failed', result.error);
      return;
    }
    const positionedItems = result.items.map((item) => {
      const layout = getOverlayLayout(item, result.items);
      return layout ? { ...item, bounds: { x: layout.x, y: layout.y, width: layout.width, height: layout.height } } : item;
    });
    const matchedItems = applyPreferenceMatches(positionedItems, preferences);
    const existingKeys = new Set(items.map(menuItemKey));
    const newItems = matchedItems.filter((item) => {
      const key = menuItemKey(item);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    }).map((item, index) => ({ ...item, id: isAdditionalPage ? `${item.id}-page-${pageCount}-${index}` : item.id }));
    const mergedItems = isAdditionalPage ? [...items, ...newItems] : newItems;
    const mergedSections = isAdditionalPage
      ? [...sections, ...result.sections.filter((section) => !sections.some((existing) => comparableMenuItem(existing) === comparableMenuItem(section)))]
      : result.sections;
    const nextCurrency = (detectedCurrency === '__UNKNOWN__' ? null : detectedCurrency) ?? result.currency;
    const nextSourceLanguage = isAdditionalPage ? sourceLanguage : result.sourceLanguage || 'en';
    setItems(mergedItems);
    setSections(mergedSections);
    setCurrency(nextCurrency ?? '__UNKNOWN__');
    setSourceLanguage(nextSourceLanguage);
    setScanPageCount(pageCount);
    setScanImageUri(isAdditionalPage ? null : imageUri ?? null);
    setScanImageAspectRatio(isAdditionalPage ? 1 : imageAspectRatio ?? 1);
    setSelectedSection(null);
    setSelectedItemIds([]);
    if (mergedItems.length > 0) {
      const shareItems = mergedItems.map((item: MenuItem) => {
        const { matchedPreferences: _matched, ...rest } = item;
        return rest;
      });
      const share = await api.createMenuShare({ sourceLanguage: nextSourceLanguage, currency: nextCurrency, sections: mergedSections, items: shareItems });
      setShareId(share.shareId ?? null);
      const saved: SavedScan = { sourceLanguage: nextSourceLanguage, currency: nextCurrency, sections: mergedSections, items: shareItems, shareId: share.shareId ?? null, imageUri: isAdditionalPage ? undefined : imageUri, imageAspectRatio: isAdditionalPage ? undefined : imageAspectRatio, pageCount };
      setRecentScan(saved);
      await AsyncStorage.setItem(activeScanKey, JSON.stringify(saved));
    }
  };

  const scanAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setLoading(true);
    try {
      const image = await prepareImage(asset);
      const ocr = await inspectMenuImage(image.uri, image.width, image.height);
      if (ocr?.dense) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert('Large menu detected', 'This menu contains a lot of text. Scanning it may use more AI processing and can work better one page at a time.', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Scan anyway', onPress: () => resolve(true) },
          ], { cancelable: false });
        });
        if (!shouldContinue) return;
      }
      setImageZoom(1);
      setResultView('list');
      const scanLanguage = scanLanguages.has(language) ? language : 'en';
      const result = await api.scanMenu(image.uri, scanLanguage);
      if (!result.error && ocr) {
        result.items = result.items.map((item) => item.bounds ? item : { ...item, bounds: findOcrBounds(item.originalName, ocr.blocks) ?? null });
      }
      const isAdditionalPage = items.length > 0;
      const pageCount = isAdditionalPage ? scanPageCount + 1 : 1;
      await saveScanResult(result, image.uri, image.width / image.height, pageCount, isAdditionalPage);
    } catch (error) {
      Alert.alert('Scan failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmPreferences = async () => {
    const labels = preferenceInput.split(',').map(normalisePreferenceLabel).filter(Boolean);
    const next = labels.map((label, index) => ({ id: `preference-${Date.now()}-${index}`, label }));
    setPreferences(next);
    if (saveForNextTime && profile && next.length > 0) {
      const result = await api.saveProfile(profile.displayName, next);
      if (result.profile) setProfile(result.profile);
      else Alert.alert('Preferences', result.error ?? 'Could not save preferences.');
    }
    setPromptVisible(false);
    if (selectedAsset) {
      await scanAsset(selectedAsset);
      setSelectedAsset(null);
    }
  };

  const chooseLanguage = async (nextLanguage: SharedLanguage) => {
    if (nextLanguage !== language && (items.length > 0 || recentScan)) {
      setItems([]);
      setRecentScan(null);
      setSections([]);
      setShareId(null);
      setSelectedSection(null);
      setScanPageCount(0);
      await AsyncStorage.removeItem(activeScanKey);
    }
    setLanguage(nextLanguage);
    await AsyncStorage.setItem(languageKey, nextLanguage);
  };

  const logout = async () => {
    setAccountBusy(true);
    await AsyncStorage.removeItem('roamenu-mobile-auth-token');
    await AsyncStorage.removeItem(activeScanKey);
    api.setAuthToken(null);
    setProfile(null);
    setItems([]);
    setRecentScan(null);
    setShareId(null);
    setScanPageCount(0);
    setAccountVisible(false);
    setAccountBusy(false);
  };

  const deleteAccount = () => {
    Alert.alert('Delete account', 'This permanently deletes your account and saved preferences.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void confirmDeleteAccount() },
    ]);
  };

  const confirmDeleteAccount = async () => {
    setAccountBusy(true);
    const result = await api.deleteProfile();
    if (!result.success) {
      setAccountBusy(false);
      Alert.alert('Delete account', result.error ?? 'Unable to delete your account.');
      return;
    }
    await logout();
  };

  const handleAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (preferences.length > 0 || items.length > 0) {
      await scanAsset(asset);
      return;
    }
    setSelectedAsset(asset);
    setPreferenceInput('');
    setSaveForNextTime(true);
    setPromptVisible(true);
  };

  const speakItem = (name: string) => {
    if (!name.trim()) return;
    const requestId = ++speechRequestId.current;
    const speechLanguage = getSpeechLocale(sourceLanguage);
    speechOperation.current = speechOperation.current.catch(() => undefined).then(async () => {
      try {
        await Speech.stop();
        if (requestId !== speechRequestId.current) return;
        if (Platform.OS === 'android') await new Promise<void>((resolve) => setTimeout(resolve, 350));
        if (requestId !== speechRequestId.current) return;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(name);
          utterance.lang = speechLanguage;
          utterance.onerror = () => Alert.alert('Speech unavailable', 'This browser does not have a speech voice available.');
          window.speechSynthesis.speak(utterance);
          return;
        }
        Speech.speak(name, {
          language: speechLanguage,
          useApplicationAudioSession: true,
          volume: 1,
          onError: () => {
            if (requestId === speechRequestId.current) Alert.alert('Speech unavailable', 'Text-to-speech is not available on this device.');
          },
        });
      } catch {
        if (requestId === speechRequestId.current) Alert.alert('Speech unavailable', 'Text-to-speech is not available on this device.');
      }
    });
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  };

  const chooseImage = () => Alert.alert('Scan a menu', 'Choose an image source', [
    { text: 'Take photo', onPress: async () => { const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 }); if (!result.canceled && result.assets[0]) await handleAsset(result.assets[0]); } },
    { text: 'Choose from library', onPress: async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }); if (!result.canceled && result.assets[0]) await handleAsset(result.assets[0]); } },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const returnToScanPage = () => {
    setItems([]);
    setShareId(null);
    setSections([]);
    setSelectedSection(null);
    setSelectedItemIds([]);
    setScanImageUri(null);
    setScanImageAspectRatio(1);
    setScanPageCount(0);
    setImageZoom(1);
    setResultView('list');
  };

  const restoreRecentScan = () => {
    if (!recentScan) return;
    const restoredItems = recentScan.items.map((item) => ({ ...item, matchedPreferences: [] }));
    const positionedItems = restoredItems.map((item) => {
      const layout = getOverlayLayout(item, restoredItems);
      return layout ? { ...item, bounds: { x: layout.x, y: layout.y, width: layout.width, height: layout.height } } : item;
    });
    setItems(applyPreferenceMatches(positionedItems, preferences));
    setSections(recentScan.sections);
    setCurrency(recentScan.currency ?? '__UNKNOWN__');
    setSourceLanguage(recentScan.sourceLanguage || 'en');
    setShareId(recentScan.shareId);
    setSelectedSection(null);
    setSelectedItemIds([]);
    setScanImageUri(recentScan.imageUri ?? null);
    setScanImageAspectRatio(recentScan.imageAspectRatio ?? 1);
    setScanPageCount(recentScan.pageCount ?? 1);
    setResultView('list');
  };

  const savePreferenceChanges = async () => {
    const labels = preferenceInput.split(',').map(normalisePreferenceLabel).filter(Boolean);
    const next = labels.map((label, index) => ({ id: `preference-${Date.now()}-${index}`, label }));
    setPreferences(next);
    if (savePreferences && profile) {
      const result = await api.saveProfile(profile.displayName, next);
      if (result.profile) setProfile(result.profile);
      else Alert.alert('Preferences', result.error ?? 'Could not save preferences.');
    }
  };

  const saveDisplayName = async () => {
    const displayName = displayNameInput.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      Alert.alert('Display name', authLabels.nameLength);
      return;
    }
    if (!profile) return;
    setAccountBusy(true);
    const result = await api.saveProfile(displayName, preferences);
    setAccountBusy(false);
    if (result.profile) {
      setProfile(result.profile);
      setDisplayNameInput(result.profile.displayName);
      setDisplayNameEditing(false);
    } else {
      Alert.alert('Display name', result.error ?? 'Could not save your display name.');
    }
  };

  const copyLink = async () => {
    if (!menuUrl) return;
    await Clipboard.setStringAsync(menuUrl);
    Alert.alert('Copied', 'The menu link is on your clipboard.');
  };

  const shareLink = async () => {
    if (menuUrl) await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`View this menu: ${menuUrl}`)}`);
  };

  const openLegalPage = async (path: '/privacy' | '/terms') => {
    await Linking.openURL(`${publicSiteUrl}${path}?lang=${encodeURIComponent(language)}`);
  };

  if (authLoading) return <CenteredState text="Loading Roamenu..." />;
  if ((!api.getAuthToken() || !profile) && items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.authKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={styles.authCard}>
              <RoamenuLogo />
              <Text style={styles.scanHeading}>{text.chooseConfidence}</Text>
              <HowItWorksPreview text={text} />
              <View style={styles.authPanel}>
              <Text style={styles.authSubtitle}>{text.authSubtitle}</Text>
              {passwordAuthMode === 'register' ? <TextInput style={styles.authInput} placeholder={authLabels.displayName} placeholderTextColor="#94A3B8" autoComplete="name" value={authDisplayName} onChangeText={setAuthDisplayName} /> : null}
              <TextInput style={styles.authInput} placeholder={authLabels.email} placeholderTextColor="#94A3B8" autoComplete="email" keyboardType="email-address" autoCapitalize="none" value={authEmail} onChangeText={setAuthEmail} />
              <TextInput style={styles.authInput} placeholder={authLabels.password} placeholderTextColor="#94A3B8" autoComplete={passwordAuthMode === 'register' ? 'new-password' : 'password'} secureTextEntry value={authPassword} onChangeText={setAuthPassword} />
              {passwordAuthMode === 'register' ? <><TextInput style={styles.authInput} placeholder={authLabels.confirmPassword} placeholderTextColor="#94A3B8" autoComplete="new-password" secureTextEntry value={authPasswordConfirmation} onChangeText={setAuthPasswordConfirmation} /><Text style={styles.authHint}>{authLabels.useAtLeast}</Text></> : null}
              <TouchableOpacity style={styles.primaryButton} onPress={() => void submitPasswordAuth()} disabled={passwordAuthBusy}><Text style={styles.primaryButtonText}>{passwordAuthBusy ? 'Please wait...' : passwordAuthMode === 'register' ? authLabels.createAccount : authLabels.signIn}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setPasswordAuthMode(passwordAuthMode === 'signIn' ? 'register' : 'signIn'); setAuthError(''); }}><Text style={styles.link}>{passwordAuthMode === 'signIn' ? authLabels.switchToRegister : authLabels.switchToSignIn}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void signInWithGoogle()} disabled={googleBusy}><Text style={styles.secondaryButtonText}>{googleBusy ? 'Please wait...' : text.continueGoogle}</Text></TouchableOpacity>
              {appleAvailable ? <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={8} style={styles.appleButton} onPress={() => void signInWithApple()} /> : null}
              {authError ? <Text style={styles.error}>{authError}</Text> : null}
              {mockAuthEnabled ? <TouchableOpacity style={styles.secondaryButton} onPress={() => void mockSignIn()}><Text style={styles.secondaryButtonText}>{text.localAuth}</Text></TouchableOpacity> : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.topBar}><View style={styles.topBarBrand}>{items.length > 0 ? <TouchableOpacity style={styles.backButton} onPress={returnToScanPage}><Text style={styles.backButtonText}>‹</Text></TouchableOpacity> : null}<RoamenuLogo compact /></View><TouchableOpacity style={styles.accountButton} onPress={() => setAccountVisible(true)} accessibilityRole="button" accessibilityLabel="Account"><AccountIcon /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? <>
          <Text style={styles.scanHeading}>{text.intelligentScan}</Text>
          <View style={styles.descriptionTextGroup}><Text style={styles.subtitleLead}>{text.chooseConfidence}</Text><Text style={styles.subtitle}>{text.description}</Text></View>
          <TouchableOpacity style={styles.scanButton} onPress={chooseImage} disabled={loading}><Text style={styles.scanButtonText}>{text.scanMenu}</Text><Text style={styles.scanButtonHint}>{text.scanHint}</Text></TouchableOpacity>
          {recentScan ? <TouchableOpacity style={styles.resumeCard} onPress={restoreRecentScan}><View style={styles.resumeTextGroup}><Text style={styles.resumeTitle}>{text.recent}</Text><Text style={styles.resumeProgress}>{recentScan.items.length} {text.scannedItems}</Text></View><Text style={styles.resumeArrow}>›</Text></TouchableOpacity> : null}
        </> : <>
          <Text style={styles.title}>{text.yourMenu}</Text>
          {menuUrl ? <View style={styles.shareRow}><TouchableOpacity style={styles.shareButton} onPress={() => void copyLink()}><Text style={styles.shareText}>{text.copyMenuLink}</Text></TouchableOpacity><TouchableOpacity style={styles.shareButton} onPress={() => void shareLink()}><Text style={styles.shareText}>{text.shareOnWhatsApp}</Text></TouchableOpacity><TouchableOpacity style={styles.shareButton} onPress={() => setQrVisible(true)}><Text style={styles.shareText}>{text.showQr}</Text></TouchableOpacity></View> : null}
          {scanPageCount < maxScanPages ? <View style={styles.pageActions}><TouchableOpacity style={styles.addPageButton} onPress={chooseImage} disabled={loading}><Text style={styles.addPageButtonText}>Add another page</Text></TouchableOpacity></View> : null}
          {sections.length > 0 || selectedItemIds.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}><TouchableOpacity style={[styles.tab, selectedSection === -1 && styles.selectedTab]} onPress={() => { setSelectedSection(-1); setResultView('list'); }}><Text>{text.selectedItems} ({selectedItemIds.length})</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, selectedSection === null && styles.selectedTab]} onPress={() => { setSelectedSection(null); setResultView('list'); }}><Text>All</Text></TouchableOpacity>{sections.map((section, index) => <TouchableOpacity key={`${section}-${index}`} style={[styles.tab, selectedSection === index && styles.selectedTab]} onPress={() => { setSelectedSection(index); setResultView('list'); }}><Text>{translateMenuSection(section, sourceLanguage)}</Text></TouchableOpacity>)}</ScrollView> : null}
          {selectedSection === -1 ? <View style={styles.selectedItemsPanel}>{selectedItems.map((item) => <View key={item.id} style={styles.selectedItemCard}><View style={styles.selectedOriginalRow}><Text style={styles.selectedOriginalName}>{item.originalName}</Text><TouchableOpacity style={styles.speakerButton} onPress={() => void speakItem(item.originalName)} accessibilityRole="button" accessibilityLabel={`Speak ${item.originalName}`}><Text style={styles.speakerIcon}>🔊</Text></TouchableOpacity></View><Text style={styles.selectedTranslatedName}>{item.translatedName}</Text>{item.pronunciation ? <Text style={styles.selectedPronunciation}>{text.sayIt} {item.pronunciation}</Text> : null}</View>)}</View> : null}
          {resultView === 'image' && scanImageUri ? <View style={[styles.menuImageFrame, { aspectRatio: scanImageAspectRatio }]}><View style={[styles.menuImageCanvas, { transform: [{ scale: imageZoom }] }]}><Image source={{ uri: scanImageUri }} style={styles.menuImage} resizeMode="contain" />{items.some((item) => item.bounds) ? visibleItems.map((item) => item.bounds ? <View key={item.id} style={[styles.menuImageLabel, { left: `${item.bounds.x * 100}%`, top: `${item.bounds.y * 100}%`, width: `${item.bounds.width * 100}%`, height: `${item.bounds.height * 100}%` }]}><Text style={styles.menuImageLabelText}>{item.translatedName}</Text></View> : null) : <Text style={styles.imageNotice}>{text.imageLocationsUnavailable}</Text>}</View><View style={styles.imageZoomControls}><TouchableOpacity style={styles.imageZoomButton} onPress={() => setImageZoom((zoom) => Math.max(1, zoom - 0.5))} accessibilityRole="button" accessibilityLabel="Zoom out"><Text style={styles.imageZoomButtonText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.imageZoomReset} onPress={() => setImageZoom(1)} accessibilityRole="button" accessibilityLabel="Reset image zoom"><Text style={styles.imageZoomResetText}>{Math.round(imageZoom * 100)}%</Text></TouchableOpacity><TouchableOpacity style={styles.imageZoomButton} onPress={() => setImageZoom((zoom) => Math.min(3, zoom + 0.5))} accessibilityRole="button" accessibilityLabel="Zoom in"><Text style={styles.imageZoomButtonText}>+</Text></TouchableOpacity></View></View> : <>{visibleItems.map((item) => <View key={item.id} style={[styles.itemCard, item.matchedPreferences.length > 0 && styles.warningCard]}><TouchableOpacity style={[styles.itemSelectButton, selectedItemIds.includes(item.id) && styles.itemSelectButtonSelected]} onPress={() => toggleItemSelection(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selectedItemIds.includes(item.id) }} accessibilityLabel={selectedItemIds.includes(item.id) ? text.deselectItem : text.selectItem}><Text style={[styles.itemSelectText, selectedItemIds.includes(item.id) && styles.itemSelectTextSelected]}>{selectedItemIds.includes(item.id) ? '✓' : '+'}</Text></TouchableOpacity><View style={styles.itemHeader}><View style={styles.itemNames}><Text style={styles.itemName}>{item.number ? `${item.number}. ` : ''}{item.translatedName}</Text><View style={styles.originalRow}><TouchableOpacity style={styles.speakerButton} onPress={() => void speakItem(selectedSection === -1 ? item.translatedName : item.originalName)} accessibilityRole="button" accessibilityLabel={`Speak ${selectedSection === -1 ? item.translatedName : item.originalName}`}><Text style={styles.speakerIcon}>🔊</Text></TouchableOpacity><Text style={styles.originalName}>{item.originalName}</Text></View></View>{item.priceInPence !== null && detectedCurrency ? <Text style={styles.price}>{formatMenuPrice(item.priceInPence, detectedCurrency, sourceLanguage)}</Text> : null}</View>{item.pronunciation ? <Text style={styles.detail}>{text.sayIt} {item.pronunciation}</Text> : null}<Text style={styles.detail}>{item.description}</Text>{item.allergens.length > 0 ? <Text style={styles.detail}>{text.allergens} {item.allergens.join(', ')}</Text> : null}{item.matchedPreferences.length > 0 ? <Text style={styles.warning}>Matches: {item.matchedPreferences.join(', ')}</Text> : null}</View>)}</>}
        </>}
      </ScrollView>
      {canViewItemsOnImage ? <View style={styles.fixedViewModeRow}><TouchableOpacity style={[styles.viewModeButton, resultView === 'list' && styles.viewModeButtonSelected]} onPress={() => setResultView('list')} accessibilityRole="button" accessibilityLabel={text.viewList}><CardsViewIcon mode="list" color={resultView === 'list' ? '#007C83' : '#8A989A'} /></TouchableOpacity><TouchableOpacity style={[styles.viewModeButton, resultView === 'image' && styles.viewModeButtonSelected]} onPress={() => setResultView('image')} accessibilityRole="button" accessibilityLabel={text.viewImage}><CardsViewIcon mode="image" color={resultView === 'image' ? '#F2B84B' : '#8A989A'} /></TouchableOpacity></View> : null}
      <Modal visible={loading} transparent animationType="fade" onRequestClose={() => undefined}><View style={styles.scanModalOverlay}><View style={styles.scanModalCard}><ActivityIndicator color="#007C83" size="large" /><Text style={styles.scanModalTitle}>{text.analysing}</Text><Text style={styles.scanModalText}>{text.analysingHint}</Text><View style={styles.scanProgressTrack}><View style={styles.scanProgressBar} /></View></View></View></Modal>
      <Modal visible={promptVisible} transparent animationType="slide" onRequestClose={() => { setPromptVisible(false); setSelectedAsset(null); }}><KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.preferenceModal}><Text style={styles.modalTitle}>{text.beforeScan}</Text><Text style={styles.modalText}>{text.promptHint}</Text><TextInput value={preferenceInput} onChangeText={setPreferenceInput} placeholder="e.g. nuts, dairy, shellfish" style={styles.preferenceInput} multiline /><View style={styles.preferenceRow}><Text style={styles.cardHint}>{text.saveNextTime}</Text><Switch value={saveForNextTime} onValueChange={setSaveForNextTime} /></View><TouchableOpacity style={styles.confirmButton} onPress={() => void confirmPreferences()}><Text style={styles.confirmButtonText}>{text.scanMenu}</Text></TouchableOpacity><TouchableOpacity onPress={() => { setPromptVisible(false); setSelectedAsset(null); }}><Text style={styles.cancelText}>{text.cancel}</Text></TouchableOpacity></View></KeyboardAvoidingView></Modal>
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.qrCard}>
            <Text style={styles.cardTitle}>Scan to open this menu</Text>
            {qrCodeMatrix ? <Svg width={280} height={280} viewBox={`0 0 ${qrCodeMatrix.size + 8} ${qrCodeMatrix.size + 8}`}>
              <Rect x={0} y={0} width={qrCodeMatrix.size + 8} height={qrCodeMatrix.size + 8} fill="#FFFFFF" />
              {qrCodeMatrix.data.map((isDark, index) => isDark ? <Rect key={index} x={(index % qrCodeMatrix.size) + 4} y={Math.floor(index / qrCodeMatrix.size) + 4} width={1} height={1} fill="#102A2E" /> : null)}
            </Svg> : <Text style={styles.error}>Unable to prepare the QR code.</Text>}
            <TouchableOpacity onPress={() => setQrVisible(false)}><Text style={styles.link}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={accountVisible} animationType="slide" onRequestClose={() => setAccountVisible(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.accountHeader}><Text style={styles.title}>{text.account}</Text><TouchableOpacity onPress={() => setAccountVisible(false)}><Text style={styles.link}>{text.close}</Text></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.accountContent}>
            <View style={styles.displayNameRow}>
              {displayNameEditing ? <TextInput autoFocus value={displayNameInput} onChangeText={setDisplayNameInput} style={[styles.input, styles.displayNameInput]} maxLength={80} returnKeyType="done" onSubmitEditing={() => void saveDisplayName()} /> : <Text style={styles.cardTitle}>{profile?.displayName ?? 'Roamenu'}</Text>}
              {displayNameEditing ? <TouchableOpacity onPress={() => void saveDisplayName()} disabled={accountBusy} accessibilityRole="button" accessibilityLabel="Save display name"><Text style={styles.link}>{accountBusy ? 'Saving...' : 'Save'}</Text></TouchableOpacity> : <TouchableOpacity onPress={() => { setDisplayNameInput(profile?.displayName ?? ''); setDisplayNameEditing(true); }} accessibilityRole="button" accessibilityLabel="Edit display name"><PencilIcon /></TouchableOpacity>}
            </View>
            <View style={styles.accountSection}>
              <Text style={styles.cardTitle}>{text.preferences}</Text>
              <Text style={styles.cardHint}>{text.preferenceHint}</Text>
              <TextInput value={preferenceInput} onChangeText={setPreferenceInput} placeholder={preferences.map((preference) => preference.label).join(', ') || 'e.g. nuts, dairy'} style={styles.input} multiline />
              <View style={styles.preferenceRow}><Text style={styles.cardHint}>{text.saveForNextTime}</Text><Switch value={savePreferences} onValueChange={setSavePreferences} /></View>
              <TouchableOpacity onPress={() => void savePreferenceChanges()}><Text style={styles.link}>{text.savePreferences}</Text></TouchableOpacity>
            </View>
            <View style={styles.accountSection}>
              <Text style={styles.cardTitle}>{text.language}</Text>
              <Text style={styles.cardHint}>{text.languageHint}</Text>
              {languageOptions.map((option) => <TouchableOpacity key={option.code} style={[styles.languageRow, option.code === language && styles.languageRowSelected]} onPress={() => void chooseLanguage(option.code)}><Text style={styles.languageFlag}>{option.flag}</Text><Text style={styles.languageLabel}>{option.label}</Text>{option.code === language ? <Text style={styles.link}>✓</Text> : null}</TouchableOpacity>)}
            </View>
            <View style={styles.accountSection}>
              <Text style={styles.cardTitle}>{legalText.sectionTitle}</Text>
              <TouchableOpacity onPress={() => void openLegalPage('/privacy')}><Text style={styles.link}>{legalText.privacyPolicy}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => void openLegalPage('/terms')}><Text style={styles.link}>{legalText.termsAndConditions}</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.logoutButton} disabled={accountBusy} onPress={() => void logout()}><Text style={styles.logoutText}>{accountBusy ? 'Working...' : text.logOut}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} disabled={accountBusy} onPress={deleteAccount}><Text style={styles.deleteText}>{text.deleteAccount}</Text></TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function CenteredState({ text }: { text: string }) {
  return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator color="#007C83" /><Text style={styles.subtitle}>{text}</Text></View></SafeAreaView>;
}

type HowItWorksText = Record<'chooseConfidence' | 'howItWorksCapture' | 'howItWorksCaptureHint' | 'howItWorksUnderstand' | 'howItWorksUnderstandHint' | 'howItWorksChoose' | 'howItWorksChooseHint', string>;

function HowItWorksPreview({ text }: { text: HowItWorksText }) {
  const steps = [
    { number: '1', title: text.howItWorksCapture, hint: text.howItWorksCaptureHint },
    { number: '2', title: text.howItWorksUnderstand, hint: text.howItWorksUnderstandHint },
    { number: '3', title: text.howItWorksChoose, hint: text.howItWorksChooseHint },
  ];

  return (
    <View style={styles.howItWorksCard}>
      <View style={styles.howItWorksSteps}>{steps.map((step) => <View key={step.number} style={styles.howItWorksStep}><View style={styles.howItWorksNumber}><Text style={styles.howItWorksNumberText}>{step.number}</Text></View><View style={styles.howItWorksStepText}><Text style={styles.howItWorksStepTitle}>{step.title}</Text><Text style={styles.howItWorksStepHint}>{step.hint}</Text></View></View>)}</View>
    </View>
  );
}

function AccountIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 64 64" fill="none">
      <Circle cx="32" cy="32" r="24" fill="#FFF4D6" stroke="#007C83" strokeWidth="2.5" />
      <Circle cx="32" cy="23.5" r="8" fill="#F2B84B" stroke="#005E63" strokeWidth="2.5" />
      <Path d="M15.5 50c1.75-10.25 8.75-15.5 16.5-15.5S46.75 39.75 48.5 50" fill="#E6F2F3" stroke="#007C83" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M22.5 42.5c2.75-2.25 5.9-3.25 9.5-3.25s6.75 1 9.5 3.25" stroke="#F2B84B" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ListViewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ImageViewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2" />
      <Circle cx="8" cy="9" r="1.5" fill={color} />
      <Path d="m4.5 18 4.25-4.25a1 1 0 0 1 1.4 0L13 16.6l1.35-1.35a1 1 0 0 1 1.4 0L20 19.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CardsViewIcon({ mode, color }: { mode: ViewIconMode; color: string }) {
  return mode === 'list'
    ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="5" width="13" height="14" rx="3" stroke={color} strokeWidth="2" /><Path d="M8 9h5M8 13h5M8 16h3M17 8h2v11" stroke={color} strokeWidth="2" strokeLinecap="round" /></Svg>
    : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="7" width="13" height="12" rx="3" stroke={color} strokeWidth="2" /><Path d="m7 16 3-3 2 2 2-2 3 3M7 5h10a3 3 0 0 1 3 3v8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

type ViewIconVariant = 'flow' | 'cards' | 'signal' | 'orbit' | 'spark' | 'ribbon' | 'ocean' | 'candy';
type ViewIconMode = 'list' | 'image';
type ViewIconOption = { id: ViewIconVariant; label: string; listColor: string; imageColor: string; tileColor: string };

const viewIconOptions: ViewIconOption[] = [
  { id: 'cards', label: 'Cards', listColor: '#007C83', imageColor: '#F2B84B', tileColor: '#E6F2F3' },
  { id: 'flow', label: 'Flow', listColor: '#005E63', imageColor: '#D99A2B', tileColor: '#F1F7F2' },
  { id: 'signal', label: 'Signal', listColor: '#D56B08', imageColor: '#5E9F48', tileColor: '#FFF3D6' },
  { id: 'orbit', label: 'Orbit', listColor: '#A23E72', imageColor: '#E15C63', tileColor: '#FBE7EF' },
  { id: 'spark', label: 'Spark', listColor: '#28745A', imageColor: '#C58B2B', tileColor: '#E5F2E9' },
  { id: 'ribbon', label: 'Ribbon', listColor: '#D4553D', imageColor: '#E99B3D', tileColor: '#FFF0E3' },
  { id: 'ocean', label: 'Current', listColor: '#27364B', imageColor: '#91B83D', tileColor: '#EEF4DF' },
  { id: 'candy', label: 'Candy', listColor: '#7657B5', imageColor: '#E65F9B', tileColor: '#F3EAFB' },
];

function ViewModeIcon({ variant, mode, color }: { variant: ViewIconVariant; mode: ViewIconMode; color: string }) {
  return <AbstractViewIcon variant={variant} mode={mode} color={color} />;
}

function AbstractViewIcon({ variant, mode, color }: { variant: ViewIconVariant; mode: ViewIconMode; color: string }) {
  if (variant === 'flow') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Circle cx="5" cy="6" r="2" fill={color} /><Circle cx="5" cy="12" r="2" fill={color} /><Circle cx="5" cy="18" r="2" fill={color} /><Path d="M10 6h9M10 12h6M10 18h9" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></Svg>;
  if (variant === 'cards') return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="5" width="13" height="14" rx="3" stroke={color} strokeWidth="2" /><Path d="M8 9h5M8 13h5M8 16h3M17 8h2v11" stroke={color} strokeWidth="2" strokeLinecap="round" /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="7" width="13" height="12" rx="3" stroke={color} strokeWidth="2" /><Path d="m7 16 3-3 2 2 2-2 3 3M7 5h10a3 3 0 0 1 3 3v8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (variant === 'signal') return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M5 18v-3M10 18v-7M15 18V8M20 18V5" stroke={color} strokeWidth="3" strokeLinecap="round" /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 16c2.5-5 5.5-5 8 0s5.5 5 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" /><Circle cx="4" cy="16" r="2" fill={color} /><Circle cx="20" cy="16" r="2" fill={color} /></Svg>;
  if (variant === 'orbit') return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="3" fill={color} /><Path d="M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0Z" stroke={color} strokeWidth="2" transform="rotate(-30 12 12)" /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="3" fill={color} /><Path d="M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0ZM12 5v14M5 12h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></Svg>;
  if (variant === 'spark') return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" fill={color} /><Circle cx="19" cy="5" r="1.5" fill={color} /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" /><Path d="M18 18v3M16.5 19.5h3" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></Svg>;
  if (variant === 'ribbon') return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 7c3-4 5 4 8 0s5 4 8 0M4 12c3-4 5 4 8 0s5 4 8 0M4 17c3-4 5 4 8 0s5 4 8 0" stroke={color} strokeWidth="2" strokeLinecap="round" /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 8c3-4 5 4 8 0s5 4 8 0v9c-3 4-5-4-8 0s-5-4-8 0V8Z" stroke={color} strokeWidth="2" strokeLinejoin="round" /></Svg>;
  return mode === 'list' ? <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" stroke={color} strokeWidth="2" strokeLinecap="round" /></Svg> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M5 17 9 13l3 3 3-4 4 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><Circle cx="8" cy="8" r="2" fill={color} /></Svg>;
}

function getViewIconOption(variant: ViewIconVariant) {
  return viewIconOptions.find((option) => option.id === variant) ?? viewIconOptions[0];
}

function ViewModeIconGallery({ selectedVariant, onSelect }: { selectedVariant: ViewIconVariant; onSelect: (variant: ViewIconVariant) => void }) {
  return (
    <View style={styles.iconGallery}>
      <Text style={styles.iconGalleryTitle}>Try another icon style</Text>
      <Text style={styles.iconGalleryHint}>Tap a pair to preview it in the fixed switch.</Text>
      <View style={styles.iconGalleryGrid}>
        {viewIconOptions.map((option) => <TouchableOpacity key={option.id} style={[styles.iconGalleryOption, { backgroundColor: option.tileColor }, selectedVariant === option.id && styles.iconGalleryOptionSelected]} onPress={() => onSelect(option.id)} accessibilityRole="button" accessibilityState={{ selected: selectedVariant === option.id }} accessibilityLabel={`Use ${option.label} icon style`}><View style={styles.iconGalleryPair}><ViewModeIcon variant={option.id} mode="list" color={option.listColor} /><ViewModeIcon variant={option.id} mode="image" color={option.imageColor} /></View><Text style={[styles.iconGalleryLabel, { color: option.listColor }]}>{option.label}</Text></TouchableOpacity>)}
      </View>
    </View>
  );
}

function CompactListIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M5 6h2M10 6h9M5 12h2M10 12h9M5 18h2M10 18h9" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></Svg>; }
function CompactImageIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="5" width="16" height="14" rx="1" stroke={color} strokeWidth="2.5" /><Path d="m6 17 4-4 3 3 2-2 3 3" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function SolidListIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24"><Rect x="4" y="5" width="3" height="3" rx="1" fill={color} /><Rect x="9" y="5" width="11" height="3" rx="1" fill={color} /><Rect x="4" y="10.5" width="3" height="3" rx="1" fill={color} /><Rect x="9" y="10.5" width="11" height="3" rx="1" fill={color} /><Rect x="4" y="16" width="3" height="3" rx="1" fill={color} /><Rect x="9" y="16" width="11" height="3" rx="1" fill={color} /></Svg>; }
function SolidImageIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24"><Rect x="3" y="4" width="18" height="16" rx="2" fill={color} /><Circle cx="8" cy="9" r="1.5" fill="#FFFFFF" /><Path d="m5 18 4-4 3 3 2-2 4 4" fill="#FFFFFF" /></Svg>; }
function ChecklistIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="m4 6 1.5 1.5L8 5M10 6h10M4 12l1.5 1.5L8 11M10 12h10M4 18l1.5 1.5L8 17M10 18h10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function ImageFrameIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2" /><Path d="m5 17 4-4 3 3 2-2 5 5M7.5 9.5h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>; }
function GridListIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="4" width="6" height="6" rx="1" stroke={color} strokeWidth="2" /><Rect x="14" y="4" width="6" height="6" rx="1" stroke={color} strokeWidth="2" /><Rect x="4" y="14" width="6" height="6" rx="1" stroke={color} strokeWidth="2" /><Rect x="14" y="14" width="6" height="6" rx="1" stroke={color} strokeWidth="2" /></Svg>; }
function GridImageIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2" /><Circle cx="8" cy="9" r="1.5" fill={color} /><Path d="m5 17 4-4 3 3 2-2 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><Path d="M6 6h12" stroke={color} strokeWidth="1.5" /></Svg>; }
function RoundedListIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="4" y="5" width="3" height="3" rx="1.5" fill={color} /><Path d="M10 6.5h10M10 12h10M10 17.5h10" stroke={color} strokeWidth="2.5" strokeLinecap="round" /><Rect x="4" y="10.5" width="3" height="3" rx="1.5" fill={color} /><Rect x="4" y="16" width="3" height="3" rx="1.5" fill={color} /></Svg>; }
function RoundedImageIcon({ color }: { color: string }) { return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x="3" y="4" width="18" height="16" rx="5" stroke={color} strokeWidth="2" /><Circle cx="8" cy="9" r="1.5" fill={color} /><Path d="m5 17 4-4 3 3 2-2 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>; }

function PencilIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityLabel="Edit">
      <Path d="m4 16.5-.75 3.25L6.5 19 17.75 7.75l-3.25-3.25L3.25 15.75" stroke="#007C83" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m13.5 5.5 3.25 3.25M4 19.75l3.25-.75" stroke="#F2B84B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RoamenuLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.logoRow, compact && styles.compactLogoRow]} accessible accessibilityLabel="Roamenu">
      <Svg width={compact ? 30 : 38} height={compact ? 30 : 38} viewBox="0 0 64 64" fill="none">
        <Circle cx="32" cy="32" r="26" fill="#FFF4D6" stroke="#007C83" strokeWidth="3" />
        <Path d="M16 35h32M20 40c2.5 6 7 9 12 9s9.5-3 12-9" stroke="#007C83" strokeWidth="3" strokeLinecap="round" />
        <Path d="M23 18v12M28 18v12M33 18v12M23 24h10M43 18v13" stroke="#F2B84B" strokeWidth="3" strokeLinecap="round" />
      </Svg>
      <View style={styles.logoType}>
        <Text style={[styles.logoName, compact && styles.compactLogoName]}>ROAMENU</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7F8F4', flex: 1, paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0 },
  content: { gap: 16, padding: 22, paddingBottom: 44 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  authKeyboard: { flex: 1 },
  authContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 44 },
  authCard: { gap: 16 },
  authPanel: { backgroundColor: '#FFFFFF', borderColor: '#D7E4E5', borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 },
  kicker: { color: '#F2B84B', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  logoRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  compactLogoRow: { gap: 7 },
  logoType: { justifyContent: 'center' },
  logoName: { color: '#007C83', fontSize: 25, fontWeight: '900', letterSpacing: 1.4 },
  compactLogoName: { fontSize: 16, letterSpacing: 1 },
  scanHeading: { color: '#F2B84B', fontSize: 24, fontWeight: '800', lineHeight: 30 },
  title: { color: '#007C83', fontSize: 32, fontWeight: '800', lineHeight: 38 },
  subtitle: { color: '#5A6E71', fontSize: 16, lineHeight: 24 },
  authSubtitle: { color: '#5A6E71', fontSize: 14, lineHeight: 20 },
  subtitleLead: { color: '#007C83', fontWeight: '800' },
  descriptionTextGroup: { borderLeftColor: '#007C83', borderLeftWidth: 3, gap: 6, paddingLeft: 13 },
  authInput: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 10, borderWidth: 1, color: '#102A2E', minHeight: 50, paddingHorizontal: 14 },
  authHint: { color: '#5A6E71', fontSize: 12 },
  authDivider: { color: '#5A6E71', fontSize: 13, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: '#007C83', borderRadius: 12, minHeight: 52, justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  scanButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#007C83', borderRadius: 14, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 14 },
  scanButtonText: { color: '#007C83', fontSize: 16, fontWeight: '800' },
  scanButtonHint: { color: '#5A6E71', fontSize: 12, marginTop: 3 },
  howItWorksCard: { backgroundColor: '#E6F2F3', borderColor: '#B8DADC', borderRadius: 14, borderWidth: 1, gap: 8, padding: 16 },
  howItWorksTitle: { color: '#102A2E', fontSize: 17, fontWeight: '800' },
  howItWorksHint: { color: '#5A6E71', fontSize: 13, lineHeight: 19 },
  demoMenu: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 6, borderWidth: 1, gap: 7, height: 104, padding: 11, transform: [{ rotate: '-5deg' }], width: 178 },
  demoMenuHeader: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  demoMenuDot: { backgroundColor: '#F2B84B', borderRadius: 5, height: 10, width: 10 },
  demoMenuHeaderLine: { backgroundColor: '#007C83', borderRadius: 2, height: 5, width: 70 },
  demoMenuLineWide: { backgroundColor: '#B8DADC', borderRadius: 2, height: 5, width: '82%' },
  demoMenuLine: { backgroundColor: '#E2E8EC', borderRadius: 2, height: 5, width: '68%' },
  demoMenuLineShort: { backgroundColor: '#E2E8EC', borderRadius: 2, height: 5, width: '45%' },
  demoScanLine: { backgroundColor: '#F2B84B', borderRadius: 2, height: 3, left: '18%', position: 'absolute', right: '18%', top: 12 },
  demoResult: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#007C83', borderRadius: 8, borderWidth: 1, bottom: 12, flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 7, position: 'absolute', right: 12 },
  demoResultCheck: { alignItems: 'center', backgroundColor: '#007C83', borderRadius: 10, color: '#FFFFFF', fontSize: 13, fontWeight: '800', height: 20, lineHeight: 20, textAlign: 'center', width: 20 },
  demoResultText: { maxWidth: 118 },
  demoResultTitle: { color: '#102A2E', fontSize: 11, fontWeight: '800' },
  demoResultHint: { color: '#5A6E71', fontSize: 10, marginTop: 1 },
  howItWorksSteps: { gap: 10, marginTop: 4 },
  howItWorksStep: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  howItWorksNumber: { alignItems: 'center', backgroundColor: '#F2B84B', borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  howItWorksNumberText: { color: '#102A2E', fontSize: 13, fontWeight: '900' },
  howItWorksStepText: { flex: 1 },
  howItWorksStepTitle: { color: '#102A2E', fontSize: 13, fontWeight: '800' },
  howItWorksStepHint: { color: '#5A6E71', fontSize: 12, lineHeight: 17 },
  resumeCard: { alignItems: 'center', backgroundColor: '#E6F2F3', borderColor: '#007C83', borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  resumeTextGroup: { flex: 1, gap: 3 },
  resumeTitle: { color: '#102A2E', fontSize: 15, fontWeight: '800' },
  resumeProgress: { color: '#5A6E71', fontSize: 12 },
  resumeArrow: { color: '#007C83', fontSize: 28, fontWeight: '300', lineHeight: 28, marginLeft: 12 },
  backButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  backButtonText: { color: '#102A2E', fontSize: 32, fontWeight: '300', lineHeight: 34 },
  secondaryButton: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 12, borderWidth: 1, minHeight: 52, justifyContent: 'center' },
  secondaryButtonText: { color: '#102A2E', fontSize: 16, fontWeight: '700' },
  appleButton: { height: 48, width: '100%' },
  error: { color: '#991B1B', fontSize: 14 },
  preferenceCard: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 },
  cardTitle: { color: '#102A2E', fontSize: 18, fontWeight: '800' },
  displayNameInput: { flex: 1, minHeight: 44, paddingVertical: 8 },
  displayNameRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  cardHint: { color: '#5A6E71', fontSize: 13, lineHeight: 19 },
  input: { borderColor: '#E2E8EC', borderRadius: 8, borderWidth: 1, color: '#102A2E', minHeight: 64, padding: 12, textAlignVertical: 'top' },
  preferenceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: '#007C83', fontWeight: '800' },
  preview: { borderRadius: 12, height: 180, width: '100%' },
  shareRow: { flexDirection: 'row', gap: 8 },
  pageActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
  addPageButton: { backgroundColor: '#E6F2F3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  addPageButtonText: { color: '#005E63', fontSize: 13, fontWeight: '700' },
  shareButton: { backgroundColor: '#E6F2F3', borderRadius: 10, flex: 1, padding: 12 },
  shareText: { color: '#005E63', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  iconGallery: { backgroundColor: '#FFFFFF', borderColor: '#D7E4E5', borderRadius: 14, borderWidth: 1, gap: 5, padding: 14 },
  iconGalleryTitle: { color: '#102A2E', fontSize: 15, fontWeight: '800' },
  iconGalleryHint: { color: '#5A6E71', fontSize: 12, lineHeight: 17 },
  iconGalleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  iconGalleryOption: { alignItems: 'center', borderColor: '#E2E8EC', borderRadius: 10, borderWidth: 1, minWidth: 84, paddingHorizontal: 8, paddingVertical: 9 },
  iconGalleryOptionSelected: { backgroundColor: '#E6F2F3', borderColor: '#007C83' },
  iconGalleryPair: { alignItems: 'center', flexDirection: 'row', gap: 9, height: 24 },
  iconGalleryLabel: { color: '#102A2E', fontSize: 11, fontWeight: '700', marginTop: 5 },
  fixedViewModeRow: { backgroundColor: '#E6F2F3', borderColor: '#B8DADC', borderRadius: 12, borderWidth: 1, bottom: 18, flexDirection: 'row', left: 18, padding: 3, position: 'absolute' },
  viewModeButton: { alignItems: 'center', borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  viewModeButtonSelected: { backgroundColor: '#FFFFFF' },
  menuImageFrame: { backgroundColor: '#102A2E', overflow: 'hidden', position: 'relative', width: '100%' },
  menuImageCanvas: { height: '100%', position: 'absolute', width: '100%' },
  menuImage: { height: '100%', width: '100%' },
  menuImageLabel: { backgroundColor: 'rgba(255, 244, 214, 0.88)', borderColor: '#007C83', borderRadius: 4, borderWidth: 1, justifyContent: 'center', minHeight: 22, overflow: 'visible', paddingHorizontal: 4, position: 'absolute' },
  menuImageLabelText: { color: '#102A2E', fontSize: 9, fontWeight: '800' },
  imageNotice: { backgroundColor: 'rgba(255, 244, 214, 0.94)', color: '#102A2E', fontSize: 14, fontWeight: '700', left: 16, padding: 12, position: 'absolute', right: 16, textAlign: 'center', top: '45%' },
  imageZoomControls: { alignItems: 'center', backgroundColor: 'rgba(16, 42, 46, 0.88)', borderRadius: 8, bottom: 10, flexDirection: 'row', position: 'absolute', right: 10 },
  imageZoomButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 36 },
  imageZoomButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  imageZoomReset: { alignItems: 'center', height: 34, justifyContent: 'center', minWidth: 48 },
  imageZoomResetText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tabs: { gap: 8 },
  tab: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  selectedTab: { backgroundColor: '#E6F2F3', borderColor: '#007C83' },
  itemCard: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  itemSelectButton: { alignItems: 'center', alignSelf: 'flex-end', borderColor: '#007C83', borderRadius: 16, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  itemSelectButtonSelected: { backgroundColor: '#007C83' },
  itemSelectText: { color: '#007C83', fontSize: 18, fontWeight: '800' },
  itemSelectTextSelected: { color: '#FFFFFF' },
  selectedItemsPanel: { gap: 10 },
  selectedItemCard: { backgroundColor: '#FFFFFF', borderColor: '#007C83', borderRadius: 12, borderWidth: 1, gap: 5, padding: 16 },
  selectedOriginalRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  selectedOriginalName: { color: '#102A2E', flex: 1, fontSize: 20, fontWeight: '800' },
  selectedTranslatedName: { color: '#5A6E71', fontSize: 16, fontWeight: '600' },
  selectedPronunciation: { color: '#007C83', fontSize: 14, fontStyle: 'italic', fontWeight: '700' },
  warningCard: { backgroundColor: '#FFF5F3', borderColor: '#C83F3F', borderWidth: 2 },
  itemHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  itemNames: { flex: 1, paddingRight: 12 },
  itemName: { color: '#102A2E', fontSize: 18, fontWeight: '800' },
  originalRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 3 },
  originalName: { color: '#5A6E71', fontSize: 13, fontStyle: 'italic', marginTop: 3 },
  speakerButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  speakerIcon: { fontSize: 17 },
  price: { color: '#007C83', fontSize: 15, fontWeight: '800' },
  detail: { color: '#5A6E71', fontSize: 14, lineHeight: 21 },
  warning: { color: '#B3261E', fontSize: 14, fontWeight: '800' },
  modalOverlay: { backgroundColor: 'rgba(16, 42, 46, 0.35)', flex: 1, justifyContent: 'center', padding: 20 },
  qrCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, gap: 16, padding: 20 },
  scanModalOverlay: { alignItems: 'center', backgroundColor: 'rgba(16, 42, 46, 0.45)', flex: 1, justifyContent: 'center', padding: 20 },
  scanModalCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, gap: 14, maxWidth: 380, padding: 28, width: '100%' },
  scanModalTitle: { color: '#102A2E', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  scanModalText: { color: '#5A6E71', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  scanProgressTrack: { backgroundColor: '#E6F2F3', borderRadius: 4, height: 8, overflow: 'hidden', width: '100%' },
  scanProgressBar: { backgroundColor: '#007C83', borderRadius: 4, height: '100%', width: '42%' },
  preferenceModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 14, padding: 22 },
  modalTitle: { color: '#102A2E', fontSize: 22, fontWeight: '800' },
  modalText: { color: '#5A6E71', fontSize: 14, lineHeight: 20 },
  preferenceInput: { borderColor: '#E2E8EC', borderRadius: 8, borderWidth: 1, color: '#102A2E', minHeight: 80, padding: 12, textAlignVertical: 'top' },
  confirmButton: { alignItems: 'center', backgroundColor: '#007C83', borderRadius: 9, justifyContent: 'center', minHeight: 50 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cancelText: { color: '#007C83', fontWeight: '700', paddingVertical: 5, textAlign: 'center' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 10 },
  topBarBrand: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  accountButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  accountHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 10 },
  accountContent: { gap: 16, padding: 22, paddingBottom: 44 },
  accountSection: { backgroundColor: '#FFFFFF', borderColor: '#E2E8EC', borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 },
  languageRow: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', minHeight: 44, paddingHorizontal: 10 },
  languageRowSelected: { backgroundColor: '#E6F2F3' },
  languageFlag: { fontSize: 18, marginRight: 10 },
  languageLabel: { color: '#102A2E', flex: 1, fontSize: 14, fontWeight: '700' },
  logoutButton: { alignItems: 'center', borderColor: '#991B1B', borderRadius: 9, borderWidth: 1, paddingVertical: 13 },
  logoutText: { color: '#991B1B', fontWeight: '800' },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { color: '#991B1B', fontSize: 13, fontWeight: '800' },
});
