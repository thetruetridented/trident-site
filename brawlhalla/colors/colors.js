const API_ROOT = "https://sussyrakas.onrender.com";

const DEFAULTS = {
  HairLt: "#d0ffff", Hair: "#a0e5ed", HairDk: "#67bee1",
  Body1VL: "#f3ffd2", Body1Lt: "#e5ff97", Body1: "#c5ff50", Body1Dk: "#6bffb0", Body1VD: "#2f766d", Body1Acc: "#1b5050",
  Body2VL: "#ffbe55", Body2Lt: "#ebda26", Body2: "#eef968", Body2Dk: "#c5ff3f", Body2VD: "#b1ff83", Body2Acc: "#c5ffb7",
  SpecialVL: "#ff7ef4", SpecialLt: "#c429d1", Special: "#6d21c3", SpecialDk: "#390ca9", SpecialVD: "#1f2575", SpecialAcc: "#28334a",
  ClothVL: "#f96a75", ClothLt: "#b83f61", Cloth: "#a5348d", ClothDk: "#5e2b63",
  WeaponVL: "#dedede", WeaponLt: "#f5e7d7", Weapon: "#aadfbb", WeaponDk: "#7090b6", WeaponAcc: "#b3fff5"
};

const GROUPS = [
  ["HAIR", ["HairLt", "Hair", "HairDk"]],
  ["BODY 1", ["Body1VL", "Body1Lt", "Body1", "Body1Dk", "Body1VD", "Body1Acc"]],
  ["BODY 2", ["Body2VL", "Body2Lt", "Body2", "Body2Dk", "Body2VD", "Body2Acc"]],
  ["SPECIAL", ["SpecialVL", "SpecialLt", "Special", "SpecialDk", "SpecialVD", "SpecialAcc"]],
  ["CLOTH", ["ClothVL", "ClothLt", "Cloth", "ClothDk"]],
  ["WEAPON", ["WeaponVL", "WeaponLt", "Weapon", "WeaponDk", "WeaponAcc"]]
];

const COLOR_KEYS = Object.keys(DEFAULTS);
const PCODE_SLOTS = {
  HairLt: 1, Hair: 2, HairDk: 3,
  Body1VL: 4, Body1Lt: 5, Body1: 6, Body1Dk: 7, Body1VD: 8, Body1Acc: 9,
  Body2VL: 10, Body2Lt: 11, Body2: 12, Body2Dk: 13, Body2VD: 14, Body2Acc: 15,
  SpecialVL: 16, SpecialLt: 17, Special: 18, SpecialDk: 19, SpecialVD: 20, SpecialAcc: 21,
  ClothVL: 26, ClothLt: 27, Cloth: 28, ClothDk: 29,
  WeaponVL: 30, WeaponLt: 31, Weapon: 32, WeaponDk: 33, WeaponAcc: 34
};
const XML_FIELDS = Object.fromEntries(COLOR_KEYS.map((key) => [key, `${key}_Swap`]));

const REPLACEMENT_COLORS = [
  "Blue", "Yellow", "Green", "Brown", "Purple", "Orange", "Cyan", "Sunset", "Grey", "Pink", "Red",
  "Lovestruck", "Heartfelt", "Lucky Clover", "Clover Patch", "Verdant Bloom", "Hibiscus", "Charged OG",
  "Raven's Honor", "Bifrost", "Art Deco", "Blood Moon", "Heatwave", "Pool Party", "Home Team",
  "Home Team Reunion", "Haunting", "Ghoulish", "Gala", "Winter Holiday", "Holly Jolly", "Soul Fire",
  "Synthwave", "Frozen Forest", "Coat of Lions", "Starlight", "Willow Leaves", "Pact of Poison",
  "Darkheart", "Armageddon", "Kira-Kira", "Ancient Curse", "Neon Hanafuda", "Dragonfire", "White", "Black",
  "Skyforged", "Goldforged", "RGB", "Blacklight", "Community Colors", "Community Colors v2", "Esports v1",
  "Esports v2", "Esports v3", "Esports v4", "Esports v5", "Esports v6", "Esports v7", "Guild Colors"
];

const LABELS = { VL: "VL", Lt: "LT", plain: "N", Dk: "DK", VD: "VD", Acc: "ACC" };
const form = document.querySelector("#color-form");
const fileInput = document.querySelector("#swf-file");
const airFileInput = document.querySelector("#air-swf-file");
const fileTitle = document.querySelector("#file-title");
const fileMeta = document.querySelector("#file-meta");
const drop = document.querySelector("#swf-drop");
const airDrop = document.querySelector("#air-swf-drop");
const airFileTitle = document.querySelector("#air-file-title");
const airFileMeta = document.querySelector("#air-file-meta");
const buildButton = document.querySelector("#build-button");
const status = document.querySelector("#form-status");
const pushbyteSelect = document.querySelector("#pushbyte-index");
const pushbyteReadout = document.querySelector("#pushbyte-readout");
const paletteName = document.querySelector("#palette-name");
const paletteImport = document.querySelector("#palette-import");
let backendReady = false;

function shadeLabel(key) {
  if (key.endsWith("Acc")) return LABELS.Acc;
  if (key.endsWith("VL")) return LABELS.VL;
  if (key.endsWith("Lt")) return LABELS.Lt;
  if (key.endsWith("Dk")) return LABELS.Dk;
  if (key.endsWith("VD")) return LABELS.VD;
  return LABELS.plain;
}

function renderPalette() {
  const host = document.querySelector("#palette-groups");
  host.innerHTML = "";
  GROUPS.forEach(([groupName, keys]) => {
    const group = document.createElement("fieldset");
    group.className = "palette-group";
    group.innerHTML = `<legend>${groupName}</legend><div class="shade-grid"></div>`;
    const grid = group.querySelector(".shade-grid");
    keys.forEach((key) => {
      const label = document.createElement("label");
      label.className = "color-control";
      label.innerHTML = `<span>${shadeLabel(key)}</span><input type="color" name="${key}" value="${DEFAULTS[key]}" aria-label="${groupName} ${shadeLabel(key)}"><code>${DEFAULTS[key].toUpperCase()}</code>`;
      const input = label.querySelector("input");
      const code = label.querySelector("code");
      input.addEventListener("input", () => { code.textContent = input.value.toUpperCase(); });
      grid.append(label);
    });
    host.append(group);
  });
}

function renderReplacementColors() {
  pushbyteSelect.innerHTML = REPLACEMENT_COLORS.map(
    (name, index) => `<option value="${index + 1}">${name}</option>`
  ).join("");
  pushbyteSelect.value = "1";
}

function currentColors() {
  return Object.fromEntries(COLOR_KEYS.map((key) => [key, form.elements[key].value.toLowerCase()]));
}

function normalizeColor(value, field) {
  let text = String(value ?? "").trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{6}$/i.test(text)) throw new Error(`Invalid color for ${field}: ${value}`);
  return `#${text.toLowerCase()}`;
}

function applyPalette(name, colors) {
  const missing = COLOR_KEYS.filter((key) => !(key in colors));
  if (missing.length) throw new Error(`Palette is missing: ${missing.join(", ")}`);
  COLOR_KEYS.forEach((key) => {
    const input = form.elements[key];
    input.value = normalizeColor(colors[key], key);
    input.dispatchEvent(new Event("input"));
  });
  paletteName.value = name || "Imported Palette";
}

function filenameStem() {
  return (paletteName.value.trim() || "trident-palette")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 80) || "trident-palette";
}

function downloadText(contents, extension, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenameStem()}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;"
  })[character]);
}

function parseJsonPalette(text, fallbackName) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Palette JSON must be an object.");
  return { name: parsed.name || fallbackName, colors: parsed.colors || parsed };
}

function parseXmlPalette(text, fallbackName) {
  const documentNode = new DOMParser().parseFromString(text, "application/xml");
  if (documentNode.querySelector("parsererror")) throw new Error("The ColorModder XML is invalid.");
  const scheme = documentNode.querySelector("ColorSchemeType");
  if (!scheme) throw new Error("No ColorSchemeType was found in the XML.");
  const colors = {};
  COLOR_KEYS.forEach((key) => {
    const node = scheme.querySelector(XML_FIELDS[key]);
    if (node) colors[key] = node.textContent;
  });
  return { name: scheme.getAttribute("ColorSchemeName") || fallbackName, colors };
}

function parsePcodePalette(text, fallbackName) {
  const values = [...text.matchAll(/\bpushuint\s+(0x[0-9a-f]+|\d+)/gi)].map((match) => Number(match[1]));
  if (values.length !== 35) throw new Error(`Expected 35 pushuint values in P-code; found ${values.length}.`);
  const colors = {};
  COLOR_KEYS.forEach((key) => {
    const value = values[PCODE_SLOTS[key]];
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff) throw new Error(`Invalid P-code color in slot ${PCODE_SLOTS[key]}.`);
    colors[key] = `#${value.toString(16).padStart(6, "0")}`;
  });
  return { name: fallbackName, colors };
}

async function importPaletteFile(file) {
  const text = await file.text();
  const fallbackName = file.name.replace(/\.[^.]+$/, "") || "Imported Palette";
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "json") return parseJsonPalette(text, fallbackName);
  if (extension === "xml") return parseXmlPalette(text, fallbackName);
  if (extension === "pcode") return parsePcodePalette(text, fallbackName);
  throw new Error("Choose a .json, .xml, or .pcode palette file.");
}

function fileIsValid(file, expectedName) {
  return Boolean(file && file.name.toLowerCase() === expectedName.toLowerCase());
}

function updateBuildState() {
  buildButton.disabled = !(
    backendReady &&
    fileIsValid(fileInput.files[0], "UI_MainMenu.swf") &&
    fileIsValid(airFileInput.files[0], "BrawlhallaAir.swf")
  );
}

function updateFile(file) {
  const valid = fileIsValid(file, "UI_MainMenu.swf");
  fileTitle.textContent = file ? file.name : "DROP UI_MainMenu.swf HERE";
  fileMeta.textContent = file ? `${(file.size / 1024).toFixed(1)} KB${valid ? " · ready" : " · wrong filename"}` : "or click to browse";
  drop.classList.toggle("has-file", Boolean(valid));
  drop.classList.toggle("has-error", Boolean(file && !valid));
  updateBuildState();
}

function updateAirFile(file) {
  const valid = fileIsValid(file, "BrawlhallaAir.swf");
  airFileTitle.textContent = file ? file.name : "DROP BrawlhallaAir.swf HERE";
  airFileMeta.textContent = file ? `${(file.size / 1024).toFixed(1)} KB${valid ? " · ready" : " · wrong filename"}` : "used to discover the current identifiers";
  airDrop.classList.toggle("has-file", Boolean(valid));
  airDrop.classList.toggle("has-error", Boolean(file && !valid));
  updateBuildState();
}

async function checkBackend() {
  const dot = document.querySelector("#backend-dot");
  const label = document.querySelector("#backend-label");
  const help = document.querySelector("#backend-help");
  dot.className = "backend-dot checking";
  label.textContent = "connecting to Color Forge";
  try {
    const response = await fetch(`${API_ROOT}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    backendReady = true;
    dot.className = "backend-dot online";
    label.textContent = "Color Forge online";
    help.textContent = "Ready to build with the hosted Render service.";
  } catch {
    backendReady = false;
    dot.className = "backend-dot offline";
    label.textContent = "Color Forge unavailable";
    help.textContent = "The hosted service may be waking up. Wait a moment, then retry.";
  }
  updateFile(fileInput.files[0]);
  updateAirFile(airFileInput.files[0]);
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener("change", () => updateFile(fileInput.files[0]));
airFileInput.addEventListener("change", () => updateAirFile(airFileInput.files[0]));

function installDropTarget(target, input, update) {
  ["dragenter", "dragover"].forEach((event) => target.addEventListener(event, (e) => { e.preventDefault(); target.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((event) => target.addEventListener(event, (e) => { e.preventDefault(); target.classList.remove("is-dragging"); }));
  target.addEventListener("drop", (event) => {
    if (!event.dataTransfer.files.length) return;
    input.files = event.dataTransfer.files;
    update(input.files[0]);
  });
}

installDropTarget(drop, fileInput, updateFile);
installDropTarget(airDrop, airFileInput, updateAirFile);

document.querySelector("#retry-backend").addEventListener("click", checkBackend);
pushbyteSelect.addEventListener("change", () => {
  pushbyteReadout.textContent = `color slot ${pushbyteSelect.value}`;
});
document.querySelector("#reset-palette").addEventListener("click", () => {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    const input = form.elements[key];
    input.value = value;
    input.dispatchEvent(new Event("input"));
  });
  paletteName.value = "Test Palette";
  status.textContent = "Test palette restored.";
  status.className = "form-status visible";
});

document.querySelector("#import-palette").addEventListener("click", () => paletteImport.click());
paletteImport.addEventListener("change", async () => {
  const file = paletteImport.files[0];
  if (!file) return;
  try {
    const imported = await importPaletteFile(file);
    applyPalette(imported.name, imported.colors);
    status.textContent = `Imported ${file.name}.`;
    status.className = "form-status visible success";
  } catch (error) {
    status.textContent = error.message;
    status.className = "form-status visible error";
  } finally {
    paletteImport.value = "";
  }
});

document.querySelector("#export-palette-json").addEventListener("click", () => {
  const payload = { format: "trident-color-palette", version: 1, name: paletteName.value.trim(), colors: currentColors() };
  downloadText(`${JSON.stringify(payload, null, 2)}\n`, "json", "application/json");
  status.textContent = "Shareable Trident palette exported.";
  status.className = "form-status visible success";
});

document.querySelector("#export-palette-xml").addEventListener("click", () => {
  const colors = currentColors();
  const fields = COLOR_KEYS.map((key) => `<${XML_FIELDS[key]}>${colors[key]}</${XML_FIELDS[key]}>`).join("");
  const xml = `<ColorSchemeTypes><ColorSchemeType ColorSchemeName="${escapeXml(paletteName.value.trim() || "Trident Palette")}">${fields}<IndicatorColor>#ffffff</IndicatorColor></ColorSchemeType></ColorSchemeTypes>\n`;
  downloadText(xml, "xml", "application/xml");
  status.textContent = "ColorModder-compatible XML exported.";
  status.className = "form-status visible success";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  const airFile = airFileInput.files[0];
  if (!fileIsValid(file, "UI_MainMenu.swf") || !fileIsValid(airFile, "BrawlhallaAir.swf")) return;
  buildButton.disabled = true;
  buildButton.classList.add("is-building");
  status.textContent = "Building and verifying your color swap…";
  status.className = "form-status visible";
  try {
    const colors = currentColors();
    const response = await fetch(`${API_ROOT}/api/colorswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        swfBase64: await readAsBase64(file),
        airFilename: airFile.name,
        airSwfBase64: await readAsBase64(airFile),
        pushbyteIndex: Number(pushbyteSelect.value),
        colors
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "The backend could not build this file.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "UI_MainMenu.swf";
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Done — patched and verified UI_MainMenu.swf downloaded.";
    status.className = "form-status visible success";
  } catch (error) {
    status.textContent = error.message;
    status.className = "form-status visible error";
  } finally {
    buildButton.classList.remove("is-building");
    updateFile(fileInput.files[0]);
    updateAirFile(airFileInput.files[0]);
  }
});

renderPalette();
renderReplacementColors();
checkBackend();
