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
  );

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

    // --- SVG Icons ---
    const svgIconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
    const svgIconExternalLink = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-up-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></svg>`;
    const svgIconRefresh = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>`;
    // --- End SVG Icons ---

    savedDecks.forEach((deck, index) => {
      const li = document.createElement("li");

      // --- Info Div (Name, Author, URL) ---
      const infoDiv = document.createElement("div");
      infoDiv.className = "deck-info"; // Add class for styling

      const nameStrong = document.createElement("strong");
      nameStrong.textContent = deck.name || "Unnamed";
      nameStrong.title = deck.name || "Unnamed";

      const authorSpan = document.createElement("span");
      authorSpan.className = "meta";
      authorSpan.textContent = `by ${deck.author || "Unknown"}`;
      authorSpan.title = `by ${deck.author || "Unknown"}`;

      // *** NEW: Deck URL Span ***
      const deckUrlSpan = document.createElement("span");
      deckUrlSpan.className = "deck-url"; // Add class for styling
      deckUrlSpan.textContent = deck.url;
      deckUrlSpan.title = deck.url; // Tooltip for full URL if truncated

      // Append info elements
      infoDiv.append(nameStrong, authorSpan, deckUrlSpan); // Add URL span

      // --- Buttons Div ---
      const buttonsDiv = document.createElement("div");
      buttonsDiv.className = "deck-buttons";

      // --- Open URL Button ---
      const btnOpenUrl = document.createElement("button");
      btnOpenUrl.className = "generic icon-btn open-url-btn"; // Add specific class
      btnOpenUrl.title = `Open deck URL in browser`; // Simpler tooltip
      btnOpenUrl.innerHTML = svgIconExternalLink; // Use SVG icon
      btnOpenUrl.onclick = (e) => {
        e.stopPropagation();
        openExternalUrl(deck.url);
      };

      // --- Refresh Button ---
      const btnRefresh = document.createElement("button");
      btnRefresh.className = "generic icon-btn refresh-btn"; // Add specific class
      btnRefresh.title = "Refresh metadata";
      btnRefresh.innerHTML = svgIconRefresh; // Use SVG icon
      btnRefresh.onclick = async (e) => {
        e.stopPropagation();
        // Visually indicate loading (e.g., disable, maybe add spinner later)
        btnRefresh.disabled = true;
        btnOpenUrl.disabled = true;
        const btnDelete = li.querySelector(".delete-btn");
        if (btnDelete) btnDelete.disabled = true;
        // Add a temporary 'loading' state if desired via CSS class
        // btnRefresh.classList.add('loading');
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
            populateSelects(); // Re-render handles re-enabling
            console.log(`Refreshed: ${newMeta.name}`);
          } else {
            alert(`Refresh fail: ${newMeta?.name || "Unknown"}`);
            console.warn("Refresh fail:", deck.url, newMeta);
            // Manually re-enable buttons on failure if not re-rendering
            btnRefresh.disabled = false;
            btnOpenUrl.disabled = false;
            if (btnDelete) btnDelete.disabled = false;
          }
        } catch (error) {
          console.error("Refresh error:", error);
          alert(`Refresh error: ${error.message}`);
          btnRefresh.disabled = false;
          btnOpenUrl.disabled = false;
          if (btnDelete) btnDelete.disabled = false;
        } finally {
          // Remove loading state if added
          // btnRefresh.classList.remove('loading');
        }
      };

      // --- Delete Button ---
      const btnDelete = document.createElement("button");
      btnDelete.className = "generic icon-btn delete-btn"; // Add specific class
      btnDelete.title = "Delete deck";
      btnDelete.innerHTML = svgIconTrash; // Use SVG icon
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

      // Append buttons to buttonsDiv (Order: Open, Refresh, Delete)
      buttonsDiv.append(btnOpenUrl, btnRefresh, btnDelete);

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
    activePlayer = playerNum;
    // console.log(`Renderer: Updating visuals for active player ${activePlayer}`);
    if (contentElement) {
      contentElement.classList.toggle(
        "player1-active-border",
        activePlayer === 1
      );
      contentElement.classList.toggle(
        "player2-active-border",
        activePlayer === 2
      );
    }
    if (activePlayerIndicator) {
      if (activePlayer === 1) {
        activePlayerIndicator.textContent = "Player 1 Active";
        activePlayerIndicator.className = "player1-active";
      } else if (activePlayer === 2) {
        activePlayerIndicator.textContent = "Player 2 Active";
        activePlayerIndicator.className = "player2-active";
      } else {
        activePlayerIndicator.textContent = "Unknown Player";
        activePlayerIndicator.className = "";
      }
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
      updateActivePlayerVisuals(1); // Ensure visuals reset to P1 on error
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
    updateActivePlayerVisuals(1); // Ensure visuals reset to P1 on error
  }

  /** Handles the trigger to switch players (e.g., from Spacebar). */
  function handleTriggerSwitch() {
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
    onTriggerSwitch(handleTriggerSwitch);
    onPlayerSwitched(updateActivePlayerVisuals); // Update visuals on confirmation
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
