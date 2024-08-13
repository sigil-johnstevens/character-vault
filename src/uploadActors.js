// Step 1: Get Folders in the Actor Directory
let actorFolders = game.folders.filter(f => f.type === "Actor");

// Step 2: Create a Dialog for Folder Selection
new Dialog({
    title: "Select Actor Folder",
    content: `<p>Select a folder to upload all actors from it to GitHub.</p>
            <select id="folderSelect">
              ${actorFolders.map(folder => `<option value="${folder.id}">${folder.name}</option>`).join('')}
            </select>`,
    buttons: {
        upload: {
            label: "Upload",
            callback: async (html) => {
                const folderId = html.find("#folderSelect")[0].value;
                const folder = game.folders.get(folderId);
                await uploadActorsFromFolderToGitHub(folder);
            }
        },
        cancel: {
            label: "Cancel"
        }
    }
}).render(true);

// Step 3: Function to Upload Actors from Selected Folder
async function uploadActorsFromFolderToGitHub(folder) {
    const repo = 'sigil-johnstevens/waymakers';  // Replace with your GitHub repo details
    const path = 'actors';  // The folder path within your repo
    const yourPAT = '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';  // Replace with your GitHub PAT

    for (let actor of folder.contents) {
        const jsonContent = JSON.stringify(actor.toJSON());
        await uploadToGitHub(actor, jsonContent, repo, path, yourPAT);
    }
}

// Step 4: Function to Upload Each Actor to GitHub
async function uploadToGitHub(actor, jsonContent, repo, path, yourPAT) {
    const encodedName = encodeURIComponent(`${actor.name}.json`);
    const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodedName}`;

    // Check if the file already exists
    let sha = null;
    const checkResponse = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (checkResponse.ok) {
        const data = await checkResponse.json();
        sha = data.sha;  // Get the current sha value
    }

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${yourPAT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Updating character ${actor.name}`,
            content: toBase64(jsonContent),
            sha: sha,  // Include sha if the file exists
            branch: "main",  // Or another branch if needed
        }),
    });

    if (response.ok) {
        console.log(`${actor.name} has been exported to GitHub.`);
    } else {
        console.error('Error exporting to GitHub:', response.statusText);
        console.log('Response status:', response.status);
        console.log('Response text:', await response.text());
    }
}

// UTF-8 Encoding Function
function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
