import { describe, expect, it } from "vitest";
import { applyPreferenceMatches, formatMenuPrice, translateMenuSection, type MenuItem } from "../src/menu-domain";
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
  });

  it("extracts share IDs from native and browser links", () => {
    expect(extractSharedMenuId("roamenu://menu/share-123")).toBe("share-123");
    expect(extractSharedMenuId("https://roamenu.vercel.app/menu/share-123")).toBe("share-123");
    expect(extractSharedMenuId("not a URL")).toBeNull();
  });
});