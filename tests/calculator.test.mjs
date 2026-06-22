import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipe } from "../public/calculator.js";

test("calculates NaOH recipe with superfat, water, shrinkage and cost", () => {
  const result = calculateRecipe({
    name: "Test",
    superfatPercent: 8,
    waterPercentOfFat: 35,
    shrinkagePercent: 10,
    alkaliType: "NaOH",
    alkaliPurityPercent: 100,
    alkaliPricePerGram: 0.02,
    ingredients: [
      { name: "Olive", category: "fat", weight: 500, sapNaoh: 0.134, pricePerGram: 0.01 },
      { name: "Kokos", category: "fat", weight: 500, sapNaoh: 0.183, pricePerGram: 0.01 },
      { name: "Wasser", category: "liquid", weight: 350, pricePerGram: 0 }
    ]
  });

  assert.equal(result.fatWeight, 1000);
  assert.equal(result.targetLiquid, 350);
  assert.equal(result.lyeWithoutSuperfat, 158.5);
  assert.equal(result.lyeWithSuperfat, 145.82);
  assert.equal(result.rawMass, 1495.82);
  assert.equal(result.curedMass, 1346.24);
  assert.equal(result.totalCost, 12.92);
  assert.equal(result.costPer100g, 0.96);
});

test("converts NaOH SAP to KOH and accounts for purity", () => {
  const result = calculateRecipe({
    name: "KOH Test",
    superfatPercent: 0,
    waterPercentOfFat: 0,
    shrinkagePercent: 0,
    alkaliType: "KOH",
    alkaliPurityPercent: 90,
    alkaliPricePerGram: 0,
    ingredients: [
      { name: "Oel", category: "fat", weight: 100, sapNaoh: 0.1, pricePerGram: 0 }
    ]
  });

  assert.equal(result.lyeWithoutSuperfat, 15.59);
  assert.equal(result.lyeWithSuperfat, 15.59);
});

test("warns about missing fat SAP values", () => {
  const result = calculateRecipe({
    name: "Warnung",
    ingredients: [
      { name: "Mystery", category: "fat", weight: 100, sapNaoh: 0, pricePerGram: 0 }
    ]
  });

  assert.equal(result.warnings.includes("Mystery: SAP-NaOH fehlt."), true);
});
