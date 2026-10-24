import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import vi from "../messages/vi.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages", () => {
  it("tiếng Anh có đủ khóa như tiếng Việt", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(vi).sort());
  });

  it("không có chuỗi rỗng", () => {
    const empty = [vi, en].flatMap((messages) =>
      keyPaths(messages).filter((path) => {
        const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], messages);
        return typeof value === "string" && value.trim() === "";
      }),
    );
    expect(empty).toEqual([]);
  });
});
