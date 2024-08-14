const MODULE_ID = "character-vault";

// Register Access Token, Path, and Repo as Game Settings
Hooks.once('init', () => {
    game.settings.register(MODULE_ID, "githubRepo", {
        name: "GitHub Repository",
        hint: "The GitHub repository where your actor JSON files are stored.",
        scope: "world",
        config: true,
        type: String,
        default: "yourRepo",
    });

    game.settings.register(MODULE_ID, "githubPath", {
        name: "GitHub Path",
        hint: "The path within the GitHub repository to the folder containing the actor JSON files.",
        scope: "world",
        config: true,
        type: String,
        default: "actors",
    });

    game.settings.register(MODULE_ID, "githubPAT", {
        name: "GitHub Personal Access Token",
        hint: "Your GitHub Personal Access Token (PAT) for accessing the repository.",
        scope: "world",
        config: true,
        type: String,
        default: "yourPAT",
        secret: true,
        onChange: value => {
            console.log("GitHub PAT updated");
        }
    });
});

import { generateUsers } from './src/createUsers.js';
import { fetchGitHubActorList, openImportDialog, openFolderImportDialog, importActorFromGitHubToActor } from './src/importActors.js';
import { openFolderUploadDialog, uploadActorsFromFolderToGitHub, uploadToGitHub, toBase64 } from './src/uploadActors.js';

Hooks.once("ready", () => {
    window.generateUsers = generateUsers;
    window.fetchGitHubActorList = fetchGitHubActorList;
    window.openImportDialog = openImportDialog;
    window.importActorFromGitHubToActor = importActorFromGitHubToActor;
    window.openFolderUploadDialog = openFolderUploadDialog;
    window.openFolderImportDialog = openFolderImportDialog;
    window.uploadActorsFromFolderToGitHub = uploadActorsFromFolderToGitHub;
    window.uploadToGitHub = uploadToGitHub;
    window.toBase64 = toBase64;
    console.log("Waymakers GM Tools: Functions are now globally available.");
});

// Add Actor Directory Buttons

Hooks.on('renderActorDirectory', (app, html, data) => {
    // Create the header
    const header = $('<h3 class="waymaker-header">Waymaker Control Panel</h3>');

    // Add a button for generating users
    const generateUsersButton = $('<button class="generate-users-button">Generate Users</button>');
    generateUsersButton.on('click', () => {
        new Dialog({
            title: "Generate Users",
            content: `
                <form>
                    <div class="form-group">
                        <label>Actor Folder Name:</label>
                        <input type="text" name="sessionName" value="Heroes"/>
                    </div>
                    <div class="form-group">
                        <label>Usernames (comma separated):</label>
                        <input type="text" name="userInput"/>
                    </div>
                </form>
            `,
            buttons: {
                generate: {
                    label: "Generate",
                    callback: (html) => {
                        const sessionName = html.find('input[name="sessionName"]').val();
                        const userInput = html.find('input[name="userInput"]').val();
                        if (sessionName && userInput) {
                            generateUsers(sessionName, userInput);
                        }
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            }
        }).render(true);
    });

    // Add a button for importing from GitHub
    const importFromGitHubButton = $('<button class="import-github-button">Import from GitHub</button>');
    importFromGitHubButton.on('click', () => {
        openFolderImportDialog();
    });

    // Add a button for deleting all non-GM users
    const deleteNonGMUsersButton = $('<button class="delete-non-gm-users-button">Delete Non-GM Users</button>');
    deleteNonGMUsersButton.on('click', async () => {
        if (!game.user.isGM) {
            ui.notifications.warn("You must be a GM to run this action.");
            return;
        }

        const nonGMs = game.users.filter(user => !user.isGM);
        for (let user of nonGMs) {
            console.log(`Removing user: ${user.name}`);
            await user.delete();
        }

        ui.notifications.info("All non-GM users have been removed.");
    });

    // Add a button for uploading actors from a folder to GitHub
    const uploadFolderButton = $('<button class="upload-folder-button">Upload Folder to GitHub</button>');
    uploadFolderButton.on('click', () => {
        openFolderUploadDialog();
    });

    // Create a container for the buttons and append it to the footer
    const buttonContainer = $('<div class="custom-buttons"></div>');
    buttonContainer.append(header);
    buttonContainer.append(generateUsersButton);
    buttonContainer.append(importFromGitHubButton);
    buttonContainer.append(deleteNonGMUsersButton);
    buttonContainer.append(uploadFolderButton);
    html.find('.directory-footer').append(buttonContainer);
});


// Add Import from GitHub Context Menu
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
    options.push({
        name: "Import from GitHub",
        icon: '<i class="fas fa-download"></i>',
        callback: async li => {
            const actorId = li.attr('data-document-id');  // Get the actor ID from the context
            openImportDialog(actorId);
        }
    });
});
