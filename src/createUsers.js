export async function generateUsers(sessionName, userInput) {
    // Function to generate a random password
    function generatePass(length = 8) {
        let pass = '';
        const str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
        for (let i = 0; i < length; i++) {
            const char = Math.floor(Math.random() * str.length);
            pass += str.charAt(char);
        }
        return pass;
    }

    // Function to create Random Folder Colour
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Create Users, Passwords, and Permissions
    let userNames = userInput.split(",");

    async function createOrFindFolder() {
        let pc_folder = game.folders.find(entry => entry.name === sessionName && entry.type === "Actor");
        if (!pc_folder) {
            pc_folder = await Folder.create({ name: sessionName, type: CONST.FOLDER_DOCUMENT_TYPES[0], color: getRandomColor() });
        }
        return pc_folder;
    }

    async function createUser(username) {
        username = username.trim();
        let folder = await createOrFindFolder();
        let actor = await Actor.implementation.create({
            name: username,
            type: "character",
            folder: folder.id
        });
        let pw = generatePass();
        const userCheck = game.users.find(u => u.name === username);
        let user;
        if (!userCheck) {
            user = await User.create({ name: username, role: 1, password: pw, character: actor, color: getRandomColor() });
        } else {
            user = userCheck;
        }

        let id = user.id;
        let owner_obj = actor.ownership;
        owner_obj[id] = 3;
        await actor.update({
            ownership: owner_obj
        });
        return [user, pw];
    }

    // Push GM Macro Bar 5 to All Users
    async function pushMacros(user, gmMacros) {
        let userMacros = user.getHotbarMacros(1);
        for (let i = 0; i < 10; i++) {
            let macroDoc = gmMacros[i].macro;
            let slot = userMacros.find(s => s.macro == null);
            if (slot && macroDoc) {
                await user.assignHotbarMacro(macroDoc, slot);
            }
        }
    }

    const gm = game.user;
    const gmMacros = gm.getHotbarMacros(5);

    for (const macroDoc of gmMacros) {
        if (macroDoc.macro) {
            macroDoc.macro.update({ 'ownership.default': 2 });
        }
    }

    let record = '';

    for (const userName of userNames) {
        const [userAcct, pw] = await createUser(userName);
        await pushMacros(userAcct, gmMacros);
        record += `<tr><td style="user-select:text">${userName}</td><td style="user-select:text">${pw}</td></tr>`;
    }

    // Output User Names and Passwords to chat
    ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker(),
        content: `<p>Created ${userNames.length} user${userNames.length > 1 ? 's' : ''}:</p><table><thead><tr><th>User</th><th>Password</th></tr></thead><tbody>${record}</tbody></table>`,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}
// Make the function globally available
window.generateUsers = generateUsers;
