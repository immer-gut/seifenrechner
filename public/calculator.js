export const CATEGORY_LABELS = {
  fat: "Fette & Oele",
  fragrance: "Duft",
  color: "Farbe",
  liquid: "Fluessigkeit",
  additive: "Sonstiges"
};

export const DEFAULT_INGREDIENTS = [
  { id: "olive", name: "Olivenoel", category: "fat", weight: 500, sapNaoh: 0.134, pricePerGram: 0.008 },
  { id: "coconut", name: "Kokosoel", category: "fat", weight: 250, sapNaoh: 0.183, pricePerGram: 0.010 },
  { id: "shea", name: "Sheabutter", category: "fat", weight: 150, sapNaoh: 0.128, pricePerGram: 0.018 },
  { id: "castor", name: "Rizinusoel", category: "fat", weight: 100, sapNaoh: 0.128, pricePerGram: 0.012 },
  { id: "water", name: "Destilliertes Wasser", category: "liquid", weight: 350, sapNaoh: 0, pricePerGram: 0.001 },
  { id: "lavender", name: "Lavendelduft", category: "fragrance", weight: 25, sapNaoh: 0, pricePerGram: 0.060 },
  { id: "clay", name: "Tonerde", category: "color", weight: 12, sapNaoh: 0, pricePerGram: 0.025 }
];

export const DEFAULT_RECIPE = {
  id: "default",
  name: "Basisrezept",
  process: "Kaltverfahren",
  cureWeeks: 6,
  superfatPercent: 8,
  waterPercentOfFat: 35,
  shrinkagePercent: 12,
  alkaliType: "NaOH",
  alkaliPurityPercent: 99,
  alkaliPricePerGram: 0.018,
  ingredients: DEFAULT_INGREDIENTS
};

const KOH_FROM_NAOH_FACTOR = 1.40272;

export function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((numberOrZero(value) + Number.EPSILON) * factor) / factor;
}

export function createId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeRecipe(recipe) {
  const source = recipe || {};
  const ingredients = Array.isArray(source.ingredients) ? source.ingredients : [];

  return {
    id: source.id || createId("recipe"),
    name: String(source.name || "Unbenanntes Rezept"),
    process: String(source.process || "Kaltverfahren"),
    cureWeeks: Math.max(0, numberOrZero(source.cureWeeks)),
    superfatPercent: clamp(numberOrZero(source.superfatPercent), 0, 30),
    waterPercentOfFat: clamp(numberOrZero(source.waterPercentOfFat), 0, 100),
    shrinkagePercent: clamp(numberOrZero(source.shrinkagePercent), 0, 60),
    alkaliType: source.alkaliType === "KOH" ? "KOH" : "NaOH",
    alkaliPurityPercent: clamp(numberOrZero(source.alkaliPurityPercent || 100), 1, 100),
    alkaliPricePerGram: Math.max(0, numberOrZero(source.alkaliPricePerGram)),
    ingredients: ingredients.map(sanitizeIngredient)
  };
}

export function sanitizeIngredient(ingredient) {
  const source = ingredient || {};
  const category = CATEGORY_LABELS[source.category] ? source.category : "fat";

  return {
    id: source.id || createId("ingredient"),
    name: String(source.name || "Zutat"),
    category,
    weight: Math.max(0, numberOrZero(source.weight)),
    sapNaoh: Math.max(0, numberOrZero(source.sapNaoh)),
    pricePerGram: Math.max(0, numberOrZero(source.pricePerGram))
  };
}

export function calculateRecipe(rawRecipe) {
  const recipe = sanitizeRecipe(rawRecipe);
  const categoryTotals = Object.fromEntries(
    Object.keys(CATEGORY_LABELS).map((key) => [key, { weight: 0, cost: 0 }])
  );

  let lyeWithoutSuperfat = 0;
  let fatWeight = 0;
  const warnings = [];

  for (const ingredient of recipe.ingredients) {
    const cost = ingredient.weight * ingredient.pricePerGram;
    categoryTotals[ingredient.category].weight += ingredient.weight;
    categoryTotals[ingredient.category].cost += cost;

    if (ingredient.category === "fat") {
      fatWeight += ingredient.weight;

      if (ingredient.sapNaoh <= 0 && ingredient.weight > 0) {
        warnings.push(`${ingredient.name}: SAP-NaOH fehlt.`);
      }

      const sap = recipe.alkaliType === "KOH"
        ? ingredient.sapNaoh * KOH_FROM_NAOH_FACTOR
        : ingredient.sapNaoh;
      lyeWithoutSuperfat += ingredient.weight * sap;
    }
  }

  const purityFactor = recipe.alkaliPurityPercent / 100;
  lyeWithoutSuperfat = purityFactor > 0 ? lyeWithoutSuperfat / purityFactor : 0;
  const lyeWithSuperfat = lyeWithoutSuperfat * (1 - recipe.superfatPercent / 100);
  const lyeCost = lyeWithSuperfat * recipe.alkaliPricePerGram;
  const targetLiquid = fatWeight * (recipe.waterPercentOfFat / 100);
  const actualLiquid = categoryTotals.liquid.weight;
  const ingredientWeight = recipe.ingredients.reduce((sum, item) => sum + item.weight, 0);
  const ingredientCost = recipe.ingredients.reduce((sum, item) => sum + item.weight * item.pricePerGram, 0);
  const rawMass = ingredientWeight + lyeWithSuperfat;
  const curedMass = rawMass * (1 - recipe.shrinkagePercent / 100);
  const totalCost = ingredientCost + lyeCost;
  const costPer100g = curedMass > 0 ? (totalCost / curedMass) * 100 : 0;
  const liquidDelta = actualLiquid - targetLiquid;

  if (fatWeight <= 0) {
    warnings.push("Keine Fette/Oele im Rezept.");
  }
  if (targetLiquid > 0 && Math.abs(liquidDelta) > targetLiquid * 0.1) {
    warnings.push(`Fluessigkeit weicht um ${round(liquidDelta)} g vom Zielwert ab.`);
  }
  if (recipe.superfatPercent > 15) {
    warnings.push("Ueberfettung ist sehr hoch.");
  }

  return {
    recipe,
    categoryTotals: mapRoundedTotals(categoryTotals),
    fatWeight: round(fatWeight),
    targetLiquid: round(targetLiquid),
    actualLiquid: round(actualLiquid),
    liquidDelta: round(liquidDelta),
    lyeWithoutSuperfat: round(lyeWithoutSuperfat),
    lyeWithSuperfat: round(lyeWithSuperfat),
    lyeCost: round(lyeCost),
    ingredientWeight: round(ingredientWeight),
    rawMass: round(rawMass),
    curedMass: round(curedMass),
    ingredientCost: round(ingredientCost),
    totalCost: round(totalCost),
    costPer100g: round(costPer100g),
    warnings
  };
}

function mapRoundedTotals(totals) {
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      { weight: round(value.weight), cost: round(value.cost) }
    ])
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

