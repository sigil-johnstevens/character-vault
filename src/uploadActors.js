
import {
    buildGitHubContentsUrl,
    buildGitHubFolderAccordion,
    getActorFolderChoices,
    getGitHubAuthHeaders,
    getGitHubPathChoices,
    getGitHubSettings,
    normalizeGitHubPath,
    requireGm,
    getSanitizedActorFileName,
    toBase64
} from "./utils.js";

async function getUploadGitHubPathChoices() {
    return getGitHubPathChoices(getGitHubSettings());
}

async function promptForUploadGitHubFolder() {
    const { choices, defaultPath } = await getUploadGitHubPathChoices();
    const folderInput = new foundry.data.fields.StringField({
        required: true,
        choices,
        initial: defaultPath,
        label: "GitHub Folder",
        hint: "Choose which GitHub folder receives the uploaded actor JSON files."
    }).toFormGroup({}, { name: "githubPath" }).outerHTML;

    const content = `<fieldset>${folderInput}</fieldset>`;

    return foundry.applications.api.DialogV2.prompt({
        content,
        modal: true,
        ok: {
            label: "Select",
            callback: async (event, button) => normalizeGitHubPath(button.form.elements.githubPath.value)
        },
        cancel: {
            label: "Cancel",
            callback: () => null
        },
        window: {
            title: "Select GitHub Folder",
            icon: "fa-solid fa-folder-open"
        },
        position: {
            width: 400,
            height: "auto"
        }
    });
}


// Step 2: Create a Dialog for Folder Selection
export async function openFolderUploadDialog() {
    if (!requireGm("upload actors to GitHub")) return;

    const folderChoices = getActorFolderChoices();
    if (!Object.keys(folderChoices).length) {
        ui.notifications.warn("No Foundry actor folders found.");
        return;
    }

    const actorFolderInput = new foundry.data.fields.StringField({
        required: true,
        choices: folderChoices,
        label: "Folder",
        hint: "Select a folder to upload all actors from it to GitHub."
    }).toFormGroup({}, { name: "folderId" }).outerHTML;

    const { choices: githubPathChoices, defaultPath } = await getUploadGitHubPathChoices();
    const githubPathInput = buildGitHubFolderAccordion(
        "githubPath",
        githubPathChoices,
        defaultPath,
        "Leave this alone unless you need a non-default GitHub folder for this upload."
    );

    const content = `<fieldset>${actorFolderInput}${githubPathInput}</fieldset>`;

    await foundry.applications.api.DialogV2.prompt({
        content: content,
        modal: true,
        ok: {
            label: "Upload",
            callback: async (event, button, html) => {
                const id = button.form.elements.folderId.value;
                const githubPath = normalizeGitHubPath(button.form.elements.githubPath.value);
                const folder = game.folders.get(id);
                if (!folder) {
                    ui.notifications.warn("Selected actor folder was not found.");
                    return;
                }
                await uploadActorsFromFolderToGitHub(folder, githubPath);
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

// Step 3: Function to Upload Actors from Selected Folder
export async function uploadActorsFromFolderToGitHub(folder, selectedPath = null) {
    if (!requireGm("upload actors to GitHub")) return;
    if (!folder) {
        ui.notifications.warn("No actor folder selected.");
        return;
    }
    if (!folder.contents?.length) {
        ui.notifications.warn(`Folder "${folder.name}" has no actors to upload.`);
        return;
    }

    const { repo, path, yourPAT } = getGitHubSettings();
    const targetPath = normalizeGitHubPath(selectedPath) || normalizeGitHubPath(path);

    for (let actor of folder.contents) {
        const jsonContent = JSON.stringify(actor.toJSON());
        const success = await uploadToGitHub(actor, jsonContent, repo, targetPath, yourPAT);

        if (success) {
            ui.notifications.info(`Actor ${actor.name} has been successfully uploaded to GitHub.`);
        } else {
            ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
        }
    }
}

// Step 4: Function to Upload a Single Actor to GitHub
export async function uploadActorToGitHub(actor) {
    if (!requireGm("upload actors to GitHub")) return;

    const selectedPath = await promptForUploadGitHubFolder();
    if (!selectedPath) return;

    const { repo, path, yourPAT } = getGitHubSettings();
    const targetPath = normalizeGitHubPath(selectedPath) || normalizeGitHubPath(path);

    const jsonContent = JSON.stringify(actor.toJSON());
    const success = await uploadToGitHub(actor, jsonContent, repo, targetPath, yourPAT);

    if (success) {
        ui.notifications.info(`Actor ${actor.name} has been successfully uploaded to GitHub.`);
    } else {
        ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
    }
}

// Step 5: Function to Upload to GitHub

export async function uploadToGitHub(actor, jsonContent, repo, path, yourPAT) {
    if (!requireGm("upload actors to GitHub")) return false;

    const encodedName = getSanitizedActorFileName(actor);
    const url = `${buildGitHubContentsUrl(repo, path)}/${encodedName}`;

    let sha = null;

    // Step 1: Check if the file already exists on GitHub to get its SHA
    try {
        const checkResponse = await fetch(url, {
            method: 'GET',
            headers: getGitHubAuthHeaders(yourPAT)
        });

        if (checkResponse.ok) {
            const data = await checkResponse.json();
            sha = data.sha; // Get the current sha value for updating
        }
    } catch (error) {
        console.error('Check file error:', error);
        return false;
    }

    // Step 2: Upload the actor data to GitHub
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: getGitHubAuthHeaders(yourPAT, { "Content-Type": "application/json" }),
            body: JSON.stringify({
                message: `Updating character ${actor.name}`,
                content: toBase64(jsonContent), // Convert JSON content to base64
                sha: sha,  // Include sha if the file exists (update)
                branch: "main",
            }),
        });

        if (response.ok) {
            console.log(`${actor.name} has been exported to GitHub.`);
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

