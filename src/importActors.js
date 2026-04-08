
import {
    buildGitHubContentsUrl,
    buildGitHubFolderAccordion,
    escapeHtml,
    getActorFolderChoices,
    getGitHubAuthHeaders,
    getGitHubPathChoices,
    getGitHubSettings,
    normalizeGitHubPath
} from "./utils.js";

function decodeBase64Utf8(base64Content) {
    const binary = atob(base64Content ?? "");
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (globalThis.TextDecoder) {
        return new TextDecoder("utf-8").decode(bytes);
    }

    const encoded = Array.from(bytes, byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
    return decodeURIComponent(encoded);
}

async function getImportGitHubPathChoices() {
    return getGitHubPathChoices(getGitHubSettings());
}

async function fetchGitHubActorsByPath(paths) {
    const actorLists = await Promise.all(paths.map(async (path) => ({
        path,
        actors: await fetchGitHubActorList(path)
    })));

    const byPath = {};
    for (const { path, actors } of actorLists) {
        byPath[path] = actors;
    }
    return byPath;
}

async function promptForImportFolders() {
    const { choices: githubChoices, defaultPath } = await getImportGitHubPathChoices();
    const folderChoices = getActorFolderChoices();
    if (!Object.keys(folderChoices).length) {
        ui.notifications.warn("No Foundry actor folders found.");
        return null;
    }

    const githubInput = buildGitHubFolderAccordion(
        "githubPath",
        githubChoices,
        defaultPath,
        "Leave this as-is unless you want to import from a different GitHub folder."
    );

    const actorFolderInput = new foundry.data.fields.StringField({
        required: true,
        choices: folderChoices,
        label: "Foundry Actor Folder",
        hint: "Choose which Foundry actor folder to match and import into."
    }).toFormGroup({}, { name: "folderId" }).outerHTML;

    const content = `<fieldset>${actorFolderInput}${githubInput}</fieldset>`;

    return foundry.applications.api.DialogV2.prompt({
        content,
        modal: true,
        ok: {
            label: "Select",
            callback: async (event, button) => {
                const githubPath = normalizeGitHubPath(button.form.elements.githubPath.value);
                const folderId = button.form.elements.folderId.value;
                const folder = game.folders.get(folderId);
                if (!folder) return null;
                return { githubPath, folder };
            }
        },
        cancel: {
            label: "Cancel",
            callback: () => null
        },
        window: {
            title: "Select Import Folders",
            icon: "fa-solid fa-folder-open"
        },
        position: {
            width: 400,
            height: "auto"
        }
    });
}


// Get list of actors from GitHub, showing actual names from JSON content
export async function fetchGitHubActorList(selectedPath = null) {
    const { repo, path, yourPAT } = getGitHubSettings();
    const targetPath = normalizeGitHubPath(selectedPath) || normalizeGitHubPath(path);

    const url = buildGitHubContentsUrl(repo, targetPath);
    const response = await fetch(url, {
        method: 'GET',
        headers: getGitHubAuthHeaders(yourPAT)
    });

    if (response.ok) {
        const files = await response.json();
        if (!Array.isArray(files)) return [];

        // Filter JSON files
        const jsonFiles = files.filter(file => file.name.endsWith('.json'));
        // Fetch all file contents in parallel
        const actorPromises = jsonFiles.map(async (file) => {
            const fileResponse = await fetch(buildGitHubContentsUrl(repo, targetPath, file.name), {
                method: 'GET',
                headers: getGitHubAuthHeaders(yourPAT)
            });
            if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                const fileContent = decodeBase64Utf8(fileData.content);
                const actorData = JSON.parse(fileContent);
                return {
                    name: actorData.name || file.name.replace('.json', ''), // Default to filename if no name in JSON
                    fileName: file.name
                };
            } else {
                console.error(`Failed to fetch JSON content for ${file.name}`);
                return null;
            }
        });
        const actorList = (await Promise.all(actorPromises)).filter(Boolean);
        return actorList;
    } else {
        console.error('Error fetching actor list from GitHub:', response.statusText);
        return [];
    }
}

// Single Actor import function for use in right click context menu
export async function openImportDialog(preselectedActorId = null) {
    const { choices: githubPathChoices, defaultPath } = await getImportGitHubPathChoices();
    const githubPaths = Object.keys(githubPathChoices);
    const githubActorsByPath = await fetchGitHubActorsByPath(githubPaths);
    const hasAnyActors = Object.values(githubActorsByPath).some(actors => actors.length > 0);
    if (!hasAnyActors) {
        ui.notifications.warn("No actor JSON files found in configured GitHub folders.");
        return;
    }

    const ownedActors = game.actors.filter(actor => actor.isOwner);
    const foundryChoices = ownedActors.reduce((acc, actor) => {
        acc[actor.id] = actor.name;
        return acc;
    }, {});

    const initialPath = defaultPath || githubPaths[0];

    const foundryActorOptions = Object.entries(foundryChoices).map(([value, name]) =>
        `<option value="${escapeHtml(value)}"${value === preselectedActorId ? " selected" : ""}>${escapeHtml(name)}</option>`
    ).join('');

    const content = `
        <form>
            <div class="form-group">
                <label>GitHub Actors:</label>
                <select name="githubActor"></select>
            </div>
            <div class="form-group">
                <label>Foundry Actors:</label>
                <select name="foundryActor">${foundryActorOptions}</select>
            </div>
            ${buildGitHubFolderAccordion(
                "githubPath",
                githubPathChoices,
                defaultPath,
                "Keep default unless you want actor choices from a different GitHub folder."
            )}
        </form>
    `;

    const attachActorSelectBinding = (app, html) => {
        const root = html instanceof HTMLElement ? html : html?.[0];
        if (!root) return false;

        const form = root.querySelector("form");
        if (!form) return false;

        const githubPathSelect = form.elements.githubPath;
        const githubActorSelect = form.elements.githubActor;
        const foundryActorSelect = form.elements.foundryActor;
        if (!githubPathSelect || !githubActorSelect || !foundryActorSelect) return false;

        const renderActorOptions = (path) => {
            const actors = githubActorsByPath[path] ?? [];
            if (!actors.length) {
                githubActorSelect.innerHTML = `<option value="">No actors found in ${escapeHtml(path)}</option>`;
                return;
            }

            githubActorSelect.innerHTML = actors
                .map((actor, index) => `<option value="${escapeHtml(actor.fileName)}"${index === 0 ? " selected" : ""}>${escapeHtml(actor.name)}</option>`)
                .join("");
        };

        githubPathSelect.addEventListener("change", () => {
            renderActorOptions(normalizeGitHubPath(githubPathSelect.value));
        });

        githubPathSelect.value = initialPath;
        renderActorOptions(initialPath);
        return true;
    };

    let dialogRenderHookId = null;
    let appRenderHookId = null;
    const onRender = (app, html) => {
        if (!attachActorSelectBinding(app, html)) return;
        if (dialogRenderHookId !== null) Hooks.off("renderDialogV2", dialogRenderHookId);
        if (appRenderHookId !== null) Hooks.off("renderApplicationV2", appRenderHookId);
    };
    dialogRenderHookId = Hooks.on("renderDialogV2", onRender);
    appRenderHookId = Hooks.on("renderApplicationV2", onRender);

    foundry.applications.api.DialogV2.prompt({
        title: "Import Actor from GitHub",
        content: content,
        modal: true,
        ok: {
            label: "Import",
            callback: async (event, button, html) => {
                const form = button.form; // Get the form from the button context
                const formData = new FormData(form);
                const selectedGithubPath = normalizeGitHubPath(formData.get("githubPath"));
                const selectedGithubActor = formData.get("githubActor");
                const selectedFoundryActor = formData.get("foundryActor");
                if (!selectedGithubActor) {
                    ui.notifications.warn(`No actor files found in "${selectedGithubPath}".`);
                    return;
                }
                if (selectedGithubActor && selectedFoundryActor) {
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
    const selection = await promptForImportFolders();
    if (!selection) return;

    const { githubPath, folder } = selection;
    const actorList = await fetchGitHubActorList(githubPath);
    if (!actorList.length) {
        ui.notifications.warn(`No actor JSON files found in "${githubPath}".`);
        return;
    }
    if (!folder.contents?.length) {
        ui.notifications.warn(`Folder "${folder.name}" has no actors to import.`);
        return;
    }

    // Reduce GitHub actors into a choices object
    const githubChoices = actorList.reduce((acc, actor) => {
        acc[actor.fileName] = actor.name;
        return acc;
    }, {});

    // Form field for each actor in the folder
    const folderActorFields = folder.contents.map(actor => {
        return `
            <div class="form-group">
                <label>${escapeHtml(actor.name)}</label>
                <select name="${escapeHtml(actor.id)}">
                    ${Object.entries(githubChoices).map(([fileName, name]) =>
            `<option value="${escapeHtml(fileName)}">${escapeHtml(name)}</option>`
        ).join('')}
                </select>
            </div>
        `;
    }).join('');

    const content = `<form>${folderActorFields}</form>`;

    foundry.applications.api.DialogV2.prompt({
        title: "Import Actors from GitHub",
        content: content,
        modal: true,
        ok: {
            label: "Import",
            callback: async (event, button, html) => {
                const form = button.form; // Get the form from the button context
                const formData = new FormData(form);

                for (const actor of folder.contents) {
                    const selectedFile = formData.get(actor.id);
                    if (selectedFile) {
                        await importActorFromGitHubToActor(selectedFile, actor.id, githubPath);
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

// Function to import the actor from GitHub to Foundry using the built-in importFromJSON function
export async function importActorFromGitHubToActor(fileName, actorId, selectedPath = null) {
    const { repo, path: defaultPath, yourPAT } = getGitHubSettings();
    const path = normalizeGitHubPath(selectedPath) || normalizeGitHubPath(defaultPath);

    const url = buildGitHubContentsUrl(repo, path, fileName);
    const response = await fetch(url, {
        method: 'GET',
        headers: getGitHubAuthHeaders(yourPAT)
    });

    if (response.ok) {
        const file = await response.json();
        const jsonContent = decodeBase64Utf8(file.content);

        // Find the existing actor
        const actor = game.actors.get(actorId);

        if (!actor) {
            ui.notifications.error('Actor not found.');
            console.error('Actor not found:', actorId);
            return;
        }

        try {
            // Use the importFromJSON function to import the data
            await actor.importFromJSON(jsonContent);
            ui.notifications.info(`Actor ${actor.name} has been successfully imported and updated.`);
        } catch (error) {
            console.error('Failed to import actor:', error);
            ui.notifications.error('Failed to import actor from JSON.');
        }
    } else {
        console.error('Error fetching actor JSON from GitHub:', response.statusText);
        ui.notifications.error('Failed to fetch actor from GitHub.');
    }
}
