const MODULE_ID = "waymakers-gm-tools";

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
        onChange: value => {
            console.log("GitHub PAT updated");
        }
    });
});

import { generateUsers } from './src/createUsers.js';
import { fetchGitHubActorList, openImportDialog, importActorFromGitHubToActor } from './src/importActors.js';
import { openFolderUploadDialog, uploadActorsFromFolderToGitHub, uploadToGitHub, toBase64 } from './src/uploadActors.js';

Hooks.once("ready", () => {
    window.generateUsers = generateUsers;
    window.fetchGitHubActorList = fetchGitHubActorList;
    window.openImportDialog = openImportDialog;
    window.importActorFromGitHubToActor = importActorFromGitHubToActor;
    window.openFolderUploadDialog = openFolderUploadDialog;
    window.uploadActorsFromFolderToGitHub = uploadActorsFromFolderToGitHub;
    window.uploadToGitHub = uploadToGitHub;
    window.toBase64 = toBase64;
    console.log("Waymakers GM Tools: Functions are now globally available.");
});

// Add Actor Directory Buttons

Hooks.on('renderActorDirectory', (app, html, data) => {
    // Add a button for generating users
    const generateUsersButton = $('<button class="generate-users-button">Generate Users</button>');
    generateUsersButton.on('click', () => {
        const sessionName = prompt('Name of actor folder (new or existing):', 'PCs');
        const userInput = prompt('Input comma separated list of users');
        if (sessionName && userInput) {
            generateUsers(sessionName, userInput);
        }
    });
    
    // Add a button for importing from GitHub
    const importFromGitHubButton = $('<button class="import-github-button">Import from GitHub</button>');
    importFromGitHubButton.on('click', () => {
        openImportDialog();
    });

    // Add a button for deleting all non-GM users
    const deleteNonGMUsersButton = $('<button class="delete-non-gm-users-button">Delete Non-GM Users</button>');
    deleteNonGMUsersButton.on('click', async () => {
        if (!game.user.isGM) {
            ui.notifications.warn("You must be a GM to run this macro.");
            return;
        }

        const nonGMs = game.users.filter(user => !user.isGM);
        for (let user of nonGMs) {
            console.log(`Removing user: ${user.name}`);
            await user.delete();
        }

        ui.notifications.info("All non-GM users have been removed.");
    });

    // Create a container for the buttons and append it to the footer
    const buttonContainer = $('<div class="custom-buttons"></div>');
    buttonContainer.append(generateUsersButton);
    buttonContainer.append(importFromGitHubButton);
    buttonContainer.append(deleteNonGMUsersButton);
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
