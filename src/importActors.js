import { getGitHubSettings, getActorFolders } from "./utils.js";

const MODULE_ID = "character-vault";

// Core-version normalization is enabled by default because Foundry blocks imports when an incoming JSON document has _stats.coreVersion greater than the running Foundry core version.
const NORMALIZE_CORE_VERSION_ON_IMPORT = true;

// Leave this disabled by default. System data migrations belong to the game system.
const NORMALIZE_SYSTEM_VERSION_ON_IMPORT = false;

const CONVERT_V14_ACTIVE_EFFECTS_FOR_V13_IMPORT = true;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

function decodeBase64Utf8(base64Content) {
  const cleaned = String(base64Content ?? "").replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));

  if (globalThis.TextDecoder) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  const encoded = Array.from(bytes, byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(encoded);
}

function getRunningFoundryCoreVersion() {
  return game.version ?? game.release?.version ?? game.data?.version ?? null;
}

function getRunningFoundryMajorVersion() {
  const generation = Number(game.release?.generation);

  if (Number.isInteger(generation) && generation > 0) {
    return generation;
  }

  const version = getRunningFoundryCoreVersion();
  if (!version) return null;

  const major = Number.parseInt(String(version).split(".")[0], 10);
  return Number.isInteger(major) ? major : null;
}

function isRunningFoundryV13() {
  return getRunningFoundryMajorVersion() === 13;
}

function isRunningSWADE() {
  return String(game.system?.id ?? "").toLowerCase() === "swade";
}

function shouldConvertActiveEffectsForV13SWADEImport() {
  return (
    CONVERT_V14_ACTIVE_EFFECTS_FOR_V13_IMPORT &&
    isRunningFoundryV13() &&
    isRunningSWADE()
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

// Normalize active Foundry document metadata throughout an Actor export. This walks the actor, embedded items, actor effects, item effects, and any other embedded documents with an active _stats object.
 /*
 * @param {object} actorData - Parsed Actor JSON export.
 * @param {object} options
 * @param {string|null} options.coreVersion - Target Foundry core version.
 * @param {boolean} options.normalizeCoreVersion
 * @param {boolean} options.normalizeSystemVersion
 * @returns {{coreVersionChanged:number, systemVersionChanged:number, activeStatsSeen:number, originalCoreVersions: string[], targetCoreVersion: string|null}}
 */
export function normalizeActorJsonForCurrentServer(actorData, options = {}) {
  const targetCoreVersion = options.coreVersion ?? getRunningFoundryCoreVersion();
  const normalizeCoreVersion = options.normalizeCoreVersion ?? NORMALIZE_CORE_VERSION_ON_IMPORT;
  const normalizeSystemVersion = options.normalizeSystemVersion ?? NORMALIZE_SYSTEM_VERSION_ON_IMPORT;
  const targetSystemId = game.system?.id ?? null;
  const targetSystemVersion = game.system?.version ?? null;

  const originalCoreVersions = new Set();

  const report = {
    coreVersionChanged: 0,
    systemVersionChanged: 0,
    activeStatsSeen: 0,
    originalCoreVersions: [],
    targetCoreVersion
  };

  function walk(value) {
    if (!value || typeof value !== "object") return;

    if (value._stats && typeof value._stats === "object") {
      const stats = value._stats;
      report.activeStatsSeen += 1;

      if (hasOwn(stats, "coreVersion")) {
        originalCoreVersions.add(String(stats.coreVersion));

        if (
          normalizeCoreVersion &&
          targetCoreVersion &&
          stats.coreVersion !== targetCoreVersion
        ) {
          stats.coreVersion = targetCoreVersion;
          report.coreVersionChanged += 1;
        }
      }

      if (
        normalizeSystemVersion &&
        targetSystemId &&
        targetSystemVersion &&
        stats.systemId === targetSystemId &&
        stats.systemVersion !== targetSystemVersion
      ) {
        stats.systemVersion = targetSystemVersion;
        report.systemVersionChanged += 1;
      }
    }

    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }

    for (const child of Object.values(value)) {
      walk(child);
    }
  }

  walk(actorData);
  report.originalCoreVersions = [...originalCoreVersions].sort();

  return report;
}

function getV13ActiveEffectMode(change) {
  if (Number.isInteger(change?.mode)) {
    return change.mode;
  }

  const type = String(change?.type ?? "").toLowerCase();

  switch (type) {
    case "custom":
      return 0;
    case "multiply":
      return 1;
    case "add":
      return 2;
    case "downgrade":
      return 3;
    case "upgrade":
      return 4;
    case "override":
      return 5;
    default:
      // SWADE v14 effect changes normally include type. If not, ADD is the typical default for numeric trait/stat modifiers.
      return 2;
  }
}

function stringifyActiveEffectChangeValueForV13(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function convertActiveEffectChangeToV13(change) {
  return {
    key: change?.key ?? "",
    mode: getV13ActiveEffectMode(change),
    value: stringifyActiveEffectChangeValueForV13(change?.value),
    priority: hasOwn(change ?? {}, "priority") ? change.priority : null
  };
}

function convertDurationToV13(effect) {
  const duration = effect?.duration && typeof effect.duration === "object" ? effect.duration : {};
  const start = effect?.start && typeof effect.start === "object" ? effect.start : {};

  const v13Duration = {
    rounds: null,
    startTime: start.time ?? duration.startTime ?? 0,
    seconds: null,
    combat: start.combat ?? duration.combat ?? null,
    turns: null,
    startRound: start.round ?? duration.startRound ?? null,
    startTurn: start.turn ?? duration.startTurn ?? null
  };

  if (hasOwn(duration, "rounds")) v13Duration.rounds = duration.rounds;
  if (hasOwn(duration, "turns")) v13Duration.turns = duration.turns;
  if (hasOwn(duration, "seconds")) v13Duration.seconds = duration.seconds;

  if (hasOwn(duration, "value")) {
    const units = String(duration.units ?? "seconds").toLowerCase();

    if (duration.value === null || duration.value === undefined) {
      if (units === "round" || units === "rounds") v13Duration.rounds = null;
      else if (units === "turn" || units === "turns") v13Duration.turns = null;
      else v13Duration.seconds = null;
    } else if (units === "round" || units === "rounds") {
      v13Duration.rounds = duration.value;
    } else if (units === "turn" || units === "turns") {
      v13Duration.turns = duration.value;
    } else {
      v13Duration.seconds = duration.value;
    }
  }

  return v13Duration;
}

function normalizeActiveEffectSystemForV13(effect) {
  if (!effect.system || typeof effect.system !== "object") {
    effect.system = {};
  }

  if (!hasOwn(effect.system, "expiration")) effect.system.expiration = null;
  if (!hasOwn(effect.system, "removeEffect")) effect.system.removeEffect = false;
  if (!hasOwn(effect.system, "loseTurnOnHold")) effect.system.loseTurnOnHold = false;
  if (!hasOwn(effect.system, "favorite")) effect.system.favorite = false;
  if (!hasOwn(effect.system, "conditionalEffect")) effect.system.conditionalEffect = false;

  if (hasOwn(effect.system, "changes")) {
    delete effect.system.changes;
  }
}

function looksLikeActiveEffect(value) {
  if (!value || typeof value !== "object") return false;

  return (
    Array.isArray(value.changes) ||
    Array.isArray(value.system?.changes) ||
    (
      typeof value.name === "string" &&
      value.type === "base" &&
      (
        hasOwn(value, "duration") ||
        hasOwn(value, "transfer") ||
        hasOwn(value, "disabled") ||
        hasOwn(value, "statuses")
      )
    )
  );
}

function convertSingleActiveEffectToV13(effect, report) {
  if (!looksLikeActiveEffect(effect)) return;

  report.effectsSeen += 1;

  const v14SystemChanges = Array.isArray(effect.system?.changes)
    ? effect.system.changes
    : null;

  if (v14SystemChanges) {
    effect.changes = v14SystemChanges.map(convertActiveEffectChangeToV13);
    report.effectsConverted += 1;
    report.changesConverted += v14SystemChanges.length;
  } else if (Array.isArray(effect.changes)) {
    // If the effect is already v13-shaped, leave it v13-shaped but normalize each change row to the expected v13 key/mode/value/priority format.
    effect.changes = effect.changes.map(convertActiveEffectChangeToV13);
    report.effectsAlreadyTopLevel += 1;
  } else {
    effect.changes = [];
    report.effectsWithNoChanges += 1;
  }

  effect.duration = convertDurationToV13(effect);
  normalizeActiveEffectSystemForV13(effect);

  // these are v14 ActiveEffect document fields. Clean v13 embedded effects do not need them.
  if (hasOwn(effect, "start")) delete effect.start;
  if (hasOwn(effect, "showIcon")) delete effect.showIcon;
  if (hasOwn(effect, "folder")) delete effect.folder;
}

// Convert v14/SWADE 6 Active Effect data to the v13/SWADE 5 shape. Only call this when the current world is running Foundry v13.x and the active system is SWADE.
 /*
 * v14 shape:
 *   effect.system.changes[] = [{ key, value, priority, type, phase }]
 *
 * v13 shape:
 *   effect.changes[] = [{ key, mode, value, priority }]
 *
 * @param {object} actorData - Parsed Actor JSON export.
 * @returns {{ran:boolean, effectsSeen:number, effectsConverted:number, effectsAlreadyTopLevel:number, effectsWithNoChanges:number, changesConverted:number}}
 */
export function convertV14ActiveEffectsForV13Import(actorData) {
  const report = {
    ran: false,
    effectsSeen: 0,
    effectsConverted: 0,
    effectsAlreadyTopLevel: 0,
    effectsWithNoChanges: 0,
    changesConverted: 0
  };

  if (
    !shouldConvertActiveEffectsForV13SWADEImport() ||
    !actorData ||
    typeof actorData !== "object"
  ) {
    return report;
  }

  report.ran = true;

  function walk(value) {
    if (!value || typeof value !== "object") return;

    if (looksLikeActiveEffect(value)) {
      convertSingleActiveEffectToV13(value, report);
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }

    for (const child of Object.values(value)) {
      walk(child);
    }
  }

  // Actor-level effects.
  if (Array.isArray(actorData.effects)) {
    for (const effect of actorData.effects) {
      convertSingleActiveEffectToV13(effect, report);
    }
  }

  // Item-embedded effects.
  if (Array.isArray(actorData.items)) {
    for (const item of actorData.items) {
      if (!Array.isArray(item.effects)) continue;

      for (const effect of item.effects) {
        convertSingleActiveEffectToV13(effect, report);
      }
    }
  }

  // Fallback scan for any unusual nested ActiveEffect locations.
  walk(actorData);

  return report;
}

function buildOptions(choices, selectedValue = null) {
  return Object.entries(choices)
    .map(([value, name]) => {
      const selected = selectedValue === value ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

// Get list of actors from GitHub, showing actual names from JSON content.
export async function fetchGitHubActorList() {
  const { repo, path, yourPAT } = getGitHubSettings();
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `token ${yourPAT}`
    }
  });

  if (!response.ok) {
    console.error("Character Vault | Error fetching actor list from GitHub:", response.statusText);
    return [];
  }

  const files = await response.json();

  if (!Array.isArray(files)) {
    console.error("Character Vault | Expected GitHub contents response to be an array:", files);
    return [];
  }

  const jsonFiles = files.filter(file => file.name?.endsWith(".json"));

  const actorPromises = jsonFiles.map(async file => {
    const fileUrl = `https://api.github.com/repos/${repo}/contents/${path}/${encodeURIComponent(file.name)}`;

    const fileResponse = await fetch(fileUrl, {
      method: "GET",
      headers: {
        "Authorization": `token ${yourPAT}`
      }
    });

    if (!fileResponse.ok) {
      console.error(`Character Vault | Failed to fetch JSON content for ${file.name}:`, fileResponse.statusText);
      return null;
    }

    try {
      const fileData = await fileResponse.json();
      const fileContent = decodeBase64Utf8(fileData.content);
      const actorData = JSON.parse(fileContent);

      return {
        name: actorData.name || file.name.replace(".json", ""),
        fileName: file.name
      };
    } catch (error) {
      console.error(`Character Vault | Failed to read actor JSON for ${file.name}:`, error);
      return null;
    }
  });

  return (await Promise.all(actorPromises)).filter(Boolean);
}

// Single Actor import function for use in right-click context menu.
export async function openImportDialog(preselectedActorId = null) {
  const githubActors = await fetchGitHubActorList();

  const githubChoices = githubActors.reduce((acc, actor) => {
    acc[actor.fileName] = actor.name;
    return acc;
  }, {});

  const ownedActors = game.actors.filter(actor => actor.isOwner);

  const foundryChoices = ownedActors.reduce((acc, actor) => {
    acc[actor.id] = actor.name;
    return acc;
  }, {});

  const githubActorOptions = buildOptions(githubChoices);
  const foundryActorOptions = buildOptions(foundryChoices, preselectedActorId);

  const content = `
    <div class="form-group">
      <label>GitHub Actor</label>
      <select name="githubActor">${githubActorOptions}</select>
    </div>
    <div class="form-group">
      <label>Foundry Actor</label>
      <select name="foundryActor">${foundryActorOptions}</select>
    </div>
  `;

  foundry.applications.api.DialogV2.prompt({
    title: "Import Actor from GitHub",
    content,
    modal: true,
    ok: {
      label: "Import",
      callback: async (event, button, html) => {
        const form = button.form;
        const formData = new FormData(form);
        const selectedGithubActor = formData.get("githubActor");
        const selectedFoundryActor = formData.get("foundryActor");

        if (selectedGithubActor && selectedFoundryActor) {
          await importActorFromGitHubToActor(selectedGithubActor, selectedFoundryActor);
        }
      }
    },
    cancel: {
      label: "Cancel"
    }
  });
}

// Multiple Actors Import for UI button.
export async function openFolderImportDialog() {
  const actorList = await fetchGitHubActorList();
  const folder = await promptForActorFolder();

  if (!folder) return;

  const githubChoices = actorList.reduce((acc, actor) => {
    acc[actor.fileName] = actor.name;
    return acc;
  }, {});

  const githubOptionsWithSkip = {
    "": "-- Skip --",
    ...githubChoices
  };

  const folderActorFields = folder.contents.map(actor => {
    return `
      <div class="form-group">
        <label>${escapeHtml(actor.name)}</label>
        <select name="${escapeHtml(actor.id)}">
          ${buildOptions(githubOptionsWithSkip)}
        </select>
      </div>
    `;
  }).join("");

  const content = `${folderActorFields}`;

  foundry.applications.api.DialogV2.prompt({
    title: "Import Actors from GitHub",
    content,
    modal: true,
    ok: {
      label: "Import",
      callback: async (event, button, html) => {
        const form = button.form;
        const formData = new FormData(form);

        for (const actor of folder.contents) {
          const selectedFile = formData.get(actor.id);
          if (selectedFile) {
            await importActorFromGitHubToActor(selectedFile, actor.id);
          }
        }
      }
    },
    cancel: {
      label: "Cancel"
    },
    window: {
      title: "Match Actors to GitHub Files",
      icon: "fa-solid fa-upload"
    },
    position: {
      width: 400,
      height: "auto"
    }
  });
}

// Choose which Actor folder to use for multiple import.
export async function promptForActorFolder() {
  return new Promise(resolve => {
    const folders = getActorFolders();

    const folderChoices = folders.reduce((acc, folder) => {
      acc[folder.id] = folder.name;
      return acc;
    }, {});

    const content = `
      <div class="form-group">
        <label>Select a folder</label>
        <select name="folderId">
          ${buildOptions(folderChoices)}
        </select>
      </div>
    `;

    foundry.applications.api.DialogV2.prompt({
      title: "Select Actor Folder",
      content,
      modal: true,
      ok: {
        label: "Select",
        callback: async (event, button, html) => {
          const folderId = button.form.elements.folderId.value;
          const folder = game.folders.get(folderId);
          resolve(folder);
        }
      },
      cancel: {
        label: "Cancel",
        callback: () => resolve(null)
      },
      window: {
        title: "Folder Selection",
        icon: "fa-solid fa-folder-open"
      },
      position: {
        width: 400,
        height: "auto"
      }
    });
  });
}

// Function to import the actor from GitHub to Foundry using the built-in importFromJSON function.
export async function importActorFromGitHubToActor(fileName, actorId) {
  const repo = game.settings.get(MODULE_ID, "githubRepo");
  const path = game.settings.get(MODULE_ID, "githubPath");
  const yourPAT = game.settings.get(MODULE_ID, "githubPAT");
  const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodeURIComponent(fileName)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `token ${yourPAT}`
    }
  });

  if (!response.ok) {
    console.error("Character Vault | Error fetching actor JSON from GitHub:", response.statusText);
    ui.notifications.error("Failed to fetch actor from GitHub.");
    return;
  }

  const file = await response.json();
  const jsonContent = decodeBase64Utf8(file.content);

  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error("Actor not found.");
    console.error("Character Vault | Actor not found:", actorId);
    return;
  }

  let normalizedJsonContent = jsonContent;
  let normalizationReport = null;
  let activeEffectConversionReport = null;

  try {
    const actorData = JSON.parse(jsonContent);

    normalizationReport = normalizeActorJsonForCurrentServer(actorData, {
      coreVersion: getRunningFoundryCoreVersion(),
      normalizeCoreVersion: NORMALIZE_CORE_VERSION_ON_IMPORT,
      normalizeSystemVersion: NORMALIZE_SYSTEM_VERSION_ON_IMPORT
    });

    // This is intentionally after core-version normalization and before JSON.stringify/importFromJSON. It only runs in Foundry v13.x SWADE worlds.
    activeEffectConversionReport = convertV14ActiveEffectsForV13Import(actorData);

    normalizedJsonContent = JSON.stringify(actorData);
  } catch (error) {
    console.error("Character Vault | Failed to parse actor JSON before import:", error);
    ui.notifications.error("Failed to parse actor JSON from GitHub.");
    return;
  }

  try {
    await actor.importFromJSON(normalizedJsonContent);

    if (normalizationReport?.coreVersionChanged) {
      console.log(
        `Character Vault | Normalized ${normalizationReport.coreVersionChanged} active _stats.coreVersion field(s) ` +
        `from [${normalizationReport.originalCoreVersions.join(", ")}] to Foundry ${normalizationReport.targetCoreVersion}.`
      );
    }

    if (normalizationReport?.systemVersionChanged) {
      console.log(
        `Character Vault | Normalized ${normalizationReport.systemVersionChanged} active _stats.systemVersion field(s) ` +
        `to ${game.system.id} ${game.system.version}.`
      );
    }

    if (activeEffectConversionReport?.ran) {
      console.log(
        `Character Vault | Converted Active Effects for Foundry v13 import: ` +
        `${activeEffectConversionReport.effectsConverted} effect(s), ` +
        `${activeEffectConversionReport.changesConverted} change row(s). ` +
        `${activeEffectConversionReport.effectsAlreadyTopLevel} effect(s) were already v13-shaped; ` +
        `${activeEffectConversionReport.effectsWithNoChanges} effect(s) had no changes.`
      );
    }

    ui.notifications.info(`Actor ${actor.name} has been successfully imported and updated.`);
  } catch (error) {
    console.error("Character Vault | Failed to import actor:", error);
    ui.notifications.error("Failed to import actor from JSON.");
  }
}
