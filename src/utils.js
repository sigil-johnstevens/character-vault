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

// Get all actor folders
export function getActorFolders() {
    return game.folders.filter(f => f.type === "Actor");
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
