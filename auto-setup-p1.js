// auto-setup-p1.js
// Handles the Player 1 setup phase of the auto-setup process.

const {
  safeExecuteJavaScript,
  delay,
  findAndClickElementByText,
  DELAYS, // Import simplified delay constants
} = require("./auto-setup-utils");

/**
 * Executes the setup steps for Player 1.
 * @param {object} appContext - The application context.
 * @param {string} p1Url - The deck URL for Player 1.
 * @returns {Promise<string>} - Promise resolving with the extracted invite link.
 * @throws {Error} If any step fails.
 */
async function setupPlayer1(appContext, p1Url) {
  const { view1, clipboard } = appContext;

  console.log("--- Starting Player 1 Setup Phase ---");

  // Step 1: Navigate P1 to home if necessary
  console.log("P1 Setup Step 1: Navigating P1 to home");
  const p1CurrentUrl = view1.webContents.getURL();
  if (!p1CurrentUrl || !p1CurrentUrl.startsWith("https://karabast.net/")) {
    await view1.webContents.loadURL("https://karabast.net");
    await delay(DELAYS.MEDIUM); // Use MEDIUM for load settle
  } else {
    console.log("P1 already at karabast.net.");
  }

  // Step 2: Click "Create Lobby"
  console.log('P1 Setup Step 2: Clicking "Create Lobby"');
  await findAndClickElementByText(
    appContext,
    view1,
    "Create Lobby",
    "Click Create Lobby P1",
    "button",
    7000
  );
  await delay(DELAYS.MEDIUM); // Use MEDIUM

  // Step 3: Select "Private" radio button
  console.log('P1 Setup Step 3: Selecting "Private"');
  await safeExecuteJavaScript(
    appContext,
    view1,
    ` Array.from(document.querySelectorAll('input[type=radio]')).find(r => r.value === 'Private')?.click(); true; `,
    "Select Private Radio"
  );
  await delay(DELAYS.SHORT); // Use SHORT

  // Step 4: Fill P1 deck input
  console.log("P1 Setup Step 4: Filling P1 deck input");
  await safeExecuteJavaScript(
    appContext,
    view1,
    ` const input = Array.from(document.querySelectorAll('input[type=text]')).find(el => el.offsetParent !== null && !el.readOnly && !el.disabled); if (input) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(
      p1Url
    )}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); true; } else { throw new Error('Visible P1 deck input not found'); } `,
    "Fill P1 Deck Input"
  );
  await delay(DELAYS.SHORT); // Use SHORT

  // Step 5: Click "Create Game"
  console.log('P1 Setup Step 5: Clicking "Create Game"');
  await findAndClickElementByText(
    appContext,
    view1,
    "Create Game",
    "Click Create Game P1",
    "button"
  );
  await delay(DELAYS.MEDIUM); // Use MEDIUM

  // Step 6: Wait for and extract invite link
  console.log("P1 Setup Step 6: Waiting for invite link input...");
  const inviteLink = await new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100; // ~15 seconds
    const interval = setInterval(async () => {
      if (attempts++ >= maxAttempts) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for invite link input"));
        return;
      }
      try {
        if (!view1 || !view1.webContents || view1.webContents.isDestroyed()) {
          clearInterval(interval);
          reject(new Error("View 1 unavailable waiting for link."));
          return;
        }
        const linkValue = await safeExecuteJavaScript(
          appContext,
          view1,
          `(() => { const i = Array.from(document.querySelectorAll('input[type=text]')).find(i => i.value.includes('karabast.net/lobby')); return i ? i.value : null; })()`,
          "Check Invite Link"
        );
        if (linkValue) {
          console.log("Invite link found:", linkValue);
          clearInterval(interval);
          resolve(linkValue);
        }
      } catch (err) {
        console.warn(
          `Temp error checking link (Attempt ${attempts}): ${err.message}`
        );
        if (attempts >= maxAttempts - 5) {
          clearInterval(interval);
          reject(new Error(`Failed check link: ${err.message}`));
        }
      }
    }, DELAYS.POLL); // Use POLL constant for interval
  });

  if (!inviteLink) throw new Error("Invite link could not be extracted");
  clipboard.writeText(inviteLink);

  // *** NEW: Add delay for backend lobby preparation ***
  console.log(
    `P1 Setup: Adding delay (${DELAYS.LONG}ms) for backend lobby preparation...`
  );
  await delay(DELAYS.LONG);
  await delay(DELAYS.LONG);

  console.log("--- Player 1 Setup Phase Complete ---");
  return inviteLink;
}

module.exports = { setupPlayer1 };
