// Queue to store download URLs
let downloadQueue = [];
let isProcessing = false;

// Function to extract asset URLs from the page
function extractAssetUrls() {
    const assetElements = document.querySelectorAll('img.scout-image-loaded, .scout-icon-normal');
    const urls = [];
    
    assetElements.forEach(element => {
        // Get the highest quality image URL
        let assetUrl = element.src || element.getAttribute('data-src');
        if (assetUrl) {
            // Convert to full resolution URL if thumbnail
            assetUrl = assetUrl.replace(/w-\d+,/, 'w-1000,');
            urls.push(assetUrl);
        }
    });

    return urls;
}

// Function to handle download initiation
function initiateDownload() {
    const urls = extractAssetUrls();
    if (urls.length > 0) {
        chrome.runtime.sendMessage({
            action: 'start_download',
            urls: urls
        });
        return {
            status: 'success',
            count: urls.length,
            message: `Found ${urls.length} assets for download`
        };
    }
    return {
        status: 'error',
        message: 'No assets found on this page'
    };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scan_page') {
        const result = initiateDownload();
        sendResponse(result);
    }
    return true; // Keep the message channel open for async response
});

// Auto-detect when page is an asset page
function detectAssetPage() {
    // Check if current page is an asset page
    const isAssetPage = window.location.href.includes('/icons/') || 
                       window.location.href.includes('/illustrations/');
    
    if (isAssetPage) {
        chrome.runtime.sendMessage({
            action: 'page_ready',
            isAssetPage: true
        });
    }
}

// Run detection when page loads
detectAssetPage();

// Observe DOM changes for dynamic content loading
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            detectAssetPage();
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
