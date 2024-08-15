const MODULE_ID = "character-vault";

// Step 1: Get Folders in the Actor Directory
export function getActorFolders() {
    return game.folders.filter(f => f.type === "Actor");
}

// Step 2: Create a Dialog for Folder Selection
export async function openFolderUploadDialog() {
    const choices = getActorFolders().reduce((acc, folder) => {
        acc[folder.id] = folder.name;
        return acc;
    }, {});

    const input = new foundry.data.fields.StringField({ // using a StringField to make use of the FormGroup method.
        required: true, // this removes blank option
        choices: choices, // this makes it a <select>
        label: "Folder",
        hint: "Select a folder to upload all actors from it to GitHub."
    }).toFormGroup({}, { name: "folderId" }).outerHTML;

    const content = `<fieldset>${input}</fieldset>`;

    await foundry.applications.api.DialogV2.prompt({
        content: content,
        modal: true, // makes the rest of the window uninteractive while this dialog is present
        ok: { // specific to DialogV2.prompt, changes to the default OK button
            label: "Upload",
            callback: async (event, button, html) => {
                const id = button.form.elements.folderId.value;
                const folder = game.folders.get(id);
                uploadActorsFromFolderToGitHub(folder);
            }
        },
        window: { // properties of the outer frame
            title: "Upload",
            icon: "fa-solid fa-upload"
        },
        position: { // properties of the window size and position
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

        // Add a confirmation notification for each uploaded actor
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

// Function to Upload to GitHub
export async function uploadToGitHub(actor, jsonContent, repo, path, yourPAT) {
    const encodedName = encodeURIComponent(`${actor.name}.json`);
    const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodedName}`;

    let sha = null;

    // Check if the file already exists on GitHub
    const checkResponse = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (checkResponse.ok) {
        const data = await checkResponse.json();
        sha = data.sha;  // Get the current sha value for updating
    }

    // Upload the actor data to GitHub
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
            branch: "main",  // Or another branch if needed
        }),
    });

    if (response.ok) {
        console.log(`${actor.name} has been exported to GitHub.`);
        return true;
    } else {
        console.error('Error exporting to GitHub:', response.statusText);
        console.log('Response status:', response.status);
        console.log('Response text:', await response.text());
        return false;
    }
}

// Function to convert string to Base64
export function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
