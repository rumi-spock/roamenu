import { describe, expect, it } from "vitest";
import { applyPreferenceMatches, formatMenuPrice, mergeScanPage, translateMenuSection, type MenuItem } from "../src/menu-domain";
import { extractSharedMenuId } from "../src/shared-menu-link";

const item: MenuItem = {
  id: "pasta-1",
  number: "1",
  priceInPence: 1250,
  originalName: "Pasta ai funghi",
  translatedName: "Mushroom pasta",
  pronunciation: null,
  description: "Pasta with mushrooms",
  allergens: ["milk"],
  section: 0,
  matchedPreferences: [],
};

describe("menu domain", () => {
  it("translates known section aliases and falls back to the original label", () => {
    expect(translateMenuSection("  main   courses ", "es")).toBe("Platos principales");
    expect(translateMenuSection("Chef's choice", "es")).toBe("Chef's choice");
  });

  it("matches preferences against names, descriptions, and allergens", () => {
    const [matched] = applyPreferenceMatches([item], [{ id: "milk", label: "dairy" }, { id: "mushroom", label: "mushroom" }]);
    expect(matched.matchedPreferences).toEqual(["mushroom"]);

    const [allergenMatch] = applyPreferenceMatches([item], [{ id: "milk", label: "milk" }]);
    expect(allergenMatch.matchedPreferences).toEqual(["milk"]);
  });

  it("formats minor-unit prices using the currency's fraction digits", () => {
    expect(formatMenuPrice(1250, "GBP", "en-GB")).toBe("£12.50");
    expect(formatMenuPrice(1200, "JPY", "ja-JP")).toBe("￥1,200");
    expect(formatMenuPrice(8000, "KRW", "ko-KR")).toContain("8,000");
    expect(formatMenuPrice(1250, null, "en-GB")).toBe("12.50");
  });

  it("extracts share IDs from native and browser links", () => {
    expect(extractSharedMenuId("roamenu://menu/share-123")).toBe("share-123");
    expect(extractSharedMenuId("https://roamenu.vercel.app/menu/share-123")).toBe("share-123");
    expect(extractSharedMenuId("not a URL")).toBeNull();
  });
});

describe("multi-page scans", () => {
  const dish = (id: string, name: string, section: number | null): MenuItem => ({ ...item, id, originalName: name, translatedName: name, section, bounds: null, matchedPreferences: [] });
  const empty = { sections: [], items: [] };

  it("maps each page's sections onto the merged section list", () => {
    const first = mergeScanPage(empty, { sections: ["Starters", "Mains"], items: [dish("a", "Soup", 0), dish("b", "Steak", 1)] }, 1);
    const second = mergeScanPage(first, { sections: ["Drinks", "mains"], items: [dish("c", "Beer", 0), dish("d", "Fish", 1)] }, 2);

    expect(second.sections).toEqual(["Starters", "Mains", "Drinks"]);
    expect(second.items.map((entry) => [entry.originalName, second.sections[entry.section ?? -1]])).toEqual([
      ["Soup", "Starters"], ["Steak", "Mains"], ["Beer", "Drinks"], ["Fish", "Mains"],
    ]);
  });

  it("skips dishes already scanned while keeping every item for the page image", () => {
    const first = mergeScanPage(empty, { sections: ["Mains"], items: [dish("a", "Steak", 0)] }, 1);
    const second = mergeScanPage(first, { sections: ["Mains"], items: [dish("b", "Steak", 0), dish("c", "Fish", 7)] }, 2);

    expect(second.items.map((entry) => entry.originalName)).toEqual(["Steak", "Fish"]);
    expect(second.items[1]).toMatchObject({ id: "c-page-2-0", section: null });
    expect(second.pageItems.map((entry) => entry.originalName)).toEqual(["Steak", "Fish"]);
  });

  it("keeps first-page IDs unchanged", () => {
    expect(mergeScanPage(empty, { sections: [], items: [dish("menu-item-0", "Soup", null)] }, 1).items[0]?.id).toBe("menu-item-0");
  });
});