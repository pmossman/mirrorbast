// renderer.js - Handles UI logic for index.html

if (window.api) {
  const {
    readClipboard, fetchMetadata, joinLobby, switchPlayer, resetApp, autoSetup,
    hideBrowserView, showBrowserView, // Added new API functions
    onLobbySuccess, onLobbyError, onResetSuccess, onResetError, onAutoSetupError,
    onTriggerSwitch, removeAllListeners
  } = window.api;

  // --- DOM Elements ---
  const bodyElement = document.body; // Get body element for class toggling
  // Main View Elements
  const mainSidebarContent = document.getElementById('mainSidebarContent');
  const p1Select = document.getElementById('p1Select');
  const p2Select = document.getElementById('p2Select');
  const p1UrlInput = document.getElementById('p1UrlInput'); // New input
  const p1AddSelectBtn = document.getElementById('p1AddSelectBtn'); // New button
  const p2UrlInput = document.getElementById('p2UrlInput'); // New input
  const p2AddSelectBtn = document.getElementById('p2AddSelectBtn'); // New button
  const autoSetupBtn = document.getElementById('autoSetupBtn');
  const joinBtn = document.getElementById('joinBtn');
  const switchBtn = document.getElementById('switchBtn');
  const manageDecksBtn = document.getElementById('manageDecksBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Deck Management View Elements
  const deckManagementView = document.getElementById('deckManagementView');
  const deckInputElement = document.getElementById('deckInput'); // Now inside deck management view
  const addDeckBtn = document.getElementById('addDeckBtn');       // Now inside deck management view
  const deckListElement = document.getElementById('deckList');     // Now inside deck management view
  const backToSetupBtn = document.getElementById('backToSetupBtn');

  // --- State ---
  const DECK_STORAGE_KEY = 'savedDecks';
  let savedDecks = [];

  // --- Deck Management Functions ---

  /** Loads decks from localStorage. */
  function loadDecks() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || '[]');
      console.log(`Loaded ${savedDecks.length} decks from storage.`);
    } catch (error) {
      console.error("Error loading decks:", error); savedDecks = []; localStorage.removeItem(DECK_STORAGE_KEY);
    }
  }

  /** Saves the current decks array to localStorage. */
  function saveDecks() {
    try { localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedDecks)); }
    catch (error) { console.error("Error saving decks:", error); alert("Error saving deck list."); }
  }

  /** Fetches metadata, adds a deck to the list, saves, and updates UI (list only). */
  async function handleAddDeck() { // Used only in Manage Decks view now
    const url = deckInputElement.value.trim();
    if (!url) { alert("Please enter a deck URL."); return; }
    if (savedDecks.some(deck => deck.url === url)) { alert("This deck URL is already saved."); deckInputElement.value = ''; return; }

    addDeckBtn.textContent = 'Adding...'; addDeckBtn.disabled = true;
    try {
      console.log(`Fetching metadata: ${url}`);
      const metadata = await fetchMetadata(url);
      if (metadata && metadata.name && metadata.name !== 'Fetch Error' && metadata.name !== 'Invalid Metadata') {
         savedDecks.push({ url, ...metadata }); saveDecks();
         renderDeckList(); // Update the list in the management view
         populateSelects(); // Update the dropdowns in the main view
         deckInputElement.value = ''; // Clear input field on success
         console.log(`Deck "${metadata.name}" added.`);
      } else {
         alert(`Could not fetch valid metadata. Error: ${metadata?.name || 'Unknown'}. Check link.`);
         console.warn("Metadata fetch failed:", url, "Received:", metadata);
      }
    } catch (error) { console.error("Error adding deck:", error); alert(`Failed add deck: ${error.message}`); }
    finally { addDeckBtn.textContent = 'Add Deck'; addDeckBtn.disabled = false; } // Restore button text
  }

  /** Renders the list of saved decks in the Deck Management View. */
  function renderDeckList() {
    deckListElement.innerHTML = ''; // Clear existing list
    if (savedDecks.length === 0) {
        const li = document.createElement('li'); li.textContent = 'No decks saved yet.'; li.style.fontStyle = 'italic'; li.style.color = '#888';
        deckListElement.appendChild(li); return;
    }
    savedDecks.forEach((deck, index) => {
      const li = document.createElement('li');
      const infoDiv = document.createElement('div');
      const nameStrong = document.createElement('strong'); nameStrong.textContent = deck.name || 'Unnamed'; nameStrong.title = deck.name || 'Unnamed';
      const authorSpan = document.createElement('span'); authorSpan.className = 'meta'; authorSpan.textContent = `by ${deck.author || 'Unknown'}`; authorSpan.title = `by ${deck.author || 'Unknown'}`;
      infoDiv.append(nameStrong, document.createElement('br'), authorSpan);
      const buttonsDiv = document.createElement('div'); buttonsDiv.style.display = 'flex'; buttonsDiv.style.flexShrink = '0'; buttonsDiv.style.gap = '4px';
      const btnRefresh = document.createElement('button'); btnRefresh.textContent = 'Refresh'; btnRefresh.className = 'generic'; btnRefresh.title = 'Refresh metadata';
      btnRefresh.onclick = async (e) => { /* ... refresh logic ... */ }; // Keep refresh logic
      const btnDelete = document.createElement('button'); btnDelete.textContent = 'Delete'; btnDelete.className = 'generic'; btnDelete.style.backgroundColor = '#a04040'; btnDelete.title = 'Delete deck';
      btnDelete.onclick = (e) => { /* ... delete logic ... */ }; // Keep delete logic
      buttonsDiv.append(btnRefresh, btnDelete);
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
     // Re-attach refresh/delete logic inside the loop as elements are recreated
     deckListElement.querySelectorAll('li').forEach((li, index) => {
        const deck = savedDecks[index];
        const btnRefresh = li.querySelector('button:nth-of-type(1)');
        const btnDelete = li.querySelector('button:nth-of-type(2)');

        if (btnRefresh) {
            btnRefresh.onclick = async (e) => {
                e.stopPropagation(); btnRefresh.textContent = '...'; btnRefresh.disabled = true;
                try {
                    const newMeta = await fetchMetadata(deck.url);
                    if (newMeta && newMeta.name && newMeta.name !== 'Fetch Error' && newMeta.name !== 'Invalid Metadata') {
                        savedDecks[index] = { url: deck.url, ...newMeta }; saveDecks(); renderDeckList(); populateSelects(); console.log(`Refreshed: ${newMeta.name}`);
                    } else { alert(`Refresh fail: ${newMeta?.name || 'Unknown'}`); console.warn("Refresh fail:", deck.url, newMeta); btnRefresh.textContent = 'Refresh'; btnRefresh.disabled = false; }
                } catch (error) { console.error("Refresh error:", error); alert(`Refresh error: ${error.message}`); btnRefresh.textContent = 'Refresh'; btnRefresh.disabled = false; }
            };
        }
        if (btnDelete) {
            btnDelete.onclick = (e) => { e.stopPropagation(); if (confirm(`Delete "${deck.name || 'this deck'}"?`)) { savedDecks.splice(index, 1); saveDecks(); renderDeckList(); populateSelects(); console.log(`Deleted: ${deck.name || deck.url}`); } };
        }
    });
  }

  /** Populates the Player 1 and Player 2 select dropdowns in the Main View. */
  function populateSelects() {
    const currentP1Value = p1Select.value; const currentP2Value = p2Select.value;
    [p1Select, p2Select].forEach(select => {
      select.innerHTML = ''; // Clear existing options
      // Add a "Select..." option first
      const defaultOpt = document.createElement('option');
      defaultOpt.value = ''; // Important: value is empty string
      defaultOpt.textContent = 'Select Deck...';
      select.append(defaultOpt);

      // Add options for each saved deck
      savedDecks.forEach(deck => {
        const opt = document.createElement('option');
        opt.value = deck.url;
        opt.textContent = deck.name || 'Unnamed Deck';
        opt.title = `${deck.name || 'Unnamed Deck'} (${deck.author || 'Unknown'})`; // Tooltip
        select.append(opt);
      });
      // Removed "Custom URL" option
    });
    // Try to restore previous selection if still valid, otherwise default to "Select..." option
    p1Select.value = savedDecks.some(d => d.url === currentP1Value) ? currentP1Value : '';
    p2Select.value = savedDecks.some(d => d.url === currentP2Value) ? currentP2Value : '';
  }

  // --- UI View Switching ---

  /** Shows the main setup/gameplay sidebar view and the BrowserView. */
  function showMainSidebarView() {
      bodyElement.classList.remove('deck-view-active'); // Remove class from body
      deckManagementView.style.display = 'none';
      mainSidebarContent.style.display = 'flex'; // Use 'flex' since it's a flex container
      showBrowserView(); // Tell main process to show the BrowserView
      console.log("Switched to Main Sidebar View");
  }

  /** Shows the deck management sidebar view (full window) and hides the BrowserView. */
  function showDeckManagementView() {
      hideBrowserView(); // Tell main process to hide the BrowserView
      bodyElement.classList.add('deck-view-active'); // Add class to body
      mainSidebarContent.style.display = 'none';
      deckManagementView.style.display = 'flex'; // Use 'flex' since it's a flex container
      renderDeckList(); // Re-render the list when showing the view
      console.log("Switched to Deck Management View");
  }


  // --- Event Handlers ---

 /**
   * Handles adding a URL from the quick-add input, saving it,
   * and selecting it in the specified dropdown.
   * @param {HTMLInputElement} urlInputEl - The input element containing the URL.
   * @param {HTMLSelectElement} targetSelectEl - The dropdown to select the deck in.
   * @param {HTMLButtonElement} addButtonEl - The button that was clicked.
   */
  async function handleAddAndSelectDeck(urlInputEl, targetSelectEl, addButtonEl) {
      const url = urlInputEl.value.trim();
      if (!url) { alert("Please paste a deck URL."); return; }

      const originalButtonText = addButtonEl.textContent;
      addButtonEl.textContent = 'Adding...';
      addButtonEl.disabled = true;

      try {
          // Check if already saved
          const existingDeck = savedDecks.find(deck => deck.url === url);
          if (existingDeck) {
              console.log("Deck already saved, selecting it.");
              populateSelects(); // Ensure dropdown is up-to-date
              targetSelectEl.value = url; // Select the existing deck
              urlInputEl.value = ''; // Clear input
          } else {
              // Not saved, fetch and add
              console.log(`Fetching metadata for quick add: ${url}`);
              const metadata = await fetchMetadata(url);
              if (metadata && metadata.name && metadata.name !== 'Fetch Error' && metadata.name !== 'Invalid Metadata') {
                  savedDecks.push({ url, ...metadata });
                  saveDecks();
                  populateSelects(); // Update dropdowns
                  targetSelectEl.value = url; // Select the newly added deck
                  urlInputEl.value = ''; // Clear input
                  console.log(`Deck "${metadata.name}" added and selected.`);
              } else {
                  alert(`Could not fetch valid metadata. Error: ${metadata?.name || 'Unknown'}. Check link.`);
                  console.warn("Metadata fetch failed:", url, "Received:", metadata);
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
    const p1Url = p1Select.value; // Directly use selected value
    const p2Url = p2Select.value; // Directly use selected value

    // Validate selections
    if (!p1Url) { alert("Please select a deck for Player 1."); p1Select.focus(); return; }
    if (!p2Url) { alert("Please select a deck for Player 2."); p2Select.focus(); return; }

    console.log(`Starting auto-setup: P1=${p1Url}, P2=${p2Url}`);
    autoSetupBtn.textContent = 'Setting Up...'; autoSetupBtn.disabled = true;
    joinBtn.disabled = true; switchBtn.disabled = true; resetBtn.disabled = true; manageDecksBtn.disabled = true;
    p1AddSelectBtn.disabled = true; p2AddSelectBtn.disabled = true; // Disable quick add buttons too
    autoSetup(p1Url, p2Url);
  }

  /** Handles the click event for the Join Lobby button. */
  async function handleJoinLobby() {
    try {
      const url = await readClipboard();
      if (url && url.includes('karabast.net/lobby')) {
         if (confirm(`Join lobby?\n\n${url}`)) {
            console.log(`Joining lobby: ${url}`);
            joinBtn.textContent = 'Joining...'; joinBtn.disabled = true;
            autoSetupBtn.disabled = true; switchBtn.disabled = true; resetBtn.disabled = true; manageDecksBtn.disabled = true;
            p1AddSelectBtn.disabled = true; p2AddSelectBtn.disabled = true;
            joinLobby(url);
         }
      } else { alert("No valid Karabast lobby link in clipboard."); }
    } catch (error) { console.error("Join lobby error:", error); alert(`Join error: ${error.message}`); }
  }

   /** Handles the click event for the Reset button. */
  function handleReset() {
      // Reset should only be available from the main view
      if (bodyElement.classList.contains('deck-view-active')) return;

      if (confirm('Reset both player views to Karabast home?')) {
          console.log('Requesting reset...');
          resetBtn.textContent = 'Resetting...'; resetBtn.disabled = true;
          autoSetupBtn.disabled = true; joinBtn.disabled = true; switchBtn.disabled = true; manageDecksBtn.disabled = true;
          p1AddSelectBtn.disabled = true; p2AddSelectBtn.disabled = true;
          resetApp();
      }
  }

  // --- IPC Event Listeners ---

  /** Handles successful lobby join or auto-setup completion. */
  function onGameReady() {
    console.log("Setup complete.");
    autoSetupBtn.textContent = 'Auto Setup Game'; autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)'; joinBtn.disabled = false;
    switchBtn.disabled = false; resetBtn.disabled = false; resetBtn.textContent = 'Reset Views'; manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false; p2AddSelectBtn.disabled = false;
    showMainSidebarView();
  }

  /** Handles errors during lobby join or auto-setup. */
  function onSetupError(errorMessage) {
    console.error("Setup Error:", errorMessage); alert(`Setup failed: ${errorMessage}`);
    autoSetupBtn.textContent = 'Auto Setup Game'; autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)'; joinBtn.disabled = false;
    switchBtn.disabled = false; resetBtn.disabled = false; resetBtn.textContent = 'Reset Views'; manageDecksBtn.disabled = false;
    p1AddSelectBtn.disabled = false; p2AddSelectBtn.disabled = false;
    showMainSidebarView();
  }

   /** Handles successful application reset. */
   function onResetComplete() {
       console.log("Reset successful.");
       resetBtn.textContent = 'Reset Views'; resetBtn.disabled = false;
       autoSetupBtn.disabled = false; joinBtn.disabled = false; switchBtn.disabled = false; manageDecksBtn.disabled = false;
       p1AddSelectBtn.disabled = false; p2AddSelectBtn.disabled = false;
       showMainSidebarView(); // Ensure main view is shown
   }

   /** Handles errors during application reset. */
   function onResetFail(errorMessage) {
       console.error("Reset Error:", errorMessage); alert(`Reset failed: ${errorMessage}`);
       resetBtn.textContent = 'Reset Views'; resetBtn.disabled = false;
       autoSetupBtn.disabled = false; joinBtn.disabled = false; switchBtn.disabled = false; manageDecksBtn.disabled = false;
       p1AddSelectBtn.disabled = false; p2AddSelectBtn.disabled = false;
       showMainSidebarView(); // Ensure main view is shown
   }

   /** Handles the trigger to switch players (e.g., from Spacebar). */
   function handleTriggerSwitch() {
       // Only switch if not in deck management view
       if (!bodyElement.classList.contains('deck-view-active')) {
           console.log("Renderer: Trigger switch received.");
           switchPlayer();
       } else {
           console.log("Renderer: Trigger switch ignored (deck view active).");
       }
   }


  // --- Initialization ---

  /** Sets up all event listeners for UI elements and IPC events. */
  function setupEventListeners() {
    // Main View Buttons / Inputs
    autoSetupBtn.addEventListener('click', handleAutoSetup);
    joinBtn.addEventListener('click', handleJoinLobby);
    switchBtn.addEventListener('click', () => switchPlayer());
    resetBtn.addEventListener('click', handleReset);
    manageDecksBtn.addEventListener('click', showDeckManagementView);
    // New Quick Add Buttons
    p1AddSelectBtn.addEventListener('click', () => handleAddAndSelectDeck(p1UrlInput, p1Select, p1AddSelectBtn));
    p2AddSelectBtn.addEventListener('click', () => handleAddAndSelectDeck(p2UrlInput, p2Select, p2AddSelectBtn));

    // Deck Management View Buttons
    addDeckBtn.addEventListener('click', handleAddDeck);
    backToSetupBtn.addEventListener('click', showMainSidebarView);

    // IPC Listeners
    onLobbySuccess(onGameReady);
    onLobbyError(onSetupError);
    onAutoSetupError(onSetupError);
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    onTriggerSwitch(handleTriggerSwitch);

     window.addEventListener('beforeunload', () => {
         console.log("Removing IPC listeners.");
         if (removeAllListeners) {
            try {
                removeAllListeners('lobby-success'); removeAllListeners('lobby-error');
                removeAllListeners('auto-setup-error'); removeAllListeners('reset-success');
                removeAllListeners('reset-error'); removeAllListeners('trigger-switch');
            } catch (e) { console.error("Error removing listeners:", e); }
         }
     });
    console.log("Event listeners set up.");
  }

  /** Initializes the renderer application. */
  function initialize() {
    console.log("Initializing renderer...");
    loadDecks();
    populateSelects(); // Populate dropdowns initially
    setupEventListeners();
    showMainSidebarView(); // Ensure the main view is visible initially
    resetBtn.textContent = 'Reset Views';
    console.log("Renderer initialization complete.");
  }

  document.addEventListener('DOMContentLoaded', initialize);

} else {
  console.error("Fatal Error: window.api not found."); alert("Application cannot start.");
}
