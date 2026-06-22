import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipe } from "../public/calculator.js";
import { LEGACY_INGREDIENTS, LEGACY_RECIPES } from "../public/legacy-data.js";

test("calculates NaOH recipe with superfat, water and shrinkage", () => {
  const result = calculateRecipe({
    name: "Test",
    superfatPercent: 8,
    waterPercentOfFat: 35,
    shrinkagePercent: 10,
    alkaliType: "NaOH",
    alkaliPurityPercent: 100,
    ingredients: [
      { name: "Olive", category: "fat", weight: 500, sapNaoh: 0.134 },
      { name: "Kokos", category: "fat", weight: 500, sapNaoh: 0.183 },
      { name: "Wasser", category: "liquid", weight: 350 }
    ]
  });

  assert.equal(result.fatWeight, 1000);
  assert.equal(result.targetLiquid, 350);
  assert.equal(result.lyeWithoutSuperfat, 158.5);
  assert.equal(result.lyeWithSuperfat, 145.82);
  assert.equal(result.rawMass, 1495.82);
  assert.equal(result.curedMass, 1346.24);
});

test("converts NaOH SAP to KOH and accounts for purity", () => {
  const result = calculateRecipe({
    name: "KOH Test",
    superfatPercent: 0,
    waterPercentOfFat: 0,
    shrinkagePercent: 0,
    alkaliType: "KOH",
    alkaliPurityPercent: 90,
    ingredients: [
      { name: "Oel", category: "fat", weight: 100, sapNaoh: 0.1 }
    ]
  });

  assert.equal(result.lyeWithoutSuperfat, 15.59);
  assert.equal(result.lyeWithSuperfat, 15.59);
});

test("warns about missing fat SAP values", () => {
  const result = calculateRecipe({
    name: "Warnung",
    ingredients: [
      { name: "Mystery", category: "fat", weight: 100, sapNaoh: 0 }
    ]
  });

  assert.equal(result.warnings.includes("Mystery: SAP-NaOH fehlt."), true);
});

test("calculates imported legacy recipes close to old exports", () => {
  const patschouli = calculateRecipe(LEGACY_RECIPES.find((item) => item.legacyId === 112));
  const milchHonig = calculateRecipe(LEGACY_RECIPES.find((item) => item.legacyId === "excel-71"));

  assert.equal(patschouli.lyeWithoutSuperfat, 139.23);
  assert.equal(patschouli.lyeWithSuperfat, 132.27);
  assert.equal(patschouli.curedMass, 1162.18);

  assert.equal(milchHonig.lyeWithoutSuperfat, 152.18);
  assert.equal(milchHonig.lyeWithSuperfat, 136.96);
  assert.equal(milchHonig.curedMass, 1264.77);
});

test("imports all recipes from the legacy data export", () => {
  assert.equal(LEGACY_RECIPES.length, 18);
  assert.equal(LEGACY_INGREDIENTS.length, 133);
  assert.equal(LEGACY_INGREDIENTS.some((item) => item.name === "Olivenöl"), true);
  assert.equal(LEGACY_INGREDIENTS.filter((item) => item.name === "Palmfett").length, 1);
  assert.equal(LEGACY_INGREDIENTS.some((item) => item.name === "Palmöl"), false);
});
