document.addEventListener('DOMContentLoaded', () => {
  const controlBtn = document.getElementById('controlBtn');
  const statusEl = document.getElementById('status');
  const settingsEl = document.getElementById('settings');
  const postLimitInput = document.getElementById('postLimit');
  const modelNameInput = document.getElementById('modelName');
  const analysisTypeRadios = document.querySelectorAll('input[name="analysisType"]');
  const profileSettingsEl = document.getElementById('profile-settings');
  const autoScrollInput = document.getElementById('autoScroll');
  const apiKeyInput = document.getElementById('apiKey');

  // Restore UI state when popup is opened
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      // Auto-select analysis type based on URL
      if (currentTab.url.includes('/status/')) {
        document.querySelector('input[name="analysisType"][value="comments"]').checked = true;
      } else {
        document.querySelector('input[name="analysisType"][value="profile"]').checked = true;
      }
    }
    handleAnalysisTypeChange();

    chrome.storage.local.get(['isCollecting', 'postCount', 'modelName', 'isAnalyzing', 'apiKey', 'autoScroll'], (result) => {
      if (result.modelName) {
        modelNameInput.value = result.modelName;
      }
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
      if (typeof result.autoScroll === 'boolean') {
        autoScrollInput.checked = result.autoScroll;
      }
      updateUI(result.isCollecting, result.postCount, result.isAnalyzing);
    });
  });

  // Listen for updates from the background/content script
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      chrome.storage.local.get(['isCollecting', 'postCount', 'isAnalyzing'], (result) => {
        updateUI(result.isCollecting, result.postCount, result.isAnalyzing);
      });
    }
  });

  analysisTypeRadios.forEach(radio => radio.addEventListener('change', handleAnalysisTypeChange));
  apiKeyInput.addEventListener('input', () => {
    // Re-evaluate button state when user types in API key field
    chrome.storage.local.get(['isCollecting', 'isAnalyzing'], (result) => {
      if (!result.isCollecting && !result.isAnalyzing) {
        controlBtn.disabled = apiKeyInput.value.trim() === '';
      }
    });
  });

  controlBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const analysisType = document.querySelector('input[name="analysisType"]:checked').value;

    const isCorrectPage = analysisType === 'profile'
      ? tab.url.includes('x.com') && !tab.url.includes('/status/')
      : tab.url.includes('/status/');

    if (!isCorrectPage) {
        const errorMsg = analysisType === 'profile' ? 'Error: Not on a user profile page.' : 'Error: Not on a single post page.';
        statusEl.textContent = errorMsg;
        return;
    }

    const { isCollecting } = await chrome.storage.local.get('isCollecting');

    if (isCollecting) {
      // This is the "Stop & Analyze" action
      controlBtn.disabled = true;
      controlBtn.textContent = 'Analyzing...';
      chrome.runtime.sendMessage({ type: 'ANALYZE_NOW' });
      // The background script will reset the state after analysis
      setTimeout(() => window.close(), 500); // Close the popup
    } else {
      // This is the "Start Collecting" action
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        statusEl.textContent = 'Error: OpenRouter API Key is required.';
        return;
      }

      const modelName = modelNameInput.value.trim();
      const autoScroll = autoScrollInput.checked;
      const message = {
        type: analysisType === 'profile' ? 'START_PROFILE_COLLECTION' : 'START_COMMENT_COLLECTION',
        limit: analysisType === 'profile' ? parseInt(postLimitInput.value, 10) : null,
        autoScroll: autoScroll,
      };

      chrome.storage.local.set({
        isCollecting: true,
        postCount: 0,
        modelName: modelName || 'mistralai/mistral-7b-instruct:free',
        apiKey: apiKey,
        autoScroll: autoScroll,
      });

      // Programmatically inject the content script before sending a message.
      // This ensures the script is running and ready to listen.
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        // Now that the script is injected, send the start message.
        chrome.tabs.sendMessage(tab.id, message);
      });
      window.close(); // Close popup after starting
    }
  });

  function updateUI(isCollecting, count = 0, isAnalyzing = false) {
    if (isAnalyzing) {
      controlBtn.textContent = 'Analyzing...';
      controlBtn.disabled = true;
      controlBtn.style.backgroundColor = '#e53e3e'; // Red
      settingsEl.classList.add('hidden');
      statusEl.textContent = 'Analysis in progress.';
    } else if (isCollecting) {
      controlBtn.textContent = `Stop & Analyze (${count} items)`;
      controlBtn.style.backgroundColor = '#42b72a'; // Green
      settingsEl.classList.add('hidden');
      statusEl.textContent = `Collecting...`;
      controlBtn.disabled = false;
    } else {
      controlBtn.textContent = 'Start Collecting';
      controlBtn.style.backgroundColor = '#1877f2'; // Blue
      settingsEl.classList.remove('hidden');
      statusEl.textContent = 'Ready to collect.';
      controlBtn.disabled = apiKeyInput.value.trim() === '';
    }
  }

  function handleAnalysisTypeChange() {
    const analysisType = document.querySelector('input[name="analysisType"]:checked').value;
    if (analysisType === 'profile') {
      profileSettingsEl.style.display = 'block';
    } else {
      profileSettingsEl.style.display = 'none';
    }
  }
});
