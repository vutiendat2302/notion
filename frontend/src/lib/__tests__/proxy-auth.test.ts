import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

describe("proxy route auth gate", () => {
  it("redirects unauthenticated workspace request to /login with next param", () => {
    const req = new NextRequest("http://localhost:3010/tasks?view=board");
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3010/login?next=%2Ftasks%3Fview%3Dboard"
    );
  });

  it("allows unauthenticated request to /login, /register and /policy", () => {
    expect(proxy(new NextRequest("http://localhost:3010/login")).status).toBe(200);
    expect(proxy(new NextRequest("http://localhost:3010/register")).status).toBe(200);
    expect(proxy(new NextRequest("http://localhost:3010/policy")).status).toBe(200);
  });

  it("allows authenticated user to open /policy without redirecting", () => {
    const req = new NextRequest("http://localhost:3010/policy", {
      headers: { cookie: "access_token=abc" },
    });
    expect(proxy(req).status).toBe(200);
  });

  it("redirects authenticated user from /login to /today", () => {
    const req = new NextRequest("http://localhost:3010/login", {
      headers: { cookie: "access_token=abc" },
    });
    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3010/today");
  });

  it("allows authenticated user into workspace routes", () => {
    const req = new NextRequest("http://localhost:3010/admin/users", {
      headers: { cookie: "refresh_token=xyz" },
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
  });
});
