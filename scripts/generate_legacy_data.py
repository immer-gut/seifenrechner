import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / ".tmp_mdb_export"
OUT = ROOT / "public" / "legacy-data.js"

CATEGORY_MAP = {
    "FO": "fat",
    "DOe": "fragrance",
    "Fa": "color",
    "So": "additive",
    "H2O": "liquid",
}


def main():
    recipes = load_json("tbl_RName.json")
    recipe_items = load_json("tbl_Rezept.json")
    ingredients = load_json("tbl_Zt.json")

    canonical_by_key = {}
    canonical_by_id = {}
    for item in ingredients:
        mapped = map_inventory_item(item)
        key = canonical_key(mapped)
        if key not in canonical_by_key:
            canonical_by_key[key] = mapped
        canonical_by_id[item["id_ZT"]] = canonical_by_key[key]

    items_by_recipe = {}
    for item in recipe_items:
        items_by_recipe.setdefault(item["id_RN"], []).append(item)

    legacy_ingredients = list(canonical_by_key.values())
    legacy_recipes = [
        map_recipe(recipe, items_by_recipe.get(recipe["id_RN"], []), canonical_by_id)
        for recipe in recipes
    ] + extra_excel_recipes()

    text = (
        "export const LEGACY_INGREDIENTS = "
        + json.dumps(legacy_ingredients, ensure_ascii=True, indent=2)
        + ";\n\nexport const LEGACY_RECIPES = "
        + json.dumps(legacy_recipes, ensure_ascii=True, indent=2)
        + ";\n"
    )
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {len(legacy_recipes)} recipes and {len(legacy_ingredients)} ingredients to {OUT}")


def load_json(name):
    return json.loads((EXPORT / name).read_text(encoding="utf-8"))


def map_inventory_item(item):
    name = item.get("Name_ZT") or "Zutat"
    category = CATEGORY_MAP.get(item.get("Index_ZT"), "additive")
    if category == "fat" and normalize_name(name) in {"palmol", "palmoel", "palm oel"}:
        name = "Palmfett"

    return {
        "legacyId": item["id_ZT"],
        "name": name,
        "category": category,
        "sapNaoh": 0.156 if category == "fat" and name == "Palmfett" else num(item.get("SAP_NaOH")),
        "inci": item.get("INCI_ZT") or "",
        "manufacturer": clean_placeholder(item.get("Hersteller_ZT")),
        "productName": clean_placeholder(item.get("Produktname_ZT")),
        "merchant": clean_placeholder(item.get("Haendler_ZT")),
        "articleNumber": item.get("Art_Nr") or "",
        "density": num(item.get("Dichte")),
        "stockGrams": num(item.get("Menge")),
        "sourceIndex": item.get("Index_ZT") or "",
    }


def map_recipe(recipe, recipe_items, ingredients_by_id):
    lye = ingredients_by_id.get(recipe.get("id_NaOH_KOH"), {})
    items = []
    for item in sorted(recipe_items, key=lambda row: row.get("id_R", 0)):
        ingredient = ingredients_by_id.get(item.get("id_ZT"), {})
        category = CATEGORY_MAP.get(item.get("Index_ZT"), ingredient.get("category", "additive"))
        items.append(
            {
                "id": f"legacy-{recipe['id_RN']}-{item.get('id_R')}",
                "legacyIngredientId": ingredient.get("legacyId") or item.get("id_ZT"),
                "name": ingredient.get("name") or f"Zutat {item.get('id_ZT')}",
                "category": category,
                "weight": num(item.get("g_ZT")),
                "sapNaoh": num(ingredient.get("sapNaoh")) if category == "fat" else 0,
            }
        )

    return {
        "id": f"legacy-recipe-{recipe['id_RN']}",
        "legacyId": recipe["id_RN"],
        "name": f"{recipe.get('Name_RN') or 'Unbenannt'} (Alt Nr. {recipe['id_RN']})",
        "process": recipe.get("Verfahren") or "Kaltverfahren",
        "madeAt": recipe.get("herge_am_RN") or "",
        "rating": recipe.get("Note_RN") or "",
        "remarks": recipe.get("Bemerkung") or "",
        "cureWeeks": num(recipe.get("Trockenzeit_W")),
        "superfatPercent": num(recipe.get("\u00dcberfettung")),
        "waterPercentOfFat": 35,
        "shrinkagePercent": num(recipe.get("Schwund")),
        "alkaliType": "KOH" if "koh" in str(lye.get("name") or "").lower() else "NaOH",
        "alkaliPurityPercent": 100,
        "ingredients": items,
    }


def clean_placeholder(value):
    if not value:
        return ""
    value = str(value)
    if value.startswith("kein "):
        return ""
    return value


def num(value):
    try:
        return 0 if value is None else float(value)
    except (TypeError, ValueError):
        return 0


def canonical_key(item):
    return f"{item['category']}|{normalize_name(item['name'])}"


def normalize_name(value):
    text = (
        str(value)
        .lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace("\u00a0", " ")
        .replace("/", " ")
        .replace("(", " ")
        .replace(")", " ")
        .replace("-", " ")
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def extra_excel_recipes():
    return [
        {
            "id": "legacy-excel-milch-honig-71",
            "legacyId": "excel-71",
            "name": "Milch & Honig Seife (Excel Alt Nr. 71)",
            "process": "Kaltverfahren",
            "madeAt": "29.07.2008",
            "rating": "",
            "remarks": "Aus db_xls/Seifenrechner.xlsx importierter Druckexport.",
            "cureWeeks": 6,
            "superfatPercent": 10,
            "waterPercentOfFat": 35,
            "shrinkagePercent": 15,
            "alkaliType": "NaOH",
            "alkaliPurityPercent": 100,
            "ingredients": [
                {"id": "legacy-excel-71-koenigsblau", "legacyIngredientId": None, "name": "Koenigsblau", "category": "color", "weight": 1, "sapNaoh": 0},
                {"id": "legacy-excel-71-sonnenblume", "legacyIngredientId": None, "name": "Sonnenblumenoel", "category": "fat", "weight": 333, "sapNaoh": 0.137},
                {"id": "legacy-excel-71-olive", "legacyIngredientId": None, "name": "Olivenoel", "category": "fat", "weight": 333, "sapNaoh": 0.136},
                {"id": "legacy-excel-71-kokos", "legacyIngredientId": None, "name": "Kokosnussfett", "category": "fat", "weight": 333, "sapNaoh": 0.184},
                {"id": "legacy-excel-71-wasser", "legacyIngredientId": None, "name": "Leitungswasser", "category": "liquid", "weight": 350, "sapNaoh": 0},
                {"id": "legacy-excel-71-kokosflocken", "legacyIngredientId": None, "name": "Kokosflocken", "category": "additive", "weight": 1, "sapNaoh": 0},
            ],
        }
    ]


if __name__ == "__main__":
    main()
