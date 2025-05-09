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
    toggleSpacebarShortcut,
    openExternalUrl,
    onLobbySuccess,
    onResetSuccess,
    onResetError,
    onAutoSetupError,
    onTriggerSwitch,
    onPlayerSwitched,
    onSetSidebarCollapsed,
    onCollapseSidebarRequest,
    onShowSpinner,
    onHideSpinner,
    onSetSwitchingAllowed,
    removeAllListeners,
  } = window.api;

  // DOM Elements References
  const bodyElement = document.body;
  const contentElement = document.getElementById("content");
  const sidebarElement = document.getElementById("sidebar");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const loadingText = document.getElementById("loadingText");
  const mainSidebarContent = document.getElementById("mainSidebarContent");
  const p1Select = document.getElementById("p1Select");
  const p2Select = document.getElementById("p2Select");
  const p1UrlInput = document.getElementById("p1UrlInput");
  const p2UrlInput = document.getElementById("p2UrlInput");
  const p1AddSelectBtn = document.getElementById("p1AddSelectBtn");
  const p2AddSelectBtn = document.getElementById("p2AddSelectBtn");
  const autoSetupBtn = document.getElementById("autoSetupBtn");
  const manageDecksBtn = document.getElementById("manageDecksBtn");
  const resetBtn = document.getElementById("resetBtn");
  const deckManagementView = document.getElementById("deckManagementView");
  const deckInputElement = document.getElementById("deckInput");
  const addDeckBtn = document.getElementById("addDeckBtn");
  const deckListElement = document.getElementById("deckList");
  const backToSetupBtn = document.getElementById("backToSetupBtn");
  const switchBtnFooter = document.getElementById("switchBtn");
  const spacebarToggleBtn = document.getElementById("spacebarToggle");
  const activePlayerIndicator = document.getElementById("activePlayerIndicator");

  // State Variables
  const DECK_STORAGE_KEY = "savedDecks";
  const LAST_DECK_P1_KEY = "lastDeckP1";
  const LAST_DECK_P2_KEY = "lastDeckP2";
  const SPACEBAR_ENABLED_KEY = "spacebarShortcutEnabled";
  let savedDecks = [];
  let isSidebarCollapsed = false;
  let isSpacebarShortcutEnabled = true; // User preference
  let activePlayer = 1;

  // Deck Management Functions
  function loadAppState() {
    try { savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]"); }
    catch (error) { console.error("Error loading decks:", error); savedDecks = []; localStorage.removeItem(DECK_STORAGE_KEY); }
    const storedSpacebarState = localStorage.getItem(SPACEBAR_ENABLED_KEY);
    isSpacebarShortcutEnabled = storedSpacebarState === "false" ? false : true;
  }
  function saveDecks() { try { localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedDecks)); } catch (error) { console.error("Error saving decks:", error); alert("Error saving deck list."); } }
  function saveLastDeckSelection(player, url) { const key = player === 1 ? LAST_DECK_P1_KEY : LAST_DECK_P2_KEY; if (url) { localStorage.setItem(key, url); } else { localStorage.removeItem(key); } }
  async function handleAddDeck() {
    const url = deckInputElement.value.trim(); if (!url) return alert("Please enter a deck URL."); if (savedDecks.some((deck) => deck.url === url)) { deckInputElement.value = ""; return alert("This deck URL is already saved."); }
    addDeckBtn.textContent = "Adding..."; addDeckBtn.disabled = true;
    try {
        const metadata = await fetchMetadata(url);
        if (metadata && metadata.name && metadata.name !== "Fetch Error" && metadata.name !== "Invalid Metadata") {
            savedDecks.push({ url, ...metadata }); saveDecks(); renderDeckList(); populateSelects(); deckInputElement.value = ""; console.log(`Deck "${metadata.name}" added.`);
        } else { alert(`Could not fetch valid metadata. Error: ${metadata?.name || "Unknown"}. Check link.`); console.warn("Metadata fetch failed:", url, metadata); }
    } catch (error) { console.error("Error adding deck:", error); alert(`Failed add deck: ${error.message}`); }
    finally { addDeckBtn.textContent = "Add Deck"; addDeckBtn.disabled = false; }
   }
  function renderDeckList() {
    deckListElement.innerHTML = ""; if (savedDecks.length === 0) { const li = document.createElement("li"); li.textContent = "No decks saved yet."; li.style.fontStyle = "italic"; li.style.color = "#888"; deckListElement.appendChild(li); return; }
    const svgIconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
    const svgIconExternalLink = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-up-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></svg>`;
    const svgIconRefresh = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>`;
    savedDecks.forEach((deck, index) => {
        const li = document.createElement("li"); const infoDiv = document.createElement("div"); infoDiv.className = "deck-info"; const nameStrong = document.createElement("strong"); nameStrong.textContent = deck.name || "Unnamed"; nameStrong.title = deck.name || "Unnamed"; const authorSpan = document.createElement("span"); authorSpan.className = "meta"; authorSpan.textContent = `by ${deck.author || "Unknown"}`; authorSpan.title = `by ${deck.author || "Unknown"}`; const deckUrlSpan = document.createElement("span"); deckUrlSpan.className = "deck-url"; deckUrlSpan.textContent = deck.url; deckUrlSpan.title = deck.url; infoDiv.append(nameStrong, authorSpan, deckUrlSpan);
        const buttonsDiv = document.createElement("div"); buttonsDiv.className = "deck-buttons"; const btnOpenUrl = document.createElement("button"); btnOpenUrl.className = "generic icon-btn open-url-btn"; btnOpenUrl.title = `Open deck URL in browser`; btnOpenUrl.innerHTML = svgIconExternalLink; btnOpenUrl.onclick = (e) => { e.stopPropagation(); openExternalUrl(deck.url); }; const btnRefresh = document.createElement("button"); btnRefresh.className = "generic icon-btn refresh-btn"; btnRefresh.title = "Refresh metadata"; btnRefresh.innerHTML = svgIconRefresh; btnRefresh.onclick = async (e) => { e.stopPropagation(); btnRefresh.disabled = true; btnOpenUrl.disabled = true; const btnDelete = li.querySelector(".delete-btn"); if (btnDelete) btnDelete.disabled = true; try { const newMeta = await fetchMetadata(deck.url); if (newMeta && newMeta.name && newMeta.name !== "Fetch Error" && newMeta.name !== "Invalid Metadata") { savedDecks[index] = { url: deck.url, ...newMeta }; saveDecks(); renderDeckList(); populateSelects(); console.log(`Refreshed: ${newMeta.name}`); } else { alert(`Refresh fail: ${newMeta?.name || "Unknown"}`); console.warn("Refresh fail:", deck.url, newMeta); btnRefresh.disabled = false; btnOpenUrl.disabled = false; if (btnDelete) btnDelete.disabled = false; } } catch (error) { console.error("Refresh error:", error); alert(`Refresh error: ${error.message}`); btnRefresh.disabled = false; btnOpenUrl.disabled = false; if (btnDelete) btnDelete.disabled = false; } }; const btnDelete = document.createElement("button"); btnDelete.className = "generic icon-btn delete-btn"; btnDelete.title = "Delete deck"; btnDelete.innerHTML = svgIconTrash; btnDelete.onclick = (e) => { e.stopPropagation(); if (confirm(`Delete "${deck.name || "this deck"}"?`)) { savedDecks.splice(index, 1); saveDecks(); renderDeckList(); populateSelects(); console.log(`Deleted: ${deck.name || deck.url}`); } }; buttonsDiv.append(btnOpenUrl, btnRefresh, btnDelete); li.append(infoDiv, buttonsDiv); deckListElement.appendChild(li);
    });
   }
  function populateSelects() {
    const lastP1 = localStorage.getItem(LAST_DECK_P1_KEY); const lastP2 = localStorage.getItem(LAST_DECK_P2_KEY);
    [p1Select, p2Select].forEach((select, index) => {
        const lastSelectedUrl = index === 0 ? lastP1 : lastP2; const currentVal = select.value; let foundLastSelected = false; select.innerHTML = "";
        const defaultOpt = document.createElement("option"); defaultOpt.value = ""; defaultOpt.textContent = "Select Deck..."; select.append(defaultOpt);
        savedDecks.forEach((deck) => { const opt = document.createElement("option"); opt.value = deck.url; opt.textContent = deck.name || "Unnamed Deck"; opt.title = `${deck.name || "Unnamed Deck"} (${deck.author || "Unknown"})`; if (deck.url === lastSelectedUrl) { opt.selected = true; foundLastSelected = true; } select.append(opt); });
        if (foundLastSelected) { select.value = lastSelectedUrl; } else if (savedDecks.some((deck) => deck.url === currentVal)) { select.value = currentVal; } else { select.value = ""; }
    });
   }

  // UI View Switching Functions
  function showMainSidebarView() { setGameViewsVisibility(true); bodyElement.classList.remove("deck-view-active"); deckManagementView.style.display = "none"; mainSidebarContent.style.display = "flex"; }
  function showDeckManagementView() { setGameViewsVisibility(false); bodyElement.classList.add("deck-view-active"); setSidebarCollapsed(false); mainSidebarContent.style.display = "none"; deckManagementView.style.display = "flex"; renderDeckList(); }
  function setSidebarCollapsed(collapsed) { if (bodyElement.classList.contains("deck-view-active") && collapsed) return; if (isSidebarCollapsed === collapsed) return; isSidebarCollapsed = collapsed; bodyElement.classList.toggle("sidebar-collapsed", isSidebarCollapsed); sidebarToggleBtn.textContent = isSidebarCollapsed ? "☰" : "✕"; sidebarStateChanged(isSidebarCollapsed); }
  function toggleSidebar() { if (bodyElement.classList.contains("deck-view-active")) return; setSidebarCollapsed(!isSidebarCollapsed); }

  // Player Visuals
  function updateActivePlayerVisuals(playerNum) {
    activePlayer = playerNum; if (contentElement) { contentElement.classList.toggle("player1-active-border", activePlayer === 1); contentElement.classList.toggle("player2-active-border", activePlayer === 2); }
    if (activePlayerIndicator) { if (activePlayer === 1) { activePlayerIndicator.textContent = "Player 1 Active"; activePlayerIndicator.className = "player1-active"; } else if (activePlayer === 2) { activePlayerIndicator.textContent = "Player 2 Active"; activePlayerIndicator.className = "player2-active"; } else { activePlayerIndicator.textContent = "Unknown Player"; activePlayerIndicator.className = ""; } }
  }

  // Control State Management
  function handleSetSwitchingAllowed(allowed) {
      console.log(`Renderer: Setting switching allowed to: ${allowed}`);

      if (switchBtnFooter) {
          switchBtnFooter.disabled = !allowed;
          switchBtnFooter.title = allowed
              ? "Switch Active Player (Spacebar)"
              : "Switching disabled until game setup is complete";
      }

      if (spacebarToggleBtn) {
          spacebarToggleBtn.disabled = !allowed;
          const userPrefEnabled = isSpacebarShortcutEnabled;

          if (allowed && userPrefEnabled) {
              spacebarToggleBtn.textContent = "Enabled";
              spacebarToggleBtn.classList.add("enabled");
              spacebarToggleBtn.classList.remove("disabled");
              spacebarToggleBtn.title = "Spacebar shortcut is ENABLED. Click to disable.";
          } else {
              spacebarToggleBtn.textContent = !allowed ? "Locked" : "Disabled";
              spacebarToggleBtn.classList.add("disabled");
              spacebarToggleBtn.classList.remove("enabled");
              spacebarToggleBtn.title = !allowed
                  ? "Spacebar shortcut disabled until game setup is complete."
                  : "Spacebar shortcut is DISABLED. Click to enable.";
          }
      }
      toggleSpacebarShortcut(allowed && isSpacebarShortcutEnabled);
  }

  function handleSpacebarToggle() {
    if (spacebarToggleBtn?.disabled) {
        console.log("Spacebar toggle ignored (button disabled).");
        return;
    }
    isSpacebarShortcutEnabled = !isSpacebarShortcutEnabled;
    localStorage.setItem(SPACEBAR_ENABLED_KEY, isSpacebarShortcutEnabled);
    handleSetSwitchingAllowed(true); // Update UI based on new pref (assuming switching is allowed)
  }

  // Spinner Functions
  function handleShowSpinner() { if (!loadingSpinner || !loadingText) return console.warn("[Renderer] Spinner/Text element not found."); loadingSpinner.classList.add("visible"); loadingText.textContent = "Please Wait..."; }
  function handleHideSpinner() { if (!loadingSpinner || !loadingText) return console.warn("[Renderer] Spinner/Text element not found."); loadingSpinner.classList.remove("visible"); loadingText.textContent = ""; }

  // Event Handlers
  async function handleAddAndSelectDeck(urlInputEl, targetSelectEl, addButtonEl, playerNum) {
    const url = urlInputEl.value.trim(); if (!url) return alert("Please paste a deck URL.");
    const originalButtonText = addButtonEl.textContent; addButtonEl.textContent = "..."; addButtonEl.disabled = true;
    try {
        const existingDeck = savedDecks.find((deck) => deck.url === url);
        if (existingDeck) { populateSelects(); targetSelectEl.value = url; saveLastDeckSelection(playerNum, url); urlInputEl.value = ""; }
        else {
            const metadata = await fetchMetadata(url);
            if (metadata && metadata.name && metadata.name !== "Fetch Error" && metadata.name !== "Invalid Metadata") { savedDecks.push({ url, ...metadata }); saveDecks(); populateSelects(); targetSelectEl.value = url; saveLastDeckSelection(playerNum, url); urlInputEl.value = ""; console.log(`Deck "${metadata.name}" added and selected.`); }
            else { alert(`Could not fetch valid metadata. Error: ${metadata?.name || "Unknown"}. Check link.`); console.warn("Metadata fetch failed:", url, metadata); }
        }
    } catch (error) { console.error("Error adding/selecting deck:", error); alert(`Failed add/select deck: ${error.message}`); }
    finally { addButtonEl.textContent = originalButtonText; addButtonEl.disabled = false; }
   }

  function handleAutoSetup() {
    if (bodyElement.classList.contains("deck-view-active")) return console.log("Auto Setup ignored (deck view active).");
    const p1Url = p1Select.value; const p2Url = p2Select.value;
    if (!p1Url) { alert("Please select a deck for Player 1."); p1Select.focus(); return; }
    if (!p2Url) { alert("Please select a deck for Player 2."); p2Select.focus(); return; }
    saveLastDeckSelection(1, p1Url); saveLastDeckSelection(2, p2Url);
    console.log(`Requesting auto-setup: P1=${p1Url}, P2=${p2Url}`);

    if (autoSetupBtn) {
        autoSetupBtn.textContent = "Setting Up...";
        autoSetupBtn.disabled = true;
    }
     if (resetBtn) resetBtn.disabled = true;
     // Main process will send set-switching-allowed: false
    autoSetup(p1Url, p2Url);
  }

  function handleReset() {
    if (bodyElement.classList.contains("deck-view-active")) return console.log("Reset ignored (deck view active).");
    if (confirm("Reset both player views to Karabast home? This will cancel any ongoing auto-setup.")) {
      console.log("Requesting reset...");
      resetApp(); // Main process sends set-switching-allowed: false
      handleHideSpinner();
    }
  }

  // IPC Event Listeners Callbacks

  function enableNonSwitchControls() {
    if (autoSetupBtn) {
        autoSetupBtn.textContent = "Auto Setup Game";
        autoSetupBtn.disabled = false;
    }
    if (resetBtn) {
        resetBtn.textContent = "Reset";
        resetBtn.disabled = false;
    }
    if (manageDecksBtn) manageDecksBtn.disabled = false;
    if (p1AddSelectBtn) p1AddSelectBtn.disabled = false;
    if (p2AddSelectBtn) p2AddSelectBtn.disabled = false;
  }

  function onLobbySuccessHandler() {
    console.log("Renderer: Game setup complete (lobby-success received).");
    enableNonSwitchControls();
    showMainSidebarView();
    handleHideSpinner();
    // Main process sends set-switching-allowed: true
  }

  function onSetupErrorHandler(errorMessage) {
     console.error("Setup Error:", errorMessage);
     alert(`Setup failed: ${errorMessage}`);
     enableNonSwitchControls();
     setSidebarCollapsed(false);
     showMainSidebarView();
     updateActivePlayerVisuals(1);
     handleHideSpinner();
     // Main process sends set-switching-allowed: false
  }

  function onResetComplete() {
    console.log("Reset successful.");
    enableNonSwitchControls();
    populateSelects();
    setSidebarCollapsed(false);
    showMainSidebarView();
    handleHideSpinner();
     // Main process sent set-switching-allowed: false
  }

  function onResetFail(errorMessage) {
    console.error("Reset Error:", errorMessage);
    alert(`Reset failed: ${errorMessage}`);
    enableNonSwitchControls();
    setSidebarCollapsed(false);
    showMainSidebarView();
    populateSelects();
    updateActivePlayerVisuals(1);
    handleHideSpinner();
     // Main process sent set-switching-allowed: false
  }

  function handleTriggerSwitch() {
    if (!bodyElement.classList.contains("deck-view-active")) {
      console.log("Renderer: Requesting player switch (via Spacebar trigger).");
      switchPlayer();
    } else {
        console.log("Renderer: Trigger switch ignored (deck view active).");
    }
  }

  function handleSetSidebarCollapsed(collapsed) { setSidebarCollapsed(collapsed); }
  function handleCollapseRequest() { if (!bodyElement.classList.contains("deck-view-active")) { setSidebarCollapsed(true); } }


  // Initialization
  function setupEventListeners() {
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener("click", toggleSidebar);
    if (autoSetupBtn) autoSetupBtn.addEventListener("click", handleAutoSetup);
    if (resetBtn) resetBtn.addEventListener("click", handleReset);
    if (manageDecksBtn) manageDecksBtn.addEventListener("click", showDeckManagementView);
    if (p1AddSelectBtn && p1UrlInput && p1Select) { p1AddSelectBtn.addEventListener("click", () => handleAddAndSelectDeck(p1UrlInput, p1Select, p1AddSelectBtn, 1)); }
    if (p2AddSelectBtn && p2UrlInput && p2Select) { p2AddSelectBtn.addEventListener("click", () => handleAddAndSelectDeck(p2UrlInput, p2Select, p2AddSelectBtn, 2)); }
    if (p1Select) p1Select.addEventListener("change", () => saveLastDeckSelection(1, p1Select.value));
    if (p2Select) p2Select.addEventListener("change", () => saveLastDeckSelection(2, p2Select.value));
    if (addDeckBtn) addDeckBtn.addEventListener("click", handleAddDeck);
    if (backToSetupBtn) backToSetupBtn.addEventListener("click", showMainSidebarView);
    if (switchBtnFooter) {
      switchBtnFooter.addEventListener("click", () => {
        if (!bodyElement.classList.contains("deck-view-active")) {
          switchPlayer();
        } else {
          console.log("Switch button ignored (deck view active).");
        }
      });
    }
    if (spacebarToggleBtn) spacebarToggleBtn.addEventListener("click", handleSpacebarToggle);

    // Register IPC Event Listeners
    try {
      onLobbySuccess(onLobbySuccessHandler);
      onAutoSetupError(onSetupErrorHandler);
      onResetSuccess(onResetComplete);
      onResetError(onResetFail);
      onTriggerSwitch(handleTriggerSwitch);
      onPlayerSwitched(updateActivePlayerVisuals);
      onSetSidebarCollapsed(handleSetSidebarCollapsed);
      onCollapseSidebarRequest(handleCollapseRequest);
      onShowSpinner(handleShowSpinner);
      onHideSpinner(handleHideSpinner);
      onSetSwitchingAllowed(handleSetSwitchingAllowed); // Listen for state changes
    } catch (error) {
      console.error("Error setting up IPC listeners:", error);
      alert("Error connecting to main process. App may not function correctly.");
    }

    // Cleanup listeners
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
          removeAllListeners("show-spinner");
          removeAllListeners("hide-spinner");
          removeAllListeners("set-switching-allowed");
        } catch (e) { console.error("Error removing listeners:", e); }
      }
    });
  }

  function initialize() {
    console.log("Initializing Mirrorbast renderer...");
    loadAppState();
    populateSelects();
    setupEventListeners();
    setSidebarCollapsed(false);
    showMainSidebarView();
    updateActivePlayerVisuals(1);
    if (resetBtn) resetBtn.textContent = "Reset";
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Auto Setup Game";
      autoSetupBtn.disabled = false;
    }
    // Set initial control state (switching disabled)
    handleSetSwitchingAllowed(false);
    console.log("Renderer initialization complete.");
  }

  document.addEventListener("DOMContentLoaded", initialize);
} else {
  console.error("Fatal Error: window.api not found. Preload script likely failed.");
  alert("Application critical error: Cannot communicate with the main process. Please restart the application or check logs.");
}
