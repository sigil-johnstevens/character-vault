// Step 1: Fetch GitHub Actor List
async function fetchGitHubActorList(repo, path, yourPAT) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (response.ok) {
        const files = await response.json();
        return files.filter(file => file.name.endsWith('.json')).map(file => file.name);
    } else {
        console.error('Error fetching actor list from GitHub:', response.statusText);
        return [];
    }
}

// Step 2: Create a Dialog to Select Actors
async function openImportDialog() {
    const repo = 'sigil-johnstevens/waymakers';  // Replace with your GitHub repo details
    const path = 'actors';  // The folder path within your repo
    const yourPAT = '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';  // Replace with your GitHub PAT

    // Fetch the list of actors from GitHub
    const fileList = await fetchGitHubActorList(repo, path, yourPAT);

    // Get a list of current actors in the Foundry VTT Actor Directory
    const actorsList = game.actors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join('');

    // Create and display the dialog
    new Dialog({
        title: "Import Actor from GitHub",
        content: `
        <p>Select an actor JSON file from GitHub:</p>
        <select id="fileSelect">${fileList.map(file => `<option value="${file}">${file}</option>`).join('')}</select>
        <p>Select an existing actor to overwrite:</p>
        <select id="actorSelect">${actorsList}</select>
      `,
        buttons: {
            import: {
                label: "Import",
                callback: async (html) => {
                    const selectedFile = html.find("#fileSelect")[0].value;
                    const selectedActorId = html.find("#actorSelect")[0].value;
                    await importActorFromGitHubToActor(repo, path, selectedFile, selectedActorId, yourPAT);
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
}

// Step 3: Import the Selected JSON into the Chosen Actor and Keep the Same Folder
async function importActorFromGitHubToActor(repo, path, fileName, actorId, yourPAT) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}/${encodeURIComponent(fileName)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (response.ok) {
        const file = await response.json();
        const jsonContent = decodeURIComponent(escape(atob(file.content)));
        const actorData = JSON.parse(jsonContent);

        const actor = game.actors.get(actorId);
        const folderId = actor.folder?.id || null;  // Get the folder ID of the existing actor

        // Update the actor with the new data and keep it in the same folder
        await actor.update({ ...actorData, folder: folderId });
        ui.notifications.info(`Actor ${actorData.name} has been updated with data from ${fileName}.`);
    } else {
        console.error('Error importing actor from GitHub:', response.statusText);
        ui.notifications.error('Failed to import actor from GitHub.');
    }
}

// To open the dialog, run:
openImportDialog();
