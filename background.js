
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
                sendToPython("System/New Tab", url);
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
function sendToPython(url) {
    //Safety check: If there's no URL, or if it's a Chrome internal page 
    //(like settings or extensions), we stop right here and don't send anything.
    if (!url || url.startsWith('chrome://') || url.startsWith('file:///')) return;

    let domainName;

    //If the "URL" we received is actually just the word "IDLE", 
    //we keep it as "IDLE" so the backend knows you're away.
    if(url === "IDLE"){
        domainName = "IDLE";
    }
    else{
        try{
            //Here we try to turn a long messy link into just the website name.
            if (url.startsWith('http')) {
                //If it's a real website link (starts with http), 
                //we peel off everything except the main name (like 'google.com').
                domainName = new URL(url).hostname;
            }
            else {
                //If it's already just a name, we use it as is.
                domainName = url;
            }
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
