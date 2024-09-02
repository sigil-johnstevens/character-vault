const MODULE_ID = "character-vault";

export async function generateUsers() {
    // Dialog for variables
    foundry.applications.api.DialogV2.prompt({
        title: "Generate Users",
        content: `
            <form>
                <div class="form-group">
                    <label>Actor Folder Name:</label>
                    <input type="text" name="sessionName" value="Heroes" required/>
                </div>
                <div class="form-group">
                    <label>Usernames (comma separated):</label>
                    <input type="text" name="userInput" required/>
                </div>
            </form>
        `,
        ok: {
            label: "Generate",
            callback: async (event, button) => {
                const formData = new FormData(button.form);
                const sessionName = formData.get('sessionName');
                const userInput = formData.get('userInput');
                if (sessionName && userInput) {
                    await processUserGeneration(sessionName, userInput);
                }
            }
        },
        cancel: {
            label: "Cancel"
        },
        window: {
            title: "Generate Users",
            icon: "fa-solid fa-user-plus"
        },
        position: {
            width: 800,
            height: "auto"
        }
    });
}

async function processUserGeneration(sessionName, userInput) {
    const folder = await createOrFindFolder(sessionName);
    const userNames = userInput.split(",");
    let consoleOutput = '';

    for (let username of userNames) {
        const [user, pw] = await createUser(username.trim(), folder);
        await pushMacros(user);
        consoleOutput += `${username.trim()}: ${pw}\n`;
    }

    // Log output to the console
    console.log(`Generated users and passwords:\n${consoleOutput}`);

    // Generate a unique ID for the button
    const getPasswordsButtonId = `getPasswordsButton-${Date.now()}`;

    // Output to the chat with a "Get Passwords" button
    const content = `
        <p>Created ${userNames.length} user${userNames.length > 1 ? 's' : ''}.</p>
        <button id="${getPasswordsButtonId}">Get Passwords</button>
    `;

    // Create the chat message using the updated method
    await getDocumentClass('ChatMessage').create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker(),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });

    // Attach the event listener after the chat message is rendered
    Hooks.once('renderChatMessage', (message, html) => {
        html.find(`#${getPasswordsButtonId}`).click(() => {
            // Open a new DialogV2 with the text content
            foundry.applications.api.DialogV2.prompt({
                title: "User Credentials",
                content: `<textarea readonly style="width:100%; height:200px;">${consoleOutput}</textarea>`,
                label: "Close", // The label for the button
                callback: () => { }, // No additional action needed on close
                options: {
                    classes: ['dialog-v2'],
                    width: 400, // Width of the dialog
                    height: "auto" // Automatically adjust height
                }
            });
        });
    });
}

// create new Actor folder
async function createOrFindFolder(sessionName) {
    let folder = game.folders.find(f => f.name === sessionName && f.type === "Actor");
    if (!folder) {
        folder = await Folder.create({ name: sessionName, type: 'Actor', color: await fetchRandomColor() });
    }
    return folder;
}

// create users and assign actors
async function createUser(username, folder) {
    const password = await fetchPassword();
    const color = await fetchRandomColor();
    const actor = await Actor.create({ name: username, type: "character", folder: folder.id });
    const user = await User.create({ name: username, password, character: actor.id, color });

    let owner_obj = {};
    owner_obj[user.id] = 3; // Owner permission level
    await actor.update({ ownership: owner_obj });

    return [user, password];
}

// Make a password
async function fetchPassword() {
    const passwordType = game.settings.get(MODULE_ID, "passwordStrength");
    const response = await fetch(`https://www.dinopass.com/password/${passwordType}`);
    if (response.ok) {
        return await response.text();
    }
    console.error("Failed to generate password using DinoPass");
    return "fallbackPassword123";
}

// Make a random folder color
async function fetchRandomColor() {
    const response = await fetch('http://colormind.io/api/', {
        method: 'POST',
        body: JSON.stringify({ model: 'default' })
    });
    if (response.ok) {
        const data = await response.json();
        return `#${data.result[0].map(c => c.toString(16).padStart(2, '0')).join('')}`;
    }
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
}

// Push Macro Bar 5 from GM to all users
async function pushMacros(user) {
    const gmMacros = game.user.getHotbarMacros(5);
    for (let i = 0; i < gmMacros.length; i++) {
        if (gmMacros[i].macro) {
            let slot = user.getHotbarMacros(1).find(s => s.macro == null);
            if (slot && gmMacros[i].macro) {
                await user.assignHotbarMacro(gmMacros[i].macro, slot.slot);
            }
        }
    }
}

// Make the function globally available
window.generateUsers = generateUsers;
