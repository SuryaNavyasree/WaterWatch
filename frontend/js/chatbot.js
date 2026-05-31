// JalDoot Accessibility Voice Chatbot Companion - WaterWatch
// Fully self-contained widget: Injects its own styling, floating FAB, sound controllers, and Speech STT/TTS loops.

(function() {
  // --- Accessibility Voice Settings ---
  let speechEnabled = true;
  let chatState = 'closed'; // closed, greeting, category, locate, verifyAddress, describe, finalize, done
  let recognition = null;
  let isListening = false;
  let currentCategory = '';
  let resolvedAddress = '';
  let resolvedLat = null;
  let resolvedLng = null;
  let transcribedDescription = '';

  // Setup Web Speech Recognition API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; // Optimize for Indian-accent English since Bangalore-centered
  }

  // --- Dynamic Style Injection (Sleek Glassmorphic & Accessible UI) ---
  const style = document.createElement('style');
  style.textContent = `
    /* Floating Action Button */
    .jaldoot-fab {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      width: 70px;
      height: 70px;
      background: linear-gradient(135deg, #0077B6 0%, #00B4D8 100%);
      color: white;
      border-radius: 50%;
      box-shadow: 0 10px 30px rgba(0, 119, 182, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10000;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 3px solid white;
    }
    .jaldoot-fab:hover {
      transform: scale(1.08) translateY(-3px);
      box-shadow: 0 15px 40px rgba(0, 119, 182, 0.6);
    }
    .jaldoot-fab svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    .jaldoot-fab span {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.2rem;
      font-family: 'Sora', sans-serif;
    }
    .jaldoot-fab-pulse {
      position: absolute;
      top: -3px;
      left: -3px;
      right: -3px;
      bottom: -3px;
      border-radius: 50%;
      border: 3px solid #00B4D8;
      opacity: 0.7;
      animation: jaldootPulse 2s infinite;
      pointer-events: none;
    }

    /* Chat Panel Overlay */
    .jaldoot-panel {
      position: fixed;
      bottom: 7.5rem;
      right: 2rem;
      width: 420px;
      max-width: calc(100vw - 4rem);
      height: 600px;
      max-height: calc(100vh - 10rem);
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10000;
      opacity: 0;
      transform: translateY(30px) scale(0.95);
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      font-family: 'Inter', sans-serif;
      color: white;
    }
    .jaldoot-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .jaldoot-header {
      padding: 1.25rem 1.5rem;
      background: linear-gradient(90deg, rgba(0,119,182,0.2) 0%, rgba(0,180,216,0.2) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .jaldoot-title {
      font-family: 'Sora', sans-serif;
      font-weight: 800;
      font-size: 1.2rem;
      color: #90E0EF;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .jaldoot-title span {
      background: #0077B6;
      color: white;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 99px;
      text-transform: uppercase;
    }
    .jaldoot-ctrl-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      padding: 0.3rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .jaldoot-ctrl-btn:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }

    /* Message Scroller */
    .jaldoot-body {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .jaldoot-bubble {
      max-width: 85%;
      padding: 1rem 1.25rem;
      border-radius: 18px;
      line-height: 1.5;
      font-size: 0.95rem;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .jaldoot-bubble-bot {
      background: rgba(255, 255, 255, 0.07);
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      align-self: flex-start;
      color: #F0F8FF;
    }
    .jaldoot-bubble-user {
      background: #0077B6;
      border-bottom-right-radius: 4px;
      align-self: flex-end;
      color: white;
      font-weight: 600;
    }

    /* Dynamic Visual Helpers (Category selection cards & Mic ripples) */
    .jaldoot-action-area {
      padding: 1.25rem;
      background: rgba(0,0,0,0.2);
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      min-height: 180px;
      justify-content: center;
    }
    .jaldoot-large-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      width: 100%;
    }
    .jaldoot-touch-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1.5px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      color: white;
      padding: 0.85rem 0.5rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      transition: all 0.25s;
    }
    .jaldoot-touch-btn:hover {
      background: rgba(0, 180, 216, 0.15);
      border-color: #00B4D8;
      transform: translateY(-2px);
    }
    .jaldoot-touch-btn.active {
      background: #0077B6;
      border-color: #90E0EF;
      box-shadow: 0 4px 15px rgba(0, 119, 182, 0.3);
    }

    /* Record Wave Microphone */
    .jaldoot-mic-btn {
      position: relative;
      width: 80px;
      height: 80px;
      background: rgba(255, 255, 255, 0.08);
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    .jaldoot-mic-btn.listening {
      background: #E63946;
      border-color: white;
      box-shadow: 0 0 25px rgba(230, 57, 70, 0.6);
      animation: jaldootPulsingMic 1.5s infinite;
    }
    .jaldoot-mic-btn svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    .jaldoot-mic-status {
      font-size: 0.8rem;
      font-weight: 700;
      color: #90E0EF;
      letter-spacing: 0.03em;
    }
    
    /* Animations */
    @keyframes jaldootPulse {
      0% { transform: scale(1); opacity: 0.7; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes jaldootPulsingMic {
      0% { box-shadow: 0 0 0 0 rgba(230, 57, 70, 0.5); }
      70% { box-shadow: 0 0 0 15px rgba(230, 57, 70, 0); }
      100% { box-shadow: 0 0 0 0 rgba(230, 57, 70, 0); }
    }
  `;
  document.head.appendChild(style);

  // --- Dynamic Widget DOM Injection ---
  const container = document.createElement('div');
  container.id = 'jaldoot-chatbot-container';
  container.innerHTML = `
    <!-- Floating Action Bubble -->
    <div class="jaldoot-fab" id="jaldoot-fab" title="Need Accessibility Help? Speak to JalDoot Assistant">
      <div class="jaldoot-fab-pulse"></div>
      <svg viewBox="0 0 24 24">
        <path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
      </svg>
      <span>Voice HELP</span>
    </div>

    <!-- Dark Glassmorphic Chat Panel Overlay -->
    <div class="jaldoot-panel" id="jaldoot-panel">
      <!-- Header -->
      <div class="jaldoot-header">
        <div class="jaldoot-title">
          👤 JalDoot
          <span>Voice Guide</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="jaldoot-ctrl-btn" id="jaldoot-volume-btn" title="Toggle Voice Sound Prompts">
            <svg id="jaldoot-vol-icon" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
          </button>
          <button class="jaldoot-ctrl-btn" id="jaldoot-close-btn" title="Close Voice Assistant" style="font-size: 1.5rem; font-weight:700; line-height: 1;">&times;</button>
        </div>
      </div>

      <!-- Scrollable Message Body -->
      <div class="jaldoot-body" id="jaldoot-body">
        <!-- Bubbles injected here -->
      </div>

      <!-- Action Footer Area -->
      <div class="jaldoot-action-area" id="jaldoot-action-area">
        <!-- Floating category select buttons or pulsing mic button goes here dynamically -->
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // --- Element Caches ---
  const fab = document.getElementById('jaldoot-fab');
  const panel = document.getElementById('jaldoot-panel');
  const body = document.getElementById('jaldoot-body');
  const actionArea = document.getElementById('jaldoot-action-area');
  const volumeBtn = document.getElementById('jaldoot-volume-btn');
  const volIcon = document.getElementById('jaldoot-vol-icon');
  const closeBtn = document.getElementById('jaldoot-close-btn');

  // --- Text-To-Speech (TTS Engine) ---
  function speak(text) {
    if (!speechEnabled) return;
    window.speechSynthesis.cancel(); // Halt previous readings
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower, extremely readable and friendly
    utterance.pitch = 1.0;
    
    // Choose local Indian English voice if available for natural dialect matching
    const voices = window.speechSynthesis.getVoices();
    const indVoice = voices.find(v => v.lang.includes('en-IN') || v.name.includes('India') || v.name.includes('Google US English'));
    if (indVoice) utterance.voice = indVoice;

    window.speechSynthesis.speak(utterance);
  }

  // --- Chat UI Utilities ---
  function appendBubble(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `jaldoot-bubble jaldoot-bubble-${sender}`;
    bubble.textContent = text;
    body.appendChild(bubble);
    body.scrollTop = body.scrollHeight; // Auto-scroll
  }

  function clearBody() {
    body.innerHTML = '';
  }

  // --- Audio Volume Toggle ---
  volumeBtn.addEventListener('click', () => {
    speechEnabled = !speechEnabled;
    if (speechEnabled) {
      volIcon.innerHTML = `<path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>`;
      speak("Voice sounds turned on.");
    } else {
      volIcon.innerHTML = `<path d="M4.34,2.93L2.93,4.34L7.29,8.7L3,13H7L12,18V13.41L16.11,17.5C15.5,17.9 14.8,18.22 14,18.39V20.45C15.35,20.2 16.59,19.57 17.6,18.7L20.66,21.76L22.07,20.35L4.34,2.93M12,4L9.91,6.09L12,8.18V4M19,12C19,12.78 18.84,13.5 18.57,14.18L20.08,15.69C20.67,14.59 21,13.33 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M14,7.97V10.18L16.4,12.58C16.46,12.39 16.5,12.2 16.5,12C16.5,10.23 15.5,8.71 14,7.97Z"/>`;
      window.speechSynthesis.cancel();
    }
  });

  // Toggle Chat Panel visibility
  fab.addEventListener('click', () => {
    if (chatState === 'closed') {
      openChat();
    } else {
      closeChat();
    }
  });

  closeBtn.addEventListener('click', closeChat);

  function openChat() {
    panel.classList.add('open');
    fab.style.display = 'none'; // hide bubble while talking
    chatState = 'greeting';
    clearBody();
    startConversation();
  }

  function closeChat() {
    panel.classList.remove('open');
    fab.style.display = 'flex';
    chatState = 'closed';
    isListening = false;
    if (recognition) recognition.stop();
    window.speechSynthesis.cancel();
  }

  // --- Dialogue Flow Control (State Machine) ---
  function startConversation() {
    const greetingText = "Hello! I am JalDoot, your WaterWatch helper. I will help you file a water complaint with your voice. Let's start! What is the problem? Is it a water leak, supply shortage, dirty water, or low pressure?";
    appendBubble('bot', greetingText);
    speak(greetingText);
    renderCategoryControls();
  }

  // --- Step 1: Render Category Selection Interface ---
  function renderCategoryControls() {
    actionArea.innerHTML = `
      <div class="jaldoot-large-buttons">
        <button class="jaldoot-touch-btn" id="btn-leakage">
          <span style="font-size: 1.8rem;">💧</span>
          <span>Water Leak</span>
        </button>
        <button class="jaldoot-touch-btn" id="btn-shortage">
          <span style="font-size: 1.8rem;">🏜️</span>
          <span>No Supply</span>
        </button>
        <button class="jaldoot-touch-btn" id="btn-contamination">
          <span style="font-size: 1.8rem;">🧪</span>
          <span>Dirty Water</span>
        </button>
        <button class="jaldoot-touch-btn" id="btn-pressure">
          <span style="font-size: 1.8rem;">📉</span>
          <span>Low Pressure</span>
        </button>
      </div>
      <button class="jaldoot-mic-btn" id="jaldoot-mic-btn" title="Click to Speak">
        <svg viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>
      </button>
      <span class="jaldoot-mic-status" id="jaldoot-mic-status">Tap microphone to Speak</span>
    `;

    // Bind touch button listeners (Illiterate visual shortcut)
    document.getElementById('btn-leakage').addEventListener('click', () => selectCategory('leakage'));
    document.getElementById('btn-shortage').addEventListener('click', () => selectCategory('shortage'));
    document.getElementById('btn-contamination').addEventListener('click', () => selectCategory('contamination'));
    document.getElementById('btn-pressure').addEventListener('click', () => selectCategory('pressure'));

    // Bind Mic listener
    const mic = document.getElementById('jaldoot-mic-btn');
    mic.addEventListener('click', () => toggleListening(processCategoryVoice));
  }

  function selectCategory(category) {
    currentCategory = category;
    
    // Programmatically populate background form category select
    document.getElementById('issueType').value = category;
    // Highlight category visual buttons
    document.querySelectorAll('.jaldoot-touch-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${category}`).classList.add('active');

    // Default severity to high for accessibility
    const sevHigh = document.getElementById('sevHigh');
    if (sevHigh) sevHigh.checked = true;

    appendBubble('user', `Category: ${category.charAt(0).toUpperCase() + category.slice(1)}`);
    
    chatState = 'locate';
    setTimeout(startLocationStep, 1000);
  }

  // Handle Speech Recognition for Category
  function processCategoryVoice(speech) {
    const raw = speech.toLowerCase().trim();
    if (raw.includes('leak') || raw.includes('burst') || raw.includes('gushing') || raw.includes('flow')) {
      selectCategory('leakage');
    } else if (raw.includes('short') || raw.includes('no water') || raw.includes('dry') || raw.includes('tanker') || raw.includes('cut')) {
      selectCategory('shortage');
    } else if (raw.includes('dirt') || raw.includes('smell') || raw.includes('sewage') || raw.includes('brown') || raw.includes('pollut')) {
      selectCategory('contamination');
    } else if (raw.includes('press') || raw.includes('slow') || raw.includes('trickle')) {
      selectCategory('pressure');
    } else {
      const errText = "I couldn't hear the category clearly. Please tap one of the large buttons on the screen or try speaking again.";
      appendBubble('bot', errText);
      speak(errText);
    }
  }

  // --- Step 2: Location Auto-detection & Speak Verification ---
  async function startLocationStep() {
    const locatePrompt = `Got it. I have selected the issue category. Now I will find your location. Please say 'yes' or tap the button to allow GPS locator access.`;
    appendBubble('bot', locatePrompt);
    speak(locatePrompt);

    actionArea.innerHTML = `
      <button class="btn btn-primary" id="btn-allow-gps" style="padding: 1rem 2rem; font-size: 1rem; width: 100%; border-radius: 14px;">📍 Detect My Location</button>
      <button class="jaldoot-mic-btn" id="jaldoot-mic-btn">
        <svg viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>
      </button>
      <span class="jaldoot-mic-status" id="jaldoot-mic-status">Tap microphone and say "Yes"</span>
    `;

    document.getElementById('btn-allow-gps').addEventListener('click', triggerGeolocation);
    const mic = document.getElementById('jaldoot-mic-btn');
    mic.addEventListener('click', () => toggleListening(processLocateVoice));
  }

  function processLocateVoice(speech) {
    if (speech.toLowerCase().includes('yes') || speech.toLowerCase().includes('okay') || speech.toLowerCase().includes('allow') || speech.toLowerCase().includes('locate')) {
      appendBubble('user', "Yes, locate me");
      triggerGeolocation();
    } else {
      const errText = "Please say 'yes' or tap the locate button on screen to find where you are.";
      appendBubble('bot', errText);
      speak(errText);
    }
  }

  // Triggers browser Geolocation and reverse-geocodes using OpenStreetMap Nominatim
  function triggerGeolocation() {
    if (!navigator.geolocation) {
      const geoErr = "Geolocation is not supported by your browser. Please tap the location manually on the screen.";
      appendBubble('bot', geoErr);
      speak(geoErr);
      return;
    }

    appendBubble('bot', "Locating you now, please stand still...");
    speak("Locating you now, please stand still.");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        resolvedLat = pos.coords.latitude;
        resolvedLng = pos.coords.longitude;
        
        // Populate inputs in form
        document.getElementById('latitude').value = resolvedLat.toFixed(6);
        document.getElementById('longitude').value = resolvedLng.toFixed(6);

        // Adjust Leaflet marker on background map if it exists
        if (typeof marker !== 'undefined' && typeof map !== 'undefined') {
          const latlng = new L.LatLng(resolvedLat, resolvedLng);
          marker.setLatLng(latlng);
          map.setView(latlng, 15);
        }

        // Reverse geocoding fetch
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${resolvedLat}&lon=${resolvedLng}&zoom=18&addressdetails=1`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              resolvedAddress = data.display_name;
              document.getElementById('address').value = resolvedAddress;
              
              chatState = 'verifyAddress';
              setTimeout(startAddressVerification, 1000);
              return;
            }
          }
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        }

        // Address fallback
        resolvedAddress = `${resolvedLat.toFixed(4)} Latitude, ${resolvedLng.toFixed(4)} Longitude`;
        document.getElementById('address').value = resolvedAddress;
        chatState = 'verifyAddress';
        setTimeout(startAddressVerification, 1000);
      },
      (err) => {
        const accessErr = "I couldn't read your GPS coordinates. Please ensure GPS is active on your device and you have given access.";
        appendBubble('bot', accessErr);
        speak(accessErr);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function startAddressVerification() {
    // Cut down very long addresses so TTS doesn't ramble
    const readableAddr = resolvedAddress.split(',').slice(0, 3).join(',');
    const addrPrompt = `I found your location near: ${readableAddr}. Is this correct? Say 'yes' or 'no'.`;
    appendBubble('bot', `Address resolved: ${resolvedAddress}. Is this correct?`);
    speak(addrPrompt);

    actionArea.innerHTML = `
      <div style="display: flex; gap: 0.75rem; width: 100%;">
        <button class="btn btn-secondary" id="btn-addr-no" style="flex: 1; border-radius:14px; padding: 0.85rem;">No</button>
        <button class="btn btn-primary" id="btn-addr-yes" style="flex: 1; border-radius:14px; padding: 0.85rem;">Yes</button>
      </div>
      <button class="jaldoot-mic-btn" id="jaldoot-mic-btn">
        <svg viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>
      </button>
      <span class="jaldoot-mic-status" id="jaldoot-mic-status">Tap mic and say "Yes" or "No"</span>
    `;

    document.getElementById('btn-addr-yes').addEventListener('click', confirmAddress);
    document.getElementById('btn-addr-no').addEventListener('click', rejectAddress);
    
    const mic = document.getElementById('jaldoot-mic-btn');
    mic.addEventListener('click', () => toggleListening(processAddressVoice));
  }

  function processAddressVoice(speech) {
    const raw = speech.toLowerCase().trim();
    if (raw.includes('yes') || raw.includes('correct') || raw.includes('right')) {
      confirmAddress();
    } else if (raw.includes('no') || raw.includes('wrong') || raw.includes('not')) {
      rejectAddress();
    } else {
      speak("Please say 'yes' if the address is correct, or say 'no' if it is incorrect.");
    }
  }

  function confirmAddress() {
    appendBubble('user', "Yes, that is correct");
    chatState = 'describe';
    setTimeout(startDescribeStep, 1000);
  }

  function rejectAddress() {
    appendBubble('user', "No, that is incorrect");
    const correctionText = "No problem! You can drag the map pin or type the correct address on the screen later. For now, let's proceed to the description.";
    appendBubble('bot', correctionText);
    speak(correctionText);
    chatState = 'describe';
    setTimeout(startDescribeStep, 4000);
  }

  // --- Step 3: Speak Complaint Description ---
  function startDescribeStep() {
    const descPrompt = `Now, please explain the water issue in your own words. How long has it been happening? Speak clearly after clicking the microphone button.`;
    appendBubble('bot', descPrompt);
    speak(descPrompt);

    actionArea.innerHTML = `
      <button class="jaldoot-mic-btn" id="jaldoot-mic-btn" style="width: 90px; height: 90px;">
        <svg viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>
      </button>
      <span class="jaldoot-mic-status" id="jaldoot-mic-status" style="color: #FF5A5F; font-size: 0.9rem;">TAP MICROPHONE TO DESCRIBE ISSUE</span>
    `;

    const mic = document.getElementById('jaldoot-mic-btn');
    mic.addEventListener('click', () => toggleListening(processDescriptionVoice));
  }

  function processDescriptionVoice(speech) {
    if (speech.trim().length < 30) {
      appendBubble('user', speech);
      transcribedDescription += " " + speech.trim();
      const needMore = "Could you tell me a little more details so our repair team can understand the problem? Speak now.";
      appendBubble('bot', needMore);
      speak(needMore);
      return;
    }

    transcribedDescription += " " + speech.trim();
    appendBubble('user', speech);

    // Save to background form
    document.getElementById('description').value = transcribedDescription.trim();

    // Auto-generate summary title
    const categoryLabel = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
    const shortAddr = resolvedAddress.split(',').slice(0, 2).join(',');
    const generatedTitle = `Voice Report: ${categoryLabel} at ${shortAddr || 'Detected Location'}`;
    document.getElementById('title').value = generatedTitle;

    chatState = 'finalize';
    setTimeout(startFinalizeStep, 1500);
  }

  // --- Step 4: Final Submission Confirmation ---
  function startFinalizeStep() {
    const finalPrompt = `Great. I have gathered all the details. I will now submit your water complaint for review. Please say 'submit' or tap the button below.`;
    appendBubble('bot', finalPrompt);
    speak(finalPrompt);

    actionArea.innerHTML = `
      <button class="btn btn-primary" id="btn-submit-complaint" style="padding: 1rem 2rem; font-size: 1.1rem; width: 100%; border-radius: 14px; background: linear-gradient(135deg, #2D9E5F 0%, #1A7F43 100%); border:none; box-shadow: 0 4px 15px rgba(45,158,95,0.3);">🚀 Submit Complaint Now</button>
      <button class="jaldoot-mic-btn" id="jaldoot-mic-btn">
        <svg viewBox="0 0 24 24"><path d="M12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/></svg>
      </button>
      <span class="jaldoot-mic-status" id="jaldoot-mic-status">Tap microphone and say "Submit"</span>
    `;

    document.getElementById('btn-submit-complaint').addEventListener('click', triggerSubmit);
    const mic = document.getElementById('jaldoot-mic-btn');
    mic.addEventListener('click', () => toggleListening(processFinalizeVoice));
  }

  function processFinalizeVoice(speech) {
    if (speech.toLowerCase().includes('sub') || speech.toLowerCase().includes('okay') || speech.toLowerCase().includes('yes') || speech.toLowerCase().includes('go')) {
      triggerSubmit();
    } else {
      speak("Please say 'submit' or tap the green submit button on the screen.");
    }
  }

  // Hooks directly into index.html's submit handler to recycle duplicate checks & AJAX submissions
  function triggerSubmit() {
    appendBubble('bot', "Submitting complaint to the municipal server. Please hold on...");
    speak("Submitting complaint to the municipal server. Please hold on.");

    // Trigger click on index.html's original form submission button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.click();
    }

    // Monitor for Success Modal trigger in DOM
    const successModal = document.getElementById('successModal');
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if (successModal && successModal.classList.contains('open')) {
        clearInterval(interval);
        chatState = 'done';
        handleSubmissionSuccess();
      } 
      else if (checks > 12) { // 6 seconds timeout
        clearInterval(interval);
        const failText = "There was a submission conflict or a duplicate issue warning occurred. Please review the prompts on your screen.";
        appendBubble('bot', failText);
        speak(failText);
      }
    }, 500);
  }

  // Completes dialogue by reading the final Ticket ID out loud
  function handleSubmissionSuccess() {
    const ticketIdElement = document.getElementById('ticketIdDisplay');
    const finalTicketId = ticketIdElement ? ticketIdElement.textContent : "WW-XXXXX";

    const doneText = `Thank you! Your water complaint has been filed successfully. Your unique Ticket ID is: ${finalTicketId}. I have logged this safely. You can now close this window or tap the track button to follow updates.`;
    appendBubble('bot', `Report Submitted! Ticket ID: ${finalTicketId}`);
    speak(doneText);

    actionArea.innerHTML = `
      <a href="track.html?id=${finalTicketId}" class="btn btn-primary" style="padding: 0.85rem 1.5rem; font-size: 1rem; width: 100%; border-radius: 14px; text-align:center;">📋 Track Status</a>
      <button class="btn btn-secondary" id="btn-close-jaldoot" style="padding: 0.75rem 1.5rem; font-size: 0.95rem; width: 100%; border-radius: 14px;">Close Assistant</button>
    `;
    document.getElementById('btn-close-jaldoot').addEventListener('click', closeChat);
  }

  // --- Speech-to-Text (STT) Controller ---
  function toggleListening(callback) {
    if (!recognition) {
      appendBubble('bot', "Voice Recognition API is not supported on this browser. Please tap the visual screen buttons.");
      speak("Voice recognition is not supported on this browser.");
      return;
    }

    const micBtn = document.getElementById('jaldoot-mic-btn');
    const micStatus = document.getElementById('jaldoot-mic-status');

    if (isListening) {
      recognition.stop();
      return;
    }

    isListening = true;
    micBtn.classList.add('listening');
    micStatus.textContent = "Listening... Speak now";
    
    // Play a friendly soft chime or alert the user
    speak(""); // stops synthesize before listening to avoid self-echoing

    recognition.start();

    recognition.onresult = (event) => {
      const textResult = event.results[0][0].transcript;
      callback(textResult);
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      micStatus.textContent = "Error. Tap mic to retry";
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      if (micStatus.textContent === "Listening... Speak now") {
        micStatus.textContent = "Tap microphone to Speak";
      }
    };
  }

  // Make sure speech is cancelled if page is unloaded
  window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
  });

})();
