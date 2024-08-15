// sessionReports.js
const MODULE_ID = "character-vault";

// Function to send in a session report
export async function showSessionReportForm() {
    const folderOptions = getFolderOptions("Actor"); // Get folder options for the "Actor" type

    const content = `
    <form>
        <div class="form-group">
            <label>Select Folder:</label>
            <select name="folderId">${folderOptions}</select>
        </div>
        <div class="form-group">
            <label>Title:</label>
            <input type="text" name="gameTitle"/>
        </div>
        <div class="form-group">
            <label>Date:</label>
            <input type="date" name="date" value="${new Date().toISOString().substr(0, 10)}"/>
        </div>
        <div class="form-group">
            <label>Time:</label>
            <input type="time" name="time" value="${new Date().toLocaleTimeString('en-US', { hour12: false })}"/>
        </div>
        <div class="form-group">
            <label>Game Master:</label>
            <input type="text" name="gameMaster" value="${game.user.name}" readonly/>
        </div>
        <div class="form-group">
            <label>Advanced:</label>
            <div>
                <input type="radio" id="advanceYes" name="earnAdvance" value="Yes" checked/>
                <label for="advanceYes">Yes</label>
                <input type="radio" id="advanceNo" name="earnAdvance" value="No"/>
                <label for="advanceNo">No</label>
            </div>
        </div>
        <div class="form-group">
            <label>Session Report:</label>
            <textarea name="sessionReport" rows="6"></textarea>
        </div>
    </form>
    `;

    foundry.applications.api.DialogV2.prompt({
        title: "Create Session Report",
        content: content,
        ok: {
            label: "Submit",
            callback: async (event, button) => {
                const formData = new FormData(button.form);
                const folderId = formData.get('folderId');
                const actors = await fetchActorsFromFolderById(folderId); // Fetch actors based on selected folder

                const data = {
                    gameTitle: formData.get('gameTitle'),
                    date: formData.get('date'),
                    time: formData.get('time'),
                    gameMaster: formData.get('gameMaster'),
                    actors: actors, // Use the fetched actor list
                    earnAdvance: formData.get('earnAdvance'),
                    sessionReport: formData.get('sessionReport')
                };
                await postSessionReportToDiscord(data);
            }
        },
        cancel: {
            label: "Cancel"
        },
        window: {
            title: "Session Report",
            icon: "fas fa-book-open"
        },
        position: {
            width: 500,
            height: "auto"
        }
    });
}

export function getFolderOptions(type = "Actor") {
    // Fetch all folders of the specified type (e.g., "Actor")
    const folders = game.folders.filter(folder => folder.type === type);
    return folders.map(folder => `<option value="${folder.id}">${folder.name}</option>`).join('');
}

// Function to fetch actor names from a folder ID and return them as a comma-separated list
export async function fetchActorsFromFolderById(folderId) {
    const folder = game.folders.get(folderId); // Get folder by ID
    if (!folder || folder.type !== "Actor") {
        console.error(`Folder with ID "${folderId}" not found or is not an Actor folder.`);
        return '';
    }

    // Fetch actors that belong to this folder
    const actors = game.actors.filter(actor => actor.folder?.id === folder.id);
    if (actors.length === 0) {
        console.warn(`No actors found in the folder with ID "${folderId}".`);
        return '';
    }

    // Map the actor names and return them as a comma-separated string
    const actorNames = actors.map(actor => actor.name);
    return actorNames.join(', ');
}

// Function to post the session report to Discord
export async function postSessionReportToDiscord(data) {
    const webhookUrl = game.settings.get(MODULE_ID, "discordWebhookUrl");
    if (!webhookUrl) {
        ui.notifications.error("Discord Webhook URL is not configured.");
        return;
    }

    const payload = {
        content: `##  Session Report: ${data.gameTitle}
        **Date:** ${data.date} 
        **Time:** ${data.time}
        **Game Master:** ${data.gameMaster}
        **Heroes**: ${data.actors}
        **Received an Advance**: ${data.earnAdvance}
        **Session Report:** ${data.sessionReport}`,
        username: game.settings.get(MODULE_ID, "discordBotName"),
        avatar_url: game.settings.get(MODULE_ID, "discordImgUrl") // Optional: discordImgUrl
    };

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        ui.notifications.info("Session report successfully posted to Discord.");
    } else {
        const errorText = await response.text();
        ui.notifications.error(`Failed to post session report to Discord. Error: ${errorText}`);
    }
}
