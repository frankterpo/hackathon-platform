import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseStructuredSubmissionBody } from "../scripts/lib/submission-csv-fields.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("parseStructuredSubmissionBody matches csv-recovery body shape", () => {
  const body = [
    "Track: Adtech",
    "Demo: https://example.com/demo",
    "Team: Alice, Bob",
    "Description:\nOur pitch.\nLine 2.",
    "AI notes:\nSummary here.",
  ].join("\n\n");

  const p = parseStructuredSubmissionBody(body);
  assert.equal(p.chosen_track, "Adtech");
  assert.equal(p.demo_url, "https://example.com/demo");
  assert.equal(p.team_members, "Alice, Bob");
  assert.ok(p.description?.includes("Our pitch."));
  assert.ok(p.description?.includes("Line 2."));
  assert.ok(p.participant_notes?.includes("Summary here."));
  assert.ok(!p.participant_notes?.includes("Our pitch."));
  assert.equal(p._meta.hadAnyLabeledBlock, true);
});

test("parseStructuredSubmissionBody Notes block and freeform", () => {
  const labeled = parseStructuredSubmissionBody("Notes:\nhello");
  assert.equal(labeled.participant_notes, "hello");
  assert.equal(labeled.description, null);
  assert.equal(labeled._meta.hadAnyLabeledBlock, true);

  const plain = parseStructuredSubmissionBody("just a description");
  assert.equal(plain.chosen_track, null);
  assert.equal(plain.description, null);
  assert.equal(plain.participant_notes, null);
  assert.equal(plain._meta.hadAnyLabeledBlock, false);
});

test("parseStructuredSubmissionBody Track/Demo/Team/Description blocks", () => {
  const body = [
    "Track: Money Movement",
    "Demo: https://example.com/demo",
    "Team: Alice, Bob",
    "Description:\nFirst line of pitch.\nSecond line.",
  ].join("\n\n");

  const p = parseStructuredSubmissionBody(body);
  assert.equal(p.chosen_track, "Money Movement");
  assert.equal(p.demo_url, "https://example.com/demo");
  assert.equal(p.team_members, "Alice, Bob");
  assert.equal(p.description, "First line of pitch.\nSecond line.");
  assert.equal(p.participant_notes, null);
  assert.equal(p._meta.hadAnyLabeledBlock, true);
});

test("parser file lives under scripts/lib from repo root", () => {
  const text = readFileSync(
    join(root, "scripts/lib/submission-csv-fields.mjs"),
    "utf8",
  );
  assert.match(text, /parseStructuredSubmissionBody/);
});
