import { describe, expect, it } from "vitest";
import { cookieFromSetCookie, jwtExpiry } from "../src/lib/http";

describe("cookies de session", () => {
  it("garde les paires nom=valeur de plusieurs Set-Cookie", () => {
    const header =
      "__Secure-neon-auth.session_token=abc.def; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly, " +
      "__Secure-neon-auth.session_data=xyz; Path=/; Secure";
    expect(cookieFromSetCookie(header)).toBe("__Secure-neon-auth.session_token=abc.def; __Secure-neon-auth.session_data=xyz");
  });

  it("ignore les cookies effacés et l'absence d'en-tête", () => {
    expect(cookieFromSetCookie("a=; Max-Age=0")).toBeNull();
    expect(cookieFromSetCookie(null)).toBeNull();
  });
});

describe("expiration du JWT", () => {
  it("lit exp", () => {
    const payload = btoa(JSON.stringify({ exp: 1_800_000_000 })).replace(/=+$/, "");
    expect(jwtExpiry(`h.${payload}.s`)).toBe(1_800_000_000_000);
    expect(jwtExpiry("pas-un-jwt")).toBe(0);
  });
});
