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

    game.settings.register(MODULE_ID, "passwordStrength", {
        name: "Password Strength",
        hint: "Select the type of password generated by DinoPass.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "simple": "Simple",
            "strong": "Strong"
        },
        default: "simple",
    });
    // Registering Settings for the Discord Session Reports

    game.settings.register(MODULE_ID, "discordWebhookUrl", {
        name: "Discord Webhook URL",
        hint: "Enter the Webhook URL from Discord to which you want to post session reports.",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });
    game.settings.register(MODULE_ID, "discordImgUrl", {
        name: "Discord Image",
        hint: "Enter the Optional Avatar Image For Your Discord Bot",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });
    game.settings.register(MODULE_ID, "discordBotName", {
        name: "Discord Bot Name",
        hint: "Enter the Name you want to appear when your Discord Bot posts",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });
});

import { generateUsers } from './src/createUsers.js';
import { fetchGitHubActorList, openImportDialog, openFolderImportDialog, importActorFromGitHubToActor } from './src/importActors.js';
import { openFolderUploadDialog, uploadActorsFromFolderToGitHub, uploadToGitHub, uploadActorToGitHub, toBase64 } from './src/uploadActors.js';
import { showSessionReportForm, getFolderOptions, fetchActorsFromFolderById, postSessionReportToDiscord } from './src/sessionReports.js'

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
    window.uploadActorToGitHub = uploadActorToGitHub;
    window.showSessionReportForm = showSessionReportForm;
    window.getFolderOptions = getFolderOptions;
    window.fetchActorsFromFolderById = fetchActorsFromFolderById;
    window.postSessionReportToDiscord = postSessionReportToDiscord;
    console.log("Character Vault: Functions are now globally available.");
});

// Add Actor Directory Buttons for GM only
Hooks.on('renderActorDirectory', (app, html, data) => {
    if (!game.user.isGM) return; // Ensure buttons are only visible to GMs

    // Create the header
    const header = $('<h3 class="character-vault-header">Character Vault Controls</h3>');

    // Add a button for generating users
    const generateUsersButton = $('<button class="generate-users-button">Generate Users</button>');
    generateUsersButton.on('click', () => {
        generateUsers();
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

    // Add a button for uploading actors from a folder to GitHub
    const showSessionReportButton = $('<button class="session-report-button">File a Session Report</button>');
    showSessionReportButton.on('click', () => {
        showSessionReportForm();
    });

    // Create a container for the buttons and append it to the footer
    const buttonContainer = $('<div class="custom-buttons"></div>');
    buttonContainer.append(header);
    buttonContainer.append(generateUsersButton);
    buttonContainer.append(importFromGitHubButton);
    buttonContainer.append(deleteNonGMUsersButton);
    buttonContainer.append(uploadFolderButton);
    buttonContainer.append(showSessionReportButton);
    html.find('.directory-footer').append(buttonContainer);
});

// Add Import and Export Context Menu Options
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
    options.push({
        name: "Import from GitHub",
        icon: '<i class="fas fa-download"></i>',
        callback: async li => {
            const actorId = li.attr('data-document-id');  // Get the actor ID from the context
            const actor = game.actors.get(actorId);
            if (actor && actor.isOwner) {
                openImportDialog(actorId);
            } else {
                ui.notifications.warn("You do not own this actor.");
            }
        }
    });

    if (game.user.isGM) {
        options.push({
            name: "Export to GitHub",
            icon: '<i class="fas fa-upload"></i>',
            callback: async li => {
                const actorId = li.attr('data-document-id');  // Get the actor ID from the context
                const actor = game.actors.get(actorId);
                if (actor && actor.isOwner) {
                    await uploadActorToGitHub(actor);
                } else {
                    ui.notifications.warn("You do not own this actor.");
                }
            }
        });
    }

});
