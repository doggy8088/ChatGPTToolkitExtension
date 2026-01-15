(function () {
    "use strict";

    // Default feature settings - all features enabled by default
    const DEFAULT_SETTINGS = {
        "chatgpttoolkit.featureToggle.autoFill": true,
        "chatgpttoolkit.featureToggle.customPrompts": true,
        "chatgpttoolkit.featureToggle.doubleClickEdit": true,
        "chatgpttoolkit.featureToggle.autoContinue": true,
        "chatgpttoolkit.featureToggle.markmap": true,
        "chatgpttoolkit.featureToggle.ctrlEnter": true
    };

    // Feature toggle mapping
    const FEATURE_TOGGLES = [
        { id: 'autoFillToggle', key: 'chatgpttoolkit.featureToggle.autoFill' },
        { id: 'customPromptsToggle', key: 'chatgpttoolkit.featureToggle.customPrompts' },
        { id: 'doubleClickEditToggle', key: 'chatgpttoolkit.featureToggle.doubleClickEdit' },
        { id: 'autoContinueToggle', key: 'chatgpttoolkit.featureToggle.autoContinue' },
        { id: 'markmapToggle', key: 'chatgpttoolkit.featureToggle.markmap' },
        { id: 'ctrlEnterToggle', key: 'chatgpttoolkit.featureToggle.ctrlEnter' }
    ];

    // Apply i18n translations
    function applyI18n() {
        document.getElementById('pageTitle').textContent = chrome.i18n.getMessage('optionsTitle') + ' - ChatGPT Toolkit';
        document.getElementById('optionsTitle').textContent = chrome.i18n.getMessage('optionsTitle');
        document.getElementById('optionsFeatureSettings').textContent = chrome.i18n.getMessage('optionsFeatureSettings');
        document.getElementById('enableAllBtn').textContent = chrome.i18n.getMessage('optionsEnableAll');
        document.getElementById('disableAllBtn').textContent = chrome.i18n.getMessage('optionsDisableAll');
        document.getElementById('saveBtn').textContent = chrome.i18n.getMessage('optionsSave');
        document.getElementById('resetBtn').textContent = chrome.i18n.getMessage('optionsReset');

        // Feature titles and descriptions
        document.getElementById('featureAutoFillTitle').textContent = chrome.i18n.getMessage('featureAutoFillTitle');
        document.getElementById('featureAutoFillDesc').textContent = chrome.i18n.getMessage('featureAutoFillDesc');
        document.getElementById('featureCustomPromptsTitle').textContent = chrome.i18n.getMessage('featureCustomPromptsTitle');
        document.getElementById('featureCustomPromptsDesc').textContent = chrome.i18n.getMessage('featureCustomPromptsDesc');
        document.getElementById('featureDoubleClickEditTitle').textContent = chrome.i18n.getMessage('featureDoubleClickEditTitle');
        document.getElementById('featureDoubleClickEditDesc').textContent = chrome.i18n.getMessage('featureDoubleClickEditDesc');
        document.getElementById('featureAutoContinueTitle').textContent = chrome.i18n.getMessage('featureAutoContinueTitle');
        document.getElementById('featureAutoContinueDesc').textContent = chrome.i18n.getMessage('featureAutoContinueDesc');
        document.getElementById('featureMarkmapTitle').textContent = chrome.i18n.getMessage('featureMarkmapTitle');
        document.getElementById('featureMarkmapDesc').textContent = chrome.i18n.getMessage('featureMarkmapDesc');
        document.getElementById('featureCtrlEnterTitle').textContent = chrome.i18n.getMessage('featureCtrlEnterTitle');
        document.getElementById('featureCtrlEnterDesc').textContent = chrome.i18n.getMessage('featureCtrlEnterDesc');
    }

    // Load settings from chrome.storage.sync
    function loadSettings() {
        // Get all feature toggle keys
        const keys = FEATURE_TOGGLES.map(f => f.key);
        
        chrome.storage.sync.get(keys, (items) => {
            FEATURE_TOGGLES.forEach(feature => {
                const toggle = document.getElementById(feature.id);
                if (toggle) {
                    // If setting exists in storage, use it; otherwise use default
                    const value = items.hasOwnProperty(feature.key) 
                        ? items[feature.key] 
                        : DEFAULT_SETTINGS[feature.key];
                    toggle.checked = value;
                }
            });
        });
    }

    // Save settings to chrome.storage.sync
    function saveSettings() {
        const settings = {};
        
        FEATURE_TOGGLES.forEach(feature => {
            const toggle = document.getElementById(feature.id);
            if (toggle) {
                settings[feature.key] = toggle.checked;
            }
        });

        chrome.storage.sync.set(settings, () => {
            showStatusMessage(chrome.i18n.getMessage('optionsSaveSuccess'), 'success');
        });
    }

    // Reset settings to default
    function resetSettings() {
        FEATURE_TOGGLES.forEach(feature => {
            const toggle = document.getElementById(feature.id);
            if (toggle) {
                toggle.checked = DEFAULT_SETTINGS[feature.key];
            }
        });
        
        // Save the default settings
        chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
            showStatusMessage(chrome.i18n.getMessage('optionsSaveSuccess'), 'success');
        });
    }

    // Enable all features
    function enableAll() {
        FEATURE_TOGGLES.forEach(feature => {
            const toggle = document.getElementById(feature.id);
            if (toggle) {
                toggle.checked = true;
            }
        });
    }

    // Disable all features
    function disableAll() {
        FEATURE_TOGGLES.forEach(feature => {
            const toggle = document.getElementById(feature.id);
            if (toggle) {
                toggle.checked = false;
            }
        });
    }

    // Show status message
    function showStatusMessage(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = 'status-message show ' + type;
        
        setTimeout(() => {
            statusElement.className = 'status-message';
        }, 3000);
    }

    // Initialize the page
    function init() {
        applyI18n();
        loadSettings();

        // Event listeners
        document.getElementById('saveBtn').addEventListener('click', saveSettings);
        document.getElementById('resetBtn').addEventListener('click', resetSettings);
        document.getElementById('enableAllBtn').addEventListener('click', enableAll);
        document.getElementById('disableAllBtn').addEventListener('click', disableAll);
    }

    // Run initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
