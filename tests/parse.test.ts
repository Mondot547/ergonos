import { test } from "node:test";
import assert from "node:assert/strict";
import { eurosToCents, slugify } from "../src/lib/parse.ts";
import { formatEur, assertCents } from "../src/lib/money.ts";

test("eurosToCents : formats valides et invalides", () => {
  assert.equal(eurosToCents("19,90"), 1990);
  assert.equal(eurosToCents("19.9"), 1990);
  assert.equal(eurosToCents("0"), 0);
  assert.equal(eurosToCents("12"), 1200);
  for (const bad of ["", "-1", "1,234", "abc", "1e3", "99999999"]) assert.equal(eurosToCents(bad), null);
});

test("slugify", () => assert.equal(slugify("Repose-poignets ÉRGO !"), "repose-poignets-ergo"));

test("money : format et garde-fous", () => {
  assert.equal(formatEur(null), "—");
  assert.match(formatEur(1990), /19,90/);
  assert.throws(() => assertCents(1.5));
  assert.throws(() => assertCents(-1));
});
