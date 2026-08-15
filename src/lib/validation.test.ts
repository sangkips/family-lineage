import { describe, expect, it } from "vitest";
import { isHangingPerson } from "./validation";

/**
 * A hanging person is connected to nobody — no parent and no child. Being
 * parentless is not enough: the oldest generation and everyone who married in
 * are parentless and entirely legitimate.
 */
describe("isHangingPerson", () => {
  it("accepts anyone with a link, however large the tree", () => {
    expect(isHangingPerson(1, 20)).toBe(false);
    expect(isHangingPerson(2, 0)).toBe(false);
  });

  it("rejects an unlinked person once the tree has anyone else in it", () => {
    expect(isHangingPerson(0, 1)).toBe(true);
    expect(isHangingPerson(0, 20)).toBe(true);
  });

  it("allows the very first person saved into an empty tree", () => {
    // Nobody to link to yet; their spouse arrives as the co-parent of the
    // first child, which is what links them.
    expect(isHangingPerson(0, 0)).toBe(false);
  });
});
