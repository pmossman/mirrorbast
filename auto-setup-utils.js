// auto-setup-utils.js
// Contains utility functions shared across the auto-setup process.

// --- Simplified Delay Constants (in milliseconds) ---
const DELAYS = {
  SHORT: 50,
  MEDIUM: 100,
  LONG: 200,
  POLL: 150,
};

/**
 * Helper function for executing JavaScript safely within a BrowserView's webContents.
 * @param {object} appContext - The application context (must include view1, view2).
 * @param {BrowserView} view - The view (view1 or view2) to execute script in.
 * @param {string} script - The JavaScript code to execute.
 * @param {string} description - A description of the step for logging/error messages.
 * @returns {Promise<any>} Promise resolving with the script result.
 * @throws {Error} If execution fails or the view is invalid.
 */
const safeExecuteJavaScript = async (appContext, view, script, description) => {
  if (!appContext || !appContext.view1 || !appContext.view2) {
    throw new Error(
      `Application context not available for step: ${description}`
    );
  }
  const viewNum =
    view.webContents.id === appContext.view1.webContents.id ? "1" : "2";
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
    throw new Error(
      `View ${viewNum} is not available for step: ${description}`
    );
  }
  try {
    const result = await view.webContents.executeJavaScript(script, true);
    return result;
  } catch (error) {
    console.error(
      `Error executing JavaScript in View ${viewNum} (${description}): ${error.message}`
    );
    throw new Error(
      `JS execution failed in View ${viewNum} (${description}): ${error.message}`
    );
  }
};

/**
 * Basic helper function to introduce a delay.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} Promise resolving after the delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * *** NEW: Delay function that shows spinner in renderer ***
 * @param {object} appContext - The application context (must include mainWindow).
 * @param {number} durationMs - Milliseconds to wait.
 * @returns {Promise<void>} Promise resolving after the delay.
 */
const delayWithSpinner = async (appContext, durationMs) => {
  const webContents = appContext.mainWindow?.webContents;
  let spinnerShown = false; // Track if we actually showed it

  if (webContents && !webContents.isDestroyed()) {
    // Send message to show spinner
    webContents.send("show-spinner");
    spinnerShown = true; // Assume it was shown
  } else {
    console.warn("Cannot show spinner: mainWindow webContents unavailable.");
  }

  try {
    // Wait for the specified duration
    await delay(durationMs);
  } finally {
    // Only hide if we actually showed it
    if (spinnerShown && webContents && !webContents.isDestroyed()) {
      webContents.send("hide-spinner");
    }
  }
};

/**
 * Finds and clicks an element with the specified text content (case-insensitive, trimmed).
 * Scrolls the element into view before clicking. Includes retries and waits.
 * @param {object} appContext - The application context.
 * @param {BrowserView} view - The view to search within.
 * @param {string} elementText - The text content to find on the element.
 * @param {string} stepDescription - Description for logging.
 * @param {string} [selector='button'] - The CSS selector for potential elements (e.g., 'button', 'p', 'button, p').
 * @param {number} [timeout=7000] - Maximum time to wait in ms.
 * @throws {Error} If the element is not found and clicked within the timeout.
 */
const findAndClickElementByText = async (
  appContext,
  view,
  elementText,
  stepDescription,
  selector = "button",
  timeout = 7000
) => {
  const startTime = Date.now();
  const lowerElementText = elementText.toLowerCase();

  while (Date.now() - startTime < timeout) {
    try {
      const clicked = await safeExecuteJavaScript(
        appContext,
        view,
        `
              (async () => { // Wrap in async IIAFE to allow await inside
                  const elements = Array.from(document.querySelectorAll('${selector}'));
                  const targetElement = elements.find(el =>
                      el.textContent.trim().toLowerCase() === '${lowerElementText}' &&
                      el.offsetParent !== null &&
                      !el.disabled
                  );
                  if (targetElement) {
                      // console.log('Found element:', targetElement.tagName, targetElement.textContent);
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                      await new Promise(r => setTimeout(r, ${DELAYS.POLL}));
                      // console.log('Clicking element:', targetElement.tagName, targetElement.textContent);
                      targetElement.click();
                      return true;
                  }
                  return false;
              })();
          `,
        stepDescription
      );

      if (clicked) {
        // console.log(`Successfully clicked "${elementText}" element.`);
        return;
      }
    } catch (error) {
      if (Date.now() - startTime < timeout - 500) {
        // console.warn(`Temporary error trying to click "${elementText}" (will retry): ${error.message}`);
      } else {
        console.error(
          `Persistent error trying to click "${elementText}": ${error.message}`
        );
        throw new Error(
          `Persistent error trying to click "${elementText}": ${error.message}`
        );
      }
    }
    // Use SHORT delay before retrying find (no spinner needed for retry wait)
    await delay(DELAYS.SHORT);
  }

  throw new Error(
    `Timed out waiting for "${elementText}" element (${selector}) in step: ${stepDescription}`
  );
};

// Export utilities AND the delays object
module.exports = {
  safeExecuteJavaScript,
  delay,
  delayWithSpinner, // Export new spinner delay
  findAndClickElementByText,
  DELAYS,
};
