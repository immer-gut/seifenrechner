import {
  CATEGORY_LABELS,
  DEFAULT_RECIPE,
  calculateRecipe,
  createId,
  sanitizeIngredient,
  sanitizeRecipe
} from "./calculator.js";

const STORAGE_KEY = "seifenrechner.recipes.v1";
const ACTIVE_KEY = "seifenrechner.activeRecipe.v1";

let recipes = loadRecipes();
let recipe = loadActiveRecipe(recipes);
let result = calculateRecipe(recipe);

const fields = {
  recipeName: document.querySelector("#recipeName"),
  process: document.querySelector("#process"),
  alkaliType: document.querySelector("#alkaliType"),
  alkaliPurityPercent: document.querySelector("#alkaliPurityPercent"),
  superfatPercent: document.querySelector("#superfatPercent"),
  waterPercentOfFat: document.querySelector("#waterPercentOfFat"),
  shrinkagePercent: document.querySelector("#shrinkagePercent"),
  cureWeeks: document.querySelector("#cureWeeks"),
  alkaliPricePerGram: document.querySelector("#alkaliPricePerGram")
};

const ingredientFields = {
  id: document.querySelector("#ingredientId"),
  name: document.querySelector("#ingredientName"),
  category: document.querySelector("#ingredientCategory"),
  weight: document.querySelector("#ingredientWeight"),
  sapNaoh: document.querySelector("#ingredientSap"),
  pricePerGram: document.querySelector("#ingredientPrice")
};

const elements = {
  ingredientForm: document.querySelector("#ingredientForm"),
  ingredientsTable: document.querySelector("#ingredientsTable"),
  ingredientCount: document.querySelector("#ingredientCount"),
  categorySummary: document.querySelector("#categorySummary"),
  warningsList: document.querySelector("#warningsList"),
  savedRecipes: document.querySelector("#savedRecipes"),
  saveState: document.querySelector("#saveState"),
  alkaliBadge: document.querySelector("#alkaliBadge"),
  lyeWithSuperfat: document.querySelector("#lyeWithSuperfat"),
  lyeWithoutSuperfat: document.querySelector("#lyeWithoutSuperfat"),
  targetLiquid: document.querySelector("#targetLiquid"),
  actualLiquid: document.querySelector("#actualLiquid"),
  rawMass: document.querySelector("#rawMass"),
  curedMass: document.querySelector("#curedMass"),
  totalCost: document.querySelector("#totalCost"),
  costPer100g: document.querySelector("#costPer100g")
};

bindEvents();
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

  document.querySelector("#clearIngredient").addEventListener("click", clearIngredientForm);
  document.querySelector("#saveRecipe").addEventListener("click", saveRecipe);
  document.querySelector("#exportRecipe").addEventListener("click", exportRecipe);
  document.querySelector("#importRecipe").addEventListener("change", importRecipe);
  document.querySelector("#printRecipe").addEventListener("click", () => window.print());
  document.querySelector("#resetRecipe").addEventListener("click", resetRecipe);
}

function render() {
  result = calculateRecipe(recipe);
  recipe = result.recipe;
  renderFields();
  renderIngredients();
  renderResults();
  renderSavedRecipes();
}

function renderFields() {
  fields.recipeName.value = recipe.name;
  fields.process.value = recipe.process;
  fields.alkaliType.value = recipe.alkaliType;
  fields.alkaliPurityPercent.value = recipe.alkaliPurityPercent;
  fields.superfatPercent.value = recipe.superfatPercent;
  fields.waterPercentOfFat.value = recipe.waterPercentOfFat;
  fields.shrinkagePercent.value = recipe.shrinkagePercent;
  fields.cureWeeks.value = recipe.cureWeeks;
  fields.alkaliPricePerGram.value = recipe.alkaliPricePerGram;
}

function renderIngredients() {
  elements.ingredientCount.textContent = `${recipe.ingredients.length}`;

  if (recipe.ingredients.length === 0) {
    elements.ingredientsTable.innerHTML = `<tr><td colspan="6" class="empty-state">Keine Zutaten.</td></tr>`;
    return;
  }

  elements.ingredientsTable.innerHTML = recipe.ingredients.map((ingredient) => `
    <tr>
      <td><strong>${escapeHtml(ingredient.name)}</strong></td>
      <td>${CATEGORY_LABELS[ingredient.category]}</td>
      <td>${formatNumber(ingredient.weight)}</td>
      <td>${ingredient.category === "fat" ? formatNumber(ingredient.sapNaoh, 3) : "-"}</td>
      <td>${formatMoney(ingredient.pricePerGram, 3)}</td>
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
  elements.totalCost.textContent = `${formatMoney(result.totalCost)} EUR`;
  elements.costPer100g.textContent = `${formatMoney(result.costPer100g)} EUR`;

  elements.categorySummary.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const total = result.categoryTotals[key];
    return `
      <div class="category-line">
        <span>${label}</span>
        <strong>${formatNumber(total.weight)} g / ${formatMoney(total.cost)} EUR</strong>
      </div>
    `;
  }).join("");

  elements.warningsList.innerHTML = result.warnings.length
    ? result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
    : `<li>Keine Auffaelligkeiten.</li>`;
}

function renderSavedRecipes() {
  if (recipes.length === 0) {
    elements.savedRecipes.innerHTML = `<div class="empty-state">Noch nichts gespeichert.</div>`;
    return;
  }

  elements.savedRecipes.innerHTML = recipes.map((item) => `
    <div class="saved-item">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.ingredients.length} Zutaten · ${item.alkaliType} · ${formatNumber(item.superfatPercent)}% UeF</span>
      </div>
      <div class="saved-actions">
        <button type="button" data-action="load" data-id="${item.id}" class="secondary">Laden</button>
        <button type="button" data-action="remove" data-id="${item.id}" class="danger">Del</button>
      </div>
    </div>
  `).join("");

  elements.savedRecipes.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "load") {
        loadSavedRecipe(button.dataset.id);
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
    process: fields.process.value,
    alkaliType: fields.alkaliType.value,
    alkaliPurityPercent: fields.alkaliPurityPercent.value,
    superfatPercent: fields.superfatPercent.value,
    waterPercentOfFat: fields.waterPercentOfFat.value,
    shrinkagePercent: fields.shrinkagePercent.value,
    cureWeeks: fields.cureWeeks.value,
    alkaliPricePerGram: fields.alkaliPricePerGram.value
  });
  elements.saveState.textContent = "Lokal";
}

function upsertIngredient() {
  const ingredient = sanitizeIngredient({
    id: ingredientFields.id.value || createId("ingredient"),
    name: ingredientFields.name.value,
    category: ingredientFields.category.value,
    weight: ingredientFields.weight.value,
    sapNaoh: ingredientFields.sapNaoh.value,
    pricePerGram: ingredientFields.pricePerGram.value
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
  ingredientFields.name.value = ingredient.name;
  ingredientFields.category.value = ingredient.category;
  ingredientFields.weight.value = ingredient.weight;
  ingredientFields.sapNaoh.value = ingredient.sapNaoh;
  ingredientFields.pricePerGram.value = ingredient.pricePerGram;
  ingredientFields.name.focus();
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
  ingredientFields.name.value = "";
  ingredientFields.category.value = "fat";
  ingredientFields.weight.value = "";
  ingredientFields.sapNaoh.value = "";
  ingredientFields.pricePerGram.value = "";
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
    return Array.isArray(parsed) ? parsed.map(sanitizeRecipe) : [];
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

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatMoney(value, decimals = 2) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
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
