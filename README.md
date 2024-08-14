# Character Vault

These functions streamline character management and synchronization across different RPG sessions. More features and details will be added as the module evolves. This module assumes basic knowledge of GitHub including making a repository and setting up access tokens. You can learn more by consulting [GitHub Docs](https://docs.github.com/en)

![Video](media/workflow.webm)

## Character Vault - Interface

The Character Vault provides powerful tools for managing and syncing Foundry VTT Actors across multiple games. Below are the key functions available via buttons in the Actor Directory.

### Generate Users

Quickly create multiple users and Actors:

- Define a folder for storing Actors.
- Provide a comma-separated list of usernames.
- Assigns randomly generated passwords using the DinoPass API.
- Assigns GM macro bar 5 to all users.
- Creates a blank actor for each user and assigns it to them
- Creates a chat message with all created usernames and passwords

### Upload Folder to GitHub

Upload all actors in a selected folder to a GitHub repository to save any advancement or updates from the session:

- Choose the folder containing the actors.
- Uploads all actors to GitHub with confirmation notifications.

### Import from GitHub

Import Actors from a GitHub repository:

- Use the right click context menu to overwrite an existing character with one from GitHub.
- Use Import from GitHub button to match and import a folder of actors from GitHub to your game.

### Remove All Non-GM Users

- Easily remove all non-GM users from your game. Useful for resetting the game before a new session.

# Character Vault - Game Settings

The Character Vault module includes several configurable settings to interface with GitHub for character management.

### GitHub Repository

- **Name**: `GitHub Repository`
- **Description**: Set the GitHub repository where your actor JSON files are stored (eg username/repo-name).
- **Default**: `yourRepo`
- **Scope**: `world`

### **GitHub Path**

- **Name**: `GitHub Path`
- **Description**: Define the path within the GitHub repository to the folder containing the actor JSON files.
- **Default**: `actors`
- **Scope**: `world`

### **GitHub Personal Access Token**

These settings must be configured for the module's GitHub integration features to function properly.

- **Name**: `GitHub Personal Access Token`
- **Description**: Enter your [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) to authenticate access to your repository.
- **Default**: `yourPAT`
- **Scope**: `world`

---
