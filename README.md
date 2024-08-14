# Character Vault

The Character Vault provides powerful tools for managing and syncing Foundry VTT Actors across multiple games. These functions streamline character management and synchronization across different RPG sessions. More features and details will be added as the module evolves. This module assumes basic knowledge of GitHub including making a repository and setting up access tokens. You can learn more by consulting [GitHub Docs](https://docs.github.com/en)

## User Interface

Player level users can use the right click context menu on an Owned Actor to access import and export functions.

- **Import from GitHub:** Overwrite an existing owned actor with one from GitHub (best done on blank Actors).
- **Export to GitHub:** Send Owned Actor data to GitHub with confirmation notification (note this overwirtes previous versions of the same actor in the repo)

## Game Master Interface

Additional bulk actions and utility functions are available to Game Master's via buttons in the Actor Directory.

### Generate Users

Quickly create multiple users and Actors:

- Define a folder for storing Actors.
- Provide a comma-separated list of usernames (eg: Tom,Dick,Harry).
- Assign randomly generated passwords using the DinoPass API.
- Assign GM macro bar 5 to all users.
- Create a blank actor for each user and assigns it to them
- Create a chat message with all created usernames and passwords

### Upload Folder to GitHub

Upload all actors in a selected folder to a GitHub repository to save any advancement or updates from the session:

- Choose the folder containing the actors.
- Uploads all actors to GitHub with confirmation notifications (note this overwirtes previous versions of the same actor in the repo).

### Import from GitHub

Import Actors from a GitHub repository:

- Use Import from GitHub button to match and import a folder of actors from GitHub to your game.

### Remove All Non-GM Users

- Easily remove all non-GM users from your game. Useful for resetting the game before a new session.

## Character Vault - Game Settings

The Character Vault module includes several configurable settings to interface with GitHub for character management. These settings must be configured for the module's GitHub integration features to function properly.

### **GitHub Repository**

This is the name of the repository on GitHub. Only `username/repo-name`. For example this module is `sigil-johnstevens/character-vault`.

- **Name**: `GitHub Repository`
- **Description**: Set the GitHub repository where your actor JSON files are stored.
- **Default**: `yourRepo`
- **Scope**: `world`

### **GitHub Path**

The folder or sub folder where the relevant actor data is stored. You can set up multiple folders for different groups/games if desired. Default is a simple `actors` folder.

- **Name**: `GitHub Path`
- **Description**: Define the path within the GitHub repository to the folder containing the actor JSON files.
- **Default**: `actors`
- **Scope**: `world`

### **GitHub Personal Access Token**

This is the area where the GitHub user enters their [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens). The token must have Content read/write access.

- **Name**: `GitHub Personal Access Token`
- **Description**: Enter your GitHub Personal Access Token (PAT) to authenticate access to your repository.
- **Default**: `yourPAT`
- **Scope**: `world`

### **Password Strength**

The module uses the [DinoPass API](https://www.dinopass.com/api) to generate user passwords. Simple passwords only have lower case letters and numbers. Strong passwords have mixed upper and lower case letters, a special character (like @, $, ! and so on) plus some numbers.

- **Name**: `Password Strength`
- **Description**: Select the type of password generated.
- **Default**: `simple`
- **Choices**: `simple` or `strong`
- **Scope**: `world`

---
