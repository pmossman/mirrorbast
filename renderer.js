// renderer.js - Handles UI logic for index.html

// Ensure the api object from preload.js is available
if (window.api) {
  const {
    readClipboard, fetchMetadata, joinLobby, switchPlayer, resetApp, autoSetup,
    onLobbySuccess, onLobbyError, onResetSuccess, onResetError, onAutoSetupError,
    onTriggerSwitch, onPreview, removeAllListeners // Assuming removeAllListeners is exposed
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
  const previewContainer = document.getElementById('previewContainer');
  const previewImg = document.getElementById('previewImg');
  const resetBtn = document.getElementById('resetBtn');

  // --- State ---
  const DECK_STORAGE_KEY = 'savedDecks';
  let savedDecks = [];

  // --- Deck Management Functions ---

  /**
   * Loads decks from localStorage.
   */
  function loadDecks() {
    try {
      savedDecks = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || '[]');
      console.log(`Loaded ${savedDecks.length} decks from storage.`);
    } catch (error) {
      console.error("Error loading decks from localStorage:", error);
      savedDecks = []; // Reset to empty array on error
      localStorage.removeItem(DECK_STORAGE_KEY); // Clear potentially corrupted data
    }
  }

  /**
   * Saves the current decks array to localStorage.
   */
  function saveDecks() {
    try {
      localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(savedDecks));
      // console.log(`Saved ${savedDecks.length} decks to storage.`); // Reduce console noise
    } catch (error) {
      console.error("Error saving decks to localStorage:", error);
      // Optionally notify the user
      alert("Error saving deck list. Storage might be full or corrupted.");
    }
  }

  /**
   * Fetches metadata, adds a deck to the list, saves, and updates UI.
   */
  async function handleAddDeck() {
    const url = deckInputElement.value.trim();
    if (!url) {
      alert("Please enter a deck URL.");
      return;
    }
    // Basic check to prevent adding duplicates
    if (savedDecks.some(deck => deck.url === url)) {
      alert("This deck URL is already saved.");
      // Optionally highlight the existing deck or clear the input
      deckInputElement.value = '';
      return;
    }

    // Add visual feedback while fetching
    addDeckBtn.textContent = 'Adding...';
    addDeckBtn.disabled = true;

    try {
      console.log(`Fetching metadata for new deck: ${url}`);
      const metadata = await fetchMetadata(url);
      // Check for valid metadata (not the error state)
      if (metadata && metadata.name && metadata.name !== 'Fetch Error' && metadata.name !== 'Invalid Metadata') {
         savedDecks.push({ url, ...metadata });
         saveDecks();
         renderDeckList();
         populateSelects();
         deckInputElement.value = ''; // Clear input field on success
         console.log(`Deck "${metadata.name}" added successfully.`);
      } else {
         // Handle cases where metadata fetch failed or returned specific error states
         alert(`Could not fetch valid metadata for URL. Error: ${metadata?.name || 'Unknown error'}. Please check the link.`);
         console.warn("Metadata fetch failed or returned invalid data for:", url, "Received:", metadata);
      }
    } catch (error) {
      console.error("Error adding deck:", error);
      alert(`Failed to add deck: ${error.message}`);
    } finally {
      // Restore button state
      addDeckBtn.textContent = 'Add';
      addDeckBtn.disabled = false;
    }
  }

  /**
   * Renders the list of saved decks in the UI.
   */
  function renderDeckList() {
    deckListElement.innerHTML = ''; // Clear existing list
    if (savedDecks.length === 0) {
        // Provide clearer feedback if the list is empty
        const li = document.createElement('li');
        li.textContent = 'No decks saved yet.';
        li.style.fontStyle = 'italic';
        li.style.color = '#888';
        deckListElement.appendChild(li);
        return;
    }

    savedDecks.forEach((deck, index) => {
      const li = document.createElement('li');

      // Deck Info Div
      const infoDiv = document.createElement('div');
      const nameStrong = document.createElement('strong');
      nameStrong.textContent = deck.name || 'Unnamed Deck';
      nameStrong.title = deck.name || 'Unnamed Deck'; // Tooltip for long names
      const authorSpan = document.createElement('span');
      authorSpan.className = 'meta';
      authorSpan.textContent = `by ${deck.author || 'Unknown Author'}`;
      authorSpan.title = `by ${deck.author || 'Unknown Author'}`; // Tooltip
      infoDiv.appendChild(nameStrong);
      infoDiv.appendChild(document.createElement('br'));
      infoDiv.appendChild(authorSpan);

      // Buttons Div
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.display = 'flex'; // Align buttons horizontally
      buttonsDiv.style.flexShrink = '0'; // Prevent button container from shrinking
      buttonsDiv.style.gap = '4px'; // Add small gap between buttons

      // Copy Button
      const btnCopy = document.createElement('button');
      btnCopy.textContent = 'Copy';
      btnCopy.className = 'generic';
      btnCopy.title = `Copy URL: ${deck.url}`;
      btnCopy.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering potential li click handlers
        navigator.clipboard.writeText(deck.url)
          .then(() => {
              console.log(`Copied URL: ${deck.url}`);
              // Optional: Provide visual feedback (e.g., change text briefly)
              const originalText = btnCopy.textContent;
              btnCopy.textContent = 'Copied!';
              setTimeout(() => { btnCopy.textContent = originalText; }, 1500);
          })
          .catch(err => console.error('Failed to copy URL:', err));
      };

      // Refresh Button
      const btnRefresh = document.createElement('button');
      btnRefresh.textContent = 'Refresh';
      btnRefresh.className = 'generic';
      btnRefresh.title = 'Refresh deck metadata';
      btnRefresh.onclick = async (e) => {
        e.stopPropagation();
        btnRefresh.textContent = '...'; // Indicate loading
        btnRefresh.disabled = true;
        try {
            const newMeta = await fetchMetadata(deck.url);
             // Check for valid metadata before updating
             if (newMeta && newMeta.name && newMeta.name !== 'Fetch Error' && newMeta.name !== 'Invalid Metadata') {
                savedDecks[index] = { url: deck.url, ...newMeta };
                saveDecks();
                renderDeckList(); // Re-render the whole list (simplest)
                populateSelects(); // Update dropdowns if names changed
                console.log(`Refreshed metadata for: ${newMeta.name}`);
             } else {
                 alert(`Failed to refresh metadata for ${deck.name || deck.url}. Error: ${newMeta?.name || 'Unknown'}`);
                 console.warn("Metadata refresh failed for:", deck.url, "Received:", newMeta);
                 // Restore button state even on failure
                 btnRefresh.textContent = 'Refresh';
                 btnRefresh.disabled = false;
             }
        } catch (error) {
            console.error("Error refreshing deck metadata:", error);
            alert(`Error refreshing metadata: ${error.message}`);
            btnRefresh.textContent = 'Refresh'; // Restore button state
            btnRefresh.disabled = false;
        }
        // Note: 'finally' block is tricky here because re-rendering removes the original button.
        // State restoration is handled within try/catch based on outcome.
      };

      // Delete Button
      const btnDelete = document.createElement('button');
      btnDelete.textContent = 'Delete';
      btnDelete.className = 'generic';
      btnDelete.style.backgroundColor = '#a04040'; // Darker red for delete
      btnDelete.title = 'Delete this deck';
      btnDelete.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${deck.name || 'this deck'}"?`)) {
          savedDecks.splice(index, 1);
          saveDecks();
          renderDeckList(); // Re-render the list
          populateSelects(); // Update dropdowns
          console.log(`Deleted deck: ${deck.name || deck.url}`);
        }
      };

      buttonsDiv.append(btnCopy, btnRefresh, btnDelete);
      li.append(infoDiv, buttonsDiv);
      deckListElement.appendChild(li);
    });
  }

  /**
   * Populates the Player 1 and Player 2 select dropdowns.
   */
  function populateSelects() {
    const currentP1Value = p1Select.value;
    const currentP2Value = p2Select.value;

    [p1Select, p2Select].forEach(select => {
      select.innerHTML = ''; // Clear existing options

      // Add a default placeholder option if no decks exist
      if (savedDecks.length === 0) {
          const placeholderOpt = document.createElement('option');
          placeholderOpt.value = '';
          placeholderOpt.textContent = 'Add decks first';
          placeholderOpt.disabled = true;
          select.appendChild(placeholderOpt);
      } else {
           // Add a "Select..." option
           const selectOpt = document.createElement('option');
           selectOpt.value = '';
           selectOpt.textContent = 'Select Saved Deck...';
           // selectOpt.disabled = true; // Optional: make it non-selectable
           select.appendChild(selectOpt);
      }

      // Add options for each saved deck
      savedDecks.forEach(deck => {
        const opt = document.createElement('option');
        opt.value = deck.url;
        opt.textContent = deck.name || 'Unnamed Deck';
        opt.title = `${deck.name || 'Unnamed Deck'} (${deck.author || 'Unknown'})`; // Tooltip
        select.appendChild(opt);
      });

      // Add the 'Custom URL' option
      const customOpt = document.createElement('option');
      customOpt.value = 'custom';
      customOpt.textContent = 'Custom URL...';
      select.appendChild(customOpt);
    });

    // Try to restore previous selection, falling back to "Select..." or "Custom"
    p1Select.value = savedDecks.some(d => d.url === currentP1Value) ? currentP1Value : (currentP1Value === 'custom' ? 'custom' : '');
    p2Select.value = savedDecks.some(d => d.url === currentP2Value) ? currentP2Value : (currentP2Value === 'custom' ? 'custom' : '');

    // Trigger change event to update custom input visibility
    p1Select.dispatchEvent(new Event('change'));
    p2Select.dispatchEvent(new Event('change'));
  }

  // --- UI Update Functions ---

  /**
   * Updates the opponent preview image.
   * @param {string} dataUrl - The base64 encoded image data URL, or empty string.
   */
  function updatePreview(dataUrl) {
    // Check if the received data looks like a valid base64 image data URL
    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
      previewImg.src = dataUrl;
      previewImg.style.display = ''; // Ensure img tag is visible
      previewContainer.style.display = 'block'; // Show container
      // console.log("Preview updated."); // Reduce noise
    } else {
      // If dataUrl is empty or invalid, hide the preview area
      previewImg.src = ''; // Clear src to show alt text or nothing
      previewImg.style.display = 'none'; // Hide the img tag itself
      previewContainer.style.display = 'none'; // Hide container
      if (dataUrl) { // Log if we received something unexpected
          console.warn("Received invalid data for preview:", dataUrl.substring(0, 50) + "...");
      } else {
          // console.log("Preview cleared."); // Reduce noise
      }
    }
  }

  // --- Event Handlers ---

  /**
   * Handles the click event for the Auto Setup button.
   */
  function handleAutoSetup() {
    const p1Value = p1Select.value;
    const p2Value = p2Select.value;
    const p1Url = p1Value === 'custom' ? p1Custom.value.trim() : p1Value;
    const p2Url = p2Value === 'custom' ? p2Custom.value.trim() : p2Value;

    // Validate selections/inputs
    if (!p1Url || p1Value === '') {
        alert("Please select or enter a deck URL for Player 1.");
        p1Select.focus();
        return;
    }
     if (!p2Url || p2Value === '') {
        alert("Please select or enter a deck URL for Player 2.");
        p2Select.focus();
        return;
    }
     if (p1Value === 'custom' && !p1Custom.value.trim()) {
        alert("Please enter a custom URL for Player 1.");
        p1Custom.focus();
        return;
    }
     if (p2Value === 'custom' && !p2Custom.value.trim()) {
        alert("Please enter a custom URL for Player 2.");
        p2Custom.focus();
        return;
    }

    console.log(`Starting auto-setup with P1: ${p1Url}, P2: ${p2Url}`);
    // Add visual feedback
    autoSetupBtn.textContent = 'Setting Up...';
    autoSetupBtn.disabled = true;
    joinBtn.disabled = true; // Disable other actions during setup
    switchBtn.disabled = true;

    autoSetup(p1Url, p2Url); // Call main process function
  }

  /**
   * Handles the click event for the Join Lobby button.
   */
  async function handleJoinLobby() {
    try {
      const urlFromClipboard = await readClipboard();
      if (urlFromClipboard && urlFromClipboard.includes('karabast.net/lobby')) {
         if (confirm(`Join lobby using this link from clipboard?\n\n${urlFromClipboard}`)) {
            console.log(`Joining lobby manually: ${urlFromClipboard}`);
            // Add visual feedback
            joinBtn.textContent = 'Joining...';
            joinBtn.disabled = true;
            autoSetupBtn.disabled = true; // Disable other actions
            switchBtn.disabled = true;
            joinLobby(urlFromClipboard);
         }
      } else {
        alert("No valid Karabast lobby link found in clipboard. Please copy the invite link first.");
      }
    } catch (error) {
      console.error("Error reading clipboard or joining lobby:", error);
      alert(`Error joining lobby: ${error.message}`);
    }
  }

   /**
   * Handles the click event for the Reset button.
   */
  function handleReset() {
      if (confirm('Are you sure you want to reload both player views to the Karabast homepage? This will disconnect any active game.')) {
          console.log('Requesting application reset...');
          resetBtn.textContent = 'Resetting...';
          resetBtn.disabled = true;
          // Disable other controls during reset
          autoSetupBtn.disabled = true;
          joinBtn.disabled = true;
          switchBtn.disabled = true;
          resetApp(); // Call main process function
      }
  }

  // --- IPC Event Listeners ---

  /**
   * Handles successful lobby join or auto-setup completion.
   */
  function onGameReady() {
    console.log("Lobby joined or auto-setup complete.");
    // *** REMOVED ALERT ***
    // alert("Game setup complete! Player 2 is now active.");
    // Restore button states
    autoSetupBtn.textContent = 'Auto Setup Game';
    autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)';
    joinBtn.disabled = false;
    switchBtn.disabled = false; // Re-enable controls
    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Views';
  }

  /**
   * Handles errors during lobby join or auto-setup.
   * @param {string} errorMessage - The error message from the main process.
   */
  function onSetupError(errorMessage) {
    console.error("Setup Error:", errorMessage);
    alert(`Setup failed: ${errorMessage}`);
    // Restore button states
    autoSetupBtn.textContent = 'Auto Setup Game';
    autoSetupBtn.disabled = false;
    joinBtn.textContent = 'Join Lobby (Paste Link First)';
    joinBtn.disabled = false;
    switchBtn.disabled = false; // Re-enable controls even on error
    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Views';
  }

   /**
   * Handles successful application reset.
   */
   function onResetComplete() {
       console.log("Application reset successful.");
       // alert("Player views have been reloaded."); // Optional: remove alert here too?
       updatePreview(''); // Clear preview after reset
       // Restore button states
       resetBtn.textContent = 'Reset Views';
       resetBtn.disabled = false;
       autoSetupBtn.disabled = false;
       joinBtn.disabled = false;
       switchBtn.disabled = false;
   }

   /**
   * Handles errors during application reset.
    * @param {string} errorMessage - The error message from the main process.
   */
   function onResetFail(errorMessage) {
       console.error("Reset Error:", errorMessage);
       alert(`Reset failed: ${errorMessage}`);
       // Restore button states
       resetBtn.textContent = 'Reset Views';
       resetBtn.disabled = false;
       autoSetupBtn.disabled = false;
       joinBtn.disabled = false;
       switchBtn.disabled = false;
   }

   /**
    * Handles the trigger to switch players (e.g., from Spacebar).
    */
   function handleTriggerSwitch() {
       console.log("Trigger switch received from main process.");
       // Call the exposed API function to tell the main process to switch
       switchPlayer();
   }


  // --- Initialization ---

  /**
   * Sets up all event listeners for UI elements and IPC events.
   */
  function setupEventListeners() {
    // Button Clicks
    addDeckBtn.addEventListener('click', handleAddDeck);
    autoSetupBtn.addEventListener('click', handleAutoSetup);
    joinBtn.addEventListener('click', handleJoinLobby);
    switchBtn.addEventListener('click', () => switchPlayer()); // Direct call for button click
    resetBtn.addEventListener('click', handleReset);


    // Select Changes (for showing/hiding custom URL inputs)
    p1Select.addEventListener('change', () => {
      p1Custom.style.display = p1Select.value === 'custom' ? 'block' : 'none';
      if(p1Select.value === 'custom') p1Custom.focus();
    });
    p2Select.addEventListener('change', () => {
      p2Custom.style.display = p2Select.value === 'custom' ? 'block' : 'none';
       if(p2Select.value === 'custom') p2Custom.focus();
    });

    // IPC Event Listeners (from Main Process)
    onLobbySuccess(onGameReady);
    onLobbyError(onSetupError); // Handles both manual join and auto-setup errors
    onAutoSetupError(onSetupError); // Use the same handler
    onResetSuccess(onResetComplete);
    onResetError(onResetFail);
    onPreview(updatePreview); // Listen for preview updates
    onTriggerSwitch(handleTriggerSwitch); // Listen for spacebar trigger

     // Optional: Clean up listeners when the window is about to close
     window.addEventListener('beforeunload', () => {
         console.log("Removing IPC listeners.");
         // This assumes removeAllListeners is exposed and works as expected
         if (removeAllListeners) {
            try {
                removeAllListeners('lobby-success');
                removeAllListeners('lobby-error');
                removeAllListeners('auto-setup-error');
                removeAllListeners('reset-success');
                removeAllListeners('reset-error');
                removeAllListeners('preview-updated');
                removeAllListeners('trigger-switch');
            } catch (e) {
                console.error("Error removing listeners:", e);
            }
         }
     });

    console.log("Event listeners set up.");
  }

  /**
   * Initializes the renderer application.
   */
  function initialize() {
    console.log("Initializing renderer...");
    loadDecks();
    renderDeckList();
    populateSelects();
    setupEventListeners();
    // Initially hide the preview container and image
    previewContainer.style.display = 'none';
    previewImg.style.display = 'none';
    resetBtn.textContent = 'Reset Views'; // Set initial button text
    console.log("Renderer initialization complete.");
  }

  // Start the application logic once the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', initialize);

} else {
  console.error("Fatal Error: window.api not found. Preload script likely failed.");
  alert("Application cannot start. Required API bridge is missing.");
}
