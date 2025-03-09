// DOM Elements
const startButton = document.getElementById('startDownload');
const stopButton = document.getElementById('stopDownload');
const delayInput = document.getElementById('delayInput');
const queueCount = document.getElementById('queueCount');
const downloadStatus = document.getElementById('downloadStatus');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// State management
let isDownloading = false;
let totalAssets = 0;
let completedAssets = 0;

// Initialize popup
function initializePopup() {
    updateStatus();
    
    // Check if we're on an IconScout page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const isIconScoutPage = currentTab.url.includes('iconscout.com');
        startButton.disabled = !isIconScoutPage;
        
        if (!isIconScoutPage) {
            downloadStatus.textContent = 'Please visit IconScout to download assets';
            startButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
}

// Update download progress
function updateProgress() {
    if (totalAssets > 0) {
        const percentage = Math.round((completedAssets / totalAssets) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}% (${completedAssets}/${totalAssets})`;
        
        if (!progressContainer.classList.contains('block')) {
            progressContainer.classList.remove('hidden');
            progressContainer.classList.add('block');
        }
    }
}

// Update status display
function updateStatus() {
    chrome.runtime.sendMessage({ action: 'get_status' }, (response) => {
        if (response) {
            queueCount.textContent = response.queueLength;
            downloadStatus.textContent = response.isProcessing ? 'Downloading...' : 'Idle';
            isDownloading = response.isProcessing;
            
            // Update button visibility
            startButton.classList.toggle('hidden', isDownloading);
            stopButton.classList.toggle('hidden', !isDownloading);
            
            // Update delay input
            delayInput.value = response.delay;
        }
    });
}

// Start download process
async function startDownload() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Reset progress
        completedAssets = 0;
        totalAssets = 0;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        // Send message to content script to scan page
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan_page' });
        
        if (response.status === 'success') {
            totalAssets = response.count;
            isDownloading = true;
            downloadStatus.textContent = 'Downloading...';
            startButton.classList.add('hidden');
            stopButton.classList.remove('hidden');
            progressContainer.classList.remove('hidden');
            updateProgress();
        } else {
            downloadStatus.textContent = response.message;
        }
    } catch (error) {
        console.error('Error starting download:', error);
        downloadStatus.textContent = 'Error: Could not start download';
    }
}

// Stop download process
function stopDownload() {
    chrome.runtime.sendMessage({ action: 'clear_queue' }, (response) => {
        if (response.status === 'success') {
            isDownloading = false;
            downloadStatus.textContent = 'Download stopped';
            startButton.classList.remove('hidden');
            stopButton.classList.add('hidden');
            updateStatus();
        }
    });
}

// Update download delay
function updateDelay() {
    const newDelay = parseInt(delayInput.value);
    if (newDelay >= 500) {
        chrome.runtime.sendMessage({
            action: 'update_delay',
            delay: newDelay
        });
    }
}

// Listen for download progress updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'download_progress') {
        completedAssets = message.completed;
        updateProgress();
        updateStatus();
    }
    return true;
});

// Event Listeners
startButton.addEventListener('click', startDownload);
stopButton.addEventListener('click', stopDownload);
delayInput.addEventListener('change', updateDelay);

// Initialize popup when opened
document.addEventListener('DOMContentLoaded', initializePopup);

// Update status periodically
setInterval(updateStatus, 1000);
