const MODULE_ID = "waymakers-gm-tools";

export async function fetchGitHubActorList() {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");
    
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `token ${yourPAT}`,
        }
    });

    if (response.ok) {
        const files = await response.json();
        console.log('Files from GitHub:', files);

        // Fetch and parse each file to extract the actor name
        const actorNames = await Promise.all(files.filter(file => file.name.endsWith('.json')).map(async file => {
            const fileResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}/${encodeURIComponent(file.name)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${yourPAT}`,
                }
            });
            const fileContent = await fileResponse.json();
            const decodedContent = decodeURIComponent(escape(atob(fileContent.content)));
            const parsedContent = JSON.parse(decodedContent);
            return { name: parsedContent.name, fileName: file.name };
        }));

        return actorNames;
    } else {
        console.error('Error fetching actor list from GitHub:', response.statusText);
        return [];
    }
}

export async function openImportDialog() {
    const actorList = await fetchGitHubActorList();
    console.log('Actor list:', actorList);

    const actorsList = game.actors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join('');

    new Dialog({
        title: "Import Actor from GitHub",
        content: `
        <p>Select an actor JSON file from GitHub:</p>
        <select id="fileSelect">${actorList.map(actor => `<option value="${actor.fileName}">${actor.name}</option>`).join('')}</select>
        <p>Select an existing actor to overwrite:</p>
        <select id="actorSelect">${actorsList}</select>
      `,
        buttons: {
            import: {
                label: "Import",
                callback: async (html) => {
                    const selectedFile = html.find("#fileSelect")[0].value;
                    const selectedActorId = html.find("#actorSelect")[0].value;
                    await importActorFromGitHubToActor(selectedFile, selectedActorId);
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
}

export async function importActorFromGitHubToActor(fileName, actorId) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

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
        const folderId = actor.folder?.id || null;

        await actor.update({ ...actorData, folder: folderId });
        ui.notifications.info(`Actor ${actorData.name} has been updated with data from ${fileName}.`);
    } else {
        console.error('Error importing actor from GitHub:', response.statusText);
        ui.notifications.error('Failed to import actor from GitHub.');
    }
}
// Make functions globally available
window.fetchGitHubActorList = fetchGitHubActorList;
window.openImportDialog = openImportDialog;
window.importActorFromGitHubToActor = importActorFromGitHubToActor;
