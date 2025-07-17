const PROFILE_API_URL = 'https://x-profiler-ten.vercel.app/api/analyze';
const SENTIMENT_API_URL = 'https://x-profiler-ten.vercel.app/api/analyze-sentiment';
const INSTALL_TRACKING_URL = 'https://x-profiler-ten.vercel.app/api/track-install';

// This listener fires when the extension is first installed.
chrome.runtime.onInstalled.addListener(async (details) => {
  // We only want to run this on the initial installation.
  if (details.reason === 'install') {
    try {
      // Check if we've already reported an installation to avoid duplicates.
      const { installReported } = await chrome.storage.local.get('installReported');

      if (!installReported) {
        await fetch(INSTALL_TRACKING_URL, {
          method: 'POST',
        });
        // Set a flag to prevent sending this ping ever again.
        await chrome.storage.local.set({ installReported: true });
      }
    } catch (error) {
      console.error('Failed to report extension install:', error);
    }
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_COUNT') {
    // This message comes from content.js and updates the count in storage
    chrome.storage.local.set({ postCount: request.count });
  } else if (request.type === 'ANALYZE_NOW') {
    // This message can come from popup.js or the content.js widget
    triggerAnalysis();
    sendResponse({ status: 'Analysis initiated' });
  }
  return true; // Keep the message channel open for async response
});

async function triggerAnalysis() {
  // Check if an analysis is already in progress to prevent duplicates.
  const { isAnalyzing } = await chrome.storage.local.get('isAnalyzing');
  if (isAnalyzing) {
    console.log('Analysis is already in progress. Ignoring duplicate trigger.');
    return;
  }

  // Set the analyzing flag to prevent other triggers from running.
  await chrome.storage.local.set({ isAnalyzing: true });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    console.error('Could not find active tab to send message to.');
    // Reset state if tab is not found
    await chrome.storage.local.set({ isCollecting: false, isAnalyzing: false, postCount: 0 });
    return;
  }

  // Tell the content script to stop and give us the data
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'STOP_COLLECTING' },
    async (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          'Error communicating with content script:',
          chrome.runtime.lastError.message
        );
        // Reset state on error
        await chrome.storage.local.set({ isCollecting: false, isAnalyzing: false, postCount: 0 });
        return;
      }

      if (response && response.data) {
        try {
          const { type, ...payloadData } = response.data; // e.g., type: 'comments', payloadData: { mainPost, comments, ... }
          const isSentimentAnalysis = type === 'comments';
          const apiUrl = isSentimentAnalysis ? SENTIMENT_API_URL : PROFILE_API_URL;

          // Get the saved model name and API key from storage
          const { modelName, apiKey } = await chrome.storage.local.get(['modelName', 'apiKey']);
          if (!apiKey) {
            console.error('API Key not found in storage. Aborting analysis.');
            // TODO: Notify the user via an alert or new tab with an error message.
            await chrome.storage.local.set({ isCollecting: false, isAnalyzing: false, postCount: 0 });
            return;
          }

          // Add the current tab's URL to the payload
          const payload = {
            ...payloadData,
            model: modelName || 'mistralai/mistral-7b-instruct:free',
            sourceUrl: tab.url, // <--- Add this line
          };

          console.log(
            `Sending data for ${isSentimentAnalysis ? 'sentiment' : 'profile'} analysis to ${apiUrl}`
          );

          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
          }

          // The API now returns a JSON object with the URL of the report
          const { reportUrl } = await apiResponse.json();

          if (reportUrl) {
            const productionUrl = `https://x-profiler-ten.vercel.app${reportUrl}`;
            chrome.tabs.create({ url: productionUrl });
          } else {
            throw new Error('API did not return a reportUrl.');
          }
        } catch (error) {
          console.error('Analysis failed:', error);
        } finally {
          // Always reset the state to idle, whether it succeeded or failed
          await chrome.storage.local.set({ isCollecting: false, isAnalyzing: false, postCount: 0 });
        }
      } else {
        // No data received, still reset state
        await chrome.storage.local.set({ isCollecting: false, isAnalyzing: false, postCount: 0 });
      }
    }
  );
}