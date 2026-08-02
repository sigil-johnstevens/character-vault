
import {
    buildGitHubPathOptions,
    escapeHtml,
    fetchGitHubFolderList,
    getActorFolders,
    getDefaultGitHubPath,
    getDialogElement,
    normalizeGitHubPath
} from "./utils.js";
import { getGitHubFileContent, listGitHubDirectory } from "./githubClient.js";
import { runBatchOperation } from "./batchOperation.js";

async function mapWithConcurrency(items, concurrency, callback) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await callback(items[index], index);
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function importFromJsonSilently(actor, jsonContent) {
    const notifications = ui?.notifications;
    if (!notifications || typeof notifications.notify !== "function") {
        return actor.importFromJSON(jsonContent);
    }

    const originalNotify = notifications.notify;
    notifications.notify = function(message, type = "info", options = {}) {
        // Batch progress replaces Foundry's per-document informational import toasts.
        // Warnings and errors still pass through normally.
        if (String(type) === "info") return null;
        return originalNotify.call(this, message, type, options);
    };

    try {
        return await actor.importFromJSON(jsonContent);
    } finally {
        notifications.notify = originalNotify;
    }
}

// Get list of actors from GitHub, showing actual names from JSON content
export async function fetchGitHubActorList(pathOverride = null) {
    const path = normalizeGitHubPath(pathOverride ?? getDefaultGitHubPath());

    try {
        const files = await listGitHubDirectory(path);
        const jsonFiles = files.filter(file => file.type === "file" && file.name?.endsWith(".json"));
        const actorList = await mapWithConcurrency(jsonFiles, 4, async file => {
            try {
                const fileContent = await getGitHubFileContent(file.name, path);
                const actorData = JSON.parse(fileContent);
                return {
                    name: actorData.name || file.name.replace(/\.json$/u, ""),
                    fileName: file.name
                };
            } catch (error) {
                console.warn(`Character Vault skipped invalid GitHub actor file ${file.name}:`, error);
                return null;
            }
        });
        return actorList.filter(Boolean);
    } catch (error) {
        console.error("Failed to fetch the GitHub actor list:", error);
        ui.notifications.error(error.message || "Failed to fetch the GitHub actor list.");
        return [];
    }
}

// Single Actor import function for use in right click context menu
export async function openImportDialog(preselectedActorId = null) {

    const githubPaths = await fetchGitHubFolderList();
    if (!githubPaths) return;
    const defaultPath = getDefaultGitHubPath();
    const initialPath = githubPaths.includes(defaultPath) ? defaultPath : githubPaths[0];
    const githubActors = await fetchGitHubActorList(initialPath);
    const githubChoices = githubActors.reduce((acc, actor) => {
        acc[actor.fileName] = actor.name;
        return acc;
    }, {});

    const ownedActors = game.actors.filter(actor => actor.isOwner);
    const foundryChoices = ownedActors.reduce((acc, actor) => {
        acc[actor.id] = actor.name;
        return acc;
    }, {});

    const githubActorOptions = Object.entries(githubChoices).map(([value, name]) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(name)}</option>`
    ).join('');
    const githubPathOptions = buildGitHubPathOptions(githubPaths, initialPath);
    const foundryActorOptions = Object.entries(foundryChoices).map(([value, name]) =>
        `<option value="${escapeHtml(value)}"${value === preselectedActorId ? " selected" : ""}>${escapeHtml(name)}</option>`
    ).join('');

    const content = `
        <form>
            <div class="form-group">
                <label>GitHub Path:</label>
                <select name="githubPath" data-github-path-select>${githubPathOptions}</select>
            </div>
            <div class="form-group">
                <label>GitHub Actors:</label>
                <select name="githubActor" data-github-actor-select>${githubActorOptions}</select>
            </div>
            <div class="form-group">
                <label>Foundry Actors:</label>
                <select name="foundryActor">${foundryActorOptions}</select>
            </div>
        </form>
    `;

    foundry.applications.api.DialogV2.prompt({
        title: "Import Actor from GitHub",
        content: content,
        modal: true,
        render: (event, target) => {
            const root = getDialogElement(target);
            if (!root) return;

            const pathSelect = root.querySelector("[data-github-path-select]");
            const actorSelect = root.querySelector("[data-github-actor-select]");
            const actorCache = new Map([[initialPath, githubActors]]);

            pathSelect?.addEventListener("change", async () => {
                const selectedPath = normalizeGitHubPath(pathSelect.value);
                actorSelect.disabled = true;

                if (!actorCache.has(selectedPath)) {
                    actorCache.set(selectedPath, await fetchGitHubActorList(selectedPath));
                }

                const actors = actorCache.get(selectedPath);
                actorSelect.innerHTML = actors.map(actor =>
                    `<option value="${escapeHtml(actor.fileName)}">${escapeHtml(actor.name)}</option>`
                ).join("");
                actorSelect.disabled = false;
            });
        },
        ok: {
            label: "Import",
            callback: async (event, button, html) => {
                const form = button.form; // Get the form from the button context
                const formData = new FormData(form);
                const selectedGithubPath = formData.get("githubPath");
                const selectedGithubActor = formData.get("githubActor");
                const selectedFoundryActor = formData.get("foundryActor");
                if (selectedGithubPath !== null && selectedGithubActor && selectedFoundryActor) {
                    await importActorFromGitHubToActor(selectedGithubActor, selectedFoundryActor, selectedGithubPath);
                }
            }
        },
        cancel: {
            label: "Cancel"
        }
    });
}

// Multiple Actors Import for UI button
export async function openFolderImportDialog() {
    const folder = await promptForActorFolder();

    if (!folder) return;

    const githubPaths = await fetchGitHubFolderList();
    if (!githubPaths) return;
    const defaultPath = getDefaultGitHubPath();
    const initialPath = githubPaths.includes(defaultPath) ? defaultPath : githubPaths[0];
    const actorList = await fetchGitHubActorList(initialPath);

    // Reduce GitHub actors into a choices object
    const githubChoices = actorList.reduce((acc, actor) => {
        acc[actor.fileName] = actor.name;
        return acc;
    }, {});
    const githubPathOptions = buildGitHubPathOptions(githubPaths, initialPath);
    const githubActorOptions = Object.entries(githubChoices).map(([fileName, name]) =>
        `<option value="${escapeHtml(fileName)}">${escapeHtml(name)}</option>`
    ).join('');

    // Form field for each actor in the folder
    const folderActorFields = folder.contents.map(actor => {
        return `
            <div class="form-group">
                <label>${escapeHtml(actor.name)}</label>
                <select name="${escapeHtml(actor.id)}-path" data-github-path-select>
                    ${githubPathOptions}
                </select>
                <select name="${escapeHtml(actor.id)}-file" data-github-actor-select>
                    ${githubActorOptions}
                </select>
            </div>
        `;
    }).join('');

    const content = `<form>${folderActorFields}</form>`;

    foundry.applications.api.DialogV2.prompt({
        title: "Import Actors from GitHub",
        content: content,
        modal: true,
        render: (event, target) => {
            const root = getDialogElement(target);
            if (!root) return;

            const actorCache = new Map([[initialPath, actorList]]);

            for (const pathSelect of root.querySelectorAll("[data-github-path-select]")) {
                const actorSelect = pathSelect.parentElement?.querySelector("[data-github-actor-select]");
                if (!actorSelect) continue;

                pathSelect.addEventListener("change", async () => {
                    const selectedPath = normalizeGitHubPath(pathSelect.value);
                    actorSelect.disabled = true;

                    if (!actorCache.has(selectedPath)) {
                        actorCache.set(selectedPath, await fetchGitHubActorList(selectedPath));
                    }

                    const actors = actorCache.get(selectedPath);
                    actorSelect.innerHTML = actors.map(actor =>
                        `<option value="${escapeHtml(actor.fileName)}">${escapeHtml(actor.name)}</option>`
                    ).join("");
                    actorSelect.disabled = false;
                });
            }
        },
        ok: {
            label: "Import",
            callback: async (event, button, html) => {
                const form = button.form; // Get the form from the button context
                const formData = new FormData(form);

                const imports = [];
                for (const actor of folder.contents) {
                    const selectedPath = formData.get(`${actor.id}-path`);
                    const selectedFile = formData.get(`${actor.id}-file`);
                    if (selectedPath !== null && selectedFile) {
                        imports.push({ actor, path: selectedPath, fileName: selectedFile });
                    }
                }

                if (!imports.length) {
                    ui.notifications.info("No Actors were selected for import.");
                    return;
                }

                // Let DialogV2 finish closing this selection dialog before opening progress.
                setTimeout(() => {
                    void runBatchOperation({
                        title: "Import Actors from GitHub",
                        items: imports,
                        getLabel: entry => entry.actor.name,
                        completedVerb: "Imported",
                        itemName: "Actor",
                        runItem: entry => importActorFromGitHubToActor(
                            entry.fileName,
                            entry.actor.id,
                            entry.path,
                            { notify: false }
                        )
                    }).catch(error => {
                        console.error("Character Vault folder import failed:", error);
                        ui.notifications.error(error.message || "The folder import failed.");
                    });
                }, 0);
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
            width: 600,
            height: "auto"
        }
    });
}


// Choose which Actor folder to use for multiple import 
export async function promptForActorFolder() {
    // Reduce Actors Folder into a choices object.
    return new Promise(resolve => {
        const folders = getActorFolders();
        const folderChoices = folders.reduce((acc, folder) => {
            acc[folder.id] = folder.name;
            return acc;
        }, {});

        const content = `
            <form>
                <div class="form-group">
                    <label>Select a folder:</label>
                    <select name="folderId" id="folderSelect">
                        ${Object.entries(folderChoices).map(([id, name]) =>
            `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`
        ).join('')}
                    </select>
                </div>
            </form>
        `;

        foundry.applications.api.DialogV2.prompt({
            title: "Select Actor Folder",
            content: content,
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
                width: 600,
                height: "auto"
            }
        });
    });
}

// Function to import the actor from GitHub to Foundry using the built-in importFromJSON function
export async function importActorFromGitHubToActor(fileName, actorId, pathOverride = null, { notify = true } = {}) {
    const path = normalizeGitHubPath(pathOverride ?? getDefaultGitHubPath());
    const actor = game.actors.get(actorId);

    if (!actor) {
        const error = new Error("Actor not found.");
        if (notify) ui.notifications.error(error.message);
        console.error("Actor not found:", actorId);
        return { ok: false, error };
    }

    try {
        const jsonContent = await getGitHubFileContent(fileName, path);
        JSON.parse(jsonContent);
        if (notify) {
            await actor.importFromJSON(jsonContent);
        } else {
            await importFromJsonSilently(actor, jsonContent);
        }
        return { ok: true, actor };
    } catch (error) {
        console.error("Failed to import actor from GitHub:", error);
        const message = error instanceof SyntaxError
            ? "The selected GitHub file does not contain valid JSON."
            : error.message || "Failed to import actor from GitHub.";
        if (notify) ui.notifications.error(message);
        return { ok: false, error: new Error(message, { cause: error }) };
    }
}
