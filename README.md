# Mirrorbast

Mirrorbast is a simple desktop application designed to wrap the web-based card game client Karabast so that it can be played by a single player using two decks, with easy setup and switching between both sides of the table for deck-testing purposes.

![Mirrorbast Application Preview](assets/mirrorbast-preview.png) 

## How to Use

* When the Mirrorbast application starts, you'll see two inputs for SWUDB deck urls (one for each "player"). 
* Enter the two decks that you want to test against eachother, and click "Auto Setup Game'. 
* The app will automatically set up a private lobby with both decks. 
  * This is automated and takes a few seconds, so sit back and let it do its thing. 
  * Clicking stuff during this phase can break the automation and you'll have to reset.
* Once finished, you can click the "Switch Active Player" button in the footer, or just hit spacebar, to toggle between the two "players" in order to play against yourself.

## ⚠️ Alpha Software - Expect Bugs! ⚠️

**Please be aware:** This application is currently in an **alpha** stage.

I vibe coded this thing with AI over two days of paternity leave while taking care of a newborn, so keep your expectations reasonably low 😅

* **Bugs are expected and likely.** Features might be incomplete or unstable.

Use this software with the understanding that it's an early experiment. Feel free to report issues or contribute if you're interested!

## Installation

The easiest way to install Mirrorbast is to download the latest release for your operating system from the **[Releases Page](https://github.com/pmossman/mirrorbast/releases)** on GitHub.

Find the release corresponding to the version you want (usually the latest) and download the appropriate file for your system:

* **Windows:** Download the `.exe` file (e.g., `mirrorbast-vX.Y.Z-windows-x64.exe`).
* **macOS:** Download the `.zip` file (e.g., `mirrorbast-vX.Y.Z-macos-arm64.zip`). *(Note: Filename might vary slightly based on architecture)*.
* **Linux (Debian/Ubuntu):** Download the `.deb` file (e.g., `mirrorbast-vX.Y.Z-linux-amd64.deb`).

### Running the Application

#### Windows

1.  Download the `mirrorbast-vX.Y.Z-windows-x64.exe` installer.
2.  Double-click the downloaded `.exe` file to run the installer.
3.  **Important:** Windows Defender SmartScreen will likely show a warning ("Windows protected your PC") because the application is not code-signed by a recognized publisher.
    * Click **"More info"**.
    * Then click **"Run anyway"**.
4.  Follow the installer prompts. The application should install and launch.

#### macOS

1.  Download the `mirrorbast-vX.Y.Z-macos-arm64.zip` file.
2.  Double-click the downloaded `.zip` file to extract the `Mirrorbast.app` application bundle (usually extracts to the same folder, e.g., Downloads).
3.  **Drag the `Mirrorbast.app` icon into your Applications folder.**
4.  **First Launch (Gatekeeper Bypass):** macOS Gatekeeper will likely prevent the app from opening initially because it's from an unidentified developer and hasn't been notarized by Apple. You will probably see a warning like ""Mirrorbast" can't be opened because it is from an unidentified developer".
    * **Right-click** (or Control-click) the Mirrorbast application icon in your Applications folder.
    * Select **"Open"** from the context menu.
    * You might see the same warning again, but this time there should be an **"Open"** button. Click it.
    * You should only need to do this the first time you run this specific version. *(The "damaged" error and the `xattr` command should no longer be necessary with the ZIP distribution).*

#### Linux (Debian/Ubuntu)

1.  Download the `mirrorbast-vX.Y.Z-linux-amd64.deb` file.
2.  You can usually install `.deb` files by double-clicking them in your file manager, which should open a package installer (like Ubuntu Software or GDebi).
3.  Alternatively, you can install it from the terminal:
    ```bash
    # Navigate to the directory where you downloaded the file
    cd ~/Downloads 
    
    # Install the package (replace vX.Y.Z with the actual version)
    sudo dpkg -i mirrorbast-vX.Y.Z-linux-amd64.deb
    
    # If you encounter dependency issues, run:
    sudo apt-get install -f 
    ```
4.  Once installed, you should find Mirrorbast in your application menu.

## Development

If you want to build or modify the application yourself:

1.  Clone the repository: `git clone https://github.com/pmossman/mirrorbast.git`
2.  Navigate into the directory: `cd mirrorbast`
3.  Install dependencies: `npm install`
4.  Run in development mode: `npm start`
5.  Build distributables: `npm run make` (requires the appropriate build environment for the target OS).
