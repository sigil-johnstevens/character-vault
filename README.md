# Character Vault

The Character Vault provides powerful tools for managing and syncing Foundry VTT Actors across multiple games. These functions streamline character management and synchronization across different RPG sessions. More features and details will be added as the module evolves. This module assumes basic knowledge of GitHub, including creating a repository and setting up access tokens. You can learn more by consulting [GitHub Docs](https://docs.github.com/en)

## User Interface

Players can only use the right-click context menu on an Owned Actor to access import functions.

- **Import from GitHub:** Overwrite an existing owned actor with one from GitHub.
- **Export to GitHub (GM Only):** Send single Actor data to GitHub with confirmation notification (note this overwrites previous versions of the same actor in the repo)

## Game Master Interface

Additional bulk actions and utility functions are available to Game Master's via buttons in the Actor Directory.

- **Generate Users**: Quickly create multiple users and Actors:
  - Define a folder for storing Actors.
  - Provide a comma-separated list of usernames (e.g., Tom,Dick,Harry).
  - Assign randomly generated passwords using the DinoPass API.
  - Assign GM macro bar 5 to all users.
  - Create a blank actor for each user and assign it to them
  - Create a chat message with all created usernames and passwords
- **Upload Folder to GitHub**: Upload all actors in a selected folder to a GitHub repository to save any advancements or updates from the session (note that this overwrites previous versions of the same actor in the repo). Choose the folder containing the actors and upload them to GitHub with confirmation notifications.
- **Import from GitHub**: Use the Import from GitHub button to match and import a folder of actors from GitHub to your game.
- **Remove All Non-GM Users**: This option removes all non-GM users from your game. It is useful for resetting the game before a new session.

## Game Settings

The Character Vault module includes several configurable settings to manage actors and file session reports via Discord.

### GitHub Settings

To function correctly, these settings must be configured for the module's GitHub integration features.

- **GitHub Repository**: This is the repository's name on GitHub. Only `username/repo-name`. For example, this module is `sigil-johnstevens/character-vault`.
**GitHub Path**: The folder or subfolder where the relevant actor data is stored. If desired, you can set up multiple folders for different groups/games. The default is a simple `actors` folder.
- **GitHub Personal Access Token**" This is the area where the GitHub user enters their [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens). The token must have Content read/write access.

### User Settings

Currently, there is only one setting for user creation.

**Password Strength**: The module uses the [DinoPass API] (<https://www.dinopass.com/api>) to generate user passwords. Simple passwords only have lowercase letters and numbers. Strong passwords have mixed upper- and lower-case letters, a special character (like @, $, !, and so on), and some numbers.

---
