export const CATEGORY_LABELS = {
  fat: "Fette & Oele",
  fragrance: "Duft",
  color: "Farbe",
  liquid: "Fluessigkeit",
  additive: "Sonstiges"
};

export const DEFAULT_INGREDIENTS = [
  { id: "olive", name: "Olivenoel", category: "fat", weight: 500, sapNaoh: 0.134 },
  { id: "coconut", name: "Kokosoel", category: "fat", weight: 250, sapNaoh: 0.183 },
  { id: "shea", name: "Sheabutter", category: "fat", weight: 150, sapNaoh: 0.128 },
  { id: "castor", name: "Rizinusoel", category: "fat", weight: 100, sapNaoh: 0.128 },
  { id: "water", name: "Destilliertes Wasser", category: "liquid", weight: 350, sapNaoh: 0 },
  { id: "lavender", name: "Lavendelduft", category: "fragrance", weight: 25, sapNaoh: 0 },
  { id: "clay", name: "Tonerde", category: "color", weight: 12, sapNaoh: 0 }
];

export const DEFAULT_RECIPE = {
  id: "default",
  name: "Basisrezept",
  process: "Kaltverfahren",
  madeAt: todayIsoDate(),
  cureWeeks: 6,
  superfatPercent: 8,
  waterPercentOfFat: 35,
  shrinkagePercent: 12,
  alkaliType: "NaOH",
  alkaliPurityPercent: 99,
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
    legacyId: source.legacyId || null,
    name: String(source.name || "Unbenanntes Rezept"),
    process: String(source.process || "Kaltverfahren"),
    madeAt: normalizeRecipeDate(source.madeAt) || todayIsoDate(),
    rating: String(source.rating || ""),
    remarks: String(source.remarks || ""),
    cureWeeks: Math.max(0, numberOrZero(source.cureWeeks ?? DEFAULT_RECIPE.cureWeeks)),
    superfatPercent: clamp(numberOrZero(source.superfatPercent), 0, 30),
    waterPercentOfFat: clamp(numberOrZero(source.waterPercentOfFat), 0, 100),
    shrinkagePercent: clamp(numberOrZero(source.shrinkagePercent), 0, 60),
    alkaliType: source.alkaliType === "KOH" ? "KOH" : "NaOH",
    alkaliPurityPercent: clamp(numberOrZero(source.alkaliPurityPercent || 100), 1, 100),
    ingredients: ingredients.map(sanitizeIngredient)
  };
}

export function sanitizeIngredient(ingredient) {
  const source = ingredient || {};
  const category = CATEGORY_LABELS[source.category] ? source.category : "fat";

  return {
    id: source.id || createId("ingredient"),
    catalogKey: typeof source.catalogKey === "string" ? source.catalogKey : "",
    name: String(source.name || "Zutat"),
    category,
    weight: Math.max(0, numberOrZero(source.weight)),
    sapNaoh: Math.max(0, numberOrZero(source.sapNaoh))
  };
}

export function calculateRecipe(rawRecipe) {
  const recipe = sanitizeRecipe(rawRecipe);
  const categoryTotals = Object.fromEntries(
    Object.keys(CATEGORY_LABELS).map((key) => [key, { weight: 0 }])
  );

  let lyeWithoutSuperfat = 0;
  let fatWeight = 0;
  const fatIngredients = [];
  const warnings = [];

  for (const ingredient of recipe.ingredients) {
    categoryTotals[ingredient.category].weight += ingredient.weight;

    if (ingredient.category === "fat") {
      fatWeight += ingredient.weight;
      if (ingredient.weight > 0) {
        fatIngredients.push(ingredient);
      }

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
  const targetLiquid = fatWeight * (recipe.waterPercentOfFat / 100);
  const actualLiquid = categoryTotals.liquid.weight;
  const ingredientWeight = recipe.ingredients.reduce((sum, item) => sum + item.weight, 0);
  const rawMass = ingredientWeight + lyeWithSuperfat;
  const curedMass = rawMass * (1 - recipe.shrinkagePercent / 100);
  const cureEndDate = addWeeksToDate(recipe.madeAt, recipe.cureWeeks);
  const liquidDelta = actualLiquid - targetLiquid;

  if (fatWeight <= 0) {
    warnings.push("Keine Fette/Oele im Rezept.");
  } else {
    const dominantFat = fatIngredients.reduce(
      (largest, item) => item.weight > largest.weight ? item : largest,
      { name: "", weight: 0 }
    );
    const dominantPercent = fatWeight > 0 ? (dominantFat.weight / fatWeight) * 100 : 0;

    if (fatIngredients.length === 1) {
      warnings.push("Nur ein Fett/Oel im Rezept; die Seife kann unausgewogen, hart, spröde oder schlecht schäumend werden.");
    } else if (dominantPercent >= 70) {
      warnings.push(`${dominantFat.name} macht ${round(dominantPercent)}% der Fettmenge aus; Rezept fachlich pruefen.`);
    }
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
    ingredientWeight: round(ingredientWeight),
    rawMass: round(rawMass),
    curedMass: round(curedMass),
    cureEndDate,
    warnings
  };
}

export function normalizeRecipeDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isValidDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? text : "";

  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!german) return "";

  const day = Number(german[1]);
  const month = Number(german[2]);
  const year = Number(german[3]);
  if (!isValidDateParts(year, month, day)) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addWeeksToDate(value, weeks) {
  const iso = normalizeRecipeDate(value);
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Math.round(numberOrZero(weeks) * 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mapRoundedTotals(totals) {
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      { weight: round(value.weight) }
    ])
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function isValidDateParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
