const MODULE_ID = "character-vault";

export async function generateUsers() {
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
        const sessionName = formData.get("sessionName")?.trim();
        const userInput = formData.get("userInput")?.trim();
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

  for (let username of userNames) {
    const trimmedName = username.trim();
    const [user, password] = await createUser(trimmedName, folder);
    await pushMacros(user);

    const inviteURL = game.data.addresses.remote;

    const content = `
      <p><strong><i class="fa-solid fa-user"></i> User Created:</strong> ${trimmedName}</p>
      <p><strong><i class="fa-solid fa-key"></i> Password:</strong> <code>${password}</code></p>
      <p><strong><i class="fa-solid fa-link"></i> Invite Link:</strong> 
        <a href="${inviteURL}" target="_blank">${inviteURL}</a>
      </p>
      <div style="margin-top: 0.5em;">
        <button class="copyUserInfo" data-username="${trimmedName}" data-password="${password}" data-url="${inviteURL}">
          <i class="fa-solid fa-clipboard"></i> Copy Info to Clipboard
        </button>
      </div>
    `;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker(),
      content,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      whisper: ChatMessage.getWhisperRecipients("GM")
    });
  }
}

// ✅ Clipboard listener (whisper-compatible and native DOM-safe)
Hooks.on("renderChatMessageHTML", (message, htmlElement) => {
  if (!game.user.isGM) return;

  const button = htmlElement.querySelector(".copyUserInfo");
  if (!button) return;

  button.addEventListener("click", () => {
    const username = button.dataset.username;
    const password = button.dataset.password;
    const url = button.dataset.url;
    const text = `User: ${username}\nPassword: ${password}\nInvite Link: ${url}`;

    navigator.clipboard.writeText(text)
      .then(() => ui.notifications.info(`📋 Copied info for ${username}`))
      .catch(err => {
        console.error("Clipboard write failed", err);
        ui.notifications.warn("Clipboard copy failed.");
      });
  });
});

// Actor folder logic
async function createOrFindFolder(sessionName) {
  let folder = game.folders.find(f => f.name === sessionName && f.type === "Actor");
  if (!folder) {
    folder = await Folder.create({ name: sessionName, type: "Actor", color: await fetchRandomColor() });
  }
  return folder;
}

// Create user and link to actor
async function createUser(username, folder) {
  const password = await fetchPassword();
  const color = await fetchRandomColor();
  const actor = await Actor.create({ name: username, type: "character", folder: folder.id });
  const user = await User.create({ name: username, password, character: actor.id, color });

  let owner_obj = {};
  owner_obj[user.id] = 3; // Owner
  await actor.update({ ownership: owner_obj });

  return [user, password];
}

// Get password from DinoPass
async function fetchPassword() {
  const passwordType = game.settings.get(MODULE_ID, "passwordStrength") || "simple";
  const url = `https://www.dinopass.com/password/${passwordType}`;
  try {
    // This is Foundry's built-in fetch that works in Node.js (server-side), no CORS issue
    const response = await foundry.utils.fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.text()).trim();
  } catch (err) {
    console.error("DinoPass fetch failed, using fallback password:", err);
    return "fallbackPassword123";
  }
}

// Get a random folder color
async function fetchRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
}

// Push GM's macro bar 5 to the new user
async function pushMacros(user) {
  const gmMacros = game.user.getHotbarMacros(5);
  for (let i = 0; i < gmMacros.length; i++) {
    if (gmMacros[i].macro) {
      const empty = user.getHotbarMacros(1).find(s => s.macro == null);
      if (empty) {
        await user.assignHotbarMacro(gmMacros[i].macro, empty.slot);
      }
    }
  }
}

// Global access
window.generateUsers = generateUsers;
