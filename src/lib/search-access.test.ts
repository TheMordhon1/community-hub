import { describe, expect, test } from "bun:test";
import { canSearchAllPayments } from "@/lib/search-access";

describe("global library payment search scope", () => {
  test("admin and Menteri Sistem & Digital can search all house payments", () => {
    expect(canSearchAllPayments("admin", null, false)).toBe(true);
    expect(canSearchAllPayments("pengurus", "menteri_sisdigi", false)).toBe(true);
  });

  test("only finance-enabled Pengurus can search all house payments", () => {
    expect(canSearchAllPayments("pengurus", "bendahara", true)).toBe(true);
    expect(canSearchAllPayments("pengurus", "anggota", false)).toBe(false);
  });

  test("residents and unresolved roles cannot search all house payments", () => {
    expect(canSearchAllPayments("warga", null, false)).toBe(false);
    expect(canSearchAllPayments(null, null, false)).toBe(false);
  });
});