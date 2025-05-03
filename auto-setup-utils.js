// auto-setup-utils.js
// Contains utility functions shared across the auto-setup process.

// --- Simplified Delay Constants (in milliseconds) ---
const DELAYS = {
  SHORT: 100, // For quick actions or brief pauses between checks
  MEDIUM: 500, // For standard waits after clicks, view switches, or initial load settling
  LONG: 2000, // For potentially slower operations like imports or settling after refresh
  POLL: 150, // Interval for polling loops and internal waits
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
  // Ensure appContext itself is provided
  if (!appContext || !appContext.view1 || !appContext.view2) {
    throw new Error(
      `Application context not available for step: ${description}`
    );
  }
  // Determine view number based on webContents ID
  const viewNum =
    view.webContents.id === appContext.view1.webContents.id ? "1" : "2";
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
    throw new Error(
      `View ${viewNum} is not available for step: ${description}`
    );
  }
  try {
    // console.log(`Executing JS in View ${viewNum} (${description}): ${script.substring(0, 100)}...`);
    const result = await view.webContents.executeJavaScript(script, true);
    // console.log(`JS Execution Result (${description}): ${result}`);
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
 * Helper function to introduce a delay.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} Promise resolving after the delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Finds and clicks an element with the specified text content (case-insensitive, trimmed).
 * Scrolls the element into view before clicking. Includes retries and waits.
 * @param {object} appContext - The application context.
 * @param {BrowserView} view - The view to search within.
 * @param {string} elementText - The text content to find on the element.
 * @param {string} stepDescription - Description for logging.
 * @param {string} [selector='button'] - The CSS selector for potential elements (e.g., 'button', 'p', 'button, p').
 * @param {number} [timeout=5000] - Maximum time to wait in ms.
 * @throws {Error} If the element is not found and clicked within the timeout.
 */
const findAndClickElementByText = async (
  appContext,
  view,
  elementText,
  stepDescription,
  selector = "button",
  timeout = 5000
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
                      console.log('Found element:', targetElement.tagName, targetElement.textContent);
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                      // Use POLL delay for the brief wait inside JS execution
                      await new Promise(r => setTimeout(r, ${DELAYS.POLL}));
                      console.log('Clicking element:', targetElement.tagName, targetElement.textContent);
                      targetElement.click();
                      return true;
                  }
                  return false;
              })();
          `,
        stepDescription
      );

      if (clicked) {
        console.log(`Successfully clicked "${elementText}" element.`);
        return;
      }
    } catch (error) {
      if (Date.now() - startTime < timeout - 500) {
        console.warn(
          `Temporary error trying to click "${elementText}" (will retry): ${error.message}`
        );
      } else {
        console.error(
          `Persistent error trying to click "${elementText}": ${error.message}`
        );
        throw new Error(
          `Persistent error trying to click "${elementText}": ${error.message}`
        );
      }
    }
    // Use SHORT delay before retrying find
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
  findAndClickElementByText,
  DELAYS, // Export the constants object
};
