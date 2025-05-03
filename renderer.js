// renderer.js - Handles UI logic for index.html

if (window.api) {
  const {
    readClipboard,
    fetchMetadata,
    switchPlayer,
    resetApp,
    autoSetup,
    sidebarStateChanged,
    setGameViewsVisibility,
    toggleSpacebarShortcut, // *** NEW ***
    openExternalUrl, // *** NEW ***
    onLobbySuccess,
    onResetSuccess,
    onResetError,
    onAutoSetupError,
    onTriggerSwitch,
    onSetSidebarCollapsed,
    onCollapseSidebarRequest,
    removeAllListeners,
  } = window.api;

  // --- DOM Elements ---
  const bodyElement = document.body;
  const sidebarElement = document.getElementById("sidebar");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  // Main View Elements
  const mainSidebarContent = document.getElementById("mainSidebarContent");
  const p1Select = document.getElementById("p1Select");
  const p2Select = document.getElementById("p2Select");
  const p1UrlInput = document.getElementById("p1UrlInput");
  const p1AddSelectBtn = document.getElementById("p1AddSelectBtn");
  const p2UrlInput = document.getElementById("p2UrlInput");
  const p2AddSelectBtn = document.getElementById("p2AddSelectBtn");
  const autoSetupBtn = document.getElementById("autoSetupBtn");
  const manageDecksBtn = document.getElementById("manageDecksBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Deck Management View Elements
  const deckManagementView = document.getElementById("deckManagementView");
  const deckInputElement = document.getElementById("deckInput");
  const addDeckBtn = document.getElementById("addDeckBtn");
  const deckListElement = document.getElementById("deckList");
  const backToSetupBtn = document.getElementById("backToSetupBtn");

  // Footer Elements
  const switchBtnFooter = document.getElementById("switchBtn");
  const spacebarToggleBtn = document.getElementById("spacebarToggle"); // *** NEW ***

  // --- State ---
  const DECK_STORAGE_KEY = "savedDecks";
  const LAST_DECK_P1_KEY = "lastDeckP1";
  const LAST_DECK_P2_KEY = "lastDeckP2";
  const SPACEBAR_ENABLED_KEY = "spacebarShortcutEnabled"; // *** NEW ***
  let savedDecks = [];
  let isSidebarCollapsed = false;
  let isSpacebarShortcutEnabled = true; // *** NEW: Default to true ***

  // --- Deck Management Functions ---

  /** Loads decks, last used deck selections, and spacebar state from localStorage. */
  function loadAppState() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]");
      console.log(`Loaded ${savedDecks.length} decks from storage.`);
    } catch (error) {
      console.error("Error loading decks:", error);
      savedDecks = [];
      localStorage.removeItem(DECK_STORAGE_KEY);
    }

    // *** NEW: Load spacebar state ***
    const storedSpacebarState = localStorage.getItem(SPACEBAR_ENABLED_KEY);
    // Default to true if not found or invalid
    isSpacebarShortcutEnabled = storedSpacebarState === 'false' ? false : true;
    console.log(`Loaded spacebar shortcut state: ${isSpacebarShortcutEnabled}`);
    updateSpacebarToggleVisuals(); // Update button appearance
    // Notify main process of the initial state on load
    toggleSpacebarShortcut(isSpacebarShortcutEnabled);
  }

  /** Saves the current decks array to localStorage. */
  function saveDecks() {
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedDecks));
    } catch (error) {
      console.error("Error saving decks:", error);
      alert("Error saving deck list.");
    }
  }

  /** Saves the last selected deck URL for a player */
  function saveLastDeckSelection(player, url) {
    const key = player === 1 ? LAST_DECK_P1_KEY : LAST_DECK_P2_KEY;
    if (url) {
      localStorage.setItem(key, url);
    } else {
      localStorage.removeItem(key);
    }
  }

  /** Fetches metadata, adds a deck, saves, and updates UI. */
  async function handleAddDeck() {
    // Used in Manage Decks view
    const url = deckInputElement.value.trim();
    if (!url) {
      alert("Please enter a deck URL.");
      return;
    }
    if (savedDecks.some((deck) => deck.url === url)) {
      alert("This deck URL is already saved.");
      deckInputElement.value = "";
      return;
    }

    addDeckBtn.textContent = "Adding...";
    addDeckBtn.disabled = true;
    try {
      console.log(`Fetching metadata: ${url}`);
      const metadata = await fetchMetadata(url);
      if (
        metadata &&
        metadata.name &&
        metadata.name !== "Fetch Error" &&
        metadata.name !== "Invalid Metadata"
      ) {
        savedDecks.push({ url, ...metadata });
        saveDecks();
        renderDeckList();
        populateSelects();
        deckInputElement.value = "";
        console.log(`Deck "${metadata.name}" added.`);
      } else {
        alert(
          `Could not fetch valid metadata. Error: ${
            metadata?.name || "Unknown"
          }. Check link.`
        );
        console.warn("Metadata fetch failed:", url, metadata);
      }
    } catch (error) {
      console.error("Error adding deck:", error);
      alert(`Failed add deck: ${error.message}`);
    } finally {
      addDeckBtn.textContent = "Add Deck";
      addDeckBtn.disabled = false;
    }
  }

  /** Renders the list of saved decks in the Deck Management View. */
  function renderDeckList() {
    deckListElement.innerHTML = "";
    if (savedDecks.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No decks saved yet.";
      li.style.fontStyle = "italic";
      li.style.color = "#888";
      deckListElement.appendChild(li);
      return;
    }
    savedDecks.forEach((deck, index) => {
      const li = document.createElement("li");

      // Deck Info Div
      const infoDiv = document.createElement("div");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = deck.name || "Unnamed";
      nameStrong.title = deck.name || "Unnamed";
      const authorSpan = document.createElement("span");
      authorSpan.className = "meta";
      authorSpan.textContent = `by ${deck.author || "Unknown"}`;
      authorSpan.title = `by ${deck.author || "Unknown"}`;
      infoDiv.append(nameStrong, document.createElement("br"), authorSpan);

      // Buttons Div
      const buttonsDiv = document.createElement("div");
      buttonsDiv.className = "deck-buttons"; // Use class for styling

      // *** NEW: Open URL Button ***
      const btnOpenUrl = document.createElement("button");
      btnOpenUrl.textContent = "Open";
      btnOpenUrl.className = "generic open-url-btn"; // Add specific class
      btnOpenUrl.title = `Open deck URL in browser:\n${deck.url}`;
      btnOpenUrl.onclick = (e) => {
          e.stopPropagation();
          console.log(`Requesting to open URL: ${deck.url}`);
          openExternalUrl(deck.url); // Call the API function
      };

      // Refresh Button
      const btnRefresh = document.createElement("button");
      btnRefresh.textContent = "Refresh";
      btnRefresh.className = "generic";
      btnRefresh.title = "Refresh metadata";
      btnRefresh.onclick = async (e) => {
          e.stopPropagation();
          btnRefresh.textContent = "...";
          btnRefresh.disabled = true;
          btnOpenUrl.disabled = true; // Disable other buttons during refresh
          // Find delete button to disable it too
          const btnDelete = li.querySelector(".delete-btn");
          if (btnDelete) btnDelete.disabled = true;

          try {
            const newMeta = await fetchMetadata(deck.url);
            if (
              newMeta &&
              newMeta.name &&
              newMeta.name !== "Fetch Error" &&
              newMeta.name !== "Invalid Metadata"
            ) {
              savedDecks[index] = { url: deck.url, ...newMeta };
              saveDecks();
              renderDeckList(); // Re-render the whole list
              populateSelects(); // Update dropdowns
              console.log(`Refreshed: ${newMeta.name}`);
            } else {
              alert(`Refresh fail: ${newMeta?.name || "Unknown"}`);
              console.warn("Refresh fail:", deck.url, newMeta);
              // Re-enable buttons on failure (renderDeckList will re-enable on success)
              btnRefresh.textContent = "Refresh";
              btnRefresh.disabled = false;
              btnOpenUrl.disabled = false;
              if (btnDelete) btnDelete.disabled = false;
            }
          } catch (error) {
            console.error("Refresh error:", error);
            alert(`Refresh error: ${error.message}`);
            // Re-enable buttons on error
            btnRefresh.textContent = "Refresh";
            btnRefresh.disabled = false;
            btnOpenUrl.disabled = false;
            if (btnDelete) btnDelete.disabled = false;
          }
      };

      // Delete Button
      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Delete";
      btnDelete.className = "generic delete-btn"; // Add specific class
      btnDelete.title = "Delete deck";
      btnDelete.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${deck.name || "this deck"}"?`)) {
            savedDecks.splice(index, 1);
            saveDecks();
            renderDeckList();
            populateSelects();
            console.log(`Deleted: ${deck.name || deck.url}`);
          }
      };

      // Append buttons to buttonsDiv
      buttonsDiv.append(btnOpenUrl, btnRefresh, btnDelete); // Open button first

      // Append info and buttons to list item
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
  }


  /** Populates dropdowns and attempts to select the last used deck. */
  function populateSelects() {
    const lastP1 = localStorage.getItem(LAST_DECK_P1_KEY);
    const lastP2 = localStorage.getItem(LAST_DECK_P2_KEY);

    [p1Select, p2Select].forEach((select, index) => {
      const lastSelectedUrl = index === 0 ? lastP1 : lastP2;
      const currentVal = select.value; // Store current value before clearing
      let foundLastSelected = false;
      select.innerHTML = ""; // Clear existing options
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Select Deck...";
      select.append(defaultOpt);

      savedDecks.forEach((deck) => {
        const opt = document.createElement("option");
        opt.value = deck.url;
        opt.textContent = deck.name || "Unnamed Deck";
        opt.title = `${deck.name || "Unnamed Deck"} (${
          deck.author || "Unknown"
        })`;
        // Select if it matches the last used URL for this player
        if (deck.url === lastSelectedUrl) {
          opt.selected = true;
          foundLastSelected = true;
        }
        select.append(opt);
      });

      // If the last selected URL wasn't found (e.g., deleted), try to restore the previous value if it still exists
      if (!foundLastSelected && savedDecks.some(deck => deck.url === currentVal)) {
          select.value = currentVal;
      } else if (!foundLastSelected) {
          select.value = ""; // Otherwise, default to "Select Deck..."
      }
      // If a last selection was found, ensure the select's value reflects it
      if (foundLastSelected) {
          select.value = lastSelectedUrl;
      }
    });
  }

  // --- UI View Switching ---

  /** Shows the main setup/gameplay sidebar view. */
  function showMainSidebarView() {
    // Tell main process to show the game views
    setGameViewsVisibility(true);
    bodyElement.classList.remove("deck-view-active");
    deckManagementView.style.display = "none";
    mainSidebarContent.style.display = "flex";
    console.log("Switched to Main Sidebar View (Game Views Visible)");
  }

  /** Shows the deck management sidebar view (full window). */
  function showDeckManagementView() {
    // Tell main process to hide the game views
    setGameViewsVisibility(false);
    bodyElement.classList.add("deck-view-active");
    setSidebarCollapsed(false); // Ensure sidebar CSS is expanded when showing deck management
    mainSidebarContent.style.display = "none";
    deckManagementView.style.display = "flex";
    renderDeckList();
    console.log("Switched to Deck Management View (Game Views Hidden)");
  }

  /** Sets the collapsed state of the sidebar and notifies main process */
  function setSidebarCollapsed(collapsed) {
    // Don't allow collapsing if deck view is active (it forces expanded)
    if (bodyElement.classList.contains("deck-view-active") && collapsed) {
      console.log("Sidebar collapse ignored (deck view active).");
      return;
    }
    if (isSidebarCollapsed === collapsed) return; // No change

    isSidebarCollapsed = collapsed;
    bodyElement.classList.toggle("sidebar-collapsed", isSidebarCollapsed);
    sidebarToggleBtn.textContent = isSidebarCollapsed ? "☰" : "✕"; // Change icon
    // Notify main process of the width change
    sidebarStateChanged(isSidebarCollapsed);
    console.log(`Sidebar collapsed state set to: ${isSidebarCollapsed}`);
  }

  /** Toggles the collapsed state of the sidebar */
  function toggleSidebar() {
    // Prevent toggle if deck management view is active (it should stay expanded)
    if (bodyElement.classList.contains("deck-view-active")) {
      console.log("Sidebar toggle ignored (deck view active).");
      return;
    }
    setSidebarCollapsed(!isSidebarCollapsed);
  }

  // --- Spacebar Shortcut Toggle Functions ---

  /** Updates the visual appearance of the spacebar toggle button. */
  function updateSpacebarToggleVisuals() {
    if (isSpacebarShortcutEnabled) {
      spacebarToggleBtn.textContent = "Enabled";
      spacebarToggleBtn.classList.add("enabled");
      spacebarToggleBtn.classList.remove("disabled");
      spacebarToggleBtn.title = "Spacebar shortcut is ENABLED. Click to disable.";
    } else {
      spacebarToggleBtn.textContent = "Disabled";
      spacebarToggleBtn.classList.add("disabled");
      spacebarToggleBtn.classList.remove("enabled");
      spacebarToggleBtn.title = "Spacebar shortcut is DISABLED. Click to enable.";
    }
  }

  /** Handles clicking the spacebar toggle button. */
  function handleSpacebarToggle() {
    isSpacebarShortcutEnabled = !isSpacebarShortcutEnabled; // Flip the state
    console.log(`Spacebar shortcut toggled to: ${isSpacebarShortcutEnabled}`);

    // Save the new state to localStorage
    localStorage.setItem(SPACEBAR_ENABLED_KEY, isSpacebarShortcutEnabled);

    // Update the button's appearance
    updateSpacebarToggleVisuals();

    // Tell the main process to enable/disable the global shortcut
    toggleSpacebarShortcut(isSpacebarShortcutEnabled);

    // *** IMPORTANT: Unfocus the button immediately after clicking ***
    // This prevents accidentally toggling it back if the user hits spacebar right away.
    spacebarToggleBtn.blur();
  }


  // --- Event Handlers ---

  /** Handles adding/selecting a deck from quick-add inputs */
  async function handleAddAndSelectDeck(
    urlInputEl,
    targetSelectEl,
    addButtonEl,
    playerNum
  ) {
    const url = urlInputEl.value.trim();
    if (!url) {
      alert("Please paste a deck URL.");
      return;
    }

    const originalButtonText = addButtonEl.textContent;
    addButtonEl.textContent = "...";
    addButtonEl.disabled = true;
    try {
      const existingDeck = savedDecks.find((deck) => deck.url === url);
      if (existingDeck) {
        console.log("Deck already saved, selecting it.");
        populateSelects(); // Repopulate to ensure list is current
        targetSelectEl.value = url; // Set the value
        saveLastDeckSelection(playerNum, url); // Save selection
        urlInputEl.value = ""; // Clear input
      } else {
        console.log(`Fetching metadata for quick add: ${url}`);
        const metadata = await fetchMetadata(url);
        if (
          metadata &&
          metadata.name &&
          metadata.name !== "Fetch Error" &&
          metadata.name !== "Invalid Metadata"
        ) {
          savedDecks.push({ url, ...metadata });
          saveDecks();
          populateSelects();
          targetSelectEl.value = url; // Set the value after populating
          saveLastDeckSelection(playerNum, url); // Save selection
          urlInputEl.value = ""; // Clear input
          console.log(`Deck "${metadata.name}" added and selected.`);
        } else {
          alert(
            `Could not fetch valid metadata. Error: ${
              metadata?.name || "Unknown"
            }. Check link.`
          );
          console.warn("Metadata fetch failed:", url, metadata);
        }
      }
    } catch (error) {
      console.error("Error adding/selecting deck:", error);
      alert(`Failed add/select deck: ${error.message}`);
    } finally {
      addButtonEl.textContent = originalButtonText;
      addButtonEl.disabled = false;
    }
  }

  /** Handles the click event for the Auto Setup button. */
  function handleAutoSetup() {
    // Ensure we're not in deck management view
    if (bodyElement.classList.contains("deck-view-active")) {
      console.log("Auto Setup ignored (deck view active).");
      return;
    }
    const p1Url = p1Select.value;
    const p2Url = p2Select.value;
    if (!p1Url) {
      alert("Please select a deck for Player 1.");
      p1Select.focus();
      return;
    }
    if (!p2Url) {
      alert("Please select a deck for Player 2.");
      p2Select.focus();
      return;
    }
    saveLastDeckSelection(1, p1Url);
    saveLastDeckSelection(2, p2Url);
    console.log(`Starting auto-setup: P1=${p1Url}, P2=${p2Url}`);
    autoSetupBtn.textContent = "Setting Up...";
    autoSetupBtn.disabled = true;
    switchBtnFooter.disabled = true;
    resetBtn.disabled = true;
    manageDecksBtn.disabled = true;
    p1AddSelectBtn.disabled = true;
    p2AddSelectBtn.disabled = true;
    spacebarToggleBtn.disabled = true; // Disable toggle during setup
    autoSetup(p1Url, p2Url);
  }

  /** Handles the click event for the Reset button. */
  function handleReset() {
    // Ensure we're not in deck management view
    if (bodyElement.classList.contains("deck-view-active")) {
      console.log("Reset ignored (deck view active).");
      return;
    }
    if (confirm("Reset both player views to Karabast home?")) {
      console.log("Requesting reset...");
      resetBtn.textContent = "Resetting...";
      resetBtn.disabled = true;
      autoSetupBtn.disabled = true;
      switchBtnFooter.disabled = true;
      manageDecksBtn.disabled = true;
      p1AddSelectBtn.disabled = true;
      p2AddSelectBtn.disabled = true;
      spacebarToggleBtn.disabled = true; // Disable toggle during reset
      resetApp();
    }
  }

  // --- IPC Event Listeners ---

  /** Handles successful lobby join or auto-setup completion. */
  function onGameReady() {
    console.log("Setup complete.");
    autoSetupBtn.textContent = "Auto Setup Game";
    autoSetupBtn.disabled = false;
    switchBtnFooter.disabled = false;
    resetBtn.disabled = false;
    resetBtn.textContent = "Reset";
    manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false;
    p2AddSelectBtn.disabled = false;
    spacebarToggleBtn.disabled = false; // Re-enable toggle
    // Ensure main view is shown (which also ensures game views are visible)
    showMainSidebarView();
    // Auto-collapse request is handled separately via onCollapseSidebarRequest
  }

  /** Handles errors during lobby join or auto-setup. */
  function onSetupError(errorMessage) {
    console.error("Setup Error:", errorMessage);
    alert(`Setup failed: ${errorMessage}`);
    autoSetupBtn.textContent = "Auto Setup Game";
    autoSetupBtn.disabled = false;
    switchBtnFooter.disabled = false;
    resetBtn.disabled = false;
    resetBtn.textContent = "Reset";
    manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false;
    p2AddSelectBtn.disabled = false;
    spacebarToggleBtn.disabled = false; // Re-enable toggle
    setSidebarCollapsed(false); // Ensure sidebar is expanded on error
    showMainSidebarView(); // Ensure main view is shown (makes game views visible)
  }

  /** Handles successful application reset. */
  function onResetComplete() {
    console.log("Reset successful.");
    resetBtn.textContent = "Reset";
    resetBtn.disabled = false;
    autoSetupBtn.disabled = false;
    switchBtnFooter.disabled = false;
    manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false;
    p2AddSelectBtn.disabled = false;
    spacebarToggleBtn.disabled = false; // Re-enable toggle

    // *** MODIFIED: DO NOT clear last deck selections ***
    // saveLastDeckSelection(1, ""); // REMOVED
    // saveLastDeckSelection(2, ""); // REMOVED

    populateSelects(); // Repopulate - will now re-select last used if they exist
    setSidebarCollapsed(false); // Ensure sidebar is expanded
    showMainSidebarView(); // Ensure main view shown (makes game views visible)
  }

  /** Handles errors during application reset. */
  function onResetFail(errorMessage) {
    console.error("Reset Error:", errorMessage);
    alert(`Reset failed: ${errorMessage}`);
    resetBtn.textContent = "Reset";
    resetBtn.disabled = false;
    autoSetupBtn.disabled = false;
    switchBtnFooter.disabled = false;
    manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false;
    p2AddSelectBtn.disabled = false;
    spacebarToggleBtn.disabled = false; // Re-enable toggle
    setSidebarCollapsed(false); // Ensure sidebar is expanded
    showMainSidebarView(); // Ensure main view shown (makes game views visible)
    // Repopulate selects even on failure, might fix visual state
    populateSelects();
  }

  /** Handles the trigger to switch players (e.g., from Spacebar). */
  function handleTriggerSwitch() {
    // *** NEW: Only switch if shortcut is enabled AND not in deck view ***
    if (isSpacebarShortcutEnabled && !bodyElement.classList.contains("deck-view-active")) {
      console.log("Renderer: Trigger switch received via Spacebar (and enabled).");
      switchPlayer(); // Call the exposed API function
    } else if (!isSpacebarShortcutEnabled) {
      console.log("Renderer: Trigger switch ignored (shortcut disabled).");
    } else {
      console.log("Renderer: Trigger switch ignored (deck view active).");
    }
  }

  /** Handles message from main process to set sidebar state */
  function handleSetSidebarCollapsed(collapsed) {
    console.log(
      `Renderer: Received request to set sidebar collapsed: ${collapsed}`
    );
    setSidebarCollapsed(collapsed);
  }

  /** Handles request from main process (via auto-setup) to collapse */
  function handleCollapseRequest() {
    // Only collapse if not in deck management view
    if (!bodyElement.classList.contains("deck-view-active")) {
      console.log(
        "Renderer: Received request to collapse sidebar after auto-setup."
      );
      setSidebarCollapsed(true);
    } else {
      console.log("Renderer: Collapse request ignored (deck view active).");
    }
  }

  // --- Initialization ---

  /** Sets up all event listeners for UI elements and IPC events. */
  function setupEventListeners() {
    sidebarToggleBtn.addEventListener("click", toggleSidebar);
    autoSetupBtn.addEventListener("click", handleAutoSetup);
    resetBtn.addEventListener("click", handleReset);
    manageDecksBtn.addEventListener("click", showDeckManagementView); // Shows deck view, hides game views
    p1AddSelectBtn.addEventListener("click", () =>
      handleAddAndSelectDeck(p1UrlInput, p1Select, p1AddSelectBtn, 1)
    );
    p2AddSelectBtn.addEventListener("click", () =>
      handleAddAndSelectDeck(p2UrlInput, p2Select, p2AddSelectBtn, 2)
    );
    // Save selection on change
    p1Select.addEventListener("change", () =>
      saveLastDeckSelection(1, p1Select.value)
    );
    p2Select.addEventListener("change", () =>
      saveLastDeckSelection(2, p2Select.value)
    );
    // Deck Management View listeners
    addDeckBtn.addEventListener("click", handleAddDeck);
    backToSetupBtn.addEventListener("click", showMainSidebarView); // Shows main view, shows game views

    // Footer listeners
    switchBtnFooter.addEventListener("click", () => {
      // Only allow switch via button if not in deck view (spacebar check is separate)
      if (!bodyElement.classList.contains("deck-view-active")) {
        switchPlayer();
      } else {
        console.log("Switch button ignored (deck view active).");
      }
    });
    // *** NEW: Spacebar Toggle Listener ***
    spacebarToggleBtn.addEventListener("click", handleSpacebarToggle);


    // IPC Listeners
    onLobbySuccess(onGameReady);
    onAutoSetupError(onSetupError);
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    onTriggerSwitch(handleTriggerSwitch); // Triggered by main process (spacebar)
    onSetSidebarCollapsed(handleSetSidebarCollapsed);
    onCollapseSidebarRequest(handleCollapseRequest);

    window.addEventListener("beforeunload", () => {
      console.log("Removing IPC listeners.");
      if (removeAllListeners) {
        try {
          removeAllListeners("lobby-success");
          removeAllListeners("auto-setup-error");
          removeAllListeners("reset-success");
          removeAllListeners("reset-error");
          removeAllListeners("trigger-switch");
          removeAllListeners("set-sidebar-collapsed");
          removeAllListeners("collapse-sidebar");
        } catch (e) {
          console.error("Error removing listeners:", e);
        }
      }
    });
    console.log("Event listeners set up.");
  }

  /** Initializes the renderer application. */
  function initialize() {
    console.log("Initializing Mirrorbast renderer...");
    loadAppState(); // Loads decks AND spacebar state
    populateSelects(); // Populates dropdowns, respecting loaded last selections
    setupEventListeners();
    setSidebarCollapsed(false); // Ensure sidebar starts expanded
    showMainSidebarView(); // Ensure main view shown (makes game views visible)
    resetBtn.textContent = "Reset";
    console.log("Renderer initialization complete.");
  }

  document.addEventListener("DOMContentLoaded", initialize);
} else {
  console.error("Fatal Error: window.api not found.");
  alert("Application cannot start.");
}
