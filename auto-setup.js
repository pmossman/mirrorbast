// auto-setup.js
// Contains the logic for the automated game setup process.

/**
 * Helper function for executing JavaScript safely within a BrowserView's webContents.
 * @param {BrowserView} view - The view (view1 or view2) to execute script in.
 * @param {string} script - The JavaScript code to execute.
 * @param {string} description - A description of the step for logging/error messages.
 * @returns {Promise<any>} Promise resolving with the script result.
 * @throws {Error} If execution fails or the view is invalid.
 */
const safeExecuteJavaScript = async (view, script, description) => {
  // Ensure appContext is available before trying to access view IDs
  if (!appContext || !appContext.view1 || !appContext.view2) {
       throw new Error(`Application context not available for step: ${description}`);
  }
  const viewNum = view.webContents.id === appContext.view1.webContents.id ? '1' : '2'; // Determine view number based on webContents ID
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
      throw new Error(`View ${viewNum} is not available for step: ${description}`);
  }
  try {
      // console.log(`Executing JS in View ${viewNum} (${description}): ${script.substring(0, 100)}...`);
      // Setting userGesture to true can help bypass certain restrictions
      const result = await view.webContents.executeJavaScript(script, true);
      // console.log(`JS Execution Result (${description}): ${result}`);
      return result;
  } catch (error) {
      console.error(`Error executing JavaScript in View ${viewNum} (${description}): ${error.message}`);
      // Rethrow with more context including the description
      throw new Error(`JS execution failed in View ${viewNum} (${description}): ${error.message}`);
  }
};

/**
* Helper function to introduce a delay.
* @param {number} ms - Milliseconds to wait.
* @returns {Promise<void>} Promise resolving after the delay.
*/
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Global variable to hold the context passed from main.js ---
let appContext = null;

/**
* Finds and clicks an element with the specified text content (case-insensitive, trimmed).
* Scrolls the element into view before clicking. Includes retries and waits.
* @param {BrowserView} view - The view to search within.
* @param {string} elementText - The text content to find on the element.
* @param {string} stepDescription - Description for logging.
* @param {string} [selector='button'] - The CSS selector for potential elements (e.g., 'button', 'p', 'button, p').
* @param {number} [timeout=5000] - Maximum time to wait in ms.
* @throws {Error} If the element is not found and clicked within the timeout.
*/
const findAndClickElementByText = async (view, elementText, stepDescription, selector = 'button', timeout = 5000) => {
  const startTime = Date.now();
  const lowerElementText = elementText.toLowerCase();

  while (Date.now() - startTime < timeout) {
      try {
          // Use the provided selector in querySelectorAll
          const clicked = await safeExecuteJavaScript(view, `
              (async () => { // Wrap in async IIAFE to allow await inside
                  const elements = Array.from(document.querySelectorAll('${selector}'));
                  // Find visible, enabled element with matching text
                  const targetElement = elements.find(el =>
                      el.textContent.trim().toLowerCase() === '${lowerElementText}' &&
                      el.offsetParent !== null && // Basic visibility check
                      !el.disabled              // Check if enabled (relevant for buttons/inputs)
                  );
                  if (targetElement) {
                      console.log('Found element:', targetElement.tagName, targetElement.textContent);
                      // *** SCROLL INTO VIEW ***
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                      // Wait briefly for scroll to potentially finish and UI to settle
                      await new Promise(r => setTimeout(r, 150));
                      console.log('Clicking element:', targetElement.tagName, targetElement.textContent);
                      targetElement.click();
                      return true; // Indicate success
                  }
                  return false; // Element not found or not ready
              })();
          `, stepDescription);

          if (clicked) {
              console.log(`Successfully clicked "${elementText}" element.`);
              return; // Exit loop on success
          }
      } catch (error) {
          // Ignore errors during polling unless it's persistent and close to timeout
           if (Date.now() - startTime < timeout - 500) {
              console.warn(`Temporary error trying to click "${elementText}" (will retry): ${error.message}`);
           } else {
               console.error(`Persistent error trying to click "${elementText}": ${error.message}`);
           }
      }
      await delay(300); // Wait slightly longer before retrying
  }

  // If loop finishes without success
  throw new Error(`Timed out waiting for "${elementText}" element (${selector}) in step: ${stepDescription}`);
};


/**
* Performs the automated setup process for starting a game.
* @param {Electron.IpcMainEvent} event - The IPC event object for replying.
* @param {string} p1Url - The deck URL for Player 1.
* @param {string} p2Url - The deck URL for Player 2.
* @param {object} context - The application context.
* @param {BrowserView} context.view1
* @param {BrowserView} context.view2
* @param {BrowserWindow} context.mainWindow
* @param {Electron.Clipboard} context.clipboard
* @param {function(number):void} context.setCurrentView
* @param {function(BrowserView):void} context.resizeView
* @param {function():number} context.getCurrentView
*/
async function performAutoSetup(event, p1Url, p2Url, context) {
  console.log('Starting auto-setup...');
  appContext = context; // Set the context for helpers
  // Destructure context, excluding sendPreview
  const { view1, view2, mainWindow, clipboard, setCurrentView, resizeView, getCurrentView } = appContext;

  if (!view1?.webContents || view1.webContents.isDestroyed() ||
      !view2?.webContents || view2.webContents.isDestroyed()) {
      console.error("Auto-setup failed: Views unavailable at start.");
      event.reply('auto-setup-error', 'Required browser views are not initialized.');
      return;
  }

  try {
      // --- Player 1 Setup ---
      console.log('AutoSetup Step 1: Navigating P1 to home');
      const p1CurrentUrl = view1.webContents.getURL();
      if (!p1CurrentUrl || !p1CurrentUrl.startsWith('https://karabast.net/')) {
          await view1.webContents.loadURL('https://karabast.net'); await delay(500);
      } else { console.log('P1 already at karabast.net.'); }

      console.log('AutoSetup Step 2: Clicking "Create Lobby"');
      await findAndClickElementByText(view1, 'Create Lobby', 'Click Create Lobby P1', 'button', 7000);
      await delay(600);

      console.log('AutoSetup Step 3: Selecting "Private"');
      await safeExecuteJavaScript(view1, ` Array.from(document.querySelectorAll('input[type=radio]')).find(r => r.value === 'Private')?.click(); true; `, 'Select Private Radio');
      await delay(300);

      console.log('AutoSetup Step 4: Filling P1 deck input');
      await safeExecuteJavaScript(view1, ` const input = Array.from(document.querySelectorAll('input[type=text]')).find(el => el.offsetParent !== null && !el.readOnly && !el.disabled); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(p1Url)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); true; } else { throw new Error('Visible P1 deck input not found'); } `, 'Fill P1 Deck Input');
      await delay(300);

      console.log('AutoSetup Step 5: Clicking "Create Game"');
      await findAndClickElementByText(view1, 'Create Game', 'Click Create Game P1', 'button');
      await delay(500);

      // --- Wait for and Extract Invite Link ---
      console.log('AutoSetup Step 6: Waiting for invite link input...');
      const inviteLink = await new Promise((resolve, reject) => {
          let attempts = 0; const maxAttempts = 100;
          const interval = setInterval(async () => {
              if (attempts++ >= maxAttempts) { clearInterval(interval); reject(new Error('Timed out waiting for invite link input')); return; }
              try {
                  if (!view1 || !view1.webContents || view1.webContents.isDestroyed()) { clearInterval(interval); reject(new Error('View 1 unavailable waiting for link.')); return; }
                  const linkValue = await safeExecuteJavaScript(view1, `(() => { const i = Array.from(document.querySelectorAll('input[type=text]')).find(i => i.value.includes('karabast.net/lobby')); return i ? i.value : null; })()`, 'Check Invite Link');
                  if (linkValue) { console.log('Invite link found:', linkValue); clearInterval(interval); resolve(linkValue); }
              } catch (err) { console.warn(`Temp error checking link (Attempt ${attempts}): ${err.message}`); if (attempts >= maxAttempts - 5) { clearInterval(interval); reject(new Error(`Failed check link: ${err.message}`)); } }
          }, 150);
      });
      if (!inviteLink) throw new Error('Invite link could not be extracted');
      clipboard.writeText(inviteLink);

      // --- Player 2 Setup ---
      console.log('AutoSetup Step 7: Loading P2 into lobby');
      const p2LoadPromise = new Promise((resolve, reject) => {
          if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) { return reject(new Error("V2 unavailable loading lobby.")); }
          let successHandler, failHandler;
          failHandler = (evt, code, desc) => { console.error(`P2 lobby load fail: ${desc} (${code})`); if (successHandler) view2.webContents.removeListener('did-finish-load', successHandler); reject(new Error(`P2 lobby load fail: ${desc} (${code})`)); };
          successHandler = () => { if (!view2 || view2.webContents.isDestroyed()) { console.warn("V2 destroyed after load."); reject(new Error("V2 destroyed after load")); return; } console.log("P2 loaded lobby URL."); if(failHandler) view2.webContents.removeListener('did-fail-load', failHandler); resolve(); };
          view2.webContents.once('did-finish-load', successHandler); view2.webContents.once('did-fail-load', failHandler);
          view2.webContents.loadURL(inviteLink).catch(err => { console.error("Error initiating P2 load:", err); view2.webContents.removeListener('did-finish-load', successHandler); view2.webContents.removeListener('did-fail-load', failHandler); reject(err); });
      });
      await p2LoadPromise;

      console.log("Switching to View 2 after lobby load");
      setCurrentView(2);
      if (mainWindow) { mainWindow.setBrowserView(view2); resizeView(view2); }
      // No preview to send
      await delay(700);

      console.log('AutoSetup Step 8: Clicking "Import New Deck" for P2');
      await findAndClickElementByText(view2, 'Import New Deck', 'Click Import New Deck P2', 'p, button', 7000);
      await delay(600);

      console.log('AutoSetup Step 9: Waiting for P2 deck input box...');
      await new Promise((resolve, reject) => {
          let attempts = 0; const maxAttempts = 60;
          const interval = setInterval(async () => {
              if (attempts++ >= maxAttempts) { clearInterval(interval); reject(new Error('Timeout waiting P2 input')); return; }
              try {
                  if (!view2 || !view2.webContents || view2.webContents.isDestroyed()) { clearInterval(interval); reject(new Error('V2 unavailable waiting input.')); return; }
                  const exists = await safeExecuteJavaScript(view2, ` Array.from(document.querySelectorAll('input[type=text]')).filter(el => el.offsetParent !== null && !el.value && !el.readOnly && !el.disabled && !el.placeholder).length > 0; `, 'Check Empty P2 Input (No Placeholder)');
                  if (exists) { clearInterval(interval); console.log('Found empty P2 input without placeholder.'); resolve(); }
              } catch (err) { console.warn(`Temp error checking P2 input (Attempt ${attempts}): ${err.message}`); if (attempts >= maxAttempts - 5) { clearInterval(interval); reject(new Error(`Failed check P2 input: ${err.message}`)); } }
          }, 150);
      });
      await delay(300);

      console.log('AutoSetup Step 10: Filling P2 deck input');
      await safeExecuteJavaScript(view2, ` (async () => { const findInput = () => Array.from(document.querySelectorAll('input[type=text]')).filter(el => el.offsetParent !== null && !el.readOnly && !el.disabled && !el.placeholder).find(el => !el.value); let input = findInput(); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(p2Url)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); console.log('P2 deck URL set.'); return true; } else { console.log('P2 input (no placeholder) retry...'); await new Promise(r => setTimeout(r, 500)); input = findInput(); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(p2Url)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); console.log('P2 deck URL set on retry.'); return true; } else { console.error('P2 empty input (no placeholder) not found'); throw new Error('P2 empty input (no placeholder) not found'); } } })(); `, 'Fill P2 Deck Input (No Placeholder)');
      await delay(500);

      // --- Remaining Steps (11-15) ---

      console.log('AutoSetup Step 11: Clicking "Import Deck" button in P2 View');
      await findAndClickElementByText(view2, 'Import Deck', 'Click Import Deck Button P2', 'button', 6000);
      await delay(1200);

      console.log('AutoSetup Step 12: Clicking "Ready" button in P2 View');
      await findAndClickElementByText(view2, 'Ready', 'Click Ready Button P2', 'button');
      await delay(500);

      console.log('AutoSetup Step 13: Switching back to P1 View');
      setCurrentView(1);
      if (mainWindow) { mainWindow.setBrowserView(view1); resizeView(view1); }
      // No preview to send
      await delay(700);

      console.log('AutoSetup Step 14: Clicking "Ready" button in P1 View');
      await findAndClickElementByText(view1, 'Ready', 'Click Ready Button P1', 'button');
      await delay(500);

      console.log('AutoSetup Step 15: Clicking "Start Game" button in P1 View');
      await findAndClickElementByText(view1, 'Start Game', 'Click Start Game Button P1', 'button');
      await delay(1000);

      console.log('Auto-setup process completed successfully.');
      event.reply('lobby-success');

  } catch (error) {
      console.error('Auto-setup failed:', error);
      event.reply('auto-setup-error', error.message || 'An unknown error occurred during auto-setup.');
      // Attempt to reset view state
      try {
           const currentViewNum = getCurrentView();
           if (mainWindow && currentViewNum !== 1 && view1 && !view1.webContents.isDestroyed()) { console.log("Switching back to V1 after error."); setCurrentView(1); mainWindow.setBrowserView(view1); resizeView(view1); /* No preview */ }
           else if (mainWindow && currentViewNum === 1 && view1 && !view1.webContents.isDestroyed()) { console.log("Reloading V1 after error."); view1.webContents.loadURL('https://karabast.net').catch(err => console.error("Failed reload V1 after error:", err)); }
      } catch (resetError) { console.error("Failed reset view state after error:", resetError); }
  } finally {
      appContext = null; // Clear context
  }
}

// Export the main function
module.exports = { performAutoSetup };
