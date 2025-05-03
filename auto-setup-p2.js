// auto-setup-p2.js
// Handles the Player 2 setup phase of the auto-setup process.
// Includes logic to refresh P2 view if initial element finding fails.

const {
  safeExecuteJavaScript,
  delay,
  findAndClickElementByText,
} = require("./auto-setup-utils");

/**
 * Helper function to wait for a view to finish loading after a reload.
 * @param {BrowserView} view - The view to monitor.
 * @returns {Promise<void>} - Promise resolving when 'did-finish-load' fires.
 * @throws {Error} If 'did-fail-load' fires or view is destroyed.
 */
function waitForLoad(view) {
  return new Promise((resolve, reject) => {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return reject(new Error("View unavailable for waitForLoad."));
    }
    let successHandler, failHandler;

    const cleanupListeners = () => {
      if (successHandler)
        view.webContents.removeListener("did-finish-load", successHandler);
      if (failHandler)
        view.webContents.removeListener("did-fail-load", failHandler);
    };

    failHandler = (evt, code, desc, validatedURL) => {
      console.error(
        `View load failed after reload: ${desc} (${code}) URL: ${validatedURL}`
      );
      cleanupListeners();
      reject(new Error(`View load failed after reload: ${desc} (${code})`));
    };
    successHandler = () => {
      if (!view || view.webContents.isDestroyed()) {
        console.warn("View destroyed after reload finished.");
        cleanupListeners();
        reject(new Error("View destroyed after reload finished"));
        return;
      }
      console.log("View finished loading after reload.");
      cleanupListeners();
      resolve();
    };
    view.webContents.once("did-finish-load", successHandler);
    view.webContents.once("did-fail-load", failHandler);
  });
}

/**
 * Executes the setup steps for Player 2.
 * @param {object} appContext - The application context.
 * @param {string} inviteLink - The lobby invite link obtained from P1 setup.
 * @param {string} p2Url - The deck URL for Player 2.
 * @returns {Promise<void>} - Promise resolving when P2 setup is complete.
 * @throws {Error} If any step fails, including the retry after refresh.
 */
async function setupPlayer2(appContext, inviteLink, p2Url) {
  const { view2, mainWindow, setCurrentView, resizeView } = appContext;
  const initialElementFindTimeout = 3000; // Shorter timeout for the first attempt
  const retryElementFindTimeout = 7000; // Original timeout for the retry

  console.log("--- Starting Player 2 Setup Phase ---");

  // Step 7: Load P2 into lobby
  console.log("P2 Setup Step 1 (Overall Step 7): Loading P2 into lobby");
  const p2LoadPromise = new Promise((resolve, reject) => {
    // ... (promise logic remains the same as previous version) ...
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
    "P2 Setup: Adding delay (1000ms) for page settlement after initial load..."
  );
  await delay(1000);

  // Switch view to P2
  console.log("P2 Setup Step 2 (Overall Step 7 cont.): Switching to View 2");
  setCurrentView(2);
  if (mainWindow) {
    mainWindow.setBrowserView(view2);
    resizeView(view2);
  }
  await delay(700); // Delay related to view switching

  // Step 8: Click "Import New Deck" - with refresh logic
  console.log(
    'P2 Setup Step 3 (Overall Step 8): Attempting to click "Import New Deck"'
  );
  try {
    // First attempt with shorter timeout
    await findAndClickElementByText(
      appContext,
      view2,
      "Import New Deck",
      "Click Import New Deck P2 (Attempt 1)",
      "p, button",
      initialElementFindTimeout
    );
    console.log("Successfully clicked 'Import New Deck' on first attempt.");
  } catch (error) {
    // Check if the error is specifically a timeout error from findAndClickElementByText
    // (We assume the timeout error message includes "Timed out")
    if (error.message && error.message.includes("Timed out")) {
      console.warn(
        `'Import New Deck' not found within ${initialElementFindTimeout}ms. Attempting refresh...`
      );

      // --- Refresh Logic ---
      try {
        if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) {
          throw new Error("View 2 unavailable for refresh.");
        }
        console.log("Reloading View 2...");
        view2.webContents.reload(); // Trigger reload

        // Wait for the reload to complete
        await waitForLoad(view2);

        // Add delay after refresh settlement
        console.log(
          "P2 Setup: Adding delay (1500ms) for page settlement after refresh..."
        );
        await delay(1500);

        // Retry finding and clicking the element with the original timeout
        console.log(
          'P2 Setup: Retrying click "Import New Deck" after refresh...'
        );
        await findAndClickElementByText(
          appContext,
          view2,
          "Import New Deck",
          "Click Import New Deck P2 (Attempt 2 after Refresh)",
          "p, button",
          retryElementFindTimeout
        );
        console.log(
          "Successfully clicked 'Import New Deck' on second attempt after refresh."
        );
      } catch (refreshError) {
        console.error("Error during refresh or second attempt:", refreshError);
        // If the refresh or the second attempt fails, re-throw the error to fail the setup
        throw new Error(
          `Failed to find/click 'Import New Deck' even after refresh: ${refreshError.message}`
        );
      }
      // --- End Refresh Logic ---
    } else {
      // If the error wasn't a timeout, re-throw it immediately
      console.error(
        "Non-timeout error during first attempt to click 'Import New Deck':",
        error
      );
      throw error;
    }
  }
  // If we get here, the button was clicked successfully (either first or second attempt)
  await delay(600); // Continue with delay after successful click

  // Step 9: Wait for P2 deck input box
  console.log(
    "P2 Setup Step 4 (Overall Step 9): Waiting for P2 deck input box..."
  );
  await new Promise((resolve, reject) => {
    // ... (promise logic remains the same as previous version) ...
    let attempts = 0;
    const maxAttempts = 60; // ~9 seconds
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
          // Avoid infinite loop
          clearInterval(interval);
          reject(new Error(`Failed check P2 input: ${err.message}`));
        }
      }
    }, 150);
  });
  await delay(300);

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
  await delay(500);

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
    6000
  );
  await delay(1200);

  // Step 12: Click "Ready" button
  console.log('P2 Setup Step 7 (Overall Step 12): Clicking "Ready" button');
  await findAndClickElementByText(
    appContext,
    view2,
    "Ready",
    "Click Ready Button P2",
    "button"
  );
  await delay(500);

  console.log("--- Player 2 Setup Phase Complete ---");
}

module.exports = { setupPlayer2 };
