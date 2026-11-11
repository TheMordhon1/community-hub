import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canSearchAllPayments, getUnpaidHouseIds } from "@/lib/search-access";

describe("global library payment search scope", () => {
  it("admin and Menteri Sistem & Digital can search all house payments", () => {
    assert.equal(canSearchAllPayments("admin", null, false), true);
    assert.equal(canSearchAllPayments("pengurus", "menteri_sisdigi", false), true);
  });

  it("only finance-enabled Pengurus can search all house payments", () => {
    assert.equal(canSearchAllPayments("pengurus", "bendahara", true), true);
    assert.equal(canSearchAllPayments("pengurus", "anggota", false), false);
  });

  it("residents and unresolved roles cannot search all house payments", () => {
    assert.equal(canSearchAllPayments("warga", null, false), false);
    assert.equal(canSearchAllPayments(null, null, false), false);
  });

  it("missing payment rows and overdue payments count as unpaid for the requested period", () => {
    assert.deepEqual(getUnpaidHouseIds(["house-a", "house-b", "house-c"], [
      { house_id: "house-a", status: "paid" },
      { house_id: "house-b", status: "overdue" },
    ]), ["house-b", "house-c"]);
  });

  it("a paid record takes precedence when duplicate period rows exist", () => {
    assert.deepEqual(getUnpaidHouseIds(["house-a"], [
      { house_id: "house-a", status: "overdue" },
      { house_id: "house-a", status: "paid" },
    ]), []);
  });
});