import { describe, expect, it } from "vitest";

import { DICTIONARIES } from "@/i18n/dictionaries";

function collectLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe("i18n dictionaries", () => {
  it("keeps identical key sets for Vietnamese default and English", () => {
    const viKeys = collectLeafKeys(DICTIONARIES.vi);
    const enKeys = collectLeafKeys(DICTIONARIES.en);
    expect(viKeys).toEqual(enKeys);
    expect(viKeys.length).toBeGreaterThan(20);
  });

  it("includes expected Vietnamese and English labels for navigation", () => {
    expect(DICTIONARIES.vi.nav.todoList).toBe("Todo List");
    expect(DICTIONARIES.vi.nav.focus).toBe("Đếm ngược");
    expect(DICTIONARIES.en.nav.focus).toBe("Countdown");
    expect(DICTIONARIES.en.nav.analytics).toBe("Analytics");
    expect(DICTIONARIES.vi.common.back).toBe("Quay lại");
    expect(DICTIONARIES.en.common.back).toBe("Back");
  });
});
