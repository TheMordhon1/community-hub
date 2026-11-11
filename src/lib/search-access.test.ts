// @ts-expect-error Bun's test module is available in the test runner but not in the app typecheck.
import { describe, expect, test } from "bun:test";
import { canSearchAllPayments, getUnpaidHouseIds } from "@/lib/search-access";

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

  test("missing payment rows and overdue payments count as unpaid for the requested period", () => {
    expect(getUnpaidHouseIds(["house-a", "house-b", "house-c"], [
      { house_id: "house-a", status: "paid" },
      { house_id: "house-b", status: "overdue" },
    ])).toEqual(["house-b", "house-c"]);
  });

  test("a paid record takes precedence when duplicate period rows exist", () => {
    expect(getUnpaidHouseIds(["house-a"], [
      { house_id: "house-a", status: "overdue" },
      { house_id: "house-a", status: "paid" },
    ])).toEqual([]);
  });
});