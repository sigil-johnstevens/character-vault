
import {
    buildGitHubPathOptions,
    escapeHtml,
    fetchGitHubFolderList,
    getActorFolders,
    getDefaultGitHubPath,
    getSanitizedActorFileName,
    normalizeGitHubPath
} from "./utils.js";
import { getGitHubFileShas, putGitHubFileContent } from "./githubClient.js";
import { runBatchOperation } from "./batchOperation.js";


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
    if (!githubPaths) return;
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
    if (!githubPaths) return;
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

    const path = normalizeGitHubPath(pathOverride ?? getDefaultGitHubPath());
    let existingShas;
    try {
        existingShas = await getGitHubFileShas(path);
    } catch (error) {
        console.error("Failed to inspect the GitHub upload path:", error);
        ui.notifications.error(error.message || "Failed to inspect the GitHub upload path.");
        return;
    }

    const actors = [...folder.contents];
    if (!actors.length) {
        ui.notifications.info("The selected Actor folder is empty.");
        return;
    }

    await runBatchOperation({
        title: "Upload Actors to GitHub",
        items: actors,
        getLabel: actor => actor.name,
        completedVerb: "Uploaded",
        itemName: "Actor",
        runItem: actor => {
            const jsonContent = JSON.stringify(actor.toJSON());
            const fileName = getSanitizedActorFileName(actor);
            return uploadToGitHub(actor, jsonContent, path, existingShas.get(fileName) ?? null);
        }
    });
}

// Step 4: Function to Upload a Single Actor to GitHub
export async function uploadActorToGitHub(actor, pathOverride = null) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return;
    }

    const path = normalizeGitHubPath(pathOverride ?? getDefaultGitHubPath());
    let existingShas;
    try {
        existingShas = await getGitHubFileShas(path);
    } catch (error) {
        console.error("Failed to inspect the GitHub upload path:", error);
        ui.notifications.error(error.message || "Failed to inspect the GitHub upload path.");
        return;
    }
    const fileName = getSanitizedActorFileName(actor);

    const jsonContent = JSON.stringify(actor.toJSON());
    const result = await uploadToGitHub(actor, jsonContent, path, existingShas.get(fileName) ?? null);

    if (result.ok) {
        ui.notifications.info(`${actor.name} has been successfully uploaded to GitHub.`);
    } else {
        ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub: ${result.error.message}`);
    }
}

// Step 5: Function to Upload to GitHub
export async function uploadToGitHub(actor, jsonContent, path, sha = null) {
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can upload actors to GitHub.");
        return { ok: false, error: new Error("Only a GM can upload actors to GitHub.") };
    }

    const fileName = getSanitizedActorFileName(actor);
    try {
        const payload = await putGitHubFileContent(fileName, jsonContent, {
            path,
            sha,
            message: `Updating character ${actor.name}`
        });
        return { ok: true, payload };
    } catch (error) {
        console.error("Failed to upload actor to GitHub:", error);
        return { ok: false, error };
    }
}
