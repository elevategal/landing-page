(function() {
  'use strict';

  // ===== CONSTANTS =====
  const STORAGE_KEY = 'a11y-widget-settings';
  const WIDGET_CLASS = 'a11y-widget';

  const DEFAULT_STATE = {
    fontSize: 100,
    contrast: 'default',
    font: 'default',
    lineHeight: 0,
    letterSpacing: 0,
    highlightHeadings: false,
    highlightLinks: false,
    stopAnimations: false,
    bigCursor: false,
    readingGuide: false,
    focusHighlight: false,
    textToSpeech: false,
    hideImages: false,
    readingMode: false
  };

  let state = { ...DEFAULT_STATE };
  let isOpen = false;
  let readingGuideEl = null;
  let ttsHandler = null;

  // ===== LOAD SAVED SETTINGS =====
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...DEFAULT_STATE, ...parsed };
      }
    } catch(e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch(e) {}
  }

  // ===== INJECT CSS =====
  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'a11y-widget-styles';
    style.textContent = `
      /* ===== FLOATING BUTTON ===== */
      .a11y-fab {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 99999;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #2563EB;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.3s, box-shadow 0.3s;
        opacity: 0;
        animation: a11yFabIn 0.3s ease-out 0.5s forwards;
      }
      .a11y-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
      .a11y-fab:focus { outline: 3px solid #93C5FD; outline-offset: 2px; }
      .a11y-fab svg { width: 28px; height: 28px; fill: #fff; }
      @keyframes a11yFabIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

      /* ===== PANEL ===== */
      .a11y-panel-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.3);
        z-index: 99999;
      }
      .a11y-panel-overlay.open { display: block; }

      .a11y-panel {
        position: fixed;
        bottom: 90px;
        left: 24px;
        z-index: 100000;
        width: 340px;
        max-height: 85vh;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        border: 1px solid rgba(0,0,0,0.08);
        direction: rtl;
        text-align: right;
        font-family: 'Heebo', 'Assistant', -apple-system, sans-serif;
        color: #1a1a1a;
        overflow: hidden;
        transform: translateY(20px) scale(0.95);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.25s ease-out, opacity 0.25s ease-out;
      }
      .a11y-panel.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }
      .a11y-panel-scroll {
        max-height: calc(85vh - 60px);
        overflow-y: auto;
        padding: 0 20px 20px;
      }
      .a11y-panel-scroll::-webkit-scrollbar { width: 4px; }
      .a11y-panel-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

      /* Header */
      .a11y-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #eee;
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 1;
      }
      .a11y-header h3 {
        font-size: 1rem;
        font-weight: 700;
        margin: 0;
        color: #1a1a1a;
      }
      .a11y-header-btn {
        width: 32px; height: 32px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: #6b7280;
        transition: all 0.2s;
      }
      .a11y-header-btn:hover { background: #f3f4f6; color: #1a1a1a; }

      /* Category */
      .a11y-category {
        margin-top: 16px;
      }
      .a11y-category-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        color: #6b7280;
        margin-bottom: 10px;
        text-transform: none;
      }
      .a11y-category-icon {
        font-size: 1.1rem;
      }

      /* Feature Row */
      .a11y-feature {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 6px;
        transition: background 0.2s;
        background: #f9fafb;
        border: 1px solid transparent;
      }
      .a11y-feature:hover { background: #f3f4f6; border-color: #e5e7eb; }
      .a11y-feature-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #374151;
      }

      /* Toggle Switch */
      .a11y-toggle {
        position: relative;
        width: 44px;
        height: 24px;
        background: #d1d5db;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s;
        border: none;
        flex-shrink: 0;
      }
      .a11y-toggle.active { background: #2563EB; }
      .a11y-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        right: 2px;
        width: 20px;
        height: 20px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .a11y-toggle.active::after { transform: translateX(-20px); }

      /* Font Size Controls */
      .a11y-font-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .a11y-font-btn {
        width: 32px; height: 32px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #fff;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 700;
        color: #374151;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .a11y-font-btn:hover { background: #2563EB; color: #fff; border-color: #2563EB; }
      .a11y-font-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .a11y-font-btn:disabled:hover { background: #fff; color: #374151; border-color: #d1d5db; }
      .a11y-font-value {
        font-size: 0.8rem;
        font-weight: 600;
        color: #2563EB;
        min-width: 36px;
        text-align: center;
      }

      /* Select */
      .a11y-select {
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        background: #fff;
        font-family: inherit;
        font-size: 0.8rem;
        color: #374151;
        cursor: pointer;
        direction: rtl;
        min-width: 100px;
      }
      .a11y-select:focus { border-color: #2563EB; outline: none; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }

      /* Slider */
      .a11y-slider-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .a11y-slider {
        width: 80px;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: #d1d5db;
        border-radius: 4px;
        outline: none;
        direction: ltr;
      }
      .a11y-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: #2563EB;
        cursor: pointer;
      }
      .a11y-slider-val {
        font-size: 0.75rem;
        color: #6b7280;
        min-width: 20px;
        text-align: center;
      }

      /* Reset Button */
      .a11y-reset-btn {
        width: 100%;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        color: #6b7280;
        cursor: pointer;
        margin-top: 16px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .a11y-reset-btn:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

      /* Footer Links */
      .a11y-footer {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid #eee;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .a11y-footer a {
        font-size: 0.85rem;
        color: #2563EB;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .a11y-footer a:hover { text-decoration: underline; }

      /* ===== MOBILE ===== */
      @media (max-width: 768px) {
        .a11y-fab { width: 48px; height: 48px; bottom: 75px; left: 16px; }
        .a11y-fab svg { width: 24px; height: 24px; }
        .a11y-panel {
          left: 0; right: 0; bottom: 0;
          width: 100%;
          max-height: 90vh;
          border-radius: 16px 16px 0 0;
          transform: translateY(100%);
        }
        .a11y-panel.open { transform: translateY(0); }
      }

      /* ===== ACCESSIBILITY STYLES APPLIED TO PAGE ===== */

      /* Font scaling - widget excluded */
      body.a11y-font-scaled .${WIDGET_CLASS},
      body.a11y-font-scaled .${WIDGET_CLASS} * { font-size: revert !important; }

      /* Contrast - applied to wrapper, not body, to preserve fixed positioning */
      #a11y-page-wrapper.a11y-contrast-high { filter: contrast(1.4); }
      #a11y-page-wrapper.a11y-contrast-inverted { filter: invert(1) hue-rotate(180deg); }
      #a11y-page-wrapper.a11y-contrast-inverted img,
      #a11y-page-wrapper.a11y-contrast-inverted video { filter: invert(1) hue-rotate(180deg); }
      #a11y-page-wrapper.a11y-contrast-mono { filter: grayscale(100%); }

      /* Font readable */
      body.a11y-font-readable * { font-family: 'Heebo', 'Assistant', sans-serif !important; }
      body.a11y-font-readable .${WIDGET_CLASS} * { font-family: 'Heebo', 'Assistant', -apple-system, sans-serif !important; }

      /* Highlight headings */
      body.a11y-highlight-headings h1,
      body.a11y-highlight-headings h2,
      body.a11y-highlight-headings h3,
      body.a11y-highlight-headings h4,
      body.a11y-highlight-headings h5,
      body.a11y-highlight-headings h6 {
        outline: 2px solid #2563EB !important;
        outline-offset: 4px !important;
        background-color: rgba(37,99,235,0.06) !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
      }

      /* Highlight links */
      body.a11y-highlight-links a:not(.${WIDGET_CLASS} a) {
        text-decoration: underline !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 3px !important;
        font-weight: 700 !important;
      }

      /* Stop animations */
      body.a11y-stop-animations *,
      body.a11y-stop-animations *::before,
      body.a11y-stop-animations *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
      body.a11y-stop-animations .${WIDGET_CLASS},
      body.a11y-stop-animations .${WIDGET_CLASS} *,
      body.a11y-stop-animations .a11y-panel,
      body.a11y-stop-animations .a11y-panel-overlay,
      body.a11y-stop-animations .a11y-fab {
        animation-duration: revert !important;
        animation-iteration-count: revert !important;
        transition-duration: revert !important;
      }

      /* Big cursor */
      body.a11y-big-cursor,
      body.a11y-big-cursor * {
        cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M8 6l28 16-12 4-8 14z" fill="%23000" stroke="%23fff" stroke-width="2"/></svg>') 4 4, auto !important;
      }
      body.a11y-big-cursor a,
      body.a11y-big-cursor button,
      body.a11y-big-cursor [role="button"] {
        cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M20 6v24h4l6-10 8 3-3-8 10-6H20z" fill="%23000" stroke="%23fff" stroke-width="2"/></svg>') 20 4, pointer !important;
      }

      /* Focus highlight */
      body.a11y-focus-highlight *:focus {
        outline: 3px solid #F59E0B !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 6px rgba(245,158,11,0.25) !important;
      }

      /* Reading guide */
      #a11y-reading-guide {
        position: fixed;
        left: 0;
        width: 100%;
        height: 40px;
        background: rgba(255,255,0,0.12);
        border-top: 2px solid rgba(37,99,235,0.3);
        border-bottom: 2px solid rgba(37,99,235,0.3);
        pointer-events: none;
        z-index: 99998;
        transition: top 50ms ease-out;
      }

      /* TTS */
      body.a11y-tts-active { cursor: crosshair !important; }
      body.a11y-tts-active *:not(.${WIDGET_CLASS} *):hover {
        outline: 2px dashed #7C3AED !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
      }
      .a11y-tts-reading {
        background-color: rgba(124,58,237,0.15) !important;
        outline: 3px solid #7C3AED !important;
        outline-offset: 2px !important;
      }
      /* TTS active banner */
      .a11y-tts-banner {
        position: fixed;
        top: 0; left: 0; right: 0;
        background: #7C3AED;
        color: #fff;
        text-align: center;
        padding: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        z-index: 99997;
        font-family: 'Heebo', sans-serif;
        direction: rtl;
      }

      /* Hide images */
      body.a11y-hide-images img:not(.${WIDGET_CLASS} img) { opacity: 0.05 !important; }

      /* Reading mode */
      body.a11y-reading-mode aside,
      body.a11y-reading-mode [role="complementary"],
      body.a11y-reading-mode .sidebar,
      body.a11y-reading-mode [class*="banner"],
      body.a11y-reading-mode [class*="popup"],
      body.a11y-reading-mode [class*="modal"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ===== APPLY FEATURES =====
  function applyAll() {
    // Font size
    document.documentElement.style.fontSize = state.fontSize + '%';
    document.body.classList.toggle('a11y-font-scaled', state.fontSize !== 100);

    // Contrast - apply to wrapper to avoid breaking fixed positioning
    var wrapper = document.getElementById('a11y-page-wrapper');
    if (wrapper) {
      wrapper.classList.remove('a11y-contrast-high', 'a11y-contrast-inverted', 'a11y-contrast-mono');
      if (state.contrast !== 'default') wrapper.classList.add('a11y-contrast-' + state.contrast);
    }

    // Font
    document.body.classList.remove('a11y-font-readable', 'a11y-font-dyslexia');
    if (state.font === 'readable' || state.font === 'dyslexia') {
      if (!document.querySelector('link[data-a11y-font]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap';
        link.dataset.a11yFont = 'true';
        document.head.appendChild(link);
      }
      document.body.classList.add('a11y-font-' + state.font);
    }

    // Line height
    if (state.lineHeight > 0) {
      document.body.style.setProperty('--a11y-lh', (1.5 + state.lineHeight * 0.25) + '');
      document.body.style.lineHeight = 'var(--a11y-lh)';
    } else {
      document.body.style.removeProperty('--a11y-lh');
      document.body.style.lineHeight = '';
    }

    // Letter spacing
    if (state.letterSpacing > 0) {
      document.body.style.letterSpacing = state.letterSpacing + 'px';
    } else {
      document.body.style.letterSpacing = '';
    }

    // Toggles
    document.body.classList.toggle('a11y-highlight-headings', state.highlightHeadings);
    document.body.classList.toggle('a11y-highlight-links', state.highlightLinks);
    document.body.classList.toggle('a11y-stop-animations', state.stopAnimations);
    document.body.classList.toggle('a11y-big-cursor', state.bigCursor);
    document.body.classList.toggle('a11y-focus-highlight', state.focusHighlight);
    document.body.classList.toggle('a11y-hide-images', state.hideImages);
    document.body.classList.toggle('a11y-reading-mode', state.readingMode);
    document.body.classList.toggle('a11y-tts-active', state.textToSpeech);

    // Reading guide
    applyReadingGuide(state.readingGuide);

    // TTS
    applyTTS(state.textToSpeech);

    // Stop animations - pause videos
    if (state.stopAnimations) {
      document.querySelectorAll('video').forEach(function(v) { v.pause(); });
    }

    saveSettings();
    updatePanel();
  }

  // Reading guide
  function applyReadingGuide(enable) {
    if (enable) {
      if (!readingGuideEl) {
        readingGuideEl = document.createElement('div');
        readingGuideEl.id = 'a11y-reading-guide';
        readingGuideEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(readingGuideEl);
      }
      document.addEventListener('mousemove', onGuideMove);
    } else {
      if (readingGuideEl) { readingGuideEl.remove(); readingGuideEl = null; }
      document.removeEventListener('mousemove', onGuideMove);
    }
  }
  function onGuideMove(e) {
    if (readingGuideEl) readingGuideEl.style.top = (e.clientY - 20) + 'px';
  }

  // TTS
  var ttsVoices = [];
  function loadVoices() {
    ttsVoices = speechSynthesis.getVoices();
  }
  if (typeof speechSynthesis !== 'undefined') {
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  function speakText(text) {
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    u.rate = 0.9;
    // Try Hebrew voice, fallback to any available
    var hv = ttsVoices.find(function(v) { return v.lang.startsWith('he'); });
    if (hv) u.voice = hv;
    return u;
  }

  function applyTTS(enable) {
    if (enable) {
      if (!ttsHandler) {
        ttsHandler = function(e) {
          var target = e.target;
          // Skip clicks on widget itself
          if (target.closest('.' + WIDGET_CLASS)) return;
          // Skip non-text elements
          if (['SCRIPT','STYLE','SVG','PATH','CIRCLE','IMG','VIDEO','IFRAME'].indexOf(target.tagName) !== -1) return;

          // Get direct text or innerText
          var text = '';
          // Prefer direct text content of clicked element
          if (target.childNodes.length === 1 && target.childNodes[0].nodeType === 3) {
            text = target.textContent.trim();
          } else {
            text = target.innerText && target.innerText.trim();
          }
          if (!text || text.length < 2) return;
          // Limit length to prevent reading entire sections
          if (text.length > 500) text = text.substring(0, 500);

          var u = speakText(text);
          target.classList.add('a11y-tts-reading');
          u.onend = function() { target.classList.remove('a11y-tts-reading'); };
          u.onerror = function() { target.classList.remove('a11y-tts-reading'); };
          speechSynthesis.speak(u);
        };
      }
      document.addEventListener('click', ttsHandler);
      // Show TTS banner
      if (!document.querySelector('.a11y-tts-banner')) {
        var banner = document.createElement('div');
        banner.className = 'a11y-tts-banner';
        banner.textContent = '\ud83d\udd0a \u05de\u05e6\u05d1 \u05d4\u05e7\u05e8\u05d0\u05d4 \u05e4\u05e2\u05d9\u05dc - \u05dc\u05d7\u05e6\u05d5 \u05e2\u05dc \u05d8\u05e7\u05e1\u05d8 \u05db\u05d3\u05d9 \u05dc\u05e9\u05de\u05d5\u05e2 \u05d0\u05d5\u05ea\u05d5';
        document.body.appendChild(banner);
      }
    } else {
      if (ttsHandler) document.removeEventListener('click', ttsHandler);
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      var existingBanner = document.querySelector('.a11y-tts-banner');
      if (existingBanner) existingBanner.remove();
    }
  }

  // ===== BUILD UI =====
  function buildWidget() {
    // Wrap all existing body children in a wrapper div (for contrast filters)
    if (!document.getElementById('a11y-page-wrapper')) {
      var wrapper = document.createElement('div');
      wrapper.id = 'a11y-page-wrapper';
      while (document.body.firstChild) {
        wrapper.appendChild(document.body.firstChild);
      }
      document.body.appendChild(wrapper);
    }

    var container = document.createElement('div');
    container.className = WIDGET_CLASS;

    // Floating button
    var fab = document.createElement('button');
    fab.className = 'a11y-fab';
    fab.setAttribute('aria-label', '\u05e4\u05ea\u05d9\u05d7\u05ea \u05ea\u05e4\u05e8\u05d9\u05d8 \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'a11y-panel');
    fab.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="4" r="2"/><path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zm-6.17 5c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1c-2.28.46-4 2.48-4 4.9 0 2.76 2.24 5 5 5 2.42 0 4.44-1.72 4.9-4h-2.07z"/></svg>';
    fab.addEventListener('click', togglePanel);

    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'a11y-panel-overlay';
    overlay.addEventListener('click', togglePanel);

    // Panel
    var panel = document.createElement('div');
    panel.className = 'a11y-panel';
    panel.id = 'a11y-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', '\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea');
    panel.setAttribute('dir', 'rtl');
    panel.setAttribute('lang', 'he');

    // Header
    var header = document.createElement('div');
    header.className = 'a11y-header';
    header.innerHTML = '<button class="a11y-header-btn a11y-close-btn" aria-label="\u05e1\u05d2\u05d9\u05e8\u05d4">\u2715</button><h3>\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea</h3><button class="a11y-header-btn a11y-reset-hdr-btn" aria-label="\u05d0\u05d9\u05e4\u05d5\u05e1">\u21BA</button>';
    header.querySelector('.a11y-close-btn').addEventListener('click', togglePanel);
    header.querySelector('.a11y-reset-hdr-btn').addEventListener('click', resetAll);

    var scroll = document.createElement('div');
    scroll.className = 'a11y-panel-scroll';

    // === Category 1: Display ===
    scroll.appendChild(buildCategory('\ud83d\udc41', '\u05d4\u05ea\u05d0\u05de\u05d5\u05ea \u05ea\u05e6\u05d5\u05d2\u05d4', [
      buildFontSize(),
      buildSelect('\u05e0\u05d9\u05d2\u05d5\u05d3\u05d9\u05d5\u05ea', 'contrast', [
        ['\u05e8\u05d2\u05d9\u05dc', 'default'],
        ['\u05e0\u05d9\u05d2\u05d5\u05d3\u05d9\u05d5\u05ea \u05d2\u05d1\u05d5\u05d4\u05d4', 'high'],
        ['\u05e6\u05d1\u05e2\u05d9\u05dd \u05d4\u05e4\u05d5\u05db\u05d9\u05dd', 'inverted'],
        ['\u05de\u05d5\u05e0\u05d5\u05db\u05e8\u05d5\u05dd', 'mono']
      ]),
      buildSelect('\u05d2\u05d5\u05e4\u05df', 'font', [
        ['\u05d1\u05e8\u05d9\u05e8\u05ea \u05de\u05d7\u05d3\u05dc', 'default'],
        ['\u05d2\u05d5\u05e4\u05df \u05e7\u05e8\u05d9\u05d0', 'readable'],
        ['\u05d3\u05d9\u05e1\u05dc\u05e7\u05e1\u05d9\u05d4', 'dyslexia']
      ]),
      buildSlider('\u05e8\u05d9\u05d5\u05d5\u05d7 \u05e9\u05d5\u05e8\u05d5\u05ea', 'lineHeight', 0, 4),
      buildSlider('\u05e8\u05d9\u05d5\u05d5\u05d7 \u05d0\u05d5\u05ea\u05d9\u05d5\u05ea', 'letterSpacing', 0, 5),
      buildToggle('\u05d4\u05d3\u05d2\u05e9\u05ea \u05db\u05d5\u05ea\u05e8\u05d5\u05ea', 'highlightHeadings'),
      buildToggle('\u05d4\u05d3\u05d2\u05e9\u05ea \u05e7\u05d9\u05e9\u05d5\u05e8\u05d9\u05dd', 'highlightLinks'),
      buildToggle('\u05e2\u05e6\u05d9\u05e8\u05ea \u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d5\u05ea', 'stopAnimations')
    ]));

    // === Category 2: Navigation ===
    scroll.appendChild(buildCategory('\u2328\ufe0f', '\u05e0\u05d9\u05d5\u05d5\u05d8 \u05d5\u05de\u05d5\u05d8\u05d5\u05e8\u05d9\u05e7\u05d4', [
      buildToggle('\u05d4\u05d3\u05d2\u05e9\u05ea focus', 'focusHighlight'),
      buildToggle('\u05e1\u05de\u05df \u05d2\u05d3\u05d5\u05dc', 'bigCursor'),
      buildToggle('\u05e7\u05d5 \u05e7\u05e8\u05d9\u05d0\u05d4', 'readingGuide')
    ]));

    // === Category 3: Content ===
    scroll.appendChild(buildCategory('\ud83d\udcd6', '\u05ea\u05d5\u05db\u05df \u05d5\u05e7\u05e8\u05d9\u05d0\u05d4', [
      buildToggle('\u05d4\u05e7\u05e8\u05d0\u05ea \u05d8\u05e7\u05e1\u05d8', 'textToSpeech'),
      buildToggle('\u05d4\u05e1\u05ea\u05e8\u05ea \u05ea\u05de\u05d5\u05e0\u05d5\u05ea', 'hideImages'),
      buildToggle('\u05de\u05e6\u05d1 \u05e7\u05e8\u05d9\u05d0\u05d4', 'readingMode')
    ]));

    // Reset button
    var resetBtn = document.createElement('button');
    resetBtn.className = 'a11y-reset-btn';
    resetBtn.innerHTML = '\u21BA \u05d0\u05d9\u05e4\u05d5\u05e1 \u05db\u05dc \u05d4\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea';
    resetBtn.addEventListener('click', resetAll);
    scroll.appendChild(resetBtn);

    // Footer links
    var footer = document.createElement('div');
    footer.className = 'a11y-footer';
    footer.innerHTML = '<a href="accessibility.html">\ud83d\udccb \u05d4\u05e6\u05d4\u05e8\u05ea \u05e0\u05d2\u05d9\u05e9\u05d5\u05ea</a>';
    scroll.appendChild(footer);

    panel.appendChild(header);
    panel.appendChild(scroll);
    container.appendChild(fab);
    container.appendChild(overlay);
    container.appendChild(panel);
    document.body.appendChild(container);
  }

  function buildCategory(icon, title, features) {
    var cat = document.createElement('div');
    cat.className = 'a11y-category';
    var t = document.createElement('div');
    t.className = 'a11y-category-title';
    t.innerHTML = '<span class="a11y-category-icon">' + icon + '</span> ' + title;
    cat.appendChild(t);
    features.forEach(function(f) { cat.appendChild(f); });
    return cat;
  }

  function buildToggle(label, key) {
    var row = document.createElement('div');
    row.className = 'a11y-feature';
    var lbl = document.createElement('span');
    lbl.className = 'a11y-feature-label';
    lbl.textContent = label;
    var toggle = document.createElement('button');
    toggle.className = 'a11y-toggle';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(state[key]));
    toggle.setAttribute('aria-label', label);
    toggle.dataset.key = key;
    if (state[key]) toggle.classList.add('active');
    toggle.addEventListener('click', function() {
      state[key] = !state[key];
      applyAll();
    });
    row.appendChild(lbl);
    row.appendChild(toggle);
    return row;
  }

  function buildFontSize() {
    var row = document.createElement('div');
    row.className = 'a11y-feature';
    var lbl = document.createElement('span');
    lbl.className = 'a11y-feature-label';
    lbl.textContent = '\u05d2\u05d5\u05d3\u05dc \u05d8\u05e7\u05e1\u05d8';
    var controls = document.createElement('div');
    controls.className = 'a11y-font-controls';
    var minus = document.createElement('button');
    minus.className = 'a11y-font-btn';
    minus.textContent = '\u2212';
    minus.setAttribute('aria-label', '\u05d4\u05e7\u05d8\u05e0\u05ea \u05d8\u05e7\u05e1\u05d8');
    var val = document.createElement('span');
    val.className = 'a11y-font-value';
    val.id = 'a11y-font-val';
    val.textContent = state.fontSize + '%';
    var plus = document.createElement('button');
    plus.className = 'a11y-font-btn';
    plus.textContent = '+';
    plus.setAttribute('aria-label', '\u05d4\u05d2\u05d3\u05dc\u05ea \u05d8\u05e7\u05e1\u05d8');
    minus.addEventListener('click', function() {
      if (state.fontSize > 100) { state.fontSize -= 10; applyAll(); }
    });
    plus.addEventListener('click', function() {
      if (state.fontSize < 150) { state.fontSize += 10; applyAll(); }
    });
    controls.appendChild(plus);
    controls.appendChild(val);
    controls.appendChild(minus);
    row.appendChild(lbl);
    row.appendChild(controls);
    return row;
  }

  function buildSelect(label, key, options) {
    var row = document.createElement('div');
    row.className = 'a11y-feature';
    var lbl = document.createElement('span');
    lbl.className = 'a11y-feature-label';
    lbl.textContent = label;
    var sel = document.createElement('select');
    sel.className = 'a11y-select';
    sel.dataset.key = key;
    sel.setAttribute('aria-label', label);
    options.forEach(function(o) {
      var opt = document.createElement('option');
      opt.value = o[1];
      opt.textContent = o[0];
      if (state[key] === o[1]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function() {
      state[key] = sel.value;
      applyAll();
    });
    row.appendChild(lbl);
    row.appendChild(sel);
    return row;
  }

  function buildSlider(label, key, min, max) {
    var row = document.createElement('div');
    row.className = 'a11y-feature';
    var lbl = document.createElement('span');
    lbl.className = 'a11y-feature-label';
    lbl.textContent = label;
    var wrap = document.createElement('div');
    wrap.className = 'a11y-slider-wrap';
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'a11y-slider';
    slider.min = min;
    slider.max = max;
    slider.value = state[key];
    slider.dataset.key = key;
    slider.setAttribute('aria-label', label);
    var valSpan = document.createElement('span');
    valSpan.className = 'a11y-slider-val';
    valSpan.textContent = state[key];
    slider.addEventListener('input', function() {
      state[key] = parseInt(slider.value);
      valSpan.textContent = slider.value;
      applyAll();
    });
    wrap.appendChild(slider);
    wrap.appendChild(valSpan);
    row.appendChild(lbl);
    row.appendChild(wrap);
    return row;
  }

  // ===== UPDATE PANEL STATE =====
  function updatePanel() {
    var panel = document.querySelector('.a11y-panel');
    if (!panel) return;

    // Update toggles
    panel.querySelectorAll('.a11y-toggle').forEach(function(t) {
      var key = t.dataset.key;
      t.classList.toggle('active', !!state[key]);
      t.setAttribute('aria-checked', String(!!state[key]));
    });

    // Update font value
    var fv = document.getElementById('a11y-font-val');
    if (fv) fv.textContent = state.fontSize + '%';

    // Update selects
    panel.querySelectorAll('.a11y-select').forEach(function(s) {
      s.value = state[s.dataset.key];
    });

    // Update sliders
    panel.querySelectorAll('.a11y-slider').forEach(function(s) {
      s.value = state[s.dataset.key];
      var valSpan = s.parentElement.querySelector('.a11y-slider-val');
      if (valSpan) valSpan.textContent = state[s.dataset.key];
    });
  }

  // ===== TOGGLE PANEL =====
  function togglePanel() {
    isOpen = !isOpen;
    var panel = document.querySelector('.a11y-panel');
    var overlay = document.querySelector('.a11y-panel-overlay');
    var fab = document.querySelector('.a11y-fab');
    if (panel) panel.classList.toggle('open', isOpen);
    if (overlay) overlay.classList.toggle('open', isOpen);
    if (fab) fab.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      var closeBtn = panel.querySelector('.a11y-close-btn');
      if (closeBtn) closeBtn.focus();
    }
  }

  // ===== RESET =====
  function resetAll() {
    state = { ...DEFAULT_STATE };
    document.documentElement.style.fontSize = '';
    document.body.style.lineHeight = '';
    document.body.style.letterSpacing = '';
    var wrapper = document.getElementById('a11y-page-wrapper');
    if (wrapper) wrapper.classList.remove('a11y-contrast-high', 'a11y-contrast-inverted', 'a11y-contrast-mono');
    applyAll();
  }

  // ===== KEYBOARD SHORTCUTS =====
  function initKeyboard() {
    document.addEventListener('keydown', function(e) {
      // Alt+A - toggle panel
      if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); togglePanel(); }
      // Escape - close panel
      if (e.key === 'Escape' && isOpen) { e.preventDefault(); togglePanel(); }
      // Alt+R - reset
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); resetAll(); }
      // Alt+= / Alt+- font size
      if (e.altKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        if (state.fontSize < 150) { state.fontSize += 10; applyAll(); }
      }
      if (e.altKey && e.key === '-') {
        e.preventDefault();
        if (state.fontSize > 100) { state.fontSize -= 10; applyAll(); }
      }
    });
  }

  // ===== INIT =====
  function init() {
    loadSettings();
    injectCSS();
    buildWidget();
    applyAll();
    initKeyboard();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
