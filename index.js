const MODULE_ID = "character-vault";
import {
    copyGmHotbar,
    escapeHtml
} from './src/utils.js';
import { fetchGitHubFolderList } from './src/githubClient.js';

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
        name: "Default GitHub Path",
        hint: "The default folder path from GitHub repository containing actor JSON files.",
        scope: "world",
        config: true,
        type: String,
        default: "actors",
    });

    game.settings.register(MODULE_ID, "githubBranch", {
        name: "GitHub Branch",
        hint: "The GitHub branch containing your actor JSON files.",
        scope: "world",
        config: true,
        type: String,
        default: "main",
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
        hint: "Select the type of password generated.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "simple": "Simple",
            "strong": "Strong"
        },
        default: "simple",
    });
});

import { generateUsers } from './src/createUsers.js';
import {
    fetchGitHubActorList,
    preloadGitHubImportData,
    openImportDialog,
    openFolderImportDialog,
    importActorFromGitHubToActor
} from './src/importActors.js';
import {
    openActorUploadDialog,
    openFolderUploadDialog,
    uploadActorToGitHub,
} from './src/uploadActors.js';

Hooks.once("ready", () => {
    const exports = {
        fetchGitHubActorList,
        fetchGitHubFolderList,
        openImportDialog,
        importActorFromGitHubToActor,
        openFolderImportDialog,
        openActorUploadDialog,
        uploadActorToGitHub,
    };
    Object.entries(exports).forEach(([key, fn]) => window[key] = fn);
    console.log("Character Vault: Functions are now globally available.");
    void preloadGitHubImportData().catch(error => {
        console.debug("Character Vault could not preload GitHub import data.", error);
    });
});

Hooks.on("renderActorDirectory", (app, html, data) => {
    if (!game.user.isGM) return;

    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const footer = root.querySelector(".directory-footer");
    if (!footer) return;

    // Avoid duplicate injection
    if (footer.querySelector(".character-vault-controls")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("action-buttons", "flexcol", "character-vault-controls");


    // Helper to create Foundry-style buttons
    const createButton = (iconClass, label, onClick) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `<i class="${iconClass}"></i><span>${label}</span>`;
        btn.addEventListener("click", onClick);
        return btn;
    };

    // Button: Generate Users
    const generateUsersBtn = createButton("fa-solid fa-user-plus", "Generate Users", () => generateUsers());

    // Button: Import from GitHub
    const importGitHubBtn = createButton("fa-solid fa-cloud-arrow-down", "Import from GitHub", () => openFolderImportDialog());

    // Button: Delete Non-GM Users
    const deleteNonGMBtn = createButton("fa-solid fa-user-slash", "Delete Non-GM Users", async () => {
        const nonGMs = game.users.filter(user => !user.isGM);
        if (!nonGMs.length) {
            ui.notifications.info("No non-GM users found.");
            return;
        }

        const userList = nonGMs
            .map(user => `<li>${escapeHtml(user.name)}</li>`)
            .join("");
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Non-GM Users" },
            content: `
                <p>Delete the following ${nonGMs.length} non-GM user${nonGMs.length === 1 ? "" : "s"}?</p>
                <ul>${userList}</ul>
                <p><strong>This action cannot be undone.</strong></p>
            `,
            yes: {
                label: `Delete ${nonGMs.length} User${nonGMs.length === 1 ? "" : "s"}`,
                icon: "fa-solid fa-user-slash"
            },
            no: {
                label: "Cancel",
                icon: "fa-solid fa-xmark"
            }
        });
        if (!confirmed) return;

        const failures = [];
        for (const user of nonGMs) {
            try {
                await user.delete();
            } catch (error) {
                failures.push(user.name);
                console.error(`Failed to delete non-GM user ${user.name}:`, error);
            }
        }

        const deletedCount = nonGMs.length - failures.length;
        if (failures.length) {
            ui.notifications.warn(`Deleted ${deletedCount} user${deletedCount === 1 ? "" : "s"}; failed to delete: ${failures.join(", ")}.`);
        } else {
            ui.notifications.info(`Deleted ${deletedCount} non-GM user${deletedCount === 1 ? "" : "s"}.`);
        }
    });

    // Button: Upload Folder to GitHub
    const uploadFolderBtn = createButton("fa-solid fa-cloud-arrow-up", "Upload Folder to GitHub", () => openFolderUploadDialog());

    // Append buttons to wrapper and to footer
    wrapper.appendChild(generateUsersBtn);
    wrapper.appendChild(importGitHubBtn);
    wrapper.appendChild(deleteNonGMBtn);
    wrapper.appendChild(uploadFolderBtn);
    footer.appendChild(wrapper);
});

Hooks.on("renderMacroDirectory", (app, html, data) => {
    if (!game.user.isGM) return;

    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const footer = root.querySelector(".directory-footer");
    if (!footer) return;

    if (footer.querySelector(".character-vault-macro-controls")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("action-buttons", "flexcol", "character-vault-macro-controls");

    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<i class="fa-solid fa-keyboard"></i><span>Copy GM Hotbar</span>`;
    button.addEventListener("click", () => copyGmHotbar());

    wrapper.appendChild(button);
    footer.appendChild(wrapper);
});


// Context Menu Function
Hooks.on("getActorContextOptions", (html, options) => {
    const getActor = (...args) => {
        for (const arg of args) {
            const element = arg instanceof HTMLElement ? arg : arg?.currentTarget ?? arg?.target;
            const row = element?.dataset?.entryId ? element : element?.closest?.("[data-entry-id]");
            const actor = row ? game.actors.get(row.dataset.entryId) : null;
            if (actor) return actor;
        }

        return null;
    };

    options.push({
        label: "Import from GitHub",
        icon: '<i class="fa-solid fa-cloud-arrow-down"></i>',
        visible: (li) => getActor(li)?.isOwner,
        onClick: (event, li) => {
            const actor = getActor(li, event);
            if (actor) openImportDialog(actor.id);
        }
    });

    options.push({
        label: "Export to GitHub",
        icon: '<i class="fa-solid fa-cloud-arrow-up"></i>',
        visible: (li) => game.user.isGM && getActor(li)?.isOwner,
        onClick: (event, li) => {
            const actor = getActor(li, event);
            if (actor) openActorUploadDialog(actor);
        }
    });
});
