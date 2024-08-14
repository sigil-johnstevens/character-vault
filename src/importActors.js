const MODULE_ID = "character-vault";

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
        return files.filter(file => file.name.endsWith('.json')).map(file => ({
            name: file.name.replace('.json', ''), // Extract the actor's name
            fileName: file.name
        }));
    } else {
        console.error('Error fetching actor list from GitHub:', response.statusText);
        return [];
    }
}

export async function openImportDialog(actorId) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

    const actorList = await fetchGitHubActorList(repo, path, yourPAT);
    
    // Filter out actors that the user doesn't own
    const actorsList = game.actors
        .filter(actor => actor.isOwner)  // Only include actors owned by the user
        .map(actor => `<option value="${actor.id}">${actor.name}</option>`)
        .join('');

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

// New openFolderImportDialog for Multiple Actors Import
export async function openFolderImportDialog() {
    const actorList = await fetchGitHubActorList();
    const folder = await promptForActorFolder();

    if (!folder) return;

    const folderActors = folder.contents.map(actor => ({
        id: actor.id,
        name: actor.name
    }));

    let dialogContent = folderActors.map(actor => {
        return `
        <div class="form-group">
            <label>${actor.name}:</label>
            <select name="${actor.id}">
                ${actorList.map(gitActor => `<option value="${gitActor.fileName}">${gitActor.name}</option>`).join('')}
            </select>
        </div>
        `;
    }).join('');

    new Dialog({
        title: "Import Actors from GitHub",
        content: `<form>${dialogContent}</form>`,
        buttons: {
            import: {
                label: "Import",
                callback: async (html) => {
                    for (const actor of folderActors) {
                        const selectedFile = html.find(`select[name="${actor.id}"]`).val();
                        await importActorFromGitHubToActor(selectedFile, actor.id);
                    }
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
}

async function promptForActorFolder() {
    return new Promise(resolve => {
        const folders = game.folders.filter(f => f.type === "Actor");

        let folderOptions = folders.map(folder => `<option value="${folder.id}">${folder.name}</option>`).join('');

        new Dialog({
            title: "Select Actor Folder",
            content: `
                <form>
                    <div class="form-group">
                        <label>Select a folder:</label>
                        <select id="folderSelect">${folderOptions}</select>
                    </div>
                </form>
            `,
            buttons: {
                select: {
                    label: "Select",
                    callback: (html) => {
                        const folderId = html.find("#folderSelect").val();
                        const folder = game.folders.get(folderId);
                        resolve(folder);
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => resolve(null)
                }
            }
        }).render(true);
    });
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

        if (!actor) {
            ui.notifications.error('Actor not found.');
            console.error('Actor not found:', actorId);
            return;
        }

        const folderId = actor.folder?.id || null;

        await actor.update({ ...actorData, folder: folderId });
        ui.notifications.info(`Actor ${actorData.name} has been updated with data from ${fileName}.`);
    } else {
        console.error('Error importing actor from GitHub:', response.statusText);
        ui.notifications.error('Failed to import actor from GitHub.');
    }
}
