import { describe, expect, it } from "vitest";

import { validateEmail, validatePhone, validateUsername } from "@/lib/validation";

describe("auth contact validation", () => {
  it("validates emails properly", () => {
    expect(validateEmail("")).toBeNull();
    expect(validateEmail("admin@dat.local")).toBeNull();
    expect(validateEmail("invalid-email")).not.toBeNull();
    expect(validateEmail("foo..bar@example.com")).not.toBeNull();
  });

  it("validates Vietnamese and E.164 phone numbers", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("0912 345 678")).toBeNull();
    expect(validatePhone("+84912345678")).toBeNull();
    expect(validatePhone("0111222333")).not.toBeNull();
    expect(validatePhone("12345")).not.toBeNull();
  });

  it("validates usernames properly", () => {
    expect(validateUsername("")).toBeNull();
    expect(validateUsername("admin")).toBeNull();
    expect(validateUsername("dat.nguyen_01")).toBeNull();
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("12345678")).not.toBeNull();
    expect(validateUsername("user@domain")).not.toBeNull();
  });
});
