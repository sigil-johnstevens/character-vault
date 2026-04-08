Character Vault
===============

The Character Vault provides simple tools for managing and syncing Foundry VTT Actors across multiple instances in order to streamline character management and synchronization. The module assumes basic knowledge of GitHub, including creating a repository and setting up access tokens. You can learn more by consulting [GitHub Docs](https://docs.github.com/en)

Actor Context Menu
------------------

Players can only use the right-click context menu on an Owned Actor to access import functions.

*   **Import from GitHub:** Completely overwrite an existing owned actor  with a json from GitHub (best done on blank Actors).
*   **Export to GitHub (GM Only):** Send single Actor data to GitHub with confirmation notification (this _overwrites previous versions_ )

Game Master Interface
---------------------

Actor Directory buttons:

*   **Generate Users**: Create multiple users and Actors:
    *   Variables
        *   Define a folder new actors (default is "Heroes").
        *   Provide a comma-separated list of usernames (e.g., Valeros,Seoni,Kyra).
    *   Outputs
        *   Assign randomly generated passwords.
        *   Create a blank actor for each user and assign it to them
        *   Create a chat message with all created usernames and passwords
*   **Upload Folder to GitHub**: Upload all actors in a selected folder to a GitHub repository to save any updates from the session. Choose the folder containing the Actors and upload them to GitHub (this _overwrites previous versions_ in the repo )
*   **Import from GitHub**: Use the Import from GitHub button to match and import a folder of actors from GitHub to your game.
*   **Remove All Non-GM Users**: This option removes all non-GM users from your game. It is useful for resetting the game before a new session.

Macro Directory Buttons:
- **Copy GM Hotbar**: This button copies the chosen GM hotbar page (1-5) to all users. Useful for providing easy access macros for each player.

Game Settings
-------------

### GitHub Settings

To function correctly, these settings must be configured for the module's GitHub integration features.

*   **GitHub Repository**: This is the repository's name on GitHub. Only `username/repo-name`. For example, this module is `username/character-vault`.
*   **GitHub Path**: The default folder or subfolder where the relevant actor data is stored. If desired, you can set up multiple folders for different groups/games and use the accordion menu to chose them from the dialog. The default is  `actors`
*   **GitHub Personal Access Token:** This is the area where the GitHub user enters their [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens). The token must have Content read/write access.

### User Settings

Currently, there is only one setting for user creation.

**Password Strength** : **Simple** passwords only have lowercase letters and numbers. **Strong** passwords have mixed upper- and lower-case letters, a special character (like @, $, !), and some numbers.