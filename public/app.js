import {
  CATEGORY_LABELS,
  DEFAULT_RECIPE,
  calculateRecipe,
  createId,
  sanitizeIngredient,
  sanitizeRecipe
} from "./calculator.js";
import { LEGACY_INGREDIENTS, LEGACY_RECIPES } from "./legacy-data.js";

const STORAGE_KEY = "seifenrechner.recipes.v1";
const ACTIVE_KEY = "seifenrechner.activeRecipe.v1";
const CATALOG_KEY = "seifenrechner.ingredients.v1";
const THEME_KEY = "seifenrechner.theme.v1";
const APP_VERSION = "1.8.0";
const KOH_FROM_NAOH_FACTOR = 1.40272;
const THEMES = ["lotus", "oliven", "patschouli", "bergamotte"];

let recipes = loadRecipes();
let recipe = loadActiveRecipe(recipes);
let customIngredients = loadCustomIngredients();
let result = calculateRecipe(recipe);
let recipeSearchTerm = "";

const fields = {
  recipeName: document.querySelector("#recipeName"),
  madeAt: document.querySelector("#madeAt"),
  process: document.querySelector("#process"),
  alkaliType: document.querySelector("#alkaliType"),
  alkaliPurityPercent: document.querySelector("#alkaliPurityPercent"),
  superfatPercent: document.querySelector("#superfatPercent"),
  waterPercentOfFat: document.querySelector("#waterPercentOfFat"),
  shrinkagePercent: document.querySelector("#shrinkagePercent"),
  cureWeeks: document.querySelector("#cureWeeks"),
  rating: document.querySelector("#rating"),
  remarks: document.querySelector("#remarks")
};

const ingredientFields = {
  id: document.querySelector("#ingredientId"),
  preset: document.querySelector("#ingredientPreset"),
  weight: document.querySelector("#ingredientWeight")
};

const catalogFields = {
  id: document.querySelector("#catalogIngredientId"),
  name: document.querySelector("#catalogIngredientName"),
  category: document.querySelector("#catalogIngredientCategory"),
  sapNaoh: document.querySelector("#catalogIngredientSap")
};

const elements = {
  ingredientForm: document.querySelector("#ingredientForm"),
  catalogForm: document.querySelector("#catalogForm"),
  customCatalogList: document.querySelector("#customCatalogList"),
  catalogCount: document.querySelector("#catalogCount"),
  ingredientsTable: document.querySelector("#ingredientsTable"),
  ingredientCount: document.querySelector("#ingredientCount"),
  categorySummary: document.querySelector("#categorySummary"),
  warningsList: document.querySelector("#warningsList"),
  recipeSearch: document.querySelector("#recipeSearch"),
  savedRecipes: document.querySelector("#savedRecipes"),
  themeSelect: document.querySelector("#themeSelect"),
  saveState: document.querySelector("#saveState"),
  alkaliBadge: document.querySelector("#alkaliBadge"),
  lyeWithSuperfat: document.querySelector("#lyeWithSuperfat"),
  lyeWithoutSuperfat: document.querySelector("#lyeWithoutSuperfat"),
  targetLiquid: document.querySelector("#targetLiquid"),
  actualLiquid: document.querySelector("#actualLiquid"),
  rawMass: document.querySelector("#rawMass"),
  curedMass: document.querySelector("#curedMass"),
  cureEndDate: document.querySelector("#cureEndDate"),
  printTitle: document.querySelector("#printTitle"),
  printRecipeNumber: document.querySelector("#printRecipeNumber"),
  printMadeAt: document.querySelector("#printMadeAt"),
  printCureEnd: document.querySelector("#printCureEnd"),
  printProperties: document.querySelector("#printProperties"),
  printIngredientsTable: document.querySelector("#printIngredientsTable"),
  printLyeColumn: document.querySelector("#printLyeColumn"),
  printCategoryTable: document.querySelector("#printCategoryTable"),
  printResultTable: document.querySelector("#printResultTable"),
  printCureNotice: document.querySelector("#printCureNotice"),
  printNotes: document.querySelector("#printNotes"),
  printWarnings: document.querySelector("#printWarnings")
};

document.querySelector("#appVersion").textContent = `v${APP_VERSION}`;
applyTheme(loadTheme());
bindEvents();
renderIngredientCatalog();
render();

function bindEvents() {
  Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => {
      updateRecipeFromFields();
      persistActive();
      render();
    });
  });

  elements.ingredientForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertIngredient();
  });

  elements.catalogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertCatalogIngredient();
  });

  document.querySelector("#clearIngredient").addEventListener("click", clearIngredientForm);
  document.querySelector("#clearCatalogIngredient").addEventListener("click", clearCatalogIngredientForm);
  elements.recipeSearch.addEventListener("input", () => {
    recipeSearchTerm = elements.recipeSearch.value;
    renderSavedRecipes();
  });
  elements.themeSelect.addEventListener("change", () => {
    applyTheme(elements.themeSelect.value);
  });
  document.querySelector("#saveRecipe").addEventListener("click", saveRecipe);
  document.querySelector("#exportRecipe").addEventListener("click", exportRecipe);
  document.querySelector("#importRecipe").addEventListener("change", importRecipe);
  document.querySelector("#printRecipe").addEventListener("click", () => window.print());
  document.querySelector("#resetRecipe").addEventListener("click", resetRecipe);
}

function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : "lotus";
  } catch {
    return "lotus";
  }
}

function applyTheme(theme) {
  const selected = THEMES.includes(theme) ? theme : "lotus";
  document.body.dataset.theme = selected;
  elements.themeSelect.value = selected;
  try {
    localStorage.setItem(THEME_KEY, selected);
  } catch {
    // Theme persistence is optional; the app still works without localStorage.
  }
}

function render() {
  result = calculateRecipe(recipe);
  recipe = result.recipe;
  renderFields();
  renderIngredients();
  renderResults();
  renderPrintSheet();
  renderSavedRecipes();
  renderCustomCatalog();
}

function renderFields() {
  fields.recipeName.value = recipe.name;
  fields.madeAt.value = recipe.madeAt;
  fields.process.value = recipe.process;
  fields.alkaliType.value = recipe.alkaliType;
  fields.alkaliPurityPercent.value = recipe.alkaliPurityPercent;
  fields.superfatPercent.value = recipe.superfatPercent;
  fields.waterPercentOfFat.value = recipe.waterPercentOfFat;
  fields.shrinkagePercent.value = recipe.shrinkagePercent;
  fields.cureWeeks.value = recipe.cureWeeks;
  fields.rating.value = recipe.rating;
  fields.remarks.value = recipe.remarks;
}

function renderIngredients() {
  elements.ingredientCount.textContent = `${recipe.ingredients.length}`;

  if (recipe.ingredients.length === 0) {
    elements.ingredientsTable.innerHTML = `<tr><td colspan="5" class="empty-state">Keine Zutaten.</td></tr>`;
    return;
  }

  elements.ingredientsTable.innerHTML = recipe.ingredients.map((ingredient) => `
    <tr>
      <td><strong>${escapeHtml(ingredient.name)}</strong></td>
      <td>${CATEGORY_LABELS[ingredient.category]}</td>
      <td>${formatNumber(ingredient.weight)}</td>
      <td>${ingredient.category === "fat" ? formatNumber(ingredient.sapNaoh, 3) : "-"}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-action="edit" data-id="${ingredient.id}" class="secondary">Edit</button>
          <button type="button" data-action="delete" data-id="${ingredient.id}" class="danger">Del</button>
        </div>
      </td>
    </tr>
  `).join("");

  elements.ingredientsTable.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "edit") {
        editIngredient(id);
      } else {
        deleteIngredient(id);
      }
    });
  });
}

function renderResults() {
  elements.alkaliBadge.textContent = recipe.alkaliType;
  elements.lyeWithSuperfat.textContent = `${formatNumber(result.lyeWithSuperfat)} g`;
  elements.lyeWithoutSuperfat.textContent = `${formatNumber(result.lyeWithoutSuperfat)} g`;
  elements.targetLiquid.textContent = `${formatNumber(result.targetLiquid)} g`;
  elements.actualLiquid.textContent = `${formatNumber(result.actualLiquid)} g`;
  elements.rawMass.textContent = `${formatNumber(result.rawMass)} g`;
  elements.curedMass.textContent = `${formatNumber(result.curedMass)} g`;
  elements.cureEndDate.textContent = formatDate(result.cureEndDate);

  elements.categorySummary.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const total = result.categoryTotals[key];
    return `
      <div class="category-line">
        <span>${label}</span>
        <strong>${formatNumber(total.weight)} g</strong>
      </div>
    `;
  }).join("");

  elements.warningsList.innerHTML = result.warnings.length
    ? result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
    : `<li>Keine Auffaelligkeiten.</li>`;
}

function renderPrintSheet() {
  elements.printTitle.textContent = recipe.name;
  elements.printRecipeNumber.textContent = recipe.legacyId ? `Seifen-Nr. ${recipe.legacyId}` : "Neues Rezept";
  elements.printMadeAt.textContent = `hergestellt am: ${formatDate(recipe.madeAt)}`;
  elements.printCureEnd.textContent = `Reifeende: ${formatDate(result.cureEndDate)}`;
  elements.printLyeColumn.textContent = `${recipe.alkaliType} in g`;

  elements.printProperties.innerHTML = [
    ["Verfahren", recipe.process],
    ["Lauge", recipe.alkaliType],
    ["Reinheit", `${formatNumber(recipe.alkaliPurityPercent)} %`],
    ["Ueberfettung", `${formatNumber(recipe.superfatPercent)} %`],
    ["Wasser", `${formatNumber(recipe.waterPercentOfFat)} % Fett`],
    ["Schwund", `${formatNumber(recipe.shrinkagePercent)} %`],
    ["Reifezeit", `${formatNumber(recipe.cureWeeks, 0)} Wochen`],
    ["Note", recipe.rating || "noch nicht bewertet"]
  ].map(([label, value]) => `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");

  elements.printIngredientsTable.innerHTML = recipe.ingredients.map((ingredient) => `
    <tr>
      <td>${escapeHtml(ingredient.name)}</td>
      <td class="num">${formatNumber(ingredient.weight)}</td>
      <td class="num">${ingredient.category === "fat" ? formatNumber(ingredient.sapNaoh, 3) : ""}</td>
      <td class="num">${formatIngredientLye(ingredient)}</td>
    </tr>
  `).join("");

  elements.printCategoryTable.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="num">${formatNumber(result.categoryTotals[key].weight)}</td>
    </tr>
  `).join("");

  elements.printResultTable.innerHTML = [
    [`${recipe.alkaliType} ohne UeF`, `${formatNumber(result.lyeWithoutSuperfat)} g`],
    [`${recipe.alkaliType} mit ${formatNumber(recipe.superfatPercent)}% UeF`, `${formatNumber(result.lyeWithSuperfat)} g`],
    ["Zielfluessigkeit", `${formatNumber(result.targetLiquid)} g`],
    ["Ist-Fluessigkeit", `${formatNumber(result.actualLiquid)} g`],
    ["Rohmasse", `${formatNumber(result.rawMass)} g`],
    [`Seifenmasse bei ${formatNumber(recipe.shrinkagePercent)}% Schwund`, `${formatNumber(result.curedMass)} g`]
  ].map(([label, value]) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="num"><strong>${escapeHtml(value)}</strong></td>
    </tr>
  `).join("");

  elements.printCureNotice.textContent = `Die Seife muss mindestens bis ${formatDate(result.cureEndDate)} reifen.`;
  elements.printNotes.innerHTML = [
    recipe.rating ? `<div><strong>Note:</strong> ${escapeHtml(recipe.rating)}</div>` : "",
    recipe.remarks ? `<div><strong>Bemerkung:</strong> ${escapeHtml(recipe.remarks)}</div>` : ""
  ].filter(Boolean).join("");
  elements.printWarnings.innerHTML = result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function renderSavedRecipes() {
  const visibleRecipes = filterRecipes(recipes, recipeSearchTerm);

  if (visibleRecipes.length === 0) {
    elements.savedRecipes.innerHTML = `<div class="empty-state">${recipes.length === 0 ? "Noch nichts gespeichert." : "Keine passenden Rezepte."}</div>`;
    return;
  }

  elements.savedRecipes.innerHTML = visibleRecipes.map((item) => `
    <div class="saved-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${savedRecipeSubtitle(item)}</span>
      </div>
      <div class="saved-actions">
        <button type="button" data-action="load" data-id="${item.id}" class="secondary">Laden</button>
        <button type="button" data-action="clone" data-id="${item.id}" class="secondary">Klonen</button>
        <button type="button" data-action="remove" data-id="${item.id}" class="danger">Del</button>
      </div>
    </div>
  `).join("");

  elements.savedRecipes.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "load") {
        loadSavedRecipe(button.dataset.id);
      } else if (button.dataset.action === "clone") {
        cloneSavedRecipe(button.dataset.id);
      } else {
        removeSavedRecipe(button.dataset.id);
      }
    });
  });
}

function updateRecipeFromFields() {
  recipe = sanitizeRecipe({
    ...recipe,
    name: fields.recipeName.value,
    madeAt: fields.madeAt.value,
    process: fields.process.value,
    alkaliType: fields.alkaliType.value,
    alkaliPurityPercent: fields.alkaliPurityPercent.value,
    superfatPercent: fields.superfatPercent.value,
    waterPercentOfFat: fields.waterPercentOfFat.value,
    shrinkagePercent: fields.shrinkagePercent.value,
    cureWeeks: fields.cureWeeks.value,
    rating: fields.rating.value,
    remarks: fields.remarks.value
  });
  elements.saveState.textContent = "Lokal";
}

function upsertIngredient() {
  const catalogItem = findCatalogItem(ingredientFields.preset.value);
  if (!catalogItem) {
    ingredientFields.preset.focus();
    return;
  }

  const ingredient = sanitizeIngredient({
    id: ingredientFields.id.value || createId("ingredient"),
    catalogKey: ingredientFields.preset.value,
    name: catalogItem.name,
    category: catalogItem.category,
    weight: ingredientFields.weight.value,
    sapNaoh: catalogItem.category === "fat" ? catalogItem.sapNaoh : 0
  });

  const index = recipe.ingredients.findIndex((item) => item.id === ingredient.id);
  const ingredients = [...recipe.ingredients];
  if (index >= 0) {
    ingredients[index] = ingredient;
  } else {
    ingredients.push(ingredient);
  }

  recipe = sanitizeRecipe({ ...recipe, ingredients });
  clearIngredientForm();
  persistActive();
  render();
}

function editIngredient(id) {
  const ingredient = recipe.ingredients.find((item) => item.id === id);
  if (!ingredient) return;

  ingredientFields.id.value = ingredient.id;
  ingredientFields.preset.value = ingredient.catalogKey || findCatalogKeyForIngredient(ingredient);
  ingredientFields.weight.value = ingredient.weight;
  ingredientFields.preset.focus();
}

function deleteIngredient(id) {
  recipe = sanitizeRecipe({
    ...recipe,
    ingredients: recipe.ingredients.filter((item) => item.id !== id)
  });
  persistActive();
  render();
}

function clearIngredientForm() {
  ingredientFields.id.value = "";
  ingredientFields.preset.value = "";
  ingredientFields.weight.value = "";
}

function renderIngredientCatalog() {
  const sorted = getCatalogItems().sort((left, right) => {
    const category = CATEGORY_LABELS[left.category].localeCompare(CATEGORY_LABELS[right.category], "de");
    return category || left.name.localeCompare(right.name, "de");
  });

  ingredientFields.preset.innerHTML = `
    <option value="">Zutat auswaehlen</option>
    ${sorted.map((item) => `
      <option value="${item.catalogKey}">
        ${escapeHtml(CATEGORY_LABELS[item.category])} - ${escapeHtml(item.name)}
      </option>
    `).join("")}
  `;
}

function upsertCatalogIngredient() {
  const ingredient = sanitizeCatalogIngredient({
    id: catalogFields.id.value || createId("catalog"),
    name: catalogFields.name.value,
    category: catalogFields.category.value,
    sapNaoh: catalogFields.sapNaoh.value
  });

  const index = customIngredients.findIndex((item) => item.id === ingredient.id);
  customIngredients = index >= 0
    ? customIngredients.map((item) => item.id === ingredient.id ? ingredient : item)
    : [ingredient, ...customIngredients];
  persistCustomIngredients();
  clearCatalogIngredientForm();
  renderIngredientCatalog();
  renderCustomCatalog();
}

function editCatalogIngredient(id) {
  const ingredient = customIngredients.find((item) => item.id === id);
  if (!ingredient) return;

  catalogFields.id.value = ingredient.id;
  catalogFields.name.value = ingredient.name;
  catalogFields.category.value = ingredient.category;
  catalogFields.sapNaoh.value = ingredient.sapNaoh;
  catalogFields.name.focus();
}

function deleteCatalogIngredient(id) {
  customIngredients = customIngredients.filter((item) => item.id !== id);
  persistCustomIngredients();
  renderIngredientCatalog();
  renderCustomCatalog();
}

function clearCatalogIngredientForm() {
  catalogFields.id.value = "";
  catalogFields.name.value = "";
  catalogFields.category.value = "fat";
  catalogFields.sapNaoh.value = "";
}

function renderCustomCatalog() {
  elements.catalogCount.textContent = `${getCatalogItems().length}`;

  if (customIngredients.length === 0) {
    elements.customCatalogList.innerHTML = `<div class="empty-state">Keine eigenen Zutaten.</div>`;
    return;
  }

  const sorted = [...customIngredients].sort((left, right) => {
    const category = CATEGORY_LABELS[left.category].localeCompare(CATEGORY_LABELS[right.category], "de");
    return category || left.name.localeCompare(right.name, "de");
  });

  elements.customCatalogList.innerHTML = sorted.map((ingredient) => `
    <div class="catalog-item">
      <div>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <span>${CATEGORY_LABELS[ingredient.category]}${ingredient.category === "fat" ? ` · SAP ${formatNumber(ingredient.sapNaoh, 3)}` : ""}</span>
      </div>
      <div class="table-actions">
        <button type="button" data-action="edit" data-id="${ingredient.id}" class="secondary">Edit</button>
        <button type="button" data-action="delete" data-id="${ingredient.id}" class="danger">Del</button>
      </div>
    </div>
  `).join("");

  elements.customCatalogList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "edit") {
        editCatalogIngredient(button.dataset.id);
      } else {
        deleteCatalogIngredient(button.dataset.id);
      }
    });
  });
}

function saveRecipe() {
  updateRecipeFromFields();
  const saved = sanitizeRecipe({
    ...recipe,
    id: recipe.id === "default" ? createId("recipe") : recipe.id
  });
  recipe = saved;
  const index = recipes.findIndex((item) => item.id === saved.id);
  recipes = index >= 0
    ? recipes.map((item) => item.id === saved.id ? saved : item)
    : [saved, ...recipes];
  persistRecipes();
  persistActive();
  elements.saveState.textContent = "Gespeichert";
  render();
}

function loadSavedRecipe(id) {
  const saved = recipes.find((item) => item.id === id);
  if (!saved) return;
  recipe = sanitizeRecipe(saved);
  persistActive();
  clearIngredientForm();
  render();
}

function cloneSavedRecipe(id) {
  const saved = recipes.find((item) => item.id === id);
  if (!saved) return;

  recipe = sanitizeRecipe({
    ...clonePlainObject(saved),
    id: createId("recipe"),
    name: nextCloneName(saved.name)
  });
  persistActive();
  clearIngredientForm();
  render();
  elements.saveState.textContent = "Kopie";
}

function removeSavedRecipe(id) {
  recipes = recipes.filter((item) => item.id !== id);
  persistRecipes();
  if (recipe.id === id) {
    recipe = sanitizeRecipe(DEFAULT_RECIPE);
    persistActive();
  }
  render();
}

function resetRecipe() {
  recipe = sanitizeRecipe(DEFAULT_RECIPE);
  persistActive();
  clearIngredientForm();
  render();
}

function exportRecipe() {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), recipe }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(recipe.name)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importRecipe(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    recipe = sanitizeRecipe(payload.recipe || payload);
    persistActive();
    clearIngredientForm();
    render();
  } catch (error) {
    elements.saveState.textContent = "Importfehler";
  } finally {
    event.target.value = "";
  }
}

function loadRecipes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const stored = Array.isArray(parsed) ? parsed.map(sanitizeRecipe) : [];
    return mergeLegacyRecipes(stored);
  } catch {
    return mergeLegacyRecipes([]);
  }
}

function loadCustomIngredients() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATALOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(sanitizeCatalogIngredient) : [];
  } catch {
    return [];
  }
}

function loadActiveRecipe(savedRecipes) {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
    return sanitizeRecipe(parsed || savedRecipes[0] || DEFAULT_RECIPE);
  } catch {
    return sanitizeRecipe(savedRecipes[0] || DEFAULT_RECIPE);
  }
}

function persistRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function persistActive() {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(recipe));
}

function persistCustomIngredients() {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(customIngredients));
}

function mergeLegacyRecipes(storedRecipes) {
  const storedIds = new Set(storedRecipes.map((item) => item.id));
  const legacy = LEGACY_RECIPES
    .map(sanitizeRecipe)
    .filter((item) => !storedIds.has(item.id));
  return [...legacy, ...storedRecipes];
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextCloneName(name) {
  const baseName = `${name || "Rezept"} - Kopie`;
  const existingNames = new Set(recipes.map((item) => item.name));
  if (!existingNames.has(baseName)) return baseName;

  let index = 2;
  while (existingNames.has(`${baseName} ${index}`)) {
    index += 1;
  }
  return `${baseName} ${index}`;
}

function savedRecipeSubtitle(item) {
  const details = [
    `${item.ingredients.length} Zutaten`,
    item.alkaliType,
    `${formatNumber(item.superfatPercent)}% UeF`,
    `hergestellt ${formatDate(item.madeAt)}`,
    `reif ${formatDate(calculateRecipe(item).cureEndDate)}`
  ];
  if (item.rating) details.push(`Note ${item.rating}`);
  return details.join(" · ");
}

function filterRecipes(items, searchTerm) {
  const normalizedTerm = normalizeSearch(searchTerm);
  const noteMatch = normalizedTerm.match(/\bnote\s+([a-z0-9]+)/);
  const terms = normalizedTerm
    .replace(noteMatch?.[0] || "", "")
    .split(" ")
    .filter(Boolean);
  if (terms.length === 0 && !noteMatch) return items;
  return items.filter((item) => {
    if (noteMatch && !normalizeSearch(item.rating).includes(noteMatch[1])) {
      return false;
    }
    const haystack = recipeSearchIndex(item);
    return terms.every((term) => haystack.includes(term));
  });
}

function recipeSearchIndex(item) {
  const result = calculateRecipe(item);
  return normalizeSearch([
    item.name,
    item.process,
    item.alkaliType,
    item.rating,
    item.rating ? `Note ${item.rating}` : "",
    item.remarks,
    formatDate(item.madeAt),
    formatDate(result.cureEndDate),
    `${formatNumber(item.superfatPercent)}% UeF`,
    ...item.ingredients.flatMap((ingredient) => [
      ingredient.name,
      CATEGORY_LABELS[ingredient.category],
      ingredient.category
    ])
  ].join(" "));
}

function getCatalogItems() {
  const legacy = LEGACY_INGREDIENTS.map((item) => ({
    ...item,
    id: `legacy-${item.legacyId}`,
    catalogKey: `legacy:${item.legacyId}`
  }));
  const custom = customIngredients.map((item) => ({
    ...item,
    catalogKey: `custom:${item.id}`
  }));
  return [...legacy, ...custom];
}

function findCatalogItem(catalogKey) {
  return getCatalogItems().find((item) => item.catalogKey === catalogKey);
}

function findCatalogKeyForIngredient(ingredient) {
  const item = getCatalogItems().find((candidate) =>
    candidate.category === ingredient.category &&
    candidate.name === ingredient.name &&
    round(candidate.sapNaoh, 3) === round(ingredient.sapNaoh, 3)
  );
  return item?.catalogKey || "";
}

function sanitizeCatalogIngredient(ingredient) {
  const item = sanitizeIngredient({
    ...ingredient,
    weight: 0
  });
  return {
    id: ingredient?.id || createId("catalog"),
    name: item.name,
    category: item.category,
    sapNaoh: item.category === "fat" ? item.sapNaoh : 0
  };
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatIngredientLye(ingredient) {
  if (ingredient.category !== "fat" || ingredient.weight <= 0 || ingredient.sapNaoh <= 0) {
    return "";
  }
  const sap = recipe.alkaliType === "KOH"
    ? ingredient.sapNaoh * KOH_FROM_NAOH_FACTOR
    : ingredient.sapNaoh;
  const purityFactor = recipe.alkaliPurityPercent / 100;
  const lye = purityFactor > 0 ? (ingredient.weight * sap) / purityFactor : 0;
  return formatNumber(lye, 2);
}

function formatDate(value) {
  if (!value) return "-";
  const parts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return String(value);
  return `${parts[3]}.${parts[2]}.${parts[1]}`;
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seifenrezept";
}
