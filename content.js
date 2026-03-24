// content.js
function safeSaveState(data) {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.storage.local.set(data);
    }
  } catch (err) {
    console.warn("Dark Webpage: Extension context invalidated. Please refresh the page.");
  }
}

(function initLiquidGlass() {
  if (document.getElementById('liquid-glass-extension-root')) return;

  const host = document.createElement('div');
  host.id = 'liquid-glass-extension-root';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100vw';
  host.style.height = '100vh';
  host.style.pointerEvents = 'none'; // Click through the container
  host.style.zIndex = '2147483647'; // Max z-index
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const linkElem = document.createElement('link');
  linkElem.setAttribute('rel', 'stylesheet');
  linkElem.setAttribute('href', chrome.runtime.getURL('styles.css'));
  shadowRoot.appendChild(linkElem);

  const panel = document.createElement('div');
  panel.id = 'liquid-panel';
  
  // Fetch memory state before rendering
  chrome.storage.local.get({
    panel_open: false,
    panel_top: '24px',
    panel_left: 'none',
    panel_right: '24px',
    dark_on: false,
    dark_val: 15,
    eye_on: false,
    eye_val: 82
  }, (state) => {
    
    // Apply position & open state
    if (!state.panel_open) {
      panel.className = 'liquid-panel hidden'; 
      panel.style.transform = 'translateY(-20px) scale(0.95)';
      panel.style.display = 'none';
    } else {
      panel.className = 'liquid-panel'; 
      panel.style.transform = 'translateY(0) scale(1)';
    }
    
    // Mathematically bind the panel 
    const panelWidth = 340; // Defined in CSS
    const maxLeft = Math.max(0, window.innerWidth - panelWidth);
    const maxTop = Math.max(0, window.innerHeight - 80);

    if (state.panel_left !== 'none') {
      let savedLeft = parseInt(state.panel_left, 10);
      if (isNaN(savedLeft)) savedLeft = 0;
      const safeLeft = Math.min(Math.max(0, savedLeft), maxLeft);
      panel.style.left = safeLeft + 'px';
      panel.style.right = 'auto';
    } else {
      panel.style.right = state.panel_right;
      panel.style.left = 'auto';
    }
    
    let savedTop = parseInt(state.panel_top, 10);
    if (isNaN(savedTop)) savedTop = 24;
    const safeTop = Math.min(Math.max(0, savedTop), maxTop);
    panel.style.top = safeTop + 'px';

    panel.innerHTML = `
      <div class="panel-header" id="drag-handle">
        <div class="drag-indicator"></div>
        <img class="logo-glass" src="${chrome.runtime.getURL('icon.svg')}" />
        <span class="panel-title" style="flex:1;">Dark Webpage</span>
        <button class="icon-btn" id="close-btn">&times;</button>
      </div>

      <div class="panel-content">
        <!-- Clock Widget -->
        <div class="widget clock-widget glass-box">
          <div class="time" id="clock-time">--:--</div>
          <div class="date" id="clock-date">-- --</div>
        </div>

        <!-- Smart Controls -->
        <div class="section-title">Display Settings</div>
        <div class="controls-col">
          
          <!-- Dark Mode -->
          <div class="glass-box">
            <div class="control-row" style="margin-bottom: 12px;">
              <div class="control-info">
                <span class="control-name">Dark Mode</span>
                <span class="control-desc">Dim the active webpage</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="dark-mode-toggle" ${state.dark_on ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="slider-container">
              <span class="range-icon" style="opacity: 0.6">🔅</span>
              <input type="range" min="10" max="100" value="${state.dark_val}" id="dark-mode-slider">
              <span class="range-icon" style="font-size:22px;">🔆</span>
            </div>
          </div>
          
          <!-- Eye Protect Mode -->
          <div class="glass-box">
            <div class="control-row" style="margin-bottom: 12px;">
              <div class="control-info">
                <span class="control-name">Eye Protect</span>
                <span class="control-desc">Reduce screen blue light</span>
              </div>
              <label class="switch">
                <input type="checkbox" id="eye-protect-toggle" ${state.eye_on ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="slider-container">
              <span class="range-icon" style="opacity: 0.6">🔅</span>
              <input type="range" min="10" max="100" value="${state.eye_val}" id="eye-protect-slider">
              <span class="range-icon" style="font-size:22px;">🔆</span>
            </div>
          </div>
          
        </div>
      </div>
    `;

    // Disable CSS transitions before inserting into the DOM to block any initial startup splash/flicker
    panel.style.transition = 'none';
    shadowRoot.appendChild(panel);

    // Force the browser to calculate layout and apply the hidden opacity instantly!
    void panel.offsetWidth;

    // Restore smooth animations back to standard for when you toggle or grab the UI
    panel.style.transition = 'opacity var(--transition-spring), transform var(--transition-spring)';

    initDraggable(panel, shadowRoot.getElementById('drag-handle'));
    initPanelControls(shadowRoot, panel);
    initClock(shadowRoot);
    initControls(shadowRoot);

    // Keep panel on-screen dynamically during window resize
    window.addEventListener('resize', () => {
        requestAnimationFrame(() => {
          const wOuter = window.innerWidth;
          const hOuter = window.innerHeight;
          const pWidth = panel.offsetWidth || 340;
          
          if (panel.style.left && panel.style.left !== 'auto') {
            const currentLeft = parseInt(panel.style.left, 10);
            const maxLeft = Math.max(0, wOuter - pWidth);
            if (currentLeft > maxLeft) panel.style.left = maxLeft + 'px';
          }
          if (panel.style.top && panel.style.top !== 'auto') {
            const currentTop = parseInt(panel.style.top, 10);
            const maxTop = Math.max(0, hOuter - 50);
            if (currentTop > maxTop) panel.style.top = maxTop + 'px';
          }
        });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle_panel') {
        let isNowOpen = false;
        if (panel.classList.contains('hidden')) {
          panel.style.display = 'flex';
          void panel.offsetWidth;
          panel.classList.remove('hidden');
          panel.style.transform = 'translateY(0) scale(1)';
          isNowOpen = true;
        } else {
          panel.classList.add('hidden');
          panel.style.transform = 'translateY(-20px) scale(0.95)';
          panel.style.transition = 'opacity var(--transition-spring), transform var(--transition-spring)';
          setTimeout(() => { if (panel.classList.contains('hidden')) panel.style.display = 'none'; }, 600);
        }
        safeSaveState({ panel_open: isNowOpen });
        sendResponse({ status: "toggled" });
      }
    });

    // Close panel when clicking outside of it (uses Capture phase to bypass website event blockers)
    document.addEventListener('click', (e) => {
      if (panel.style.display === 'none' || panel.classList.contains('hidden')) return;
      
      // If the click path contains our extension root, they clicked inside the panel
      const clickedInside = e.composedPath && e.composedPath().some(el => el.id === 'liquid-glass-extension-root');
      
      if (!clickedInside) {
        panel.classList.add('hidden');
        panel.style.transform = 'translateY(-20px) scale(0.95)';
        panel.style.transition = 'opacity var(--transition-spring), transform var(--transition-spring)';
        setTimeout(() => { if (panel.classList.contains('hidden')) panel.style.display = 'none'; }, 600);
        safeSaveState({ panel_open: false });
      }
    }, true);

  });
})();

// Draggable window logic
function initDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    if (e.target.id === 'close-btn') return; 
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    element.style.transition = 'none'; 
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const newTop = element.offsetTop - pos2;
    const newLeft = element.offsetLeft - pos1;
    
    element.style.top = Math.max(0, newTop) + "px";
    element.style.left = Math.max(0, newLeft) + "px";
    element.style.bottom = 'auto'; 
    element.style.right = 'auto'; 
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    element.style.transition = 'opacity var(--transition-spring), transform var(--transition-spring)';
    
    safeSaveState({ 
      panel_top: element.style.top,
      panel_left: element.style.left
    });
  }
}

// Close button
function initPanelControls(shadowRoot, panel) {
  shadowRoot.getElementById('close-btn').addEventListener('click', () => {
    panel.classList.add('hidden');
    panel.style.transform = 'translateY(-20px) scale(0.95)';
    panel.style.transition = 'opacity var(--transition-spring), transform var(--transition-spring)';
    setTimeout(() => { if (panel.classList.contains('hidden')) panel.style.display = 'none'; }, 600);
    safeSaveState({ panel_open: false });
  });
}

// Clock
function initClock(shadowRoot) {
  const timeEl = shadowRoot.getElementById('clock-time');
  const dateEl = shadowRoot.getElementById('clock-date');
  
  function update() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
  }
  update();
  setInterval(update, 1000); 
}

// Page Brightness, Dark Mode, and Eye Protect Controls
function initControls(shadowRoot) {
  
  // Page Dark Mode Overlay
  const darkToggle = shadowRoot.getElementById('dark-mode-toggle');
  const darkSlider = shadowRoot.getElementById('dark-mode-slider');
  let darkOverlay = document.getElementById('liquid-glass-dark-overlay');
  
  if (!darkOverlay) {
    darkOverlay = document.createElement('div');
    darkOverlay.id = 'liquid-glass-dark-overlay';
    darkOverlay.style.position = 'fixed';
    darkOverlay.style.top = '0'; darkOverlay.style.left = '0';
    darkOverlay.style.width = '100vw'; darkOverlay.style.height = '100vh';
    darkOverlay.style.pointerEvents = 'none';
    darkOverlay.style.zIndex = '2147483644'; 
    darkOverlay.style.background = '#000';
    darkOverlay.style.mixBlendMode = 'multiply';
    darkOverlay.style.transition = 'opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    darkOverlay.style.opacity = '0';
    document.body.appendChild(darkOverlay);
  }
  
  function updateDarkMode() {
    if (darkToggle.checked) {
      const opacity = (100 - darkSlider.value) / 100;
      darkOverlay.style.opacity = opacity.toString();
    } else {
      darkOverlay.style.opacity = '0';
    }
    const min = darkSlider.min || 10;
    const max = darkSlider.max || 100;
    const pct = ((darkSlider.value - min) / (max - min)) * 100;
    darkSlider.style.setProperty('--val', `${pct}%`);
    
    // Save state
    chrome.storage.local.set({
      dark_on: darkToggle.checked,
      dark_val: darkSlider.value
    });
  }
  updateDarkMode();

  darkToggle.addEventListener('change', updateDarkMode);
  darkSlider.addEventListener('input', updateDarkMode);

  // Eye Protect Mode Overlay
  const eyeToggle = shadowRoot.getElementById('eye-protect-toggle');
  const eyeSlider = shadowRoot.getElementById('eye-protect-slider');
  let eyeOverlay = document.getElementById('liquid-glass-eye-overlay');
  
  if (!eyeOverlay) {
    eyeOverlay = document.createElement('div');
    eyeOverlay.id = 'liquid-glass-eye-overlay';
    eyeOverlay.style.position = 'fixed';
    eyeOverlay.style.top = '0'; eyeOverlay.style.left = '0';
    eyeOverlay.style.width = '100vw'; eyeOverlay.style.height = '100vh';
    eyeOverlay.style.pointerEvents = 'none';
    eyeOverlay.style.zIndex = '2147483645'; 
    eyeOverlay.style.background = '#f59e0b'; // Warm amber
    eyeOverlay.style.mixBlendMode = 'multiply';
    eyeOverlay.style.transition = 'opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    eyeOverlay.style.opacity = '0';
    document.body.appendChild(eyeOverlay);
  }
  
  function updateEyeProtect() {
    if (eyeToggle.checked) {
      const opacity = (100 - eyeSlider.value) / 100;
      eyeOverlay.style.opacity = Math.min(opacity, 0.8).toString();
    } else {
      eyeOverlay.style.opacity = '0';
    }
    const min = eyeSlider.min || 10;
    const max = eyeSlider.max || 100;
    const pct = ((eyeSlider.value - min) / (max - min)) * 100;
    eyeSlider.style.setProperty('--val', `${pct}%`);
    
    // Save state
    chrome.storage.local.set({
      eye_on: eyeToggle.checked,
      eye_val: eyeSlider.value
    });
  }
  updateEyeProtect();

  eyeToggle.addEventListener('change', updateEyeProtect);
  eyeSlider.addEventListener('input', updateEyeProtect);
}
