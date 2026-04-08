// Utility functions for character-vault module

export const MODULE_ID = "character-vault";

// Get FoundryVTT settings for GitHub integration
export function getGitHubSettings() {
    return {
        repo: game.settings.get(MODULE_ID, "githubRepo"),
        path: game.settings.get(MODULE_ID, "githubPath"),
        yourPAT: game.settings.get(MODULE_ID, "githubPAT"),
    };
}

export function requireGm(action = "perform this action") {
    if (game.user?.isGM) return true;
    ui.notifications.error(`Only a GM can ${action}.`);
    return false;
}

export function normalizeGitHubPath(path) {
    return String(path ?? "").trim().replace(/^\/+|\/+$/g, "");
}

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
        switch (char) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "'": return "&#39;";
            default: return char;
        }
    });
}

export function getGitHubAuthHeaders(yourPAT, additionalHeaders = {}) {
    return {
        Authorization: `token ${yourPAT}`,
        ...additionalHeaders
    };
}

export function buildGitHubContentsUrl(repo, path, fileName = null) {
    const normalizedPath = normalizeGitHubPath(path);
    const baseUrl = `https://api.github.com/repos/${repo}/contents/${normalizedPath}`;
    if (!fileName) return baseUrl;
    return `${baseUrl}/${encodeURIComponent(fileName)}`;
}

export function buildGitHubFolderAccordion(name, choices, defaultPath, hint) {
    const options = Object.entries(choices).map(([value, label]) => {
        const selected = value === defaultPath ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");

    return `
        <details class="character-vault-github-folder">
            <summary>GitHub Folder (Default: ${escapeHtml(defaultPath)})</summary>
            <div class="form-group">
                <label>GitHub Folder:</label>
                <select name="${escapeHtml(name)}">
                    ${options}
                </select>
                <p class="hint">${escapeHtml(hint)}</p>
            </div>
        </details>
    `;
}

export async function fetchGitHubRepoDirectories(repo, yourPAT) {
    if (!repo || !yourPAT) return [];

    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/contents`, {
            method: "GET",
            headers: getGitHubAuthHeaders(yourPAT)
        });

        if (!response.ok) return [];

        const entries = await response.json();
        if (!Array.isArray(entries)) return [];
        return entries
            .filter(entry => entry?.type === "dir" && entry?.name)
            .map(entry => normalizeGitHubPath(entry.name))
            .filter(Boolean);
    } catch (error) {
        console.warn("Character Vault: Failed to fetch repository folders.", error);
        return [];
    }
}

export async function getGitHubPathChoices({ repo, path, yourPAT }, fallbackPath = "actors") {
    const defaultPath = normalizeGitHubPath(path);
    const repoDirectories = await fetchGitHubRepoDirectories(repo, yourPAT);

    const uniquePaths = [];
    const seen = new Set();
    for (const candidate of [defaultPath, ...repoDirectories]) {
        const normalized = normalizeGitHubPath(candidate);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        uniquePaths.push(normalized);
    }

    if (!uniquePaths.length && defaultPath) uniquePaths.push(defaultPath);
    if (!uniquePaths.length) uniquePaths.push(normalizeGitHubPath(fallbackPath) || "actors");

    const choices = uniquePaths.reduce((acc, folderPath) => {
        acc[folderPath] = folderPath;
        return acc;
    }, {});

    return {
        choices,
        defaultPath: uniquePaths[0]
    };
}

// Get all actor folders
export function getActorFolders() {
    return game.folders.filter(f => f.type === "Actor");
}

export function getActorFolderChoices() {
    return getActorFolders().reduce((acc, folder) => {
        acc[folder.id] = folder.name;
        return acc;
    }, {});
}

// Slugify and sanitize actor name for filenames
export function getSanitizedActorFileName(actor) {
    // Use Foundry VTT v13's string.slugify method with recommended options
    const slug = actor.name.slugify({ lowercase: true, replacement: "-", strict: true });
    return encodeURIComponent(slug + ".json");
}

// Base64 encode string for GitHub API
export function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

async function copyHotbarPage(user, sourceBar) {
    const gmMacros = game.user.getHotbarMacros(sourceBar);
    let assignedCount = 0;

    for (let i = 0; i < gmMacros.length; i++) {
        const slotData = gmMacros[i];
        if (!slotData?.macro) continue;
        const targetSlot = i + 1; // Always write to user hotbar page 1
        await user.assignHotbarMacro(slotData.macro, targetSlot);
        assignedCount++;
    }

    return assignedCount;
}

export async function copyGmHotbar() {
    if (!requireGm("copy hotbar macros")) return;

    const content = `
        <form>
            <div class="form-group">
                <label>GM Hotbar Page:</label>
                <select name="sourceBar">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5" selected>5</option>
                </select>
            </div>
        </form>
    `;

    await foundry.applications.api.DialogV2.prompt({
        title: "Copy GM Hotbar to All Users",
        content,
        modal: true,
        ok: {
            label: "Copy",
            callback: async (event, button) => {
                const sourceBar = Number(button.form.elements.sourceBar.value) || 5;
                const users = game.users.filter(user => !user.isGM);

                if (!users.length) {
                    ui.notifications.warn("No non-GM users found.");
                    return;
                }

                let totalAssigned = 0;
                for (const user of users) {
                    totalAssigned += await copyHotbarPage(user, sourceBar);
                }

                ui.notifications.info(`Copied page ${sourceBar} to ${users.length} user(s), assigned ${totalAssigned} macro(s).`);
            }
        },
        cancel: {
            label: "Cancel"
        },
        window: {
            title: "Copy GM Hotbar",
            icon: "fa-solid fa-keyboard"
        }
    });
}
