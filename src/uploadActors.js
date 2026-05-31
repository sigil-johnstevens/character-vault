
import {
    buildGitHubContentsUrl,
    buildGitHubPathOptions,
    escapeHtml,
    fetchGitHubFolderList,
    getActorFolders,
    getDefaultGitHubPath,
    getGitHubSettings,
    getSanitizedActorFileName,
    normalizeGitHubPath,
    toBase64
} from "./utils.js";


// Step 2: Create a Dialog for Folder Selection
export async function openFolderUploadDialog() {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return;
    }

    const folderChoices = getActorFolders().reduce((acc, folder) => {
        acc[folder.id] = folder.name;
        return acc;
    }, {});
    const githubPaths = await fetchGitHubFolderList();
    const defaultPath = getDefaultGitHubPath();
    const initialPath = githubPaths.includes(defaultPath) ? defaultPath : githubPaths[0];
    const githubPathOptions = buildGitHubPathOptions(githubPaths, initialPath);

    const content = `
        <form>
            <div class="form-group">
                <label>Folder</label>
                <select name="folderId">
                    ${Object.entries(folderChoices).map(([id, name]) =>
        `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`
    ).join("")}
                </select>
            </div>
            <div class="form-group">
                <label>GitHub Path</label>
                <select name="githubPath">${githubPathOptions}</select>
            </div>
        </form>
    `;

    await foundry.applications.api.DialogV2.prompt({
        content: content,
        modal: true,
        ok: {
            label: "Upload",
            callback: async (event, button, html) => {
                const id = button.form.elements.folderId.value;
                const path = button.form.elements.githubPath.value;
                const folder = game.folders.get(id);
                uploadActorsFromFolderToGitHub(folder, path);
            }
        },
        window: {
            title: "Upload",
            icon: "fa-solid fa-upload"
        },
        position: {
            width: 400,
            height: "auto"
        }
    });
}

export async function openActorUploadDialog(actor) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return;
    }

    const githubPaths = await fetchGitHubFolderList();
    const defaultPath = getDefaultGitHubPath();
    const initialPath = githubPaths.includes(defaultPath) ? defaultPath : githubPaths[0];
    const githubPathOptions = buildGitHubPathOptions(githubPaths, initialPath);

    const content = `
        <form>
            <div class="form-group">
                <label>Actor</label>
                <div>${escapeHtml(actor.name)}</div>
            </div>
            <div class="form-group">
                <label>GitHub Path</label>
                <select name="githubPath">${githubPathOptions}</select>
            </div>
        </form>
    `;

    await foundry.applications.api.DialogV2.prompt({
        content,
        modal: true,
        ok: {
            label: "Upload",
            callback: async (event, button) => {
                await uploadActorToGitHub(actor, button.form.elements.githubPath.value);
            }
        },
        cancel: {
            label: "Cancel"
        },
        window: {
            title: "Upload Actor",
            icon: "fa-solid fa-upload"
        },
        position: {
            width: 400,
            height: "auto"
        }
    });
}

// Step 3: Function to Upload Actors from Selected Folder
export async function uploadActorsFromFolderToGitHub(folder, pathOverride = null) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return;
    }

    const { repo, path: defaultPath, yourPAT } = getGitHubSettings();
    const path = normalizeGitHubPath(pathOverride ?? defaultPath);
    const existingShas = await fetchExistingGitHubFileShas(repo, path, yourPAT);

    for (let actor of folder.contents) {
        const jsonContent = JSON.stringify(actor.toJSON());
        const fileName = getSanitizedActorFileName(actor);
        const success = await uploadToGitHub(actor, jsonContent, repo, path, yourPAT, existingShas.get(fileName) ?? null);

        if (success) {
            ui.notifications.info(`${actor.name} has been successfully uploaded to GitHub.`);
        } else {
            ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
        }
    }
}

// Step 4: Function to Upload a Single Actor to GitHub
export async function uploadActorToGitHub(actor, pathOverride = null) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return;
    }

    const { repo, path: defaultPath, yourPAT } = getGitHubSettings();
    const path = normalizeGitHubPath(pathOverride ?? defaultPath);
    const existingShas = await fetchExistingGitHubFileShas(repo, path, yourPAT);
    const fileName = getSanitizedActorFileName(actor);

    const jsonContent = JSON.stringify(actor.toJSON());
    const success = await uploadToGitHub(actor, jsonContent, repo, path, yourPAT, existingShas.get(fileName) ?? null);

    if (success) {
        ui.notifications.info(`${actor.name} has been successfully uploaded to GitHub.`);
    } else {
        ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
    }
}

// Step 5: Function to Upload to GitHub

async function fetchExistingGitHubFileShas(repo, path, yourPAT) {
    const shas = new Map();

    try {
        const response = await fetch(buildGitHubContentsUrl(repo, path), {
            method: 'GET',
            headers: {
                'Authorization': `token ${yourPAT}`,
            }
        });

        if (!response.ok) return shas;

        const entries = await response.json();
        if (!Array.isArray(entries)) return shas;

        for (const entry of entries) {
            if (entry.type === "file" && entry.name?.endsWith(".json")) {
                shas.set(entry.name, entry.sha);
            }
        }
    } catch (error) {
        console.error('Folder contents check error:', error);
    }

    return shas;
}

export async function uploadToGitHub(actor, jsonContent, repo, path, yourPAT, sha = null) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return false;
    }

    const fileName = getSanitizedActorFileName(actor);
    const url = buildGitHubContentsUrl(repo, path, fileName);

    // Step 2: Upload the actor data to GitHub
    try {
        const body = {
            message: `Updating character ${actor.name}`,
            content: toBase64(jsonContent), // Convert JSON content to base64
            branch: "main",
        };
        if (sha) body.sha = sha;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${yourPAT}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            return true;
        } else {
            console.error('Upload error:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Export error:', error);
        return false;
    }
}
