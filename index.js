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
