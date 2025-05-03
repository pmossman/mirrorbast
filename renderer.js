// renderer.js - Handles UI logic for index.html

// Ensure the api object from preload.js is available
if (window.api) {
  const {
    readClipboard, fetchMetadata, joinLobby, switchPlayer, resetApp, autoSetup,
    onLobbySuccess, onLobbyError, onResetSuccess, onResetError, onAutoSetupError,
    onTriggerSwitch, /* onPreview removed */ removeAllListeners
  } = window.api;

  // --- DOM Elements ---
  const deckInputElement = document.getElementById('deckInput');
  const addDeckBtn = document.getElementById('addDeckBtn');
  const p1Select = document.getElementById('p1Select');
  const p2Select = document.getElementById('p2Select');
  const p1Custom = document.getElementById('p1Custom');
  const p2Custom = document.getElementById('p2Custom');
  const autoSetupBtn = document.getElementById('autoSetupBtn');
  const deckListElement = document.getElementById('deckList');
  const joinBtn = document.getElementById('joinBtn');
  const switchBtn = document.getElementById('switchBtn');
  // Removed previewContainer and previewImg elements
  const resetBtn = document.getElementById('resetBtn');

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

  /** Fetches metadata, adds a deck to the list, saves, and updates UI. */
  async function handleAddDeck() {
    const url = deckInputElement.value.trim();
    if (!url) { alert("Please enter a deck URL."); return; }
    if (savedDecks.some(deck => deck.url === url)) { alert("This deck URL is already saved."); deckInputElement.value = ''; return; }

    addDeckBtn.textContent = 'Adding...'; addDeckBtn.disabled = true;
    try {
      console.log(`Fetching metadata: ${url}`);
      const metadata = await fetchMetadata(url);
      if (metadata && metadata.name && metadata.name !== 'Fetch Error' && metadata.name !== 'Invalid Metadata') {
         savedDecks.push({ url, ...metadata }); saveDecks(); renderDeckList(); populateSelects(); deckInputElement.value = '';
         console.log(`Deck "${metadata.name}" added.`);
      } else {
         alert(`Could not fetch valid metadata. Error: ${metadata?.name || 'Unknown'}. Check link.`);
         console.warn("Metadata fetch failed:", url, "Received:", metadata);
      }
    } catch (error) { console.error("Error adding deck:", error); alert(`Failed add deck: ${error.message}`); }
    finally { addDeckBtn.textContent = 'Add'; addDeckBtn.disabled = false; }
  }

  /** Renders the list of saved decks in the UI. */
  function renderDeckList() {
    deckListElement.innerHTML = '';
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
      const btnCopy = document.createElement('button'); btnCopy.textContent = 'Copy'; btnCopy.className = 'generic'; btnCopy.title = `Copy URL: ${deck.url}`;
      btnCopy.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(deck.url).then(() => { console.log(`Copied: ${deck.url}`); const o = btnCopy.textContent; btnCopy.textContent = 'Copied!'; setTimeout(() => { btnCopy.textContent = o; }, 1500); }).catch(err => console.error('Copy fail:', err)); };
      const btnRefresh = document.createElement('button'); btnRefresh.textContent = 'Refresh'; btnRefresh.className = 'generic'; btnRefresh.title = 'Refresh metadata';
      btnRefresh.onclick = async (e) => {
        e.stopPropagation(); btnRefresh.textContent = '...'; btnRefresh.disabled = true;
        try {
            const newMeta = await fetchMetadata(deck.url);
             if (newMeta && newMeta.name && newMeta.name !== 'Fetch Error' && newMeta.name !== 'Invalid Metadata') {
                savedDecks[index] = { url: deck.url, ...newMeta }; saveDecks(); renderDeckList(); populateSelects(); console.log(`Refreshed: ${newMeta.name}`);
             } else { alert(`Refresh fail: ${newMeta?.name || 'Unknown'}`); console.warn("Refresh fail:", deck.url, newMeta); btnRefresh.textContent = 'Refresh'; btnRefresh.disabled = false; }
        } catch (error) { console.error("Refresh error:", error); alert(`Refresh error: ${error.message}`); btnRefresh.textContent = 'Refresh'; btnRefresh.disabled = false; }
      };
      const btnDelete = document.createElement('button'); btnDelete.textContent = 'Delete'; btnDelete.className = 'generic'; btnDelete.style.backgroundColor = '#a04040'; btnDelete.title = 'Delete deck';
      btnDelete.onclick = (e) => { e.stopPropagation(); if (confirm(`Delete "${deck.name || 'this deck'}"?`)) { savedDecks.splice(index, 1); saveDecks(); renderDeckList(); populateSelects(); console.log(`Deleted: ${deck.name || deck.url}`); } };
      buttonsDiv.append(btnCopy, btnRefresh, btnDelete);
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
  }

  /** Populates the Player 1 and Player 2 select dropdowns. */
  function populateSelects() {
    const currentP1Value = p1Select.value; const currentP2Value = p2Select.value;
    [p1Select, p2Select].forEach(select => {
      select.innerHTML = '';
      if (savedDecks.length === 0) { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Add decks first'; opt.disabled = true; select.append(opt); }
      else { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Select Saved Deck...'; select.append(opt); }
      savedDecks.forEach(deck => { const opt = document.createElement('option'); opt.value = deck.url; opt.textContent = deck.name || 'Unnamed'; opt.title = `${deck.name || 'Unnamed'} (${deck.author || 'Unknown'})`; select.append(opt); });
      const customOpt = document.createElement('option'); customOpt.value = 'custom'; customOpt.textContent = 'Custom URL...'; select.append(customOpt);
    });
    p1Select.value = savedDecks.some(d => d.url === currentP1Value) ? currentP1Value : (currentP1Value === 'custom' ? 'custom' : '');
    p2Select.value = savedDecks.some(d => d.url === currentP2Value) ? currentP2Value : (currentP2Value === 'custom' ? 'custom' : '');
    p1Select.dispatchEvent(new Event('change')); p2Select.dispatchEvent(new Event('change'));
  }

  // Removed updatePreview function

  // --- Event Handlers ---

  /** Handles the click event for the Auto Setup button. */
  function handleAutoSetup() {
    const p1Value = p1Select.value; const p2Value = p2Select.value;
    const p1Url = p1Value === 'custom' ? p1Custom.value.trim() : p1Value;
    const p2Url = p2Value === 'custom' ? p2Custom.value.trim() : p2Value;
    if (!p1Url || p1Value === '') { alert("Select/enter P1 deck URL."); p1Select.focus(); return; }
    if (!p2Url || p2Value === '') { alert("Select/enter P2 deck URL."); p2Select.focus(); return; }
    if (p1Value === 'custom' && !p1Custom.value.trim()) { alert("Enter custom P1 URL."); p1Custom.focus(); return; }
    if (p2Value === 'custom' && !p2Custom.value.trim()) { alert("Enter custom P2 URL."); p2Custom.focus(); return; }
    console.log(`Starting auto-setup: P1=${p1Url}, P2=${p2Url}`);
    autoSetupBtn.textContent = 'Setting Up...'; autoSetupBtn.disabled = true;
    joinBtn.disabled = true; switchBtn.disabled = true; resetBtn.disabled = true;
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
            autoSetupBtn.disabled = true; switchBtn.disabled = true; resetBtn.disabled = true;
            joinLobby(url);
         }
      } else { alert("No valid Karabast lobby link in clipboard."); }
    } catch (error) { console.error("Join lobby error:", error); alert(`Join error: ${error.message}`); }
  }

   /** Handles the click event for the Reset button. */
  function handleReset() {
      if (confirm('Reset both player views to Karabast home?')) {
          console.log('Requesting reset...');
          resetBtn.textContent = 'Resetting...'; resetBtn.disabled = true;
          autoSetupBtn.disabled = true; joinBtn.disabled = true; switchBtn.disabled = true;
          resetApp();
      }
  }

  // --- IPC Event Listeners ---

  /** Handles successful lobby join or auto-setup completion. */
  function onGameReady() {
    console.log("Setup complete.");
    autoSetupBtn.textContent = 'Auto Setup Game'; autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)'; joinBtn.disabled = false;
    switchBtn.disabled = false; resetBtn.disabled = false; resetBtn.textContent = 'Reset Views';
  }

  /** Handles errors during lobby join or auto-setup. */
  function onSetupError(errorMessage) {
    console.error("Setup Error:", errorMessage); alert(`Setup failed: ${errorMessage}`);
    autoSetupBtn.textContent = 'Auto Setup Game'; autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)'; joinBtn.disabled = false;
    switchBtn.disabled = false; resetBtn.disabled = false; resetBtn.textContent = 'Reset Views';
  }

   /** Handles successful application reset. */
   function onResetComplete() {
       console.log("Reset successful.");
       // No preview to clear
       resetBtn.textContent = 'Reset Views'; resetBtn.disabled = false;
       autoSetupBtn.disabled = false; joinBtn.disabled = false; switchBtn.disabled = false;
   }

   /** Handles errors during application reset. */
   function onResetFail(errorMessage) {
       console.error("Reset Error:", errorMessage); alert(`Reset failed: ${errorMessage}`);
       // No preview to clear
       resetBtn.textContent = 'Reset Views'; resetBtn.disabled = false;
       autoSetupBtn.disabled = false; joinBtn.disabled = false; switchBtn.disabled = false;
   }

   /** Handles the trigger to switch players (e.g., from Spacebar). */
   function handleTriggerSwitch() {
       console.log("Renderer: Trigger switch received.");
       switchPlayer();
   }


  // --- Initialization ---

  /** Sets up all event listeners for UI elements and IPC events. */
  function setupEventListeners() {
    addDeckBtn.addEventListener('click', handleAddDeck);
    autoSetupBtn.addEventListener('click', handleAutoSetup);
    joinBtn.addEventListener('click', handleJoinLobby);
    switchBtn.addEventListener('click', () => switchPlayer());
    resetBtn.addEventListener('click', handleReset);
    p1Select.addEventListener('change', () => { p1Custom.style.display = p1Select.value === 'custom' ? 'block' : 'none'; if(p1Select.value === 'custom') p1Custom.focus(); });
    p2Select.addEventListener('change', () => { p2Custom.style.display = p2Select.value === 'custom' ? 'block' : 'none'; if(p2Select.value === 'custom') p2Custom.focus(); });

    // IPC Listeners
    onLobbySuccess(onGameReady);
    onLobbyError(onSetupError);
    onAutoSetupError(onSetupError);
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    // Removed onPreview listener
    onTriggerSwitch(handleTriggerSwitch);

     window.addEventListener('beforeunload', () => {
         console.log("Removing IPC listeners.");
         if (removeAllListeners) {
            try { // Remove only listeners that were added
                removeAllListeners('lobby-success'); removeAllListeners('lobby-error');
                removeAllListeners('auto-setup-error'); removeAllListeners('reset-success');
                removeAllListeners('reset-error'); removeAllListeners('trigger-switch');
                // Removed 'preview-updated' from cleanup
            } catch (e) { console.error("Error removing listeners:", e); }
         }
     });
    console.log("Event listeners set up.");
  }

  /** Initializes the renderer application. */
  function initialize() {
    console.log("Initializing renderer...");
    loadDecks(); renderDeckList(); populateSelects(); setupEventListeners();
    // No initial preview hiding needed as element is removed from HTML
    resetBtn.textContent = 'Reset Views';
    console.log("Renderer initialization complete.");
  }

  document.addEventListener('DOMContentLoaded', initialize);

} else {
  console.error("Fatal Error: window.api not found."); alert("Application cannot start.");
}
