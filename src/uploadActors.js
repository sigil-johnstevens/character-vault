
import { getActorFolders, toBase64 } from "./utils.js";
const MODULE_ID = "character-vault";


// Step 2: Create a Dialog for Folder Selection
export async function openFolderUploadDialog() {
    const choices = getActorFolders().reduce((acc, folder) => {
        acc[folder.id] = folder.name;
        return acc;
    }, {});

    const input = new foundry.data.fields.StringField({
        required: true,
        choices: choices,
        label: "Folder",
        hint: "Select a folder to upload all actors from it to GitHub."
    }).toFormGroup({}, { name: "folderId" }).outerHTML;

    const content = `<fieldset>${input}</fieldset>`;

    await foundry.applications.api.DialogV2.prompt({
        content: content,
        modal: true,
        ok: {
            label: "Upload",
            callback: async (event, button, html) => {
                const id = button.form.elements.folderId.value;
                const folder = game.folders.get(id);
                uploadActorsFromFolderToGitHub(folder);
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
export async function uploadActorsFromFolderToGitHub(folder) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

    for (let actor of folder.contents) {
        const jsonContent = JSON.stringify(actor.toJSON());
        const success = await uploadToGitHub(actor, jsonContent, repo, path, yourPAT);

        if (success) {
            ui.notifications.info(`Actor ${actor.name} has been successfully uploaded to GitHub.`);
        } else {
            ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
        }
    }
}

// Step 4: Function to Upload a Single Actor to GitHub
export async function uploadActorToGitHub(actor) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

    const jsonContent = JSON.stringify(actor.toJSON());
    const success = await uploadToGitHub(actor, jsonContent, repo, path, yourPAT);

    if (success) {
        ui.notifications.info(`Actor ${actor.name} has been successfully uploaded to GitHub.`);
    } else {
        ui.notifications.error(`Failed to upload actor ${actor.name} to GitHub.`);
    }
}

// Step 5: Function to Upload to GitHub

export async function uploadToGitHub(actor, jsonContent, repo, path, yourPAT) {
    const sanitizedFileName = actor.name.slugify().replace(/'/g, ''); // Foundry's slugify instance method and removes apostrophes
    const encodedName = encodeURIComponent(`${sanitizedFileName}.json`);
    const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodedName}`;

    let sha = null;

    // Step 1: Check if the file already exists on GitHub to get its SHA
    try {
        const checkResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${yourPAT}`,
            }
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
            headers: {
                'Authorization': `token ${yourPAT}`,
                'Content-Type': 'application/json',
            },
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

