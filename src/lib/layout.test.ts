import { describe, expect, it } from "vitest";
import type { MarriageDTO, ParentLinkDTO, PersonDTO } from "./tree";
import { layoutTree } from "./layout";

function person(id: string, gender: PersonDTO["gender"] = null): PersonDTO {
  return {
    id,
    firstName: id,
    lastName: "Test",
    maidenName: null,
    gender,
    birthDate: null,
    birthDatePrecision: "YEAR",
    deathDate: null,
    birthPlace: null,
    bio: null,
    isLiving: true,
    status: "APPROVED",
  };
}

const link = (childId: string, parentId: string): ParentLinkDTO => ({
  childId,
  parentId,
  role: "PARENT",
});

const marriage = (a: string, b: string): MarriageDTO => ({
  id: `m-${a}-${b}`,
  partnerAId: a,
  partnerBId: b,
  startDate: null,
  startPrecision: "YEAR",
  endDate: null,
  endReason: null,
});

describe("layoutTree", () => {
  it("places a simple couple and their child", () => {
    const people = [person("dad"), person("mum"), person("kid")];
    const links = [link("kid", "dad"), link("kid", "mum")];

    const result = layoutTree(people, links);

    expect(result.nodes).toHaveLength(3);
    const kid = result.nodes.find((n) => n.id === "kid")!;
    const dad = result.nodes.find((n) => n.id === "dad")!;
    expect(kid.generation).toBe(dad.generation + 1);
    expect(result.couples).toHaveLength(1);
    expect(result.couples[0].recorded).toBe(false); // inferred from the child
  });

  it("marks a couple as recorded when a marriage exists", () => {
    const people = [person("a"), person("b")];
    const result = layoutTree(people, [], undefined, [marriage("a", "b")]);

    expect(result.couples).toHaveLength(1);
    expect(result.couples[0].recorded).toBe(true);
    expect(result.couples[0].marriageId).toBe("m-a-b");
  });

  it("pairs a childless couple, which sharing a child cannot express", () => {
    const people = [person("a"), person("b")];
    const withoutMarriage = layoutTree(people, []);
    const withMarriage = layoutTree(people, [], undefined, [marriage("a", "b")]);

    expect(withoutMarriage.couples).toHaveLength(0);
    expect(withMarriage.couples).toHaveLength(1);
  });

  it("survives someone with two spouses", () => {
    // Remarriage, or two concurrent wives. Both are ordinary in a family
    // register, and both union the same person into two pairings.
    const people = [person("x"), person("wife1"), person("wife2")];
    const marriages = [marriage("x", "wife1"), marriage("x", "wife2")];

    expect(() => layoutTree(people, [], undefined, marriages)).not.toThrow();

    const result = layoutTree(people, [], undefined, marriages);
    expect(result.nodes).toHaveLength(3);
  });

  it("survives a spouse who is also a co-parent with someone else", () => {
    // x married to a; x also has a child with b. Two separate pairings.
    const people = [person("x"), person("a"), person("b"), person("kid")];
    const links = [link("kid", "x"), link("kid", "b")];

    expect(() =>
      layoutTree(people, links, undefined, [marriage("x", "a")])
    ).not.toThrow();
  });
});
