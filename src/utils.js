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
