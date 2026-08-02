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

export function normalizeGitHubPath(path) {
    return String(path ?? "").trim().replace(/^\/+|\/+$/g, "");
}

export function encodeGitHubPath(path) {
    return normalizeGitHubPath(path)
        .split("/")
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join("/");
}

export function buildGitHubContentsUrl(repo, path, fileName = null) {
    const encodedPath = encodeGitHubPath(path);
    const parts = [`https://api.github.com/repos/${repo}/contents`];

    if (encodedPath) parts.push(encodedPath);
    if (fileName) parts.push(encodeURIComponent(fileName));

    return parts.join("/");
}

export function getDefaultGitHubPath() {
    return normalizeGitHubPath(game.settings.get(MODULE_ID, "githubPath"));
}

export function buildGitHubPathOptions(paths, selectedPath) {
    const selected = normalizeGitHubPath(selectedPath);

    return paths.map(path => {
        const normalized = normalizeGitHubPath(path);
        const label = normalized || "/";
        return `<option value="${escapeHtml(normalized)}"${normalized === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
}

function dedupeGitHubPaths(paths) {
    return [...new Set(paths.map(normalizeGitHubPath))].sort((a, b) => a.localeCompare(b));
}

function isVisibleGitHubPath(path) {
    return normalizeGitHubPath(path)
        .split("/")
        .filter(Boolean)
        .every(segment => !segment.startsWith("."));
}

export async function fetchGitHubFolderList() {
    const { repo, path, yourPAT } = getGitHubSettings();
    const defaultPath = normalizeGitHubPath(path);
    const folders = new Set([defaultPath]);
    const url = `https://api.github.com/repos/${repo}/git/trees/main?recursive=1`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${yourPAT}`,
            }
        });

        if (!response.ok) {
            console.error('Error fetching GitHub folder list:', response.statusText);
            return dedupeGitHubPaths([...folders]);
        }

        const data = await response.json();
        for (const entry of data.tree ?? []) {
            if (entry.type === "tree") {
                if (isVisibleGitHubPath(entry.path)) folders.add(entry.path);
            } else if (entry.type === "blob" && entry.path?.endsWith(".json")) {
                const parentPath = entry.path.split("/").slice(0, -1).join("/");
                if (isVisibleGitHubPath(parentPath)) folders.add(parentPath);
            }
        }
    } catch (error) {
        console.error('Failed to fetch GitHub folder list:', error);
    }

    return dedupeGitHubPaths([...folders]);
}

export function getDialogElement(target) {
    if (target instanceof HTMLElement) return target;
    if (target?.[0] instanceof HTMLElement) return target[0];
    if (target?.element instanceof HTMLElement) return target.element;
    return null;
}

// Get all actor folders
export function getActorFolders() {
    return game.folders.filter(f => f.type === "Actor");
}

// Slugify and sanitize actor name for filenames
export function getSanitizedActorFileName(actor) {
    // Use Foundry VTT v13's string.slugify method with recommended options
    const slug = actor.name.slugify({ lowercase: true, replacement: "-", strict: true });
    return slug + ".json";
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
    if (!game.user.isGM) {
        ui.notifications.error("Only a GM can copy hotbar macros.");
        return;
    }

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
