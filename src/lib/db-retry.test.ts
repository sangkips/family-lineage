import { describe, expect, it, vi } from "vitest";
import { isTransientDbError, withDbRetry } from "./db-retry";

describe("isTransientDbError", () => {
  it.each([
    "getaddrinfo EAI_AGAIN aws-0-eu-central-1.pooler.supabase.com",
    "connect ECONNREFUSED 10.0.0.1:5432",
    "Connection terminated unexpectedly",
    "P1001: Can't reach database server",
  ])("treats %s as transient", (message) => {
    expect(isTransientDbError(new Error(message))).toBe(true);
  });

  it.each([
    "Unique constraint failed on the fields: (`partnerAId`,`partnerBId`)",
    "This marriage is already recorded",
  ])("does not treat %s as transient", (message) => {
    expect(isTransientDbError(new Error(message))).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("returns the result without retrying when the call succeeds", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(withDbRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries once after a transient failure", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("getaddrinfo EAI_AGAIN supabase.com"))
      .mockResolvedValue("recovered");

    await expect(withDbRetry(run, 0)).resolves.toBe("recovered");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry a real error", async () => {
    // A constraint violation would fail identically the second time, and
    // retrying it would only hide the cause.
    const run = vi.fn().mockRejectedValue(new Error("Unique constraint failed"));

    await expect(withDbRetry(run, 0)).rejects.toThrow("Unique constraint failed");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives up after the single retry", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    await expect(withDbRetry(run, 0)).rejects.toThrow("ECONNRESET");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
