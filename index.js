MODULE_ID = "waymakers-gm-tools";

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
      name: "GitHub Path",
      hint: "The path within the GitHub repository to the folder containing the actor JSON files.",
      scope: "world",
      config: true,
      type: String,
      default: "actors",
    });
  
    game.settings.register(MODULE_ID, "githubPAT", {
      name: "GitHub Personal Access Token",
      hint: "Your GitHub Personal Access Token (PAT) for accessing the repository.",
      scope: "world",
      config: true,
      type: String,
      default: "yourPAT",
      // Set restricted access if sensitive
      onChange: value => {
        console.log("GitHub PAT updated");  // Optional: handle changes to the PAT
      }
    });
  });

// Add Import from GitHub Context Menu

// Step 1: Fetch GitHub Actor List and Parse Actor Names

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
        console.log('Files from GitHub:', files); // Debugging line

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

// Step 2: Add "Import from GitHub" to Right-Click Menu
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
    options.push({
        name: "Import from GitHub",
        icon: '<i class="fas fa-download"></i>',
        callback: async li => {
            const actorId = li.attr('data-document-id');  // Get the actor ID from the context
            openImportDialog(actorId);
        }
    });
});

// Step 3: Create a Dialog to Select Actors
async function openImportDialog(actorId) {
    const repo = game.settings.get(MODULE_ID, "githubRepo");
    const path = game.settings.get(MODULE_ID, "githubPath");
    const yourPAT = game.settings.get(MODULE_ID, "githubPAT");

    // Fetch the list of actors from GitHub
    const actorList = await fetchGitHubActorList(repo, path, yourPAT);
    console.log('Actor list:', actorList); // Debugging line

    // Create and display the dialog with actor names
    new Dialog({
        title: "Import Actor from GitHub",
        content: `
        <p>Select an actor JSON file from GitHub:</p>
        <select id="fileSelect">${actorList.map(actor => `<option value="${actor.fileName}">${actor.name}</option>`).join('')}</select>
      `,
        buttons: {
            import: {
                label: "Import",
                callback: async (html) => {
                    const selectedFile = html.find("#fileSelect")[0].value;
                    await importActorFromGitHubToActor(repo, path, selectedFile, actorId, yourPAT);
                }
            },
            cancel: {
                label: "Cancel"
            }
        }
    }).render(true);
}

// Step 4: Import the Selected JSON into the Chosen Actor with Error Handling
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

        if (!actor) {
            ui.notifications.error('Actor not found.');
            console.error('Actor not found:', actorId);
            return;
        }

        const folderId = actor.folder?.id || null;  // Get the folder ID of the existing actor

        // Update the actor with the new data and keep it in the same folder
        await actor.update({ ...actorData, folder: folderId });
        ui.notifications.info(`Actor ${actorData.name} has been updated with data from ${fileName}.`);
    } else {
        console.error('Error importing actor from GitHub:', response.statusText);
        ui.notifications.error('Failed to import actor from GitHub.');
    }
}
