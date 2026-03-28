

/*
const IGNORED_SCHEMES = ['chrome://', 'file:///', 'chrome-extension://', 'edge://'];
const IGNORED_DOMAINS = ['newtab', 'extensions', 'settings', 'blank','System/'];

// This creates a "pulse" every 15 seconds.
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("heartbeat", { periodInMinutes: 0.25 }); 
});

// --- 2. THE HEARTBEAT LISTENER ---
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "heartbeat") {
        // We check if the user is actually active before pinging.
        chrome.idle.queryState(15, (state) => {
            if (state === "active") {
                console.log("Heartbeat: User still active. Updating duration...");
                reportActiveTab(); // This uses your existing logic!
            } else {
                // If they are away, we remind the backend we are still IDLE
                // This keeps the IDLE session accurate too.
                sendToPython("IDLE");
            }
        });
    }
});
//When we open a new tab on google chrome, it logs it and sends the url to our backend
//via sendToPython function and the url it detected(changeInfo.url)
//sendToPython will check if its valid and decide if to post it to the backend.
chrome.tabs.onUpdated.addListener((tabId,changeInfo,tab)=>{

    //A tab "updates" for many reasons (like the little loading spinner or a title change).
    //I only  care if the user actually went to a new web address (the URL).
    if (changeInfo.url){
        //If the URL changed, it means the user moved to a new page.
        //We grab that new address and send it to our sendToPython to be processed.
        sendToPython(changeInfo.url);
    }
});

//When we switch from one tab to the other, it sends the current url of the site to our backend
//via sendToPython function and the url it detected(tab.url)
//sendToPython will check if its a vaild url and decide if to post it to the backend.
chrome.tabs.onActivated.addListener((activeInfo)=>{
    //We receive an ID (activeInfo.tabId) and we need to fetch the tab in order to see the url.
    chrome.tabs.get(activeInfo.tabId,(tab)=>{
        //We safety check that the url exists and if so we send it to the be processed.
        if (tab.url){
            sendToPython(tab.url);
        }
    });
});

//I defined a time of 15 seconds, if the user is not active for 15 seconds, we will swtich to idle mode
//and we will stop record the screen time
chrome.idle.setDetectionInterval(15);

//Here we listens for changes in physical user activity
//It handels the transition between 'active' use of the tab and 'idle' where no activity is happening.
//We also check for the case where we watch a video meaning that we are not physically active but still not idling.
    chrome.idle.onStateChanged.addListener((newState)=>{
        console.log("System state: ", newState);
        //Happens when we stop touching the mouse/keyboard.
        if(newState === "idle" || newState === "locked"){
            //We query for the active tab and are checking if the user is watching something with audio meaning that 
            //he is probably watching a video hence he is not idle
            chrome.tabs.query({active:true,currentWindow:true},(tabs)=>{
                if (tabs[0]){
                    const isMeeting = tabs[0].url.includes("meet.google.com") || tabs[0].url.includes("zoom.us");
                    // If it's a meeting OR it's making noise, don't go idle.
                    if (tabs[0].audible || isMeeting) {
                        console.log("Meeting or Audio detected. Staying active.");
                        return; 
                    }
                }
                //If the user is not watching a video and is physically idle we send that he is idle.
                sendToPython("IDLE","N/A");
            });
        }
        //If the user is active we call "reportActiveTab" and continue with the script.
        else if (newState === "active"){
            console.log("User returned! Resuming tracking...");
            reportActiveTab();
            }
    });

//This function identifies the current active tab and sends its data to the backend via
function reportActiveTab() {
    //Queries Chrome for the tab that is currently 'active' and in the user's 'focused' window
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        //This is a safety check that the url exists and is valid
        if (tabs[0] && tabs[0].url) {
            let url = tabs[0].url;
            //we want to send only the domain of the site, not the extenstions so we "strip" the extenstions off of it.
            if (url.startsWith("http")) {
                try {
                    let domain = new URL(url).hostname;
                    sendToPython(domain, url);
                } catch (e) {
                    console.error("URL Parsing failed:", e);
                }
            } else {
                //If the page is generic like new tab or settings we just send a placeholder
                sendToPython("newtab", url);
            }
        }
    });
}


//Here we monitor tab updates to detect when media (like YouTube) stops playing.
//This ensures we transition to 'IDLE' the moment a video ends, even if 
//the user has already been physically away from the keyboard.
chrome.tabs.onUpdated.addListener((tabId,changeInfo,tab)=>{
    //We check if the tab's 'audible' state just changed to false (sound stopped/paused)
    if (changeInfo.audible === false){
        //Before marking as IDLE, we must verify the user is physically away.
        //We query the current state instead of waiting for a change event.
        chrome.idle.queryState(15,(state)=>{
            //If we are idle and the sound is now gone, we can stop counting time in the tab.
            if (state === "idle" || state === "locked"){
                const isMeeting = tab.url.includes("meet.google.com") || tab.url.includes("zoom.us");

                if (!isMeeting) {
                    console.log("Video stopped and user is away. Sending IDLE.");
                    sendToPython("IDLE", "N/A");
                }
                else{
                    console.log("Audio stopped but it's a Meeting. Keeping active.");
                }
            }
        });
    }
});


//This function is the "Courier."
//Its job is to process the data, pack it up 
//and send it over to your Python server.
/*function sendToPython(url) {
    //Safety check: If there's no URL, or if it's a Chrome internal page 
    //(like settings or extensions), we stop right here and don't send anything.
    if (!url || IGNORED_SCHEMES.some(scheme => url.startsWith(scheme))) return;

    let domainName;

    //If the "URL" we received is actually just the word "IDLE", 
    //we keep it as "IDLE" so the backend knows you're away.
    if(url === "IDLE"){
        domainName = "IDLE";
    }
    else{
        try{
            domainName = url.startsWith('http') ? new URL(url).hostname : url;
            if (IGNORED_DOMAINS.includes(domainName)) return;
        }
        catch(e){
            //If something goes wrong and the URL is weird, we log an error 
            //instead of letting the whole extension crash.
            console.error("Could not parse URL:",url);
            return;
        }
    }
    //We bundle the URL and the domain name into a little package that the backend knows how to read.
    const dataToSend = {
        url: url,
        domain: domainName
    };
     
    //We send the package to our Python server at address 127.0.0.1 (your own PC).
    fetch("http://127.0.0.1:8000/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
    })
    .catch(e => console.error("Python Server Offline", e));

}


function sendToPython(url) {
    if (!url) return;

    let domainName = "idle"; // Start with a default 'stop' signal
    let isIgnored = false;

    // Check if the scheme is ignored (chrome://, etc.)
    if (IGNORED_SCHEMES.some(scheme => url.startsWith(scheme))) {
        isIgnored = true;
    }

    if (!isIgnored && url !== "IDLE") {
        try {
            domainName = url.startsWith('http') ? new URL(url).hostname : url;
            // Check if the domain itself is ignored (newtab, etc.)
            if (IGNORED_DOMAINS.includes(domainName)) {
                domainName = "idle";
            }
        } catch (e) {
            domainName = "idle";
        }
    } else if (url === "IDLE") {
        domainName = "idle";
    }

    // --- THE FIX: ALWAYS FETCH ---
    // We removed all the "return" statements. 
    // Now, even if a site is ignored, we send "idle" to the backend.
    const dataToSend = {
        url: url,
        domain: domainName
    };

    fetch("http://127.0.0.1:8000/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
    })
    .catch(e => console.error("Python Server Offline", e));
}
*/

const IGNORED_SCHEMES = ['chrome://', 'file:///', 'chrome-extension://', 'edge://'];
const IGNORED_DOMAINS = ['newtab', 'extensions', 'settings', 'blank', 'system/'];

// --- 1. INITIALIZATION ---
chrome.runtime.onInstalled.addListener(() => {
    // Heartbeat runs every 15 seconds to double-check state
    chrome.alarms.create("heartbeat", { periodInMinutes: 0.25 }); 
    console.log("Chronos extension started.");
});

// --- 2. FOCUS & WINDOW TRACKING (The "Fix") ---
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // This fires the MOMENT you click an app outside of Chrome (VS Code, Spotify, etc.)
        console.log("OS Focus Lost: Chrome is background.");
        sendToPython("IDLE");
    } else {
        // You just clicked back into a Chrome window
        console.log("OS Focus Gained: Chrome is active.");
        reportActiveTab();
    }
});

// --- 3. HEARTBEAT (The Safety Net) ---
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "heartbeat") {
        // Check if ANY chrome window is currently the OS-level focused window
        chrome.windows.getLastFocused({ populate: false }, (win) => {
            if (win && win.focused) {
                // If Chrome is focused, check if the user is actually typing/moving mouse
                chrome.idle.queryState(30, (state) => {
                    if (state === "active") {
                        reportActiveTab();
                    } else {
                        // Check for meetings/media before idling
                        checkMediaAndReport();
                    }
                });
            } else {
                // If Chrome is open but NOT the focused app on your PC
                sendToPython("IDLE");
            }
        });
    }
});

// --- 4. TAB & ACTIVITY LISTENERS ---
chrome.tabs.onActivated.addListener(() => reportActiveTab());

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        // Only report if the URL change happened in the window the user is looking at
        chrome.windows.get(tab.windowId, (win) => {
            if (win.focused) {
                sendToPython(changeInfo.url);
            }
        });
    }
});

chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === "active") {
        reportActiveTab();
    } else {
        checkMediaAndReport();
    }
});

// --- 5. HELPERS ---

function reportActiveTab() {
    // query the active tab in the window that is currently focused
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            sendToPython(tabs[0].url);
        }
    });
}

function checkMediaAndReport() {
    // Look for ANY tab that is either playing sound or is a known meeting domain
    chrome.tabs.query({}, (allTabs) => {
        const activeMediaTab = allTabs.find(tab => {
            const isMeeting = tab.url && (tab.url.includes("meet.google.com") || tab.url.includes("zoom.us"));
            return tab.audible || isMeeting;
        });

        if (activeMediaTab) {
            // If we found a tab playing media/meeting, keep reporting it!
            console.log("System is idle, but media/meeting is active on:", activeMediaTab.url);
            sendToPython(activeMediaTab.url);
        } else {
            // Truly idle: no audio, no meeting, no input.
            console.log("System is idle and silent. Sending IDLE.");
            sendToPython("IDLE");
        }
    });
}
let lastReportedDomain = ""; // Tracks the last thing we told Python

function sendToPython(url) {
    if (!url) return;

    let domainName = "idle";
    let isIgnored = (url === "IDLE" || IGNORED_SCHEMES.some(scheme => url.startsWith(scheme)));

    if (!isIgnored) {
        try {
            domainName = new URL(url).hostname;
            if (IGNORED_DOMAINS.some(d => domainName.toLowerCase().includes(d.toLowerCase()))) {
                domainName = "idle";
            }
        } catch (e) {
            domainName = "idle";
        }
    }

    // --- THE STATE GATE ---
    // If we are idle now AND we were already idle, STOP. Don't ping the server.
    if (domainName === "idle" && lastReportedDomain === "idle") {
        return; 
    }

    // Update our tracker
    lastReportedDomain = domainName;

    console.log(">>> Reporting to Python:", domainName);

    const dataToSend = { url: url, domain: domainName };
    fetch("http://127.0.0.1:8000/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
    }).catch(err => console.error("Python Offline"));
}