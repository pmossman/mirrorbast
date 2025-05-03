// renderer.js - Handles UI logic for index.html

if (window.api) {
  const {
    readClipboard,
    fetchMetadata,
    switchPlayer, // Still sends the request to main
    resetApp,
    autoSetup,
    sidebarStateChanged,
    setGameViewsVisibility,
    toggleSpacebarShortcut,
    openExternalUrl,
    onLobbySuccess,
    onResetSuccess,
    onResetError,
    onAutoSetupError,
    onTriggerSwitch, // Listens for spacebar trigger from main
    onPlayerSwitched, // Listens for confirmation from main
    onSetSidebarCollapsed,
    onCollapseSidebarRequest,
    removeAllListeners,
  } = window.api;

  // --- DOM Elements ---
  const bodyElement = document.body;
  const contentElement = document.getElementById("content");
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
  const spacebarToggleBtn = document.getElementById("spacebarToggle");
  const activePlayerIndicator = document.getElementById(
    "activePlayerIndicator"
  ); // *** NEW ***

  // --- State ---
  const DECK_STORAGE_KEY = "savedDecks";
  const LAST_DECK_P1_KEY = "lastDeckP1";
  const LAST_DECK_P2_KEY = "lastDeckP2";
  const SPACEBAR_ENABLED_KEY = "spacebarShortcutEnabled";
  let savedDecks = [];
  let isSidebarCollapsed = false;
  let isSpacebarShortcutEnabled = true;
  let activePlayer = 1; // Track active player for visuals

  // --- Deck Management Functions ---

  /** Loads decks, last used deck selections, and spacebar state from localStorage. */
  function loadAppState() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]");
    } catch (error) {
      console.error("Error loading decks:", error);
      savedDecks = [];
      localStorage.removeItem(DECK_STORAGE_KEY);
    }
    const storedSpacebarState = localStorage.getItem(SPACEBAR_ENABLED_KEY);
    isSpacebarShortcutEnabled = storedSpacebarState === "false" ? false : true;
    updateSpacebarToggleVisuals();
    toggleSpacebarShortcut(isSpacebarShortcutEnabled); // Inform main process
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
    const url = deckInputElement.value.trim();
    if (!url) return alert("Please enter a deck URL.");
    if (savedDecks.some((deck) => deck.url === url)) {
      deckInputElement.value = "";
      return alert("This deck URL is already saved.");
    }

    addDeckBtn.textContent = "Adding...";
    addDeckBtn.disabled = true;
    try {
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
      const infoDiv = document.createElement("div");
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = deck.name || "Unnamed";
      nameStrong.title = deck.name || "Unnamed";
      const authorSpan = document.createElement("span");
      authorSpan.className = "meta";
      authorSpan.textContent = `by ${deck.author || "Unknown"}`;
      authorSpan.title = `by ${deck.author || "Unknown"}`;
      infoDiv.append(nameStrong, document.createElement("br"), authorSpan);

      const buttonsDiv = document.createElement("div");
      buttonsDiv.className = "deck-buttons";

      const btnOpenUrl = document.createElement("button");
      btnOpenUrl.textContent = "Open";
      btnOpenUrl.className = "generic open-url-btn";
      btnOpenUrl.title = `Open deck URL in browser:\n${deck.url}`;
      btnOpenUrl.onclick = (e) => {
        e.stopPropagation();
        openExternalUrl(deck.url);
      };

      const btnRefresh = document.createElement("button");
      btnRefresh.textContent = "Refresh";
      btnRefresh.className = "generic";
      btnRefresh.title = "Refresh metadata";
      btnRefresh.onclick = async (e) => {
        e.stopPropagation();
        btnRefresh.textContent = "...";
        btnRefresh.disabled = true;
        btnOpenUrl.disabled = true;
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
            renderDeckList();
            populateSelects();
            console.log(`Refreshed: ${newMeta.name}`);
          } else {
            alert(`Refresh fail: ${newMeta?.name || "Unknown"}`);
            console.warn("Refresh fail:", deck.url, newMeta);
            btnRefresh.textContent = "Refresh";
            btnRefresh.disabled = false;
            btnOpenUrl.disabled = false;
            if (btnDelete) btnDelete.disabled = false;
          }
        } catch (error) {
          console.error("Refresh error:", error);
          alert(`Refresh error: ${error.message}`);
          btnRefresh.textContent = "Refresh";
          btnRefresh.disabled = false;
          btnOpenUrl.disabled = false;
          if (btnDelete) btnDelete.disabled = false;
        }
      };

      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Delete";
      btnDelete.className = "generic delete-btn";
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
      buttonsDiv.append(btnOpenUrl, btnRefresh, btnDelete);
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
      const currentVal = select.value;
      let foundLastSelected = false;
      select.innerHTML = "";
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
        if (deck.url === lastSelectedUrl) {
          opt.selected = true;
          foundLastSelected = true;
        }
        select.append(opt);
      });
      if (
        !foundLastSelected &&
        savedDecks.some((deck) => deck.url === currentVal)
      ) {
        select.value = currentVal;
      } else if (!foundLastSelected) {
        select.value = "";
      }
      if (foundLastSelected) {
        select.value = lastSelectedUrl;
      }
    });
  }

  // --- UI View Switching ---

  /** Shows the main setup/gameplay sidebar view. */
  function showMainSidebarView() {
    setGameViewsVisibility(true);
    bodyElement.classList.remove("deck-view-active");
    deckManagementView.style.display = "none";
    mainSidebarContent.style.display = "flex";
  }

  /** Shows the deck management sidebar view (full window). */
  function showDeckManagementView() {
    setGameViewsVisibility(false);
    bodyElement.classList.add("deck-view-active");
    setSidebarCollapsed(false);
    mainSidebarContent.style.display = "none";
    deckManagementView.style.display = "flex";
    renderDeckList();
  }

  /** Sets the collapsed state of the sidebar and notifies main process */
  function setSidebarCollapsed(collapsed) {
    if (bodyElement.classList.contains("deck-view-active") && collapsed) return;
    if (isSidebarCollapsed === collapsed) return;
    isSidebarCollapsed = collapsed;
    bodyElement.classList.toggle("sidebar-collapsed", isSidebarCollapsed);
    sidebarToggleBtn.textContent = isSidebarCollapsed ? "☰" : "✕";
    sidebarStateChanged(isSidebarCollapsed);
  }

  /** Toggles the collapsed state of the sidebar */
  function toggleSidebar() {
    if (bodyElement.classList.contains("deck-view-active")) return;
    setSidebarCollapsed(!isSidebarCollapsed);
  }

  // --- Player Visuals ---

  /** Updates the border and footer indicator based on the active player */
  function updateActivePlayerVisuals(playerNum) {
    activePlayer = playerNum; // Update state
    console.log(`Renderer: Updating visuals for active player ${activePlayer}`);

    // Update content border
    if (contentElement) {
      contentElement.classList.toggle(
        "player1-active-border",
        activePlayer === 1
      );
      contentElement.classList.toggle(
        "player2-active-border",
        activePlayer === 2
      );
    } else {
      console.warn("Content element not found for border update.");
    }

    // Update footer indicator text and class
    if (activePlayerIndicator) {
      if (activePlayer === 1) {
        activePlayerIndicator.textContent = "Player 1 Active";
        activePlayerIndicator.className = "player1-active"; // Set class directly
      } else if (activePlayer === 2) {
        activePlayerIndicator.textContent = "Player 2 Active";
        activePlayerIndicator.className = "player2-active"; // Set class directly
      } else {
        activePlayerIndicator.textContent = "Unknown Player";
        activePlayerIndicator.className = ""; // Clear classes
      }
    } else {
      console.warn("Active player indicator element not found in footer.");
    }
  }

  // --- Spacebar Shortcut Toggle Functions ---

  /** Updates the visual appearance of the spacebar toggle button. */
  function updateSpacebarToggleVisuals() {
    if (isSpacebarShortcutEnabled) {
      spacebarToggleBtn.textContent = "Enabled";
      spacebarToggleBtn.classList.add("enabled");
      spacebarToggleBtn.classList.remove("disabled");
      spacebarToggleBtn.title =
        "Spacebar shortcut is ENABLED. Click to disable.";
    } else {
      spacebarToggleBtn.textContent = "Disabled";
      spacebarToggleBtn.classList.add("disabled");
      spacebarToggleBtn.classList.remove("enabled");
      spacebarToggleBtn.title =
        "Spacebar shortcut is DISABLED. Click to enable.";
    }
  }

  /** Handles clicking the spacebar toggle button. */
  function handleSpacebarToggle() {
    isSpacebarShortcutEnabled = !isSpacebarShortcutEnabled;
    localStorage.setItem(SPACEBAR_ENABLED_KEY, isSpacebarShortcutEnabled);
    updateSpacebarToggleVisuals();
    toggleSpacebarShortcut(isSpacebarShortcutEnabled); // Inform main
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
    if (!url) return alert("Please paste a deck URL.");

    const originalButtonText = addButtonEl.textContent;
    addButtonEl.textContent = "...";
    addButtonEl.disabled = true;
    try {
      const existingDeck = savedDecks.find((deck) => deck.url === url);
      if (existingDeck) {
        populateSelects();
        targetSelectEl.value = url;
        saveLastDeckSelection(playerNum, url);
        urlInputEl.value = "";
      } else {
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
          targetSelectEl.value = url;
          saveLastDeckSelection(playerNum, url);
          urlInputEl.value = "";
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
    if (bodyElement.classList.contains("deck-view-active"))
      return console.log("Auto Setup ignored (deck view active).");
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
    console.log(`Requesting auto-setup: P1=${p1Url}, P2=${p2Url}`);
    // Disable buttons
    autoSetupBtn.textContent = "Setting Up...";
    autoSetupBtn.disabled = true;
    switchBtnFooter.disabled = true;
    resetBtn.disabled = true;
    manageDecksBtn.disabled = true;
    p1AddSelectBtn.disabled = true;
    p2AddSelectBtn.disabled = true;
    spacebarToggleBtn.disabled = true;
    // Send request - Main process will ensure P1 is active first
    autoSetup(p1Url, p2Url);
  }

  /** Handles the click event for the Reset button. */
  function handleReset() {
    if (bodyElement.classList.contains("deck-view-active"))
      return console.log("Reset ignored (deck view active).");
    if (
      confirm(
        "Reset both player views to Karabast home? This will cancel any ongoing auto-setup."
      )
    ) {
      console.log("Requesting reset...");
      resetBtn.textContent = "Resetting...";
      resetBtn.disabled = true;
      autoSetupBtn.disabled = true;
      switchBtnFooter.disabled = true;
      manageDecksBtn.disabled = true;
      p1AddSelectBtn.disabled = true;
      p2AddSelectBtn.disabled = true;
      spacebarToggleBtn.disabled = true;
      resetApp(); // Main process handles aborting setup
    }
  }

  // --- IPC Event Listeners ---

  /** Re-enables controls after a successful operation or reset */
  function enableControls() {
    autoSetupBtn.textContent = "Auto Setup Game";
    autoSetupBtn.disabled = false;
    switchBtnFooter.disabled = false;
    resetBtn.disabled = false;
    resetBtn.textContent = "Reset";
    manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false;
    p2AddSelectBtn.disabled = false;
    spacebarToggleBtn.disabled = false;
  }

  /** Handles successful lobby join or auto-setup completion. */
  function onGameReady() {
    console.log("Setup complete.");
    enableControls();
    showMainSidebarView();
    // Visuals updated by onPlayerSwitched potentially called during finalize
  }

  /** Handles errors during lobby join or auto-setup. */
  function onSetupError(errorMessage) {
    const isAbort =
      errorMessage.includes("abort") || errorMessage.includes("AbortError");
    if (isAbort) {
      console.log(
        "Auto-setup aborted (likely by Reset). UI will be updated by reset handler."
      );
    } else {
      console.error("Setup Error:", errorMessage);
      alert(`Setup failed: ${errorMessage}`);
      enableControls();
      setSidebarCollapsed(false);
      showMainSidebarView();
      // Ensure visuals reset to P1 on error
      updateActivePlayerVisuals(1);
    }
  }

  /** Handles successful application reset. */
  function onResetComplete() {
    console.log("Reset successful.");
    enableControls();
    populateSelects();
    setSidebarCollapsed(false);
    showMainSidebarView();
    // Visuals updated by onPlayerSwitched called from main process reset handler
  }

  /** Handles errors during application reset. */
  function onResetFail(errorMessage) {
    console.error("Reset Error:", errorMessage);
    alert(`Reset failed: ${errorMessage}`);
    enableControls();
    setSidebarCollapsed(false);
    showMainSidebarView();
    populateSelects();
    // Ensure visuals reset to P1 on error
    updateActivePlayerVisuals(1);
  }

  /** Handles the trigger to switch players (e.g., from Spacebar). */
  function handleTriggerSwitch() {
    // Main process handles the actual switch and sends back onPlayerSwitched
    if (
      isSpacebarShortcutEnabled &&
      !bodyElement.classList.contains("deck-view-active")
    ) {
      console.log("Renderer: Requesting player switch (via Spacebar trigger).");
      switchPlayer(); // Just send the request
    } else if (!isSpacebarShortcutEnabled) {
      console.log("Renderer: Trigger switch ignored (shortcut disabled).");
    } else {
      console.log("Renderer: Trigger switch ignored (deck view active).");
    }
  }

  /** Handles message from main process to set sidebar state */
  function handleSetSidebarCollapsed(collapsed) {
    setSidebarCollapsed(collapsed);
  }

  /** Handles request from main process (via auto-setup) to collapse */
  function handleCollapseRequest() {
    if (!bodyElement.classList.contains("deck-view-active")) {
      setSidebarCollapsed(true);
    }
  }

  // --- Initialization ---

  /** Sets up all event listeners for UI elements and IPC events. */
  function setupEventListeners() {
    sidebarToggleBtn.addEventListener("click", toggleSidebar);
    autoSetupBtn.addEventListener("click", handleAutoSetup);
    resetBtn.addEventListener("click", handleReset);
    manageDecksBtn.addEventListener("click", showDeckManagementView);
    p1AddSelectBtn.addEventListener("click", () =>
      handleAddAndSelectDeck(p1UrlInput, p1Select, p1AddSelectBtn, 1)
    );
    p2AddSelectBtn.addEventListener("click", () =>
      handleAddAndSelectDeck(p2UrlInput, p2Select, p2AddSelectBtn, 2)
    );
    p1Select.addEventListener("change", () =>
      saveLastDeckSelection(1, p1Select.value)
    );
    p2Select.addEventListener("change", () =>
      saveLastDeckSelection(2, p2Select.value)
    );
    addDeckBtn.addEventListener("click", handleAddDeck);
    backToSetupBtn.addEventListener("click", showMainSidebarView);
    switchBtnFooter.addEventListener("click", () => {
      // Manual switch button
      if (!bodyElement.classList.contains("deck-view-active")) {
        switchPlayer(); // Just send the request
      } else {
        console.log("Switch button ignored (deck view active).");
      }
    });
    spacebarToggleBtn.addEventListener("click", handleSpacebarToggle);

    // IPC Listeners
    onLobbySuccess(onGameReady);
    onAutoSetupError(onSetupError);
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    onTriggerSwitch(handleTriggerSwitch); // Listens for spacebar event from main
    onPlayerSwitched(updateActivePlayerVisuals); // *** Update visuals on confirmation ***
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
          removeAllListeners("player-switched");
          removeAllListeners("set-sidebar-collapsed");
          removeAllListeners("collapse-sidebar");
        } catch (e) {
          console.error("Error removing listeners:", e);
        }
      }
    });
  }

  /** Initializes the renderer application. */
  function initialize() {
    console.log("Initializing Mirrorbast renderer...");
    loadAppState();
    populateSelects();
    setupEventListeners();
    setSidebarCollapsed(false);
    showMainSidebarView();
    updateActivePlayerVisuals(1); // Set initial visuals for P1
    resetBtn.textContent = "Reset";
    console.log("Renderer initialization complete.");
  }

  document.addEventListener("DOMContentLoaded", initialize);
} else {
  console.error("Fatal Error: window.api not found.");
  alert("Application cannot start.");
}
