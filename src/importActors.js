
import { getGitHubSettings, getActorFolders } from "./utils.js";
const MODULE_ID = "character-vault";

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
    const binary = atob(base64Content ?? "");
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (globalThis.TextDecoder) {
        return new TextDecoder("utf-8").decode(bytes);
    }

    const encoded = Array.from(bytes, byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
    return decodeURIComponent(encoded);
}


// Get list of actors from GitHub, showing actual names from JSON content
export async function fetchGitHubActorList() {
    const { repo, path, yourPAT } = getGitHubSettings();

    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (response.ok) {
        const files = await response.json();

        // Filter JSON files
        const jsonFiles = files.filter(file => file.name.endsWith('.json'));
        // Fetch all file contents in parallel
        const actorPromises = jsonFiles.map(async (file) => {
            const fileResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}/${file.name}`, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${yourPAT}`
                }
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

    const githubActorOptions = Object.entries(githubChoices).map(([value, name]) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(name)}</option>`
    ).join('');
    const foundryActorOptions = Object.entries(foundryChoices).map(([value, name]) =>
        `<option value="${escapeHtml(value)}"${value === preselectedActorId ? " selected" : ""}>${escapeHtml(name)}</option>`
    ).join('');

    const content = `
        <form>
            <div class="form-group">
                <label>GitHub Actors:</label>
                <select name="githubActor">${githubActorOptions}</select>
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
        ok: {
            label: "Import",
            callback: async (event, button, html) => {
                const form = button.form; // Get the form from the button context
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

// Multiple Actors Import for UI button
export async function openFolderImportDialog() {
    const actorList = await fetchGitHubActorList();
    const folder = await promptForActorFolder();

    if (!folder) return;

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
                width: 400,
                height: "auto"
            }
        });
    });
}

// Function to import the actor from GitHub to Foundry using the built-in importFromJSON function
export async function importActorFromGitHubToActor(fileName, actorId) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

    const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodeURIComponent(fileName)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
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
