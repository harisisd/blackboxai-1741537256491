// Download queue management
let downloadQueue = [];
let isProcessing = false;
let downloadDelay = 1000; // Default delay between downloads (1 second)

// Process downloads one at a time
async function processDownloadQueue() {
    if (isProcessing || downloadQueue.length === 0) return;
    
    isProcessing = true;
    
    while (downloadQueue.length > 0) {
        const url = downloadQueue.shift();
        try {
            await downloadAsset(url);
            // Wait before processing next download to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, downloadDelay));
        } catch (error) {
            console.error('Download failed:', error);
        }
    }
    
    isProcessing = false;
}

// Handle individual asset download
function downloadAsset(url) {
    return new Promise((resolve, reject) => {
        // Extract filename from URL or generate one
        const filename = url.split('/').pop().split('?')[0] || `iconscout-${Date.now()}.png`;
        
        chrome.downloads.download({
            url: url,
            filename: `iconscout/${filename}`,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            
            // Monitor download progress
            chrome.downloads.onChanged.addListener(function onChanged(delta) {
                if (delta.id === downloadId) {
                    if (delta.state && delta.state.current === 'complete') {
                        chrome.downloads.onChanged.removeListener(onChanged);
                        resolve(downloadId);
                    } else if (delta.error) {
                        chrome.downloads.onChanged.removeListener(onChanged);
                        reject(delta.error);
                    }
                }
            });
        });
    });
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'start_download':
            if (Array.isArray(request.urls)) {
                downloadQueue.push(...request.urls);
                processDownloadQueue();
                sendResponse({
                    status: 'success',
                    message: `Added ${request.urls.length} items to download queue`
                });
            }
            break;
            
        case 'update_delay':
            if (request.delay && typeof request.delay === 'number') {
                downloadDelay = Math.max(500, request.delay); // Minimum 500ms delay
                sendResponse({
                    status: 'success',
                    message: `Download delay updated to ${downloadDelay}ms`
                });
            }
            break;
            
        case 'get_status':
            sendResponse({
                queueLength: downloadQueue.length,
                isProcessing: isProcessing,
                delay: downloadDelay
            });
            break;
            
        case 'clear_queue':
            downloadQueue = [];
            sendResponse({
                status: 'success',
                message: 'Download queue cleared'
            });
            break;
    }
    return true; // Keep the message channel open for async response
});

// Create downloads directory when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    // Create a directory for downloads
    chrome.downloads.download({
        url: 'data:text/plain;base64,',
        filename: 'iconscout/.keep',
        saveAs: false
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to create downloads directory:', chrome.runtime.lastError);
        }
    });
});
