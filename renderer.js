// renderer.js - Handles UI logic for index.html

// Ensure the API provided by preload.js is available
if (window.api) {
  // Destructure necessary functions from the exposed API
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
    removeAllListeners,
  } = window.api;

  // --- DOM Elements References ---
  // Get references to various elements needed for UI manipulation
  const bodyElement = document.body;
  const contentElement = document.getElementById("content");
  const sidebarElement = document.getElementById("sidebar");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const loadingText = document.getElementById("loadingText");
  // Main View Elements
  const mainSidebarContent = document.getElementById("mainSidebarContent");
  const p1Select = document.getElementById("p1Select");
  const p2Select = document.getElementById("p2Select");
  const p1UrlInput = document.getElementById("p1UrlInput"); // Added reference
  const p2UrlInput = document.getElementById("p2UrlInput"); // Added reference
  const p1AddSelectBtn = document.getElementById("p1AddSelectBtn"); // Added reference
  const p2AddSelectBtn = document.getElementById("p2AddSelectBtn"); // Added reference
  const autoSetupBtn = document.getElementById("autoSetupBtn"); // Reference for Auto Setup button
  const manageDecksBtn = document.getElementById("manageDecksBtn");
  const resetBtn = document.getElementById("resetBtn"); // Reference for Reset button
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

  // --- State Variables ---
  // Keys for local storage
  const DECK_STORAGE_KEY = "savedDecks";
  const LAST_DECK_P1_KEY = "lastDeckP1";
  const LAST_DECK_P2_KEY = "lastDeckP2";
  const SPACEBAR_ENABLED_KEY = "spacebarShortcutEnabled";
  // Application state variables
  let savedDecks = []; // Array to hold saved deck objects { url, name, author }
  let isSidebarCollapsed = false; // Tracks sidebar state
  let isSpacebarShortcutEnabled = true; // Tracks if spacebar shortcut is active
  let activePlayer = 1; // Tracks the currently active player (1 or 2)

  // --- Deck Management Functions ---
  // Loads saved decks, last selections, and spacebar setting from localStorage
  function loadAppState() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]");
    } catch (error) {
      console.error("Error loading decks:", error);
      savedDecks = [];
      localStorage.removeItem(DECK_STORAGE_KEY); // Clear potentially corrupted data
    }
    const storedSpacebarState = localStorage.getItem(SPACEBAR_ENABLED_KEY);
    isSpacebarShortcutEnabled = storedSpacebarState === "false" ? false : true; // Default to true
    updateSpacebarToggleVisuals();
    toggleSpacebarShortcut(isSpacebarShortcutEnabled); // Inform main process
  }

  // Saves the current list of decks to localStorage
  function saveDecks() {
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedDecks));
    } catch (error) {
      console.error("Error saving decks:", error);
      alert("Error saving deck list."); // Inform user
    }
  }

  // Saves the last selected deck URL for a specific player to localStorage
  function saveLastDeckSelection(player, url) {
    const key = player === 1 ? LAST_DECK_P1_KEY : LAST_DECK_P2_KEY;
    if (url) {
      localStorage.setItem(key, url);
    } else {
      localStorage.removeItem(key); // Remove if URL is empty (e.g., "Select Deck...")
    }
  }

  // Handles adding a new deck URL via the deck management view
  async function handleAddDeck() {
    const url = deckInputElement.value.trim();
    if (!url) return alert("Please enter a deck URL.");
    if (savedDecks.some((deck) => deck.url === url)) {
      deckInputElement.value = "";
      return alert("This deck URL is already saved.");
    }

    // Disable button during fetch
    addDeckBtn.textContent = "Adding...";
    addDeckBtn.disabled = true;

    try {
      // Fetch metadata (name, author) from the main process
      const metadata = await fetchMetadata(url);
      if (
        metadata &&
        metadata.name &&
        metadata.name !== "Fetch Error" &&
        metadata.name !== "Invalid Metadata"
      ) {
        // Add deck if metadata is valid
        savedDecks.push({ url, ...metadata });
        saveDecks(); // Save updated list
        renderDeckList(); // Update UI list
        populateSelects(); // Update dropdowns
        deckInputElement.value = ""; // Clear input field
        console.log(`Deck "${metadata.name}" added.`);
      } else {
        // Handle fetch errors or invalid metadata
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
      // Re-enable button
      addDeckBtn.textContent = "Add Deck";
      addDeckBtn.disabled = false;
    }
  }

  // Renders the list of saved decks in the deck management view
  function renderDeckList() {
    deckListElement.innerHTML = ""; // Clear existing list
    if (savedDecks.length === 0) {
      // Display message if no decks are saved
      const li = document.createElement("li");
      li.textContent = "No decks saved yet.";
      li.style.fontStyle = "italic";
      li.style.color = "#888";
      deckListElement.appendChild(li);
      return;
    }

    // SVG icons for buttons
    const svgIconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
    const svgIconExternalLink = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-up-right" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/></svg>`;
    const svgIconRefresh = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>`;

    // Create list items for each saved deck
    savedDecks.forEach((deck, index) => {
      const li = document.createElement("li");
      // Deck Info (Name, Author, URL)
      const infoDiv = document.createElement("div");
      infoDiv.className = "deck-info";
      const nameStrong = document.createElement("strong");
      nameStrong.textContent = deck.name || "Unnamed";
      nameStrong.title = deck.name || "Unnamed"; // Tooltip
      const authorSpan = document.createElement("span");
      authorSpan.className = "meta";
      authorSpan.textContent = `by ${deck.author || "Unknown"}`;
      authorSpan.title = `by ${deck.author || "Unknown"}`; // Tooltip
      const deckUrlSpan = document.createElement("span");
      deckUrlSpan.className = "deck-url";
      deckUrlSpan.textContent = deck.url;
      deckUrlSpan.title = deck.url; // Tooltip
      infoDiv.append(nameStrong, authorSpan, deckUrlSpan);

      // Action Buttons (Open, Refresh, Delete)
      const buttonsDiv = document.createElement("div");
      buttonsDiv.className = "deck-buttons";
      // Open URL Button
      const btnOpenUrl = document.createElement("button");
      btnOpenUrl.className = "generic icon-btn open-url-btn";
      btnOpenUrl.title = `Open deck URL in browser`;
      btnOpenUrl.innerHTML = svgIconExternalLink;
      btnOpenUrl.onclick = (e) => {
        e.stopPropagation(); // Prevent li click event
        openExternalUrl(deck.url); // Call main process function
      };
      // Refresh Metadata Button
      const btnRefresh = document.createElement("button");
      btnRefresh.className = "generic icon-btn refresh-btn";
      btnRefresh.title = "Refresh metadata";
      btnRefresh.innerHTML = svgIconRefresh;
      btnRefresh.onclick = async (e) => {
        e.stopPropagation();
        // Disable buttons during refresh
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
            // Update deck in array and save
            savedDecks[index] = { url: deck.url, ...newMeta };
            saveDecks();
            renderDeckList(); // Re-render the list
            populateSelects(); // Update dropdowns
            console.log(`Refreshed: ${newMeta.name}`);
          } else {
            alert(`Refresh fail: ${newMeta?.name || "Unknown"}`);
            console.warn("Refresh fail:", deck.url, newMeta);
            // Re-enable buttons on failure
            btnRefresh.disabled = false;
            btnOpenUrl.disabled = false;
            if (btnDelete) btnDelete.disabled = false;
          }
        } catch (error) {
          console.error("Refresh error:", error);
          alert(`Refresh error: ${error.message}`);
          // Re-enable buttons on error
          btnRefresh.disabled = false;
          btnOpenUrl.disabled = false;
          if (btnDelete) btnDelete.disabled = false;
        }
      };
      // Delete Deck Button
      const btnDelete = document.createElement("button");
      btnDelete.className = "generic icon-btn delete-btn";
      btnDelete.title = "Delete deck";
      btnDelete.innerHTML = svgIconTrash;
      btnDelete.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${deck.name || "this deck"}"?`)) {
          savedDecks.splice(index, 1); // Remove from array
          saveDecks(); // Save updated list
          renderDeckList(); // Re-render UI list
          populateSelects(); // Update dropdowns
          console.log(`Deleted: ${deck.name || deck.url}`);
        }
      };
      buttonsDiv.append(btnOpenUrl, btnRefresh, btnDelete);
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
  }

  // Populates the Player 1 and Player 2 deck selection dropdowns
  function populateSelects() {
    const lastP1 = localStorage.getItem(LAST_DECK_P1_KEY);
    const lastP2 = localStorage.getItem(LAST_DECK_P2_KEY);

    [p1Select, p2Select].forEach((select, index) => {
      const lastSelectedUrl = index === 0 ? lastP1 : lastP2;
      const currentVal = select.value; // Preserve current selection if possible
      let foundLastSelected = false; // Flag if last saved selection exists

      select.innerHTML = ""; // Clear existing options

      // Add default "Select Deck..." option
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Select Deck...";
      select.append(defaultOpt);

      // Add options for each saved deck
      savedDecks.forEach((deck) => {
        const opt = document.createElement("option");
        opt.value = deck.url;
        opt.textContent = deck.name || "Unnamed Deck"; // Use name or fallback
        opt.title = `${deck.name || "Unnamed Deck"} (${
          deck.author || "Unknown"
        })`; // Tooltip
        if (deck.url === lastSelectedUrl) {
          opt.selected = true; // Select if it matches the last saved URL
          foundLastSelected = true;
        }
        select.append(opt);
      });

      // Logic to restore selection:
      // 1. If last saved selection was found, use it.
      // 2. If not, but the previously selected value still exists in savedDecks, keep it.
      // 3. Otherwise, default to "Select Deck...".
      if (foundLastSelected) {
        select.value = lastSelectedUrl;
      } else if (savedDecks.some((deck) => deck.url === currentVal)) {
        select.value = currentVal;
      } else {
        select.value = ""; // Default to empty selection
      }
    });
  }

  // --- UI View Switching Functions ---
  // Shows the main setup/gameplay view in the sidebar
  function showMainSidebarView() {
    setGameViewsVisibility(true); // Tell main process to show game views
    bodyElement.classList.remove("deck-view-active"); // CSS class for styling
    deckManagementView.style.display = "none"; // Hide deck management
    mainSidebarContent.style.display = "flex"; // Show main setup content
  }

  // Shows the deck management view in the sidebar
  function showDeckManagementView() {
    setGameViewsVisibility(false); // Tell main process to hide game views
    bodyElement.classList.add("deck-view-active"); // CSS class for styling
    setSidebarCollapsed(false); // Ensure sidebar is expanded when managing decks
    mainSidebarContent.style.display = "none"; // Hide main setup content
    deckManagementView.style.display = "flex"; // Show deck management
    renderDeckList(); // Render the current deck list
  }

  // Sets the collapsed state of the sidebar
  function setSidebarCollapsed(collapsed) {
    // Prevent collapsing while in deck management view
    if (bodyElement.classList.contains("deck-view-active") && collapsed) return;
    // Avoid unnecessary updates if state hasn't changed
    if (isSidebarCollapsed === collapsed) return;

    isSidebarCollapsed = collapsed;
    bodyElement.classList.toggle("sidebar-collapsed", isSidebarCollapsed); // Apply CSS class
    sidebarToggleBtn.textContent = isSidebarCollapsed ? "☰" : "✕"; // Change icon
    sidebarStateChanged(isSidebarCollapsed); // Inform main process
  }

  // Toggles the sidebar's collapsed state
  function toggleSidebar() {
    // Ignore if in deck management view
    if (bodyElement.classList.contains("deck-view-active")) return;
    setSidebarCollapsed(!isSidebarCollapsed);
  }

  // --- Player Visuals ---
  // Updates UI elements to reflect the active player
  function updateActivePlayerVisuals(playerNum) {
    activePlayer = playerNum;
    // Update border highlight around content area
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
    // Update text indicator in the footer
    if (activePlayerIndicator) {
      if (activePlayer === 1) {
        activePlayerIndicator.textContent = "Player 1 Active";
        activePlayerIndicator.className = "player1-active"; // For styling
      } else if (activePlayer === 2) {
        activePlayerIndicator.textContent = "Player 2 Active";
        activePlayerIndicator.className = "player2-active"; // For styling
      } else {
        activePlayerIndicator.textContent = "Unknown Player"; // Fallback
        activePlayerIndicator.className = "";
      }
    }
  }

  // --- Spacebar Shortcut Toggle Functions ---
  // Updates the visual state of the spacebar toggle button
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

  // Handles clicking the spacebar toggle button
  function handleSpacebarToggle() {
    isSpacebarShortcutEnabled = !isSpacebarShortcutEnabled; // Toggle state
    localStorage.setItem(SPACEBAR_ENABLED_KEY, isSpacebarShortcutEnabled); // Save state
    updateSpacebarToggleVisuals(); // Update button appearance
    toggleSpacebarShortcut(isSpacebarShortcutEnabled); // Inform main process
    spacebarToggleBtn.blur(); // Remove focus from the button
  }

  // --- Spinner Functions ---
  /** Shows the loading spinner and "Please Wait..." text */
  function handleShowSpinner() {
    if (!loadingSpinner || !loadingText)
      return console.warn("[Renderer] Spinner/Text element not found.");
    console.log("[Renderer] Showing spinner.");
    loadingSpinner.classList.add("visible");
    loadingText.textContent = "Please Wait...";
  }

  /** Hides the loading spinner and clears the text */
  function handleHideSpinner() {
    if (!loadingSpinner || !loadingText)
      return console.warn("[Renderer] Spinner/Text element not found.");
    console.log("[Renderer] Hiding spinner.");
    loadingSpinner.classList.remove("visible");
    loadingText.textContent = "";
  }

  // --- Event Handlers ---
  // Handles the "Quick Add & Select" functionality for player decks
  async function handleAddAndSelectDeck(
    urlInputEl,
    targetSelectEl,
    addButtonEl,
    playerNum
  ) {
    const url = urlInputEl.value.trim();
    if (!url) return alert("Please paste a deck URL.");

    const originalButtonText = addButtonEl.textContent;
    addButtonEl.textContent = "..."; // Indicate processing
    addButtonEl.disabled = true;

    try {
      // Check if deck already exists
      const existingDeck = savedDecks.find((deck) => deck.url === url);
      if (existingDeck) {
        // If exists, just select it
        populateSelects(); // Ensure dropdown is up-to-date
        targetSelectEl.value = url;
        saveLastDeckSelection(playerNum, url);
        urlInputEl.value = ""; // Clear input
      } else {
        // If new, fetch metadata and add
        const metadata = await fetchMetadata(url);
        if (
          metadata &&
          metadata.name &&
          metadata.name !== "Fetch Error" &&
          metadata.name !== "Invalid Metadata"
        ) {
          savedDecks.push({ url, ...metadata });
          saveDecks();
          populateSelects(); // Update dropdowns
          targetSelectEl.value = url; // Select the newly added deck
          saveLastDeckSelection(playerNum, url);
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
      // Restore button state
      addButtonEl.textContent = originalButtonText;
      addButtonEl.disabled = false;
    }
  }

  // Handles clicking the "Auto Setup Game" button
  function handleAutoSetup() {
    // Ignore if in deck management view
    if (bodyElement.classList.contains("deck-view-active"))
      return console.log("Auto Setup ignored (deck view active).");

    const p1Url = p1Select.value;
    const p2Url = p2Select.value;

    // Validate selections
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

    // Save selections for next launch
    saveLastDeckSelection(1, p1Url);
    saveLastDeckSelection(2, p2Url);

    console.log(`Requesting auto-setup: P1=${p1Url}, P2=${p2Url}`);

    // Disable Auto Setup button immediately on click.
    // It will ONLY be re-enabled by onResetComplete() or onResetFail().
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Setting Up..."; // Set text to indicate progress
      autoSetupBtn.disabled = true;
    }

    // Disable other controls during setup
    if (switchBtnFooter) switchBtnFooter.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    if (manageDecksBtn) manageDecksBtn.disabled = true;
    if (p1AddSelectBtn) p1AddSelectBtn.disabled = true;
    if (p2AddSelectBtn) p2AddSelectBtn.disabled = true;
    if (spacebarToggleBtn) spacebarToggleBtn.disabled = true;

    // Trigger the auto setup process in the main process
    autoSetup(p1Url, p2Url);
  }

  // Handles clicking the "Reset" button
  function handleReset() {
    // Ignore if in deck management view
    if (bodyElement.classList.contains("deck-view-active"))
      return console.log("Reset ignored (deck view active).");

    // Confirm with the user
    if (
      confirm(
        "Reset both player views to Karabast home? This will cancel any ongoing auto-setup."
      )
    ) {
      console.log("Requesting reset...");

      // Disable controls while reset is in progress
      // Note: AutoSetupBtn remains disabled if it was already.
      if (resetBtn) {
        resetBtn.textContent = "Resetting...";
        resetBtn.disabled = true;
      }
      if (switchBtnFooter) switchBtnFooter.disabled = true;
      if (manageDecksBtn) manageDecksBtn.disabled = true;
      if (p1AddSelectBtn) p1AddSelectBtn.disabled = true;
      if (p2AddSelectBtn) p2AddSelectBtn.disabled = true;
      if (spacebarToggleBtn) spacebarToggleBtn.disabled = true;

      // Trigger the reset process in the main process
      resetApp();
      handleHideSpinner(); // Hide spinner immediately on reset request
    }
  }

  // --- IPC Event Listeners Callbacks ---

  // Enables primary controls *EXCEPT* Auto Setup - called on success/error completion
  function enableControls() {
    // REMOVED the logic to re-enable the Auto Setup button from this function.

    // Re-enable other controls
    if (switchBtnFooter) switchBtnFooter.disabled = false;
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.textContent = "Reset";
    }
    if (manageDecksBtn) manageDecksBtn.disabled = false;
    if (p1AddSelectBtn) p1AddSelectBtn.disabled = false;
    if (p2AddSelectBtn) p2AddSelectBtn.disabled = false;
    if (spacebarToggleBtn) spacebarToggleBtn.disabled = false;
  }

  // Called when auto-setup completes successfully
  function onGameReady() {
    console.log("Setup complete.");
    // --- MODIFICATION START ---
    // Update the button text to show completion, but keep it disabled.
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Setup Complete";
      // autoSetupBtn.disabled remains true
    }
    // --- MODIFICATION END ---
    enableControls(); // Re-enable other controls
    showMainSidebarView(); // Ensure correct view is shown
    handleHideSpinner(); // Hide loading indicator
  }

  // Called when auto-setup encounters an error
  function onSetupError(errorMessage) {
    const isAbort =
      errorMessage.includes("abort") || errorMessage.includes("AbortError");
    if (isAbort) {
      // If aborted (likely by Reset), do nothing here, reset handler takes over
      console.log(
        "Auto-setup aborted (likely by Reset). UI will be updated by reset handler."
      );
      // Note: autoSetupBtn state is handled by the reset handler
    } else {
      // Handle actual setup errors
      console.error("Setup Error:", errorMessage);
      alert(`Setup failed: ${errorMessage}`);
      // --- MODIFICATION START ---
      // Reset button text to allow retry if needed, but keep disabled until Reset clicked
      if (autoSetupBtn) {
        autoSetupBtn.textContent = "Setup Failed";
        // autoSetupBtn.disabled remains true
      }
      // --- MODIFICATION END ---
      enableControls(); // Re-enable other controls so user can try again
      setSidebarCollapsed(false); // Ensure sidebar is visible
      showMainSidebarView();
      updateActivePlayerVisuals(1); // Reset active player visual
      handleHideSpinner(); // Hide loading indicator
    }
  }

  // Called when the reset process completes successfully
  function onResetComplete() {
    console.log("Reset successful.");
    enableControls(); // Re-enable other controls
    // EXPLICITLY re-enable the Auto Setup button ONLY on reset completion.
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Auto Setup Game";
      autoSetupBtn.disabled = false;
    }
    populateSelects(); // Repopulate dropdowns
    setSidebarCollapsed(false); // Ensure sidebar is visible
    showMainSidebarView();
    handleHideSpinner(); // Hide spinner if it was shown
  }

  // Called when the reset process fails
  function onResetFail(errorMessage) {
    console.error("Reset Error:", errorMessage);
    alert(`Reset failed: ${errorMessage}`);
    enableControls(); // Re-enable other controls
    // EXPLICITLY re-enable the Auto Setup button ONLY on reset completion (even if failed).
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Auto Setup Game";
      autoSetupBtn.disabled = false;
    }
    setSidebarCollapsed(false);
    showMainSidebarView();
    populateSelects();
    updateActivePlayerVisuals(1); // Reset active player visual
    handleHideSpinner(); // Hide spinner if it was shown
  }

  // Handles the trigger from main process (e.g., Spacebar press)
  function handleTriggerSwitch() {
    // Only switch if shortcut is enabled and not in deck view
    if (
      isSpacebarShortcutEnabled &&
      !bodyElement.classList.contains("deck-view-active")
    ) {
      console.log("Renderer: Requesting player switch (via Spacebar trigger).");
      switchPlayer(); // Call main process function
    } else if (!isSpacebarShortcutEnabled) {
      console.log("Renderer: Trigger switch ignored (shortcut disabled).");
    } else {
      console.log("Renderer: Trigger switch ignored (deck view active).");
    }
  }

  // Handles request from main process to set sidebar state
  function handleSetSidebarCollapsed(collapsed) {
    setSidebarCollapsed(collapsed);
  }

  // Handles request from main process to collapse sidebar (e.g., Escape key)
  function handleCollapseRequest() {
    // Only collapse if not in deck view
    if (!bodyElement.classList.contains("deck-view-active")) {
      setSidebarCollapsed(true);
    }
  }

  // --- Initialization ---
  // Sets up all event listeners for UI elements and IPC communication
  function setupEventListeners() {
    // --- Check if elements exist before adding listeners ---
    if (sidebarToggleBtn)
      sidebarToggleBtn.addEventListener("click", toggleSidebar);
    if (autoSetupBtn) autoSetupBtn.addEventListener("click", handleAutoSetup);
    if (resetBtn) resetBtn.addEventListener("click", handleReset);
    if (manageDecksBtn)
      manageDecksBtn.addEventListener("click", showDeckManagementView);
    if (p1AddSelectBtn && p1UrlInput && p1Select) {
      p1AddSelectBtn.addEventListener("click", () =>
        handleAddAndSelectDeck(p1UrlInput, p1Select, p1AddSelectBtn, 1)
      );
    }
    if (p2AddSelectBtn && p2UrlInput && p2Select) {
      p2AddSelectBtn.addEventListener("click", () =>
        handleAddAndSelectDeck(p2UrlInput, p2Select, p2AddSelectBtn, 2)
      );
    }
    if (p1Select)
      p1Select.addEventListener("change", () =>
        saveLastDeckSelection(1, p1Select.value)
      );
    if (p2Select)
      p2Select.addEventListener("change", () =>
        saveLastDeckSelection(2, p2Select.value)
      );
    if (addDeckBtn) addDeckBtn.addEventListener("click", handleAddDeck);
    if (backToSetupBtn)
      backToSetupBtn.addEventListener("click", showMainSidebarView);
    if (switchBtnFooter) {
      switchBtnFooter.addEventListener("click", () => {
        if (!bodyElement.classList.contains("deck-view-active")) {
          switchPlayer();
        } else {
          console.log("Switch button ignored (deck view active).");
        }
      });
    }
    if (spacebarToggleBtn)
      spacebarToggleBtn.addEventListener("click", handleSpacebarToggle);

    // --- Register IPC Event Listeners ---
    // These functions are defined in preload.js and call ipcRenderer.on
    try {
      onLobbySuccess(onGameReady);
      onAutoSetupError(onSetupError);
      onResetSuccess(onResetComplete);
      onResetError(onResetFail);
      onTriggerSwitch(handleTriggerSwitch);
      onPlayerSwitched(updateActivePlayerVisuals);
      onSetSidebarCollapsed(handleSetSidebarCollapsed);
      onCollapseSidebarRequest(handleCollapseRequest);
      onShowSpinner(handleShowSpinner);
      onHideSpinner(handleHideSpinner);
    } catch (error) {
      console.error("Error setting up IPC listeners:", error);
      alert(
        "Error connecting to main process. App may not function correctly."
      );
    }

    // Cleanup listeners on window close/reload
    window.addEventListener("beforeunload", () => {
      console.log("Removing IPC listeners.");
      if (removeAllListeners) {
        try {
          // Call the cleanup function exposed from preload.js
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
        } catch (e) {
          console.error("Error removing listeners:", e);
        }
      }
    });
  }

  // Main initialization function called after DOM is loaded
  function initialize() {
    console.log("Initializing Mirrorbast renderer...");
    loadAppState(); // Load saved state from localStorage
    populateSelects(); // Fill deck dropdowns
    setupEventListeners(); // Attach event listeners
    setSidebarCollapsed(false); // Set initial sidebar state
    showMainSidebarView(); // Show the default view
    updateActivePlayerVisuals(1); // Set initial active player
    if (resetBtn) resetBtn.textContent = "Reset"; // Ensure reset button text is correct
    // --- Ensure Auto Setup button is enabled on initial load ---
    if (autoSetupBtn) {
      autoSetupBtn.textContent = "Auto Setup Game";
      autoSetupBtn.disabled = false;
    }
    console.log("Renderer initialization complete.");
  }

  // Wait for the DOM to be fully loaded before running initialization
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  // Critical error if preload script didn't expose the API
  console.error(
    "Fatal Error: window.api not found. Preload script likely failed."
  );
  alert(
    "Application critical error: Cannot communicate with the main process. Please restart the application or check logs."
  );
}
