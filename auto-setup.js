// auto-setup.js
// Orchestrates the automated game setup process by calling phase-specific modules.

const { setupPlayer1 } = require("./auto-setup-p1");
const { setupPlayer2 } = require("./auto-setup-p2");
const { finalizeSetup } = require("./auto-setup-finalize");

/**
 * Performs the automated setup process by orchestrating different phases.
 * @param {Electron.IpcMainEvent} event - The IPC event object for replying.
 * @param {string} p1Url - The deck URL for Player 1.
 * @param {string} p2Url - The deck URL for Player 2.
 * @param {object} context - The application context passed from main.js.
 * Must include: view1, view2, mainWindow, clipboard,
 * setCurrentView, resizeView, getCurrentView.
 */
async function performAutoSetup(event, p1Url, p2Url, context) {
  console.log("Starting auto-setup orchestration...");
  const {
    view1,
    view2,
    mainWindow,
    setCurrentView,
    resizeView,
    getCurrentView,
  } = context;

  // Initial check for view availability
  if (
    !view1?.webContents ||
    view1.webContents.isDestroyed() ||
    !view2?.webContents ||
    view2.webContents.isDestroyed()
  ) {
    console.error("Auto-setup failed: Views unavailable at start.");
    event.reply(
      "auto-setup-error",
      "Required browser views are not initialized."
    );
    return; // Exit early
  }

  try {
    // --- Phase 1: Player 1 Setup ---
    const inviteLink = await setupPlayer1(context, p1Url);
    console.log("Phase 1 (P1 Setup) successful.");

    // --- Phase 2: Player 2 Setup ---
    await setupPlayer2(context, inviteLink, p2Url);
    console.log("Phase 2 (P2 Setup) successful.");

    // --- Phase 3: Finalization ---
    await finalizeSetup(context);
    console.log("Phase 3 (Finalization) successful.");

    // --- Success ---
    console.log("Auto-setup process completed successfully.");
    event.reply("lobby-success"); // Indicate game setup is done

  } catch (error) {
    // --- Error Handling ---
    console.error("Auto-setup failed during orchestration:", error);
    // Don't set game ready on error
    event.reply(
      "auto-setup-error",
      error.message || "An unknown error occurred during auto-setup."
    );

    // Attempt to reset view state to a known good state (P1 active, sidebar expanded)
    try {
      const currentViewNum = getCurrentView(); // Use the function from context
      if (
        mainWindow && !mainWindow.isDestroyed() &&
        currentViewNum !== 1 &&
        view1 && !view1.webContents.isDestroyed()
      ) {
        console.log("Switching back to V1 after error.");
        setCurrentView(1);
        mainWindow.setBrowserView(view1);
        resizeView(view1); // Resize P1
        if (view2 && !view2.webContents.isDestroyed()) {
          resizeView(view2); // Also resize P2
        }
      }
      // Ensure sidebar is expanded after error
      const wc = mainWindow?.webContents;
      if (wc && !wc.isDestroyed()) {
        wc.send("set-sidebar-collapsed", false);
      }
    } catch (resetError) {
      console.error("Failed to reset view state after error:", resetError);
    }
  }
}

// Export the main orchestrator function
module.exports = { performAutoSetup };
