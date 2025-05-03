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
  const switchBtnFooter = document.getElementById("switchBtn"); // Get switch button from footer

  // --- State ---
  const DECK_STORAGE_KEY = "savedDecks";
  const LAST_DECK_P1_KEY = "lastDeckP1";
  const LAST_DECK_P2_KEY = "lastDeckP2";
  let savedDecks = [];
  let isSidebarCollapsed = false;

  // --- Deck Management Functions ---

  /** Loads decks and last used deck selections from localStorage. */
  function loadAppState() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]");
      console.log(`Loaded ${savedDecks.length} decks from storage.`);
    } catch (error) {
      console.error("Error loading decks:", error);
      savedDecks = [];
      localStorage.removeItem(DECK_STORAGE_KEY);
    }
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
      buttonsDiv.style.display = "flex";
      buttonsDiv.style.flexShrink = "0";
      buttonsDiv.style.gap = "4px";
      const btnRefresh = document.createElement("button");
      btnRefresh.textContent = "Refresh";
      btnRefresh.className = "generic";
      btnRefresh.title = "Refresh metadata";
      const btnDelete = document.createElement("button");
      btnDelete.textContent = "Delete";
      btnDelete.className = "generic";
      btnDelete.style.backgroundColor = "#a04040";
      btnDelete.title = "Delete deck";
      buttonsDiv.append(btnRefresh, btnDelete);
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
    // Re-attach refresh/delete logic inside the loop as elements are recreated
    deckListElement.querySelectorAll("li").forEach((li, index) => {
      const deck = savedDecks[index];
      const btnRefresh = li.querySelector("button:nth-of-type(1)");
      const btnDelete = li.querySelector("button:nth-of-type(2)");
      if (btnRefresh) {
        btnRefresh.onclick = async (e) => {
          e.stopPropagation();
          btnRefresh.textContent = "...";
          btnRefresh.disabled = true;
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
            }
          } catch (error) {
            console.error("Refresh error:", error);
            alert(`Refresh error: ${error.message}`);
            btnRefresh.textContent = "Refresh";
            btnRefresh.disabled = false;
          }
        };
      }
      if (btnDelete) {
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
      }
    });
  }

  /** Populates dropdowns and attempts to select the last used deck. */
  function populateSelects() {
    const lastP1 = localStorage.getItem(LAST_DECK_P1_KEY);
    const lastP2 = localStorage.getItem(LAST_DECK_P2_KEY);

    [p1Select, p2Select].forEach((select, index) => {
      const lastSelectedUrl = index === 0 ? lastP1 : lastP2;
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
      if (!foundLastSelected) {
        select.value = "";
      }
    });
  }

  // --- UI View Switching ---

  /** Shows the main setup/gameplay sidebar view. */
  function showMainSidebarView() {
    // *** Tell main process to show the game views ***
    setGameViewsVisibility(true);
    bodyElement.classList.remove("deck-view-active");
    deckManagementView.style.display = "none";
    mainSidebarContent.style.display = "flex";
    console.log("Switched to Main Sidebar View (Game Views Visible)");
  }

  /** Shows the deck management sidebar view (full window). */
  function showDeckManagementView() {
    // *** Tell main process to hide the game views ***
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
    // *** Ensure we're not in deck management view ***
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
    autoSetup(p1Url, p2Url);
  }

  /** Handles the click event for the Reset button. */
  function handleReset() {
    // *** Ensure we're not in deck management view ***
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
    saveLastDeckSelection(1, "");
    saveLastDeckSelection(2, "");
    populateSelects();
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
    setSidebarCollapsed(false); // Ensure sidebar is expanded
    showMainSidebarView(); // Ensure main view shown (makes game views visible)
  }

  /** Handles the trigger to switch players (e.g., from Spacebar). */
  function handleTriggerSwitch() {
    // Only switch if deck management view is NOT active
    if (!bodyElement.classList.contains("deck-view-active")) {
      console.log("Renderer: Trigger switch received via Spacebar.");
      switchPlayer(); // Call the exposed API function
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
    p1Select.addEventListener("change", () =>
      saveLastDeckSelection(1, p1Select.value)
    );
    p2Select.addEventListener("change", () =>
      saveLastDeckSelection(2, p2Select.value)
    );
    addDeckBtn.addEventListener("click", handleAddDeck);
    backToSetupBtn.addEventListener("click", showMainSidebarView); // Shows main view, shows game views
    switchBtnFooter.addEventListener("click", () => {
      // Only allow switch if not in deck view
      if (!bodyElement.classList.contains("deck-view-active")) {
        switchPlayer();
      } else {
        console.log("Switch button ignored (deck view active).");
      }
    });

    // IPC Listeners
    onLobbySuccess(onGameReady);
    onAutoSetupError(onSetupError);
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    onTriggerSwitch(handleTriggerSwitch);
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
    loadAppState();
    populateSelects();
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
