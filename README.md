# X Profile Analyzer

A Chrome extension to collect posts from an X (formerly Twitter) user profile and generate a detailed psychological and behavioral analysis using AI.

## How to Use

1.  **Start the Backend**: Navigate to the `x-profiler-backend` directory and run `npm run dev` to start the local API server. NOTE: Backend is already running on `x-profiler-ten.vercel.app` . No need to run it locally.
2.  **Load the Extension**: Open Chrome, go to `chrome://extensions`, enable "Developer mode", and click "Load unpacked". Select the `x-profiler-extension` folder. **Reload the extension after making code changes.**
3.  **Navigate to X**: Go to any user's profile page on `x.com`.
4.  **Start Collecting**: Click the extension icon in the toolbar and press the "Start Collecting" button.
5.  **Auto-Collect**: An on-page widget will appear and the extension will **auto-scroll** to collect posts.
6.  **Analyze**: Once the collection reaches your specified limit or the end of the profile, it will **automatically stop and generate the analysis report** in a new tab. You can also manually click "Stop & Analyze" in the popup at any time to stop early.

---

## Current Capabilities

*   **Advanced Scraping**:
    *   Scrapes posts from a user's profile page as you scroll.
    *   **Auto-Scroll**: Automatically scrolls the page to collect posts, removing the need for manual scrolling.
    *   **Post Limit**: Set a maximum number of posts to collect via the popup UI.
    *   Captures the user's handle (e.g., `@username`).
    *   Differentiates between original posts, comments, and reposts, providing better context for the AI.
*   **User-Friendly Interface**:
    *   An interactive popup UI to start/stop collection, set post limits, and specify a custom AI model.
    *   Provides a real-time on-page widget to show collection status, including post count and an estimated token count (e.g., "✅ Ready to scroll (105 posts | ~4500 tokens)").
    *   Stable scraping mechanism that avoids page freezes.
*   **Powerful AI Analysis**:
    *   Sends collected data to a local backend API for processing.
    *   **Custom Model Support**: Specify any model from OpenRouter directly in the extension popup for flexible analysis.
    *   Uses a capable and free AI model (`mistralai/mistral-7b-instruct:free`) via OpenRouter for analysis.
    *   The AI prompt is engineered to perform a comprehensive multi-point analysis and is explicitly instructed to mitigate its own biases and avoid mainstream narratives. It looks for:
        *   Misinformation and propaganda.
        *   Behavioral traits (contrarianism, dishonesty, etc.).
        *   Political leanings and potential biases.
        *   Changes in opinions or stances over time.
        *   Potential cognitive biases and alternative interpretations of the user's statements.
*   **Detailed Reporting**:
    *   Generates a clean, formatted HTML report in a new tab.
    *   The report includes the user's handle for clarity.
    *   Displays the total number of posts that were analyzed.
    *   Includes a collapsible section with the full raw data that was sent to the AI for complete transparency.

---

## Changelog

### v2.0 (Current) - Custom Models & Race Condition Fix
*   **Feature**: Added an input field in the popup to specify a custom AI model from OpenRouter.
*   **Fix**: Resolved a race condition that could cause two analysis reports to be generated. The analysis process is now protected by a state flag to ensure it only runs once per collection.

### v1.9.2 - Stability & Automation
*   **Feature**: The analysis process now starts automatically once the auto-scroll is complete (either by reaching the post limit or the end of the page).
*   **Fix**: Resolved a critical bug where starting collection multiple times on the same page would cause errors and duplicate analysis reports. The content script is now guarded against being injected more than once.
*   **UX**: The "How to Use" guide has been updated to reflect the new automatic analysis workflow.

### v1.9.1 - Bug Fix
*   **Fix**: Resolved a critical bug where the "Start Collecting" button did nothing. The content script is now correctly injected into the page before being used.

### v1.9 - Collection Limits & UI Overhaul
*   **Feature**: Added an input field in the popup to set a maximum number of posts to collect.
*   **Feature**: Overhauled the popup UI for a cleaner look and more robust state management using `chrome.storage`.
*   **Fix**: The on-page widget now correctly updates its post and token count in real-time during auto-scrolling.

### v1.8 - Auto-Scroll Collection
*   **Feature**: Implemented an auto-scroll mechanism. When collection starts, the extension now automatically scrolls to the bottom of the page, collecting all posts along the way.
*   **UX**: The on-page widget now provides more detailed status updates for auto-scrolling and when collection is finished.

### v1.7 - Bias Mitigation & Critical Analysis
*   **Improvement**: Overhauled the system prompt to explicitly instruct the AI to mitigate its own biases.
*   **Improvement**: The prompt now directs the AI to perform first-principles thinking, avoid mainstream narratives, and base its analysis strictly on the provided data.
*   **Feature**: Added a "Potential Biases and Alternative Interpretations" section to the analysis report to encourage a more critical and nuanced output.

### v1.6 - Token Count Estimation & Formatting
*   **Feature**: The on-page widget now displays an estimated token count, giving the user a better sense of how much data they are collecting for the AI prompt.
*   **Fix**: Improved AI prompt to enforce strict HTML formatting for better report readability.

### v1.5 - Hyper-Detailed Analysis
*   **Feature**: Added the total number of analyzed posts to the final report.
*   **Improvement**: Massively upgraded the AI system prompt to perform a comprehensive multi-point psychological, behavioral, and political analysis, covering personality, beliefs, interests, and social style.

### v1.4 - Advanced Analysis & Data Granularity
*   **Feature**: The scraper now captures the user's handle to include in the report.
*   **Feature**: The scraper now attempts to differentiate between original posts, comments, and reposts, sending this type information to the AI.
*   **Feature**: The analysis report now includes the user's handle and the raw, formatted data that was sent to the AI.
*   **Improvement**: The AI prompt has been significantly enhanced to perform a more in-depth political and psychological analysis based on specific criteria.
*   **Improvement**: Refactored the extension to use a background script (`background.js`) for more robust state management. This fixed a bug where the post count in the popup was not updating correctly.
*   **Fix**: Switched to a more reliable AI model to resolve API errors.
*   **UX**: Removed the redundant "Analyze" button from the on-page widget to simplify the interface.

### v1.2 - Stability and UX
*   **Fix**: Reworked the `MutationObserver` to only watch the main timeline container. This fixed a critical bug where the X page would freeze after collecting the first batch of posts.
*   **Feature**: Added an on-page status widget to provide real-time feedback during the scraping process.

### v1.1 - AI Integration
*   **Feature**: Replaced the mock backend response with a real API call to the OpenRouter service.
*   **Security**: Implemented `.env.local` for secure API key storage.

### v1.0 - Initial Version
*   **Feature**: Basic extension structure with a popup UI.
*   **Feature**: Content script to scrape post text from the active tab.
*   **Feature**: Backend API endpoint with a mock (hardcoded) analysis response..
