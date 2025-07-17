// Guard against the script being injected multiple times on the same page.
// This prevents "variable already declared" errors and duplicate listeners.
if (window.vibeCodeScriptInjected) {
  // The script is already on the page. The active listener will handle messages.
} else {
  window.vibeCodeScriptInjected = true;

  let collectedPosts = [];
  let observer = null;
  const scrapedPostTexts = new Set();
  let statusWidget = null;
  let totalChars = 0;
  let isAutoScrolling = false;
  let collectionLimit = null;
  let enableAutoScroll = true;
  let currentAnalysisType = 'profile'; // 'profile' or 'comments'
  let mainPost = null; // For comment analysis
  let mainPostAuthor = 'Unknown User'; // For comment analysis

  /**
   * Creates and injects a status widget onto the page.
   */
  function createStatusWidget() {
    if (statusWidget) return;

    statusWidget = document.createElement('div');
    Object.assign(statusWidget.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#1a202c',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      zIndex: '9999',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      transition: 'background-color 0.3s ease',
    });
    document.body.appendChild(statusWidget);
  }

  /**
   * Updates the text and color of the status widget.
   * @param {'scraping' | 'idle' | 'autoscrolling' | 'finished'} status - The current status.
   * @param {number} count - The number of collected items.
   */
  function updateStatusWidget(status, count) {
    if (!statusWidget) return;
    const approxTokens = Math.round(totalChars / 4);
    let text = '';
    let color = '#1a202c'; // Default: Dark Gray

    switch (status) {
      case 'scraping':
        text = `⚙️ Scraping... (${count} items | ~${approxTokens} tokens)`;
        color = '#e53e3e'; // Red
        break;
      case 'autoscrolling':
        text = `🤖 Auto-scrolling... (${count} items | ~${approxTokens} tokens)`;
        color = '#3182ce'; // Blue
        break;
      case 'finished':
        text = `🏁 Now Analyzing... (${count} items | ~${approxTokens} tokens)`;
        color = '#2f855a'; // Green
        break;
      case 'idle':
      default:
        text = `✅ Ready to scroll (${count} items | ~${approxTokens} tokens)`;
        color = '#1a202c';
        break;
    }

    statusWidget.style.backgroundColor = color;
    statusWidget.textContent = text;
  }

  /**
   * This function finds and scrapes post data from the DOM for profile analysis.
   */
  function scrapePosts() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    articles.forEach((article) => {
      const tweetTextElement = article.querySelector('div[data-testid="tweetText"]');
      const socialContextElement = article.querySelector('[data-testid="socialContext"]');

      if (tweetTextElement && tweetTextElement.textContent) {
        const postText = tweetTextElement.textContent.trim();

        if (postText && !scrapedPostTexts.has(postText)) {
          let type = 'post';
          if (socialContextElement && socialContextElement.textContent.includes('reposted')) {
            type = 'repost';
          } else if (postText.toLowerCase().startsWith('replying to')) {
            type = 'comment';
          }

          totalChars += postText.length;
          scrapedPostTexts.add(postText);
          collectedPosts.push({ text: postText, type: type });
        }
      }
    });

    if (isAutoScrolling) {
      updateStatusWidget('autoscrolling', collectedPosts.length);
    } else {
      updateStatusWidget('idle', collectedPosts.length);
    }

    chrome.runtime.sendMessage({
      type: 'UPDATE_COUNT',
      count: collectedPosts.length,
    });
  }

  /**
   * This function finds and scrapes the main post and its comments for sentiment analysis.
   */
  function scrapeComments() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    articles.forEach((article, index) => {
      const tweetTextElement = article.querySelector('div[data-testid="tweetText"]');
      if (!tweetTextElement || !tweetTextElement.textContent) return;

      const postText = tweetTextElement.textContent.trim();
      if (!postText || scrapedPostTexts.has(postText)) return;

      // The first article on a status page is the main post
      if (index === 0 && !mainPost) {
        mainPost = { text: postText, type: 'post' };
        // Scrape the author's name from within the first article
        const userNameContainer = article.querySelector('[data-testid="User-Name"]');
        if (userNameContainer) {
          const textContent = userNameContainer.textContent || '';
          const match = textContent.match(/@\w+/);
          if (match) {
            mainPostAuthor = match[0];
          }
        }
        console.log(`[Vibe Code] Identified main post by ${mainPostAuthor}: "${postText.substring(0, 60)}..."`);
      } else {
        // All subsequent articles are comments
        let commentAuthor = 'Unknown Commenter';
        const userNameContainer = article.querySelector('[data-testid="User-Name"]');
        if (userNameContainer) {
          const textContent = userNameContainer.textContent || '';
          const match = textContent.match(/@\w+/);
          if (match) {
            commentAuthor = match[0];
          }
        }

        // Distinguish between a regular comment and a reply from the original poster
        const commentType = commentAuthor === mainPostAuthor ? 'op_comment' : 'comment';

        totalChars += postText.length;
        scrapedPostTexts.add(postText);
        collectedPosts.push({ text: postText, type: commentType });
        console.log(`[Vibe Code] Collected ${commentType} #${collectedPosts.length}: "${postText.substring(0, 60)}..."`);
      }
    });

    updateStatusWidget(isAutoScrolling ? 'autoscrolling' : 'idle', collectedPosts.length);
    chrome.runtime.sendMessage({
      type: 'UPDATE_COUNT',
      count: collectedPosts.length,
    });
  }

  /**
   * Calculates a dynamic delay for scrolling to make it seem more human.
   */
  function getDynamicDelay(postCount) {
    const baseDelay = 3000;
    const randomJitter = Math.random() * 1500;
    const progressiveBackoff = Math.floor(postCount / 200) * 500;
    const totalDelay = baseDelay + randomJitter + progressiveBackoff;
    console.log(`[Vibe Code] Dynamic delay: ${totalDelay.toFixed(0)}ms`);
    return totalDelay;
  }

  /**
   * Automatically scrolls the page down to collect posts.
   */
  async function autoScrollView() {
    // This function should not even be called if auto-scrolling is disabled.
    // But as a safeguard:
    if (!enableAutoScroll) {
      console.log('[Vibe Code] Auto-scrolling is disabled. Manual scroll mode.');
      return;
    }

    isAutoScrolling = true;
    console.log('[Vibe Code] Auto-scroll started.');
    updateStatusWidget('autoscrolling', collectedPosts.length);

    try {
      while (isAutoScrolling) {
        if (currentAnalysisType === 'profile' && collectionLimit && collectedPosts.length >= collectionLimit) {
          console.log(`[Vibe Code] Reached post limit of ${collectionLimit}. Auto-scroll finished.`);
          isAutoScrolling = false;
          updateStatusWidget('finished', collectedPosts.length);
          break;
        }

        // For comment analysis, stop if we see the "Discover more" section.
        if (currentAnalysisType === 'comments' && document.body.innerText.includes('Discover more')) {
          console.log('[Vibe Code] "Discover more" section detected. Auto-scroll finished.');
          isAutoScrolling = false;
          updateStatusWidget('finished', collectedPosts.length);
          break;
        }

        const scrollHeightBefore = document.body.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, getDynamicDelay(collectedPosts.length)));
        const scrollHeightAfter = document.body.scrollHeight;

        if (scrollHeightAfter === scrollHeightBefore) {
          console.log('[Vibe Code] Reached bottom of the page. Auto-scroll finished.');
          isAutoScrolling = false;
          updateStatusWidget('finished', collectedPosts.length);
          break;
        }
      }
    } catch (error) {
      console.error('[Vibe Code] Error during auto-scroll:', error);
      isAutoScrolling = false;
    }

    if (!isAutoScrolling && collectedPosts.length > 0) {
      console.log('[Vibe Code] Auto-scroll finished. Triggering analysis...');
      chrome.runtime.sendMessage({ type: 'ANALYZE_NOW' });
    }
  }

  /**
   * Listens for messages from the popup script (popup.js)
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const startCollection = (type) => {
      console.log(`Content script: Received start command for ${type}.`);
      currentAnalysisType = type;
      collectedPosts = [];
      mainPost = null;
      mainPostAuthor = 'Unknown User';
      scrapedPostTexts.clear();
      totalChars = 0;
      collectionLimit = request.limit;
      enableAutoScroll = request.autoScroll;
      isAutoScrolling = false; // Start with this as false.
      createStatusWidget();
      updateStatusWidget('idle', 0);

      const scrapeFunction = type === 'profile' ? scrapePosts : scrapeComments;
      scrapeFunction();

      if (enableAutoScroll) {
        autoScrollView();
      } else {
        console.log('[Vibe Code] Manual scrolling enabled. Widget will update as you scroll.');
        updateStatusWidget('scraping', collectedPosts.length);
      }

      let timer;
      observer = new MutationObserver((mutations) => {
        if (!isAutoScrolling) {
          updateStatusWidget('scraping', collectedPosts.length);
        }
        clearTimeout(timer);
        timer = setTimeout(scrapeFunction, 500);
      });

      let findTimelineInterval;
      const findAndObserveTimeline = () => {
        const timeline = document.querySelector('main');
        if (timeline) {
          console.log('[Vibe Code] Found <main> element. Observing for changes.');
          observer.observe(timeline, { childList: true, subtree: true });
          if (findTimelineInterval) clearInterval(findTimelineInterval);
          return true;
        }
        return false;
      };

      if (!findAndObserveTimeline()) {
        let attempts = 0;
        const maxAttempts = 50;
        findTimelineInterval = setInterval(() => {
          attempts++;
          if (findAndObserveTimeline() || attempts >= maxAttempts) {
            clearInterval(findTimelineInterval);
            if (attempts >= maxAttempts && statusWidget) {
              statusWidget.textContent = 'Error: Could not attach to timeline.';
              statusWidget.style.backgroundColor = '#e53e3e';
            }
          }
        }, 100);
      }
      sendResponse({ status: 'Collection started' });
    };

    if (request.type === 'START_PROFILE_COLLECTION') {
      startCollection('profile');
    } else if (request.type === 'START_COMMENT_COLLECTION') {
      startCollection('comments');
    } else if (request.type === 'STOP_COLLECTING') {
      console.log('Content script: Received stop command.');
      isAutoScrolling = false;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      // statusWidget.remove(); // <-- Remove this line
      // statusWidget = null;   // <-- Remove this line

      const profileUserNameElement = document.querySelector('[data-testid="UserName"]');
      const profileUserName = profileUserNameElement ? profileUserNameElement.textContent.trim() : 'Unknown User';

      if (currentAnalysisType === 'comments') {
        sendResponse({
          data: {
            type: 'comments',
            mainPost: mainPost,
            comments: collectedPosts,
            userName: mainPostAuthor,
          },
        });
      } else {
        sendResponse({
          data: { type: 'profile', posts: collectedPosts, userName: profileUserName },
        });
      }

      // When scraping is finished and analysis starts, instead of removing the widget:
      function showAnalyzingState() {
        const widget = document.getElementById('xprofiler-widget');
        if (widget) {
          widget.querySelector('.xprofiler-status').textContent = 'Analyzing...';
          // Optionally, disable buttons or show a spinner here
        }
      }

      showAnalyzingState(); // <-- call this instead of removing the widget
    }
    return true; // Indicates that the response is sent asynchronously
  });
} // End of the guard block
