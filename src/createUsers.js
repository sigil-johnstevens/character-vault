const MODULE_ID = "character-vault";
const WORDLIST_URL = `modules/${MODULE_ID}/src/wordlist.txt`;
const FALLBACK_WORDLIST = ["tiger", "rabbit", "blue", "green", "apple", "banana", "berry", "orange"];
let WordlistCache = null;

export async function generateUsers() {
  if (!game.user.isGM) {
    ui.notifications.error("Only a GM can generate users.");
    return;
  }

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
  if (!game.user.isGM) {
    ui.notifications.error("Only a GM can generate users.");
    return;
  }

  const folder = await createOrFindFolder(sessionName);
  const userNames = userInput
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

  if (!userNames.length) {
    ui.notifications.warn("No valid usernames were provided.");
    return;
  }

  for (let username of userNames) {
    const [user, password] = await createUser(username, folder);

    const inviteURL = game.data.addresses.remote;

    const content = `
      <p><strong><i class="fa-solid fa-user"></i> User Created:</strong> ${username}</p>
      <p><strong><i class="fa-solid fa-key"></i> Password:</strong> <code>${password}</code></p>
      <p><strong><i class="fa-solid fa-link"></i> Invite Link:</strong> 
        <a href="${inviteURL}" target="_blank">${inviteURL}</a>
      </p>
      <div style="margin-top: 0.5em;">
        <button class="copyUserInfo" data-username="${username}" data-password="${password}" data-url="${inviteURL}">
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

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => ui.notifications.info(`Copied info for ${username}`))
        .catch(err => {
          console.error("Clipboard write failed", err);
          ui.notifications.warn("Clipboard copy failed.");
        });
    } else {
      // Fallback for environments without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        ui.notifications.info(`📋 Copied info for ${username}`);
      } catch (err) {
        console.error("Fallback copy failed", err);
        ui.notifications.warn("Clipboard copy failed.");
      }
      document.body.removeChild(textArea);
    }
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

// Generate password locally (avoids CORS failures from browser fetch)
async function fetchPassword() {
  const passwordType = game.settings.get(MODULE_ID, "passwordStrength") || "simple";
  return generatePassword(passwordType);
}

async function generatePassword(passwordType) {
  const wordlist = await getWordlist();

  if (passwordType === "strong") {
    const words = [
      capitalize(randomWord(wordlist)),
      capitalize(randomWord(wordlist)),
      capitalize(randomWord(wordlist)),
      capitalize(randomWord(wordlist))
    ];
    const digits = String(randomInt(100)).padStart(2, "0");
    const symbol = randomChar("!@#$%&*");
    return `${words.join("")}${symbol}${digits}`;
  }

  // "simple" and unknown values default to a readable passphrase.
  const first = capitalize(randomWord(wordlist));
  const second = capitalize(randomWord(wordlist));
  const suffix = String(randomInt(100)).padStart(2, "0");
  return `${first}${second}${suffix}`;
}

async function getWordlist() {
  if (WordlistCache?.length) return WordlistCache;

  try {
    const response = await fetch(WORDLIST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const words = text
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.split(/\s+/u).pop())
      .filter(Boolean);

    if (!words.length) throw new Error("Wordlist is empty");
    WordlistCache = words;
  } catch (err) {
    console.error("Failed loading wordlist, using fallback list:", err);
    WordlistCache = FALLBACK_WORDLIST;
  }

  return WordlistCache;
}

function randomWord(wordlist) {
  return wordlist[randomInt(wordlist.length)];
}

function randomChar(charset) {
  const index = randomInt(charset.length);
  return charset.charAt(index);
}

function randomInt(max) {
  if (max <= 0) return 0;

  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let number = 0;
    do {
      globalThis.crypto.getRandomValues(values);
      number = values[0];
    } while (number >= limit);
    return number % max;
  }

  return Math.floor(Math.random() * max);
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Get a random folder color
async function fetchRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
}

// Global access
window.generateUsers = generateUsers;
