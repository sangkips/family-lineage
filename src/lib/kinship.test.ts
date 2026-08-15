import { describe, expect, it } from "vitest";
import type { Gender, ParentLinkDTO } from "./tree";
import {
  createRelationLookup,
  describeGenerationOffset,
  describeRelation,
} from "./kinship";

/**
 * Fixture family, anchored on "me":
 *
 *   gggg → ggg → gg1 + gg2 ─┬─ grandpa + grandma ─┬─ dad + mum ─┬─ me ─ son ─ grandson
 *                           │                     │             ├─ sister ─ niece
 *                           │                     │             └─ nameless (no gender)
 *                           │                     └─ aunt + auntHusband ─ cousin
 *                           └─ greatUncle
 */
const link = (childId: string, parentId: string): ParentLinkDTO => ({
  childId,
  parentId,
  role: "PARENT",
});

const LINKS: ParentLinkDTO[] = [
  link("ggg", "gggg"),
  link("gg1", "ggg"),
  link("grandpa", "gg1"),
  link("grandpa", "gg2"),
  link("greatUncle", "gg1"),
  link("greatUncle", "gg2"),
  link("dad", "grandpa"),
  link("dad", "grandma"),
  link("aunt", "grandpa"),
  link("aunt", "grandma"),
  link("me", "dad"),
  link("me", "mum"),
  link("sister", "dad"),
  link("sister", "mum"),
  link("nameless", "dad"),
  link("nameless", "mum"),
  link("cousin", "aunt"),
  link("cousin", "auntHusband"),
  link("son", "me"),
  link("grandson", "son"),
  link("niece", "sister"),
];

const GENDERS = new Map<string, Gender | null>([
  ["gggg", "MALE"],
  ["ggg", "MALE"],
  ["gg1", "MALE"],
  ["gg2", "FEMALE"],
  ["grandpa", "MALE"],
  ["grandma", "FEMALE"],
  ["dad", "MALE"],
  ["mum", "FEMALE"],
  ["aunt", "FEMALE"],
  ["auntHusband", "MALE"],
  ["cousin", "MALE"],
  ["sister", "FEMALE"],
  ["nameless", null],
  ["son", "MALE"],
  ["grandson", "MALE"],
  ["niece", "FEMALE"],
  ["greatUncle", "MALE"],
]);

const relationTo = createRelationLookup("me", LINKS, GENDERS);

describe("createRelationLookup", () => {
  it("names the anchor themselves", () => {
    expect(relationTo("me")).toBe("you");
  });

  it.each([
    ["dad", "father"],
    ["mum", "mother"],
    ["grandpa", "grandfather"],
    ["grandma", "grandmother"],
    ["gg1", "great-grandfather"],
    ["gg2", "great-grandmother"],
    ["ggg", "great-great-grandfather"],
  ])("names ancestor %s as %s", (id, expected) => {
    expect(relationTo(id)).toBe(expected);
  });

  it.each([
    ["son", "son"],
    ["grandson", "grandson"],
  ])("names descendant %s as %s", (id, expected) => {
    expect(relationTo(id)).toBe(expected);
  });

  it.each([
    ["sister", "sister"],
    ["aunt", "aunt"],
    ["cousin", "cousin"],
    ["niece", "niece"],
  ])("names collateral relative %s as %s", (id, expected) => {
    expect(relationTo(id)).toBe(expected);
  });

  it("falls back to a neutral term when gender is unknown", () => {
    expect(relationTo("nameless")).toBe("sibling");
  });

  it("falls back to a generation count past great-great-grandparent", () => {
    expect(relationTo("gggg")).toBe("relative · 5 generations up");
  });

  it("falls back to a generation count for relatives it has no word for", () => {
    // A great-uncle: two generations up the tree, but not a lineal ancestor.
    expect(relationTo("greatUncle")).toBe("relative · 2 generations up");
  });

  it("returns null for someone related only by marriage", () => {
    expect(relationTo("auntHusband")).toBeNull();
  });

  it("reads correctly from a different anchor", () => {
    const fromCousin = createRelationLookup("cousin", LINKS, GENDERS);
    expect(fromCousin("me")).toBe("cousin");
    expect(fromCousin("aunt")).toBe("mother");
    expect(fromCousin("dad")).toBe("uncle");
    expect(fromCousin("grandpa")).toBe("grandfather");
  });

  it("names a nephew from the parent generation", () => {
    const fromAunt = createRelationLookup("aunt", LINKS, GENDERS);
    expect(fromAunt("sister")).toBe("niece");
  });

  it("works without any gender information", () => {
    const genderless = createRelationLookup("me", LINKS);
    expect(genderless("dad")).toBe("parent");
    expect(genderless("sister")).toBe("sibling");
    expect(genderless("son")).toBe("child");
    expect(genderless("aunt")).toBe("aunt or uncle");
  });

  it("takes the nearest path when a person is reachable two ways", () => {
    // Half-siblings share a single parent and are still siblings.
    const halfSiblings: ParentLinkDTO[] = [link("a", "shared"), link("b", "shared")];
    expect(describeRelation("a", "b", halfSiblings)).toBe("sibling");
  });
});

describe("describeGenerationOffset", () => {
  it.each([
    [0, "Your generation"],
    [-1, "Parents"],
    [-3, "Great-grandparents"],
    [1, "Children"],
    [2, "Grandchildren"],
    [-4, "relative · 4 generations up"],
    [5, "relative · 5 generations down"],
  ])("labels offset %i as %s", (offset, expected) => {
    expect(describeGenerationOffset(offset)).toBe(expected);
  });
});
