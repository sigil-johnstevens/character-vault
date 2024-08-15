// sessionReports.js
export const MODULE_ID = "character-vault";

// Registering a game setting for the Discord webhook URL
Hooks.once('init', () => {
    game.settings.register(MODULE_ID, "discordWebhookUrl", {
        name: "Discord Webhook URL",
        hint: "Enter the Webhook URL from Discord to which you want to post session reports.",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });
});

// Function to show the session report form and handle the submission
export async function showSessionReportForm() {
    const actors = await fetchActorsFromFolder("Session Characters"); // Fetch actors from a specified folder
    const actorOptions = actors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join('');

    const content = `
        <form>
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
                <label>Actors:</label>
                <select name="actorId">${actorOptions}</select>
            </div>
            <div class="form-group">
                <label>Advanced:</label>
                <input type="radio" name="earnAdvance" checked>Yes</input> <input type="radio" name="earnAdvance">No</input>
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
            callback: async (html) => {
                const formData = new FormData(html[0]);
                const data = {
                    date: formData.get('date'),
                    time: formData.get('time'),
                    gameMaster: formData.get('gameMaster'),
                    actorId: formData.get('actorId'),
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

// Function to fetch actors from a specified folder
async function fetchActorsFromFolder(folderName) {
    const folder = game.folders.find(f => f.name === folderName && f.type === "Actor");
    return folder ? folder.contents : [];
}

// Function to post the session report to Discord
async function postSessionReportToDiscord(data) {
    const webhookUrl = game.settings.get(MODULE_ID, "discordWebhookUrl");
    if (!webhookUrl) {
        ui.notifications.error("Discord Webhook URL is not configured.");
        return;
    }

    const payload = {
        content: `**Session Report**
        **Date:** ${data.date} 
        **Time:** ${data.time}
        **Game Master:** ${data.gameMaster}
        **Session Report:** ${data.sessionReport}`,
        username: "Session Report Bot",
        avatar_url: "https://example.com/image.png" // Optional: Link to a custom avatar image
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
