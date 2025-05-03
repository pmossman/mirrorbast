// auto-setup-finalize.js
// Handles the finalization phase of the auto-setup process.

const { delay, findAndClickElementByText } = require("./auto-setup-utils");

/**
 * Executes the final steps of the setup process.
 * @param {object} appContext - The application context.
 * @returns {Promise<void>} - Promise resolving when finalization is complete.
 * @throws {Error} If any step fails.
 */
async function finalizeSetup(appContext) {
  const { view1, mainWindow, setCurrentView, resizeView } = appContext;

  console.log("--- Starting Finalization Phase ---");

  // Step 13: Switch back to P1 View
  console.log("Finalize Step 1 (Overall Step 13): Switching back to P1 View");
  setCurrentView(1);
  if (mainWindow) {
    mainWindow.setBrowserView(view1);
    resizeView(view1);
  }
  await delay(2700);

  // Step 14: Click "Ready" button in P1 View
  console.log(
    'Finalize Step 2 (Overall Step 14): Clicking "Ready" button in P1 View'
  );
  await findAndClickElementByText(
    appContext,
    view1,
    "Ready",
    "Click Ready Button P1",
    "button"
  );
  await delay(500);

  // Step 15: Click "Start Game" button in P1 View
  console.log(
    'Finalize Step 3 (Overall Step 15): Clicking "Start Game" button'
  );
  await findAndClickElementByText(
    appContext,
    view1,
    "Start Game",
    "Click Start Game Button P1",
    "button"
  );
  await delay(1000); // Wait a bit after starting the game

  // Step 16: Request sidebar collapse
  console.log("Finalize Step 4 (Overall Step 16): Requesting sidebar collapse");
  if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("collapse-sidebar");
  }

  console.log("--- Finalization Phase Complete ---");
}

module.exports = { finalizeSetup };
