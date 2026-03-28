/*let myChartInstance = null;
let timelineChartInstance = null;
let currentView = 'today';

// 1. Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-today').addEventListener('click', () => loadChart('today'));
    document.getElementById('btn-all').addEventListener('click', () => loadChart('all'));
    document.getElementById('refresh-btn').addEventListener('click', refreshCurrentView);
    document.getElementById('date-picker').addEventListener('change', loadDateFromPicker);

    loadChart('today');
});

function refreshCurrentView() {
    loadChart(currentView);
}

function loadDateFromPicker() {
    const dateVal = document.getElementById('date-picker').value;
    if (dateVal) loadChart(`date/${dateVal}`);
}

function formatSeconds(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}h ${m}m ${s}s`;
}

// 2. The Timeline Logic (The Histogram)
async function loadTimeline(selectedDomain = null) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    const timelineTitle = document.getElementById('timeline-title');
    
    timelineTitle.innerText = selectedDomain 
        ? `Timeline for ${selectedDomain}` 
        : "Total Activity Timeline (24h)";

    try {
        // 1. Fetch RAW events from Python (Not the 24-array, but a list of visits)
        let url = `http://127.0.0.1:8000/timeline`;
        const response = await fetch(url);
        const result = await response.json(); 
        // We expect result to look like: { "events": [ {timestamp: "...", duration: 5.2, domain: "..."}, ... ] }

        // 2. CREATE THE 24-HOUR ARRAY HERE
        // This is where your buckets live now.
        let hourlyBuckets = new Array(24).fill(0);

        // 3. THE MAGIC SHIFT
        result.events.forEach(event => {
            // Convert the UTC string from Python into a local Date object
            // This automatically applies the +2 offset for Israel.
            const localDate = new Date(event.timestamp);
            const hour = localDate.getHours(); // Returns 0-23 based on your PC clock

            // Filter logic: Only add to the bucket if we want ALL data 
            // OR if the domain matches what we clicked in the doughnut.
            if (!selectedDomain || event.domain === selectedDomain) {
                hourlyBuckets[hour] += event.duration;
            }
        });
        const roundedBuckets = hourlyBuckets.map(minutes => Math.round(minutes));
        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        if (timelineChartInstance) timelineChartInstance.destroy();

        timelineChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutes Active',
                    data: roundedBuckets, // <--- Using our fresh local buckets
                    backgroundColor: selectedDomain ? '#FF6384' : '#36A2EB',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 60,
                        title: { display: true, text: 'Minutes' } 
                    }
                }
            }
        });
    } catch (e) {
        console.error("Timeline Error:", e);
    }
}
// 3. The Main Summary Logic (The Doughnut)
async function loadChart(type = 'today') {
    currentView = type;
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const title = document.getElementById('chart-title');
    const totalDisplay = document.getElementById('total-time-display');
    const noDataMsg = document.getElementById('no-data-msg');
    const chartCanvas = document.getElementById('myChart');
    const datePicker = document.getElementById('date-picker');

    // Reset date picker if needed
    if (type === 'today' || type === 'all') datePicker.value = "";
    else if (type.startsWith('date/')) datePicker.value = type.split('/')[1];

    noDataMsg.style.display = 'none';
    chartCanvas.style.display = 'block';

    if (type === 'today') title.innerText = "Today's Activity";
    else if (type === 'all') title.innerText = "All-Time History";
    else title.innerText = `Activity for ${type.split('/')[1]}`;

    try {
        const response = await fetch(`http://127.0.0.1:8000/summary/${type}`);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        statusDot.className = 'online';
        statusText.innerText = 'Server Online';

        const labels = Object.keys(data);
        if (labels.length === 0) {
            noDataMsg.style.display = 'block';
            chartCanvas.style.display = 'none';
            totalDisplay.innerText = "Total: 0h 0m 0s";
            if (myChartInstance) myChartInstance.destroy();
            return;
        }

        let grandTotalSeconds = 0;
        const values = labels.map(l => {
            const parts = data[l].match(/\d+/g);
            const seconds = (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2]);
            grandTotalSeconds += seconds; 
            return seconds;
        });

        totalDisplay.innerText = `Total: ${formatSeconds(grandTotalSeconds)}`;

        const ctx = chartCanvas.getContext('2d');
        if (myChartInstance) myChartInstance.destroy();

        myChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const domain = labels[index];
                        // 🎯 TRIGGER DRILL-DOWN
                        loadTimeline(domain);
                    } else {
                        // Reset to total trend if clicking background
                        loadTimeline();
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatSeconds(ctx.raw)}`
                        }
                    }
                }
            }
        });

        // 🚀 Always load the total timeline on initial view load
        loadTimeline();

    } catch (e) {
        console.error("Dashboard Error:", e);
        statusDot.className = 'offline';
        statusText.innerText = 'Server Offline';
    }
}
let myChartInstance = null;
let timelineChartInstance = null;
let currentView = 'today';

// 1. Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-today').addEventListener('click', () => loadChart('today'));
    document.getElementById('btn-all').addEventListener('click', () => loadChart('all'));
    document.getElementById('refresh-btn').addEventListener('click', refreshCurrentView);
    document.getElementById('date-picker').addEventListener('change', loadDateFromPicker);

    loadChart('today');
});

function refreshCurrentView() {
    loadChart(currentView);
}

function loadDateFromPicker() {
    const dateVal = document.getElementById('date-picker').value;
    if (dateVal) loadChart(`date/${dateVal}`);
}

/**
 * Converts raw seconds into human-readable H/M/S for the UI
 *
function formatSeconds(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.length > 0 ? parts.join(' ') : "0s";
}

// 2. The Timeline Logic (The Histogram)
async function loadTimeline(selectedDomain = null,selectedDate = null) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    const timelineTitle = document.getElementById('timeline-title');
    
    timelineTitle.innerText = selectedDomain 
        ? `Timeline for ${selectedDomain}` 
        : "Total Activity Timeline (24h)";

    try {
        let url = `http://127.0.0.1:8000/timeline`;
        if (selectedDate) {
            url += `?target_date=${selectedDate}`;
        }
        const response = await fetch(url);
        const result = await response.json(); 

        let hourlyBuckets = new Array(24).fill(0);

        if (result.events) {
            result.events.forEach(event => {
                const localDate = new Date(event.timestamp);
                const hour = localDate.getHours(); 

                if (!selectedDomain || event.domain === selectedDomain) {
                    // Convert seconds to minutes for the bar chart display
                    hourlyBuckets[hour] += (event.duration / 60);
                }
            });
        }

        const roundedBuckets = hourlyBuckets.map(minutes => Math.floor(minutes));
        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        if (timelineChartInstance) timelineChartInstance.destroy();

        timelineChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutes Active',
                    data: roundedBuckets,
                    backgroundColor: selectedDomain ? '#FF6384' : '#36A2EB',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 60,
                        title: { display: true, text: 'Minutes' } 
                    }
                }
            }
        });
    } catch (e) {
        console.error("Timeline Error:", e);
    }
}

// 3. The Main Summary Logic (The Doughnut)
async function loadChart(type = 'today') {
    currentView = type;
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const title = document.getElementById('chart-title');
    const totalDisplay = document.getElementById('total-time-display');
    const noDataMsg = document.getElementById('no-data-msg');
    const chartCanvas = document.getElementById('myChart');
    const refreshBtn = document.getElementById('refresh-btn');
    const datePicker = document.getElementById('date-picker');

    refreshBtn.innerText = "🔄 Syncing...";

    if (type === 'today' || type === 'all') datePicker.value = "";
    else if (type.startsWith('date/')) datePicker.value = type.split('/')[1];

    noDataMsg.style.display = 'none';
    chartCanvas.style.display = 'block';

    if (type === 'today') title.innerText = "Today's Activity";
    else if (type === 'all') title.innerText = "All-Time History";
    else title.innerText = `Activity for ${type.split('/')[1]}`;

    try {
        const response = await fetch(`http://127.0.0.1:8000/summary/${type}`);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        statusDot.className = 'online';
        statusText.innerText = 'Server Online';

        const labels = Object.keys(data);
        if (labels.length === 0) {
            noDataMsg.style.display = 'block';
            chartCanvas.style.display = 'none';
            totalDisplay.innerText = "Total: 0s";
            if (myChartInstance) myChartInstance.destroy();
            return;
        }

        let grandTotalSeconds = 0;
        
        // --- THE FIX: INTELLIGENT PARSING ---
        const values = labels.map(l => {
            const parts = data[l].match(/\d+/g).map(Number);
            let seconds = 0;

            if (parts.length === 3) { 
                // [Hours, Minutes, Seconds]
                seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            } else if (parts.length === 2) { 
                // [Minutes, Seconds]
                seconds = (parts[0] * 60) + parts[1];
            } else if (parts.length === 1) { 
                // [Seconds]
                seconds = parts[0];
            }

            grandTotalSeconds += seconds; 
            return seconds;
        });

        totalDisplay.innerText = `Total: ${formatSeconds(grandTotalSeconds)}`;

        const ctx = chartCanvas.getContext('2d');
        if (myChartInstance) myChartInstance.destroy();

        myChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const domain = labels[index];
                        loadTimeline(domain);
                    } else {
                        loadTimeline();
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatSeconds(ctx.raw)}`
                        }
                    }
                }
            }
        });

        loadTimeline();

    } catch (e) {
        console.error("Dashboard Error:", e);
        statusDot.className = 'offline';
        statusText.innerText = 'Server Offline';
    } finally {
        refreshBtn.innerText = "🔄 Refresh";
    }
}*/
// --- GLOBAL INSTANCES ---
let myChartInstance = null;         // Doughnut Chart (Summary)
let timelineChartInstance = null;   // Bar Chart (Timeline)
let currentView = 'today';          // Tracks the current state

// 1. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    // Button Listeners
    document.getElementById('btn-today').addEventListener('click', () => loadChart('today'));
    document.getElementById('btn-all').addEventListener('click', () => loadChart('all'));
    document.getElementById('refresh-btn').addEventListener('click', refreshCurrentView);
    
    // Calendar Picker Listener
    document.getElementById('date-picker').addEventListener('change', loadDateFromPicker);

    // Initial Load
    loadChart('today');
});

function refreshCurrentView() {
    loadChart(currentView);
}

function loadDateFromPicker() {
    const dateVal = document.getElementById('date-picker').value;
    if (dateVal) {
        // Formats the call as 'date/2026-03-21' for the backend
        loadChart(`date/${dateVal}`);
    }
}

/**
 * Helper: Converts raw seconds into human-readable H/M/S
 */
function formatSeconds(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.length > 0 ? parts.join(' ') : "0s";
}

/*// 2. THE TIMELINE LOGIC (BAR CHART)
async function loadTimeline(selectedDomain = null, selectedDate = null) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // 1. Build the URL correctly
    const url = new URL('http://127.0.0.1:8000/timeline');
    if (selectedDate) url.searchParams.append('target_date', selectedDate);
    if (selectedDomain) url.searchParams.append('domain', selectedDomain);

    try {
        const response = await fetch(url);
        const result = await response.json(); 

        // 2. ALWAYS reset buckets to zero
        let hourlyBuckets = new Array(24).fill(0);

        if (result.events) {
            result.events.forEach(event => {
                const localDate = new Date(event.timestamp);
                const hour = localDate.getHours(); 
                // Convert seconds to minutes
                hourlyBuckets[hour] += (event.duration / 60);
            });
        }
        const roundedBuckets = hourlyBuckets.map(minutes => {
            return Math.floor(minutes); // 14.793 becomes 14
        });

        // 3. Update the Chart
        if (window.timelineChartInstance) window.timelineChartInstance.destroy();

        window.timelineChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [{
                    label: selectedDomain ? `Minutes on ${selectedDomain}` : 'Total Minutes Active',
                    data: roundedBuckets, // Use the fresh data!
                    backgroundColor: selectedDomain ? '#FF6384' : '#36A2EB',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, max: 60 } }
            }
        });
    } catch (e) {
        console.error("Timeline Error:", e);
    }
}

*/
async function loadTimeline(selectedDomain = null, selectedDate = null) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    const url = new URL('http://127.0.0.1:8000/timeline');
    if (selectedDate) url.searchParams.append('target_date', selectedDate);
    if (selectedDomain) url.searchParams.append('domain', selectedDomain);

    try {
        const response = await fetch(url);
        const result = await response.json(); 

        let hourlyBuckets = new Array(24).fill(0);
        if (result.events) {
            result.events.forEach(event => {
                const localDate = new Date(event.timestamp);
                const hour = localDate.getHours(); 
                hourlyBuckets[hour] += (event.duration / 60);
            });
        }
        const roundedBuckets = hourlyBuckets.map(minutes => Math.floor(minutes));
        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        // --- UPDATE LOGIC ---
        if (timelineChartInstance) {
            timelineChartInstance.data.labels = labels;
            timelineChartInstance.data.datasets[0].data = roundedBuckets;
            timelineChartInstance.data.datasets[0].label = selectedDomain ? `Minutes on ${selectedDomain}` : 'Total Minutes Active';
            timelineChartInstance.data.datasets[0].backgroundColor = selectedDomain ? '#FF6384' : '#36A2EB';
            timelineChartInstance.update(); // Smooth transition
        } else {
            timelineChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: selectedDomain ? `Minutes on ${selectedDomain}` : 'Total Minutes Active',
                        data: roundedBuckets,
                        backgroundColor: selectedDomain ? '#FF6384' : '#36A2EB',
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true, max: 60 } }
                }
            });
        }
    } catch (e) {
        console.error("Timeline Error:", e);
    }
}
/*
// 3. THE MAIN SUMMARY LOGIC (DOUGHNUT CHART)
async function loadChart(type = 'today') {
    currentView = type;
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const title = document.getElementById('chart-title');
    const totalDisplay = document.getElementById('total-time-display');
    const noDataMsg = document.getElementById('no-data-msg');
    const chartCanvas = document.getElementById('myChart');
    const refreshBtn = document.getElementById('refresh-btn');
    const datePicker = document.getElementById('date-picker');

    refreshBtn.innerText = "🔄 Syncing...";

    // --- DATE EXTRACTION ---
    let dateForTimeline = null;
    if (type === 'today' || type === 'all') {
        datePicker.value = "";
    } else if (type.startsWith('date/')) {
        dateForTimeline = type.split('/')[1];
        datePicker.value = dateForTimeline;
    }

    // UI Updates
    noDataMsg.style.display = 'none';
    chartCanvas.style.display = 'block';

    if (type === 'today') title.innerText = "Today's Activity";
    else if (type === 'all') title.innerText = "All-Time History";
    else title.innerText = `Activity for ${dateForTimeline}`;

    try {
        const response = await fetch(`http://127.0.0.1:8000/summary/${type}`);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        statusDot.className = 'online';
        statusText.innerText = 'Server Online';

        const labels = Object.keys(data);
        if (labels.length === 0) {
            noDataMsg.style.display = 'block';
            chartCanvas.style.display = 'none';
            totalDisplay.innerText = "Total: 0s";
            if (myChartInstance) myChartInstance.destroy();
            // Even if no summary data, try to load an empty timeline for that date
            loadTimeline(null, dateForTimeline);
            return;
        }


        const values = Object.values(data);
        const grandTotalSeconds = values.reduce((acc, curr) => {
            const val = parseFloat(curr);
            return acc + (isNaN(val) ? 0 : val);
        }, 0);

        totalDisplay.innerText = `Total: ${formatSeconds(grandTotalSeconds)}`;


        const ctx = chartCanvas.getContext('2d');
        if (myChartInstance) myChartInstance.destroy();

        myChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const domain = labels[index];
                        // Pass current date to keep timeline in sync when filtering by domain
                        loadTimeline(domain, dateForTimeline);
                    } else {
                        loadTimeline(null, dateForTimeline);
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatSeconds(ctx.raw)}`
                        }
                    }
                }
            }
        });

        // --- FINAL SYNC: Update Timeline whenever the Summary updates ---
        loadTimeline(null, dateForTimeline);

    } catch (e) {
        console.error("Dashboard Error:", e);
        statusDot.className = 'offline';
        statusText.innerText = 'Server Offline';
    } finally {
        refreshBtn.innerText = "🔄 Refresh";
    }
}*/

async function loadChart(type = 'today') {
    currentView = type;
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const title = document.getElementById('chart-title');
    const totalDisplay = document.getElementById('total-time-display');
    const noDataMsg = document.getElementById('no-data-msg');
    const chartCanvas = document.getElementById('myChart');
    const refreshBtn = document.getElementById('refresh-btn');
    const datePicker = document.getElementById('date-picker');

    refreshBtn.innerText = "🔄 Syncing...";

    let dateForTimeline = null;
    if (type === 'today' || type === 'all') {
        datePicker.value = "";
    } else if (type.startsWith('date/')) {
        dateForTimeline = type.split('/')[1];
        datePicker.value = dateForTimeline;
    }

    if (type === 'today') title.innerText = "Today's Activity";
    else if (type === 'all') title.innerText = "All-Time History";
    else title.innerText = `Activity for ${dateForTimeline}`;

    try {
        const response = await fetch(`http://127.0.0.1:8000/summary/${type}`);
        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        statusDot.className = 'online';
        statusText.innerText = 'Server Online';

        const labels = Object.keys(data);
        if (labels.length === 0) {
            noDataMsg.style.display = 'block';
            chartCanvas.style.display = 'none';
            totalDisplay.innerText = "Total: 0s";
            if (myChartInstance) {
                myChartInstance.destroy();
                myChartInstance = null;
            }
            loadTimeline(null, dateForTimeline);
            return;
        }

        noDataMsg.style.display = 'none';
        chartCanvas.style.display = 'block';

        const values = Object.values(data).map(v => parseFloat(v) || 0);
        const grandTotalSeconds = values.reduce((acc, curr) => acc + curr, 0);
        totalDisplay.innerText = `Total: ${formatSeconds(grandTotalSeconds)}`;

        const ctx = chartCanvas.getContext('2d');

        // --- UPDATE LOGIC ---
        if (myChartInstance) {
            myChartInstance.data.labels = labels;
            myChartInstance.data.datasets[0].data = values;
            myChartInstance.update(); // Updates colors and slices smoothly
        } else {
            myChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7BC225'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const domain = myChartInstance.data.labels[index];
                            loadTimeline(domain, dateForTimeline);
                        } else {
                            loadTimeline(null, dateForTimeline);
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.label}: ${formatSeconds(ctx.raw)}`
                            }
                        }
                    }
                }
            });
        }

        loadTimeline(null, dateForTimeline);

    } catch (e) {
        console.error("Dashboard Error:", e);
        statusDot.className = 'offline';
        statusText.innerText = 'Server Offline';
    } finally {
        refreshBtn.innerText = "🔄 Refresh";
    }
}