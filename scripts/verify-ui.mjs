const port = process.env.CHROME_DEBUG_PORT || "9222";
const appUrl = process.env.APP_URL || `http://127.0.0.1:8082/?verify=${Date.now()}`;
const endpoint = `http://127.0.0.1:${port}`;

const target = await createTarget();
const client = await connect(target.webSocketDebuggerUrl);
const messages = [];

client.on("Runtime.consoleAPICalled", (event) => {
  messages.push({ type: "console", args: event.args.map((arg) => arg.value ?? arg.description).join(" ") });
});
client.on("Runtime.exceptionThrown", (event) => {
  messages.push({ type: "exception", text: event.exceptionDetails.text });
});

await client.send("Runtime.enable");
await client.send("Page.enable");
await client.send("Network.enable");
await client.send("Network.setCacheDisabled", { cacheDisabled: true });
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false
});
await navigate(client, appUrl);
await evaluate(client, `localStorage.clear()`);
await navigate(client, appUrl);
await waitFor(client, `document.querySelectorAll('#ingredientsTable tr').length > 0`);

const desktop = await evaluate(client, `(() => ({
  title: document.title,
  h1: document.querySelector('h1')?.innerText,
  lye: document.querySelector('#lyeWithSuperfat')?.innerText,
  rows: document.querySelectorAll('#ingredientsTable tr').length,
  savedRecipes: document.querySelectorAll('#savedRecipes .saved-item').length,
  version: document.querySelector('#appVersion')?.innerText,
  catalogOptions: document.querySelectorAll('#ingredientPreset option').length,
  catalogCount: document.querySelector('#catalogCount')?.innerText,
  priceFields: document.querySelectorAll('#ingredientPrice, #alkaliPricePerGram, #costPer100g, #totalCost').length,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
}))()`);

const customCatalogFlow = await evaluate(client, `(() => {
  document.querySelector('#catalogIngredientName').value = 'Testduft';
  document.querySelector('#catalogIngredientCategory').value = 'fragrance';
  document.querySelector('#catalogIngredientSap').value = '';
  document.querySelector('#catalogForm').requestSubmit();

  const preset = document.querySelector('#ingredientPreset');
  const option = [...preset.options].find((item) => item.textContent.includes('Testduft'));
  preset.value = option.value;
  document.querySelector('#ingredientWeight').value = '12';
  document.querySelector('#ingredientForm').requestSubmit();

  const names = [...document.querySelectorAll('#ingredientsTable tr td:first-child')]
    .map((cell) => cell.textContent.trim());
  return {
    catalogOptions: preset.options.length,
    catalogCount: document.querySelector('#catalogCount')?.innerText,
    customRows: document.querySelectorAll('#customCatalogList .catalog-item').length,
    hasTestduft: names.includes('Testduft')
  };
})()`);

const palmfettPreset = await evaluate(client, `(() => {
  const preset = document.querySelector('#ingredientPreset');
  const option = [...preset.options].find((item) => item.textContent.includes('Palmfett'));
  preset.value = option.value;
  preset.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#ingredientWeight').value = '1000';
  document.querySelector('#ingredientForm').requestSubmit();
  const names = [...document.querySelectorAll('#ingredientsTable tr td:first-child')]
    .map((cell) => cell.textContent.trim());
  return {
    optionCount: [...preset.options].filter((item) => item.textContent.includes('Palmfett')).length,
    hasPalmOel: [...preset.options].some((item) => item.textContent.includes('Palmöl')),
    hasPalmfett: names.includes('Palmfett'),
    rows: names.length
  };
})()`);

await evaluate(client, `localStorage.setItem('seifenrechner.activeRecipe.v1', JSON.stringify({
  id: 'verify-single-fat',
  name: 'Palmfett Test',
  process: 'Kaltverfahren',
  cureWeeks: 6,
  superfatPercent: 8,
  waterPercentOfFat: 35,
  shrinkagePercent: 12,
  alkaliType: 'NaOH',
  alkaliPurityPercent: 99,
  ingredients: [
    { id: 'verify-water', name: 'Destilliertes Wasser', category: 'liquid', weight: 350, sapNaoh: 0 },
    { id: 'verify-palm', name: 'Palmfett', category: 'fat', weight: 1000, sapNaoh: 0.156 }
  ]
}))`);
await navigate(client, appUrl);
await waitFor(client, `document.querySelector('#recipeName')?.value === 'Palmfett Test'`);

const singleFatRecipe = await evaluate(client, `(() => ({
  lye: document.querySelector('#lyeWithSuperfat')?.innerText,
  warnings: [...document.querySelectorAll('#warningsList li')].map((item) => item.innerText)
}))()`);

await evaluate(client, `(() => {
  const input = document.querySelector('#superfatPercent');
  input.value = '10';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelector('#lyeWithSuperfat').innerText;
})()`);

const changedLye = await evaluate(client, `document.querySelector('#lyeWithSuperfat').innerText`);

await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 900,
  deviceScaleFactor: 2,
  mobile: true
});
await navigate(client, appUrl);
await waitFor(client, `document.querySelector('h1')?.innerText?.startsWith('Seifenrechner')`);

const mobile = await evaluate(client, `(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  h1: document.querySelector('h1')?.innerText,
  widest: [...document.querySelectorAll('body *')]
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: element.className,
      id: element.id,
      width: Math.round(element.getBoundingClientRect().width),
      scrollWidth: element.scrollWidth
    }))
    .filter((item) => item.width > document.documentElement.clientWidth || item.scrollWidth > document.documentElement.clientWidth)
    .slice(0, 8)
}))()`);

client.close();

const result = { desktop, customCatalogFlow, palmfettPreset, singleFatRecipe, changedLye, mobile, messages };
console.log(JSON.stringify(result, null, 2));

if (desktop.title !== "Seifenrechner" || !desktop.h1?.startsWith("Seifenrechner") || desktop.version !== "v1.2.0") {
  throw new Error("Seite wurde nicht korrekt geladen.");
}
if (!desktop.lye || desktop.lye === "0 g" || desktop.rows < 1 || desktop.savedRecipes < 18 || desktop.catalogOptions < 134) {
  throw new Error("Rechnerwerte oder Zutatenliste fehlen.");
}
if (desktop.priceFields !== 0) {
  throw new Error("Preisfelder sind noch sichtbar.");
}
if (customCatalogFlow.catalogOptions < 135 || customCatalogFlow.catalogCount !== "134" || customCatalogFlow.customRows !== 1 || !customCatalogFlow.hasTestduft) {
  throw new Error("Eigene Zutaten werden nicht getrennt im Katalog gepflegt und im Rezept verwendet.");
}
if (messages.some((message) => message.type === "exception")) {
  throw new Error("Browser meldet JavaScript-Ausnahmen.");
}
if (desktop.overflow > 0 || mobile.overflow > 0) {
  throw new Error("Layout erzeugt horizontales Ueberlaufen.");
}
if (palmfettPreset.optionCount !== 1 || palmfettPreset.hasPalmOel || !palmfettPreset.hasPalmfett) {
  throw new Error("Palmfett ist nicht eindeutig im bereinigten Katalog.");
}
if (!singleFatRecipe.warnings.some((warning) => warning.includes("Nur ein Fett/Oel"))) {
  throw new Error("Ein-Fett-Rezept wird nicht fachlich gewarnt.");
}

async function createTarget() {
  await waitForChrome();
  let response = await fetch(`${endpoint}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!response.ok) {
    response = await fetch(`${endpoint}/json/new?${encodeURIComponent("about:blank")}`);
  }
  if (!response.ok) {
    throw new Error(`Chrome target konnte nicht erstellt werden: ${response.status}`);
  }
  return response.json();
}

async function waitForChrome() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Chrome Debug-Port ${port} antwortet nicht.`);
}

function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result);
      return;
    }
    if (payload.method && listeners.has(payload.method)) {
      for (const listener of listeners.get(payload.method)) listener(payload.params || {});
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const commandId = ++id;
          socket.send(JSON.stringify({ id: commandId, method, params }));
          return new Promise((commandResolve, commandReject) => {
            pending.set(commandId, { resolve: commandResolve, reject: commandReject });
          });
        },
        on(method, listener) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(listener);
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener("error", reject);
  });
}

async function navigate(client, url) {
  const loaded = new Promise((resolve) => client.on("Page.loadEventFired", resolve));
  await client.send("Page.navigate", { url });
  await loaded;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(client, expression, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await evaluate(client, expression);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout beim Warten auf: ${expression}`);
}
