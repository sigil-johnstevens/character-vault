const MODULE_ID = "character-vault";
const GITHUB_API_URL = "https://api.github.com";

export class GitHubError extends Error {
    constructor(message, { status = null, cause = null } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = "GitHubError";
        this.status = status;
    }
}

export function getGitHubConfiguration() {
    return {
        repo: String(game.settings.get(MODULE_ID, "githubRepo") ?? "").trim(),
        path: String(game.settings.get(MODULE_ID, "githubPath") ?? "").trim(),
        token: String(game.settings.get(MODULE_ID, "githubPAT") ?? "").trim(),
        branch: String(game.settings.get(MODULE_ID, "githubBranch") ?? "main").trim() || "main"
    };
}

export function validateGitHubConfiguration(configuration = getGitHubConfiguration()) {
    if (!configuration.repo || configuration.repo === "yourRepo") {
        throw new GitHubError("Configure a GitHub repository in Character Vault settings.");
    }

    if (!/^[^/\s]+\/[^/\s]+$/u.test(configuration.repo)) {
        throw new GitHubError("The GitHub repository must use the owner/repository format.");
    }

    if (!configuration.token || configuration.token === "yourPAT") {
        throw new GitHubError("Configure a GitHub access token in Character Vault settings.");
    }

    return configuration;
}

function errorMessageForStatus(status, githubMessage = "") {
    switch (status) {
        case 401:
            return "GitHub rejected the access token.";
        case 403:
            return "GitHub denied this request. Check token permissions or rate limits.";
        case 404:
            return "The GitHub repository, branch, or path could not be found.";
        case 409:
            return "GitHub could not complete the update because the remote file changed.";
        default:
            return githubMessage || `GitHub request failed with status ${status}.`;
    }
}

export async function githubRequest(route, { method = "GET", body = null } = {}) {
    const configuration = validateGitHubConfiguration();
    let response;

    try {
        response = await fetch(`${GITHUB_API_URL}${route}`, {
            method,
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${configuration.token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                ...(body === null ? {} : { "Content-Type": "application/json" })
            },
            ...(body === null ? {} : { body: JSON.stringify(body) })
        });
    } catch (error) {
        throw new GitHubError("Could not connect to GitHub.", { cause: error });
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch (error) {
        if (response.ok) {
            throw new GitHubError("GitHub returned an invalid response.", {
                status: response.status,
                cause: error
            });
        }
    }

    if (!response.ok) {
        throw new GitHubError(errorMessageForStatus(response.status, payload?.message), {
            status: response.status
        });
    }

    return payload;
}

export async function fetchGitHubTree() {
    const { repo, branch } = validateGitHubConfiguration();
    const encodedRepo = repo.split("/").map(encodeURIComponent).join("/");
    const encodedBranch = encodeURIComponent(branch);
    return githubRequest(`/repos/${encodedRepo}/git/trees/${encodedBranch}?recursive=1`);
}

function normalizePath(path) {
    return String(path ?? "").trim().replace(/^\/+|\/+$/gu, "");
}

function encodePath(path) {
    return normalizePath(path)
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");
}

function contentsRoute(repo, path, fileName = null) {
    const encodedRepo = repo.split("/").map(encodeURIComponent).join("/");
    const encodedPath = encodePath(path);
    const parts = [`/repos/${encodedRepo}/contents`];
    if (encodedPath) parts.push(encodedPath);
    if (fileName) parts.push(encodeURIComponent(fileName));
    return parts.join("/");
}

export async function listGitHubDirectory(path = null) {
    const { repo, path: defaultPath, branch } = validateGitHubConfiguration();
    const route = contentsRoute(repo, path ?? defaultPath);
    const payload = await githubRequest(`${route}?ref=${encodeURIComponent(branch)}`);

    if (!Array.isArray(payload)) {
        throw new GitHubError("The configured GitHub path is not a directory.");
    }

    return payload;
}

function decodeBase64Utf8(base64Content) {
    try {
        const binary = atob(String(base64Content ?? "").replace(/\s/gu, ""));
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        if (globalThis.TextDecoder) return new TextDecoder("utf-8").decode(bytes);

        const encoded = Array.from(bytes, byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
        return decodeURIComponent(encoded);
    } catch (error) {
        throw new GitHubError("GitHub returned invalid file content.", { cause: error });
    }
}

export async function getGitHubFileContent(fileName, path = null) {
    const { repo, path: defaultPath, branch } = validateGitHubConfiguration();
    const route = contentsRoute(repo, path ?? defaultPath, fileName);
    const payload = await githubRequest(`${route}?ref=${encodeURIComponent(branch)}`);

    if (!payload || payload.type !== "file" || typeof payload.content !== "string") {
        throw new GitHubError("GitHub returned an invalid file response.");
    }

    return decodeBase64Utf8(payload.content);
}

export async function getGitHubFileShas(path = null) {
    let entries;
    try {
        entries = await listGitHubDirectory(path);
    } catch (error) {
        // GitHub returns 404 for a path that does not exist yet. Uploading a new file may create it.
        if (error instanceof GitHubError && error.status === 404) return new Map();
        throw error;
    }

    return new Map(entries
        .filter(entry => entry.type === "file" && typeof entry.name === "string" && typeof entry.sha === "string")
        .map(entry => [entry.name, entry.sha]));
}

function encodeBase64Utf8(content) {
    const bytes = new TextEncoder().encode(String(content));
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
}

export async function putGitHubFileContent(fileName, content, {
    path = null,
    sha = null,
    message = `Update ${fileName}`
} = {}) {
    const { repo, path: defaultPath, branch } = validateGitHubConfiguration();
    const route = contentsRoute(repo, path ?? defaultPath, fileName);
    const body = {
        message,
        content: encodeBase64Utf8(content),
        branch
    };
    if (sha) body.sha = sha;

    return githubRequest(route, { method: "PUT", body });
}
