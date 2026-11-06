export type MenuPreference = { id: string; label: string };
export type MenuItemBounds = { x: number; y: number; width: number; height: number };

export type MenuItem = {
  id: string;
  number: string | null;
  priceInPence: number | null;
  originalName: string;
  translatedName: string;
  pronunciation: string | null;
  description: string;
  allergens: string[];
  section: number | null;
  bounds: MenuItemBounds | null;
  matchedPreferences: string[];
};

export type MenuScanResult = {
  sourceLanguage: string;
  currency: string | null;
  sections: string[];
  items: MenuItem[];
  code?: string;
  error?: string;
};

export type SharedMenu = {
  sourceLanguage: string;
  currency: string | null;
  sections: string[];
  items: Omit<MenuItem, 'matchedPreferences'>[];
};

const sectionLabels: Record<string, Record<string, string>> = {
  all: { en: 'All', es: 'Todo', pt: 'Tudo', nl: 'Alles' },
  starters: { en: 'Starters', es: 'Entrantes', pt: 'Entradas', nl: 'Voorgerechten' },
  mains: { en: 'Main courses', es: 'Platos principales', pt: 'Pratos principais', nl: 'Hoofdgerechten' },
  desserts: { en: 'Desserts', es: 'Postres', pt: 'Sobremesas', nl: 'Desserts' },
  drinks: { en: 'Drinks', es: 'Bebidas', pt: 'Bebidas', nl: 'Dranken' },
  breakfast: { en: 'Breakfast', es: 'Desayuno', pt: 'Pequeno-almoço', nl: 'Ontbijt' },
  salads: { en: 'Salads', es: 'Ensaladas', pt: 'Saladas', nl: 'Salades' },
  sides: { en: 'Sides', es: 'Guarniciones', pt: 'Acompanhamentos', nl: 'Bijgerechten' },
};

const sectionAliases: Record<string, string> = {
  all: 'all', todo: 'all', tudo: 'all', alles: 'all',
  starter: 'starters', starters: 'starters', entrantes: 'starters', entradas: 'starters', voorgerechten: 'starters',
  main: 'mains', mains: 'mains', 'main courses': 'mains', 'platos principales': 'mains', 'pratos principais': 'mains', hoofdgerechten: 'mains',
  dessert: 'desserts', desserts: 'desserts', postres: 'desserts', sobremesas: 'desserts',
  drink: 'drinks', drinks: 'drinks', bebidas: 'drinks', dranken: 'drinks',
  breakfast: 'breakfast', desayuno: 'breakfast', 'pequeno-almoço': 'breakfast', ontbijt: 'breakfast',
  salad: 'salads', salads: 'salads', ensaladas: 'salads', saladas: 'salads', salades: 'salads',
  side: 'sides', sides: 'sides', guarniciones: 'sides', acompanhamentos: 'sides', bijgerechten: 'sides',
};

export function translateMenuSection(section: string, language: string): string {
  const canonical = sectionAliases[section.trim().toLocaleLowerCase().replace(/\s+/g, ' ')];
  return canonical ? sectionLabels[canonical][language] ?? sectionLabels[canonical].en : section;
}

export function normalisePreferenceLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function comparableText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function applyPreferenceMatches(items: MenuItem[], preferences: MenuPreference[]): MenuItem[] {
  return items.map((item) => {
    const searchableText = comparableText([item.originalName, item.translatedName, item.description, ...item.allergens].join(' '));
    const matchedPreferences = preferences.filter((preference) => searchableText.includes(comparableText(preference.label))).map((preference) => preference.label);
    return { ...item, matchedPreferences };
  });
}

export function formatMenuPrice(priceInMinorUnits: number, currency: string, language: string): string {
  try {
    const formatter = new Intl.NumberFormat(language, { style: 'currency', currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(priceInMinorUnits / (10 ** fractionDigits));
  } catch {
    return `${currency} ${priceInMinorUnits}`;
  }
}
