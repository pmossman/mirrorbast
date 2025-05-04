// auto-setup-p2.js
// Handles the Player 2 setup phase of the auto-setup process.

const {
  safeExecuteJavaScript,
  delay, // Keep basic delay for polling loop internal waits
  delayWithSpinner, // Use the spinner version for step delays
  findAndClickElementByText,
  DELAYS,
} = require("./auto-setup-utils");

/**
 * Executes the setup steps for Player 2.
 * @param {object} appContext - The application context.
 * @param {string} inviteLink - The lobby invite link obtained from P1 setup.
 * @param {string} p2Url - The deck URL for Player 2.
 * @returns {Promise<void>} - Promise resolving when P2 setup is complete.
 * @throws {Error} If any step fails.
 */
async function setupPlayer2(appContext, inviteLink, p2Url) {
  setTimeout(() => {
    
  }, 500);
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Give the lobby some time to settle

  const { view2, mainWindow, setCurrentView, resizeView } = appContext;
  const elementFindTimeout = 7000; // Standard timeout for finding elements

  console.log("--- Starting Player 2 Setup Phase ---");

  // Step 7: Load P2 into lobby
  console.log("P2 Setup Step 1 (Overall Step 7): Loading P2 into lobby");
  const p2LoadPromise = new Promise((resolve, reject) => {
    // ... (promise logic remains the same) ...
    if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) {
      return reject(new Error("V2 unavailable loading lobby."));
    }
    let successHandler, failHandler;
    const cleanupListeners = () => {
      if (successHandler)
        view2.webContents.removeListener("did-finish-load", successHandler);
      if (failHandler)
        view2.webContents.removeListener("did-fail-load", failHandler);
    };
    failHandler = (evt, code, desc) => {
      console.error(`P2 lobby load fail: ${desc} (${code})`);
      cleanupListeners();
      reject(new Error(`P2 lobby load fail: ${desc} (${code})`));
    };
    successHandler = () => {
      if (!view2 || view2.webContents.isDestroyed()) {
        console.warn("V2 destroyed after load.");
        cleanupListeners();
        reject(new Error("V2 destroyed after load"));
        return;
      }
      console.log("P2 loaded lobby URL (did-finish-load).");
      cleanupListeners();
      resolve();
    };
    view2.webContents.once("did-finish-load", successHandler);
    view2.webContents.once("did-fail-load", failHandler);
    view2.webContents.loadURL(inviteLink).catch((err) => {
      console.error("Error initiating P2 load:", err);
      cleanupListeners();
      reject(err);
    });
  });
  await p2LoadPromise;

  // Add delay for page settlement
  console.log(
    `P2 Setup: Adding delay (${DELAYS.MEDIUM}ms) for page settlement after initial load...`
  );
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Use spinner delay

  // Switch view to P2
  console.log("P2 Setup Step 2 (Overall Step 7 cont.): Switching to View 2");
  setCurrentView(2);
  if (mainWindow) {
    mainWindow.setBrowserView(view2);
    resizeView(view2);
  }
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Use spinner delay

  // Step 8: Click "Import New Deck" (Single attempt)
  console.log('P2 Setup Step 3 (Overall Step 8): Clicking "Import New Deck"');
  await findAndClickElementByText(
    appContext,
    view2,
    "Import New Deck",
    "Click Import New Deck P2",
    "p, button",
    elementFindTimeout
  );
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Use spinner delay

  // Step 9: Wait for P2 deck input box
  console.log(
    "P2 Setup Step 4 (Overall Step 9): Waiting for P2 deck input box..."
  );
  // Note: Polling loop doesn't use delayWithSpinner
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
      if (attempts++ >= maxAttempts) {
        clearInterval(interval);
        reject(new Error("Timeout waiting P2 input"));
        return;
      }
      try {
        if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) {
          clearInterval(interval);
          reject(new Error("V2 unavailable waiting input."));
          return;
        }
        const exists = await safeExecuteJavaScript(
          appContext,
          view2,
          ` Array.from(document.querySelectorAll('input[type=text]')).filter(el => el.offsetParent !== null && !el.value && !el.readOnly && !el.disabled && !el.placeholder).length > 0; `,
          "Check Empty P2 Input (No Placeholder)"
        );
        if (exists) {
          clearInterval(interval);
          console.log("Found empty P2 input without placeholder.");
          resolve();
        }
      } catch (err) {
        console.warn(
          `Temp error checking P2 input (Attempt ${attempts}): ${err.message}`
        );
        if (attempts >= maxAttempts - 5) {
          clearInterval(interval);
          reject(new Error(`Failed check P2 input: ${err.message}`));
        }
      }
    }, DELAYS.POLL);
  });
  await delayWithSpinner(appContext, DELAYS.SHORT); // Use spinner delay

  // Step 10: Fill P2 deck input
  console.log("P2 Setup Step 5 (Overall Step 10): Filling P2 deck input");
  await safeExecuteJavaScript(
    appContext,
    view2,
    ` (async () => { const findInput = () => Array.from(document.querySelectorAll('input[type=text]')).filter(el => el.offsetParent !== null && !el.readOnly && !el.disabled && !el.placeholder).find(el => !el.value); let input = findInput(); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(
      p2Url
    )}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); console.log('P2 deck URL set.'); return true; } else { console.log('P2 input (no placeholder) retry...'); await new Promise(r => setTimeout(r, 500)); input = findInput(); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(
      p2Url
    )}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); console.log('P2 deck URL set on retry.'); return true; } else { console.error('P2 empty input (no placeholder) not found'); throw new Error('P2 empty input (no placeholder) not found'); } } })(); `,
    "Fill P2 Deck Input (No Placeholder)"
  );
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Use spinner delay

  // Step 11: Click "Import Deck" button
  console.log(
    'P2 Setup Step 6 (Overall Step 11): Clicking "Import Deck" button'
  );
  await findAndClickElementByText(
    appContext,
    view2,
    "Import Deck",
    "Click Import Deck Button P2",
    "button",
    elementFindTimeout
  );
  await delayWithSpinner(appContext, DELAYS.LONG); // Use spinner delay

  // Step 12: Click "Ready" button
  console.log('P2 Setup Step 7 (Overall Step 12): Clicking "Ready" button');
  await findAndClickElementByText(
    appContext,
    view2,
    "Ready",
    "Click Ready Button P2",
    "button",
    elementFindTimeout
  );
  await delayWithSpinner(appContext, DELAYS.MEDIUM); // Use spinner delay

  console.log("--- Player 2 Setup Phase Complete ---");
}

module.exports = { setupPlayer2 };
