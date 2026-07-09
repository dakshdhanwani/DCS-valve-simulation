// =========================================================
// DCS CONTROL VALVE SIMULATOR
// script.js - Presentation Edition
// =========================================================

// --- DOM Elements ---
const slider = document.getElementById("commandSlider");
const sendBtn = document.getElementById("sendBtn");
const commandValue = document.getElementById("commandValue");

const currentValue = document.getElementById("currentValue");
const pressureValue = document.getElementById("pressureValue");
const aiFeedbackValue = document.getElementById("aiFeedbackValue");
const feedbackValue = document.getElementById("feedbackValue");

const spValue = document.getElementById("spValue");
const pvValue = document.getElementById("pvValue");
const outValue = document.getElementById("outValue");

const aoLiveVal = document.getElementById("aoLiveVal");
const aiLiveVal = document.getElementById("aiLiveVal");
const ipLiveVal = document.getElementById("ipLiveVal");
const valvePosVal = document.getElementById("valvePosVal");

const eventLog = document.getElementById("eventLog");
const svgCanvas = document.getElementById("signalCanvas");
const archContainer = document.getElementById("architecture");

const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popupTitle");
const popupText = document.getElementById("popupText");
const closePopup = document.getElementById("closePopup");

const valveStem = document.getElementById("valveStem");
const valvePlug = document.getElementById("valvePlug");

const mathOverlay = document.getElementById("mathOverlay");
const mathFormula = document.getElementById("mathFormula");

const valveTypeSelect = document.getElementById("valveTypeSelect");
const pauseBtn = document.getElementById("pauseBtn");

// --- State Variables ---
let targetPosition = 40.0;
let currentPosition = 40.0;
let isAnimating = false;
let isSystemPaused = false;
let connections = []; 
let isWireBroken = false;
let isAirLost = false;
let valveAction = "FC";

// Update valve action listener
valveTypeSelect.addEventListener("change", function() {
    valveAction = this.value;
    addLog(`System configured to ${valveAction === "FC" ? "Fail Closed" : "Fail Open"}`, "normal");
    if (!isAnimating && !isWireBroken && !isAirLost) {
        // Soft refresh visuals
        progressiveUpdate("aoCard", targetPosition, "forward");
        progressiveUpdate("ipConverter", targetPosition, "forward");
    }
});

// Pause listener
pauseBtn.addEventListener("click", function() {
    isSystemPaused = !isSystemPaused;
    if (isSystemPaused) {
        this.textContent = "▶ RESUME";
        this.classList.replace("warning-btn", "primary-btn");
        addLog("Simulation PAUSED", "cmd");
    } else {
        this.textContent = "⏸ PAUSE";
        this.classList.replace("primary-btn", "warning-btn");
        addLog("Simulation RESUMED", "cmd");
    }
});

// --- Math Helpers ---
function calculateAOCurrent(pos) { return valveAction === "FC" ? 4 + (pos * 16 / 100) : 20 - (pos * 16 / 100); }
function calculatePressure(curr) { return 3 + ((curr - 4) * 12 / 16); }
function calculateAICurrent(pos) { return 4 + (pos * 16 / 100); }

// --- Logging ---
function addLog(msg, type = "normal") {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    eventLog.appendChild(div);
    eventLog.scrollTop = eventLog.scrollHeight;
}

// Signal travels: Operator → Connectivity Server (bridges both networks) → Controller
// NOTE: The Firewall sits at the BOUNDARY between networks. It inspects traffic but
//       process data does NOT route through it. The Connectivity Server is the actual bridge.
const forwardSequence = ["operator", "aspect", "connectivity", "controller", "commModule", "aoCard", "marshalling", "junction", "ipConverter", "valve"];

const feedbackSequence = ["valve", "aiCard", "controller"];

function getCenterCoords(id) {
    const el = document.getElementById(id);
    if (!el) return { x: 0, y: 0 };
    const archRect = archContainer.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
        x: elRect.left - archRect.left + elRect.width / 2,
        y: elRect.top - archRect.top + elRect.height / 2 + archContainer.scrollTop
    };
}

function drawConnections() {
    svgCanvas.innerHTML = "";
    connections = [];
    
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "5");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "4");
    marker.setAttribute("markerHeight", "4");
    marker.setAttribute("orient", "auto-start-reverse");
    
    const mPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    mPath.setAttribute("fill", "rgba(0, 229, 255, 0.3)");
    marker.appendChild(mPath);
    defs.appendChild(marker);
    svgCanvas.appendChild(defs);

    for (let i = 0; i < forwardSequence.length - 1; i++) {
        drawPath(forwardSequence[i], forwardSequence[i+1], "forward");
    }
    for (let i = 0; i < feedbackSequence.length - 1; i++) {
        drawPath(feedbackSequence[i], feedbackSequence[i+1], "feedback");
    }
}

function drawPath(id1, id2, type) {
    const p1 = getCenterCoords(id1);
    const p2 = getCenterCoords(id2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const midY = (p1.y + p2.y) / 2;
    const d = `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", type === "forward" ? "rgba(0, 229, 255, 0.15)" : "rgba(16, 185, 129, 0.15)");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", "url(#arrow)");
    path.dataset.from = id1;
    path.dataset.to = id2;
    svgCanvas.appendChild(path);
    connections.push({ path, p1, p2, id1, id2, type });
}

window.addEventListener("resize", drawConnections);
archContainer.addEventListener("scroll", drawConnections);

// --- Formula Overlay ---
let mathTimerId = null;
let mathTimeRemaining = 0;
function showMathOverlay(deviceId, formulaHTML) {
    const el = document.getElementById(deviceId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mathFormula.innerHTML = formulaHTML;
    
    // Position near the element
    mathOverlay.style.left = (rect.right + 20) + "px";
    mathOverlay.style.top = (rect.top - 10) + "px";
    mathOverlay.classList.add("show");
    
    mathTimeRemaining = 2500;
    if (mathTimerId) clearInterval(mathTimerId);
    mathTimerId = setInterval(() => {
        if (!isSystemPaused) {
            mathTimeRemaining -= 100;
            if (mathTimeRemaining <= 0) {
                mathOverlay.classList.remove("show");
                clearInterval(mathTimerId);
            }
        }
    }, 100);
}

// --- Animation Engine with Pause Support ---
function animateSignal(sequence, type, targetVal, callback) {
    let step = 0;
    
    function nextStep() {
        try {
            if (step >= sequence.length - 1) {
                if (callback) callback();
                return;
            }
            
            const fromId = sequence[step];
            const toId = sequence[step+1];
            
            const el = document.getElementById(fromId);
            if(el) {
                el.classList.add("active");
                // Wait for unpause to remove active state smoothly
                let activeTimeRemaining = 400;
                let activeTimer = setInterval(() => {
                    if (!isSystemPaused) activeTimeRemaining -= 100;
                    if (activeTimeRemaining <= 0) {
                        el.classList.remove("active");
                        clearInterval(activeTimer);
                    }
                }, 100);
            }
            
            const conn = connections.find(c => c.id1 === fromId && c.id2 === toId);
            if (conn && conn.path && !isWireBroken) { 
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("r", "6");
                circle.setAttribute("fill", type === "forward" ? "#00e5ff" : "#10b981");
                circle.style.filter = "drop-shadow(0 0 5px currentColor)";
                svgCanvas.appendChild(circle);
                
                let length = 100;
                try { length = conn.path.getTotalLength(); } catch(e){}

                let startTime = performance.now();
                let totalPausedTime = 0;
                let pauseTime = 0;
                const duration = 250; 
                
                function stepAnim(timestamp) {
                    if (isSystemPaused) {
                        if (pauseTime === 0) pauseTime = timestamp;
                        requestAnimationFrame(stepAnim);
                        return;
                    } else {
                        if (pauseTime > 0) {
                            totalPausedTime += (timestamp - pauseTime);
                            pauseTime = 0;
                        }
                    }

                    try {
                        let progress = (timestamp - startTime - totalPausedTime) / duration;
                        if (progress > 1) progress = 1;
                        if (progress < 0) progress = 0;
                        
                        if (progress < 1) {
                            try {
                                const pt = conn.path.getPointAtLength(progress * length);
                                circle.setAttribute("cx", pt.x);
                                circle.setAttribute("cy", pt.y);
                            } catch(err) {
                                const p1 = conn.p1; const p2 = conn.p2;
                                circle.setAttribute("cx", p1.x + (p2.x - p1.x) * progress);
                                circle.setAttribute("cy", p1.y + (p2.y - p1.y) * progress);
                            }
                            requestAnimationFrame(stepAnim);
                        } else {
                            if (circle.parentNode === svgCanvas) svgCanvas.removeChild(circle);
                            progressiveUpdate(toId, targetVal, type);
                            step++;
                            nextStep();
                        }
                    } catch (err) {
                        if (circle.parentNode === svgCanvas) svgCanvas.removeChild(circle);
                        step++; nextStep();
                    }
                }
                requestAnimationFrame(stepAnim);
            } else {
                step++; nextStep();
            }
        } catch (err) {
            isAnimating = false;
        }
    }
    nextStep();
}

function progressiveUpdate(deviceId, target, type) {
    if (type === "forward") {
        if (deviceId === "aoCard") {
            const cur = calculateAOCurrent(target).toFixed(2);
            aoLiveVal.textContent = cur + " mA";
            outValue.textContent = cur + " mA";
            currentValue.textContent = cur + " mA";
            addLog(`AO Card: ${cur} mA`, "normal");
            
            if (valveAction === "FC") {
                showMathOverlay("aoCard", `4 + (${target.toFixed(1)} &times; 0.16) = <span style="color:#fff">${cur}mA</span>`);
            } else {
                showMathOverlay("aoCard", `20 - (${target.toFixed(1)} &times; 0.16) = <span style="color:#fff">${cur}mA</span>`);
            }
        }
        if (deviceId === "ipConverter") {
            const cur = calculateAOCurrent(target);
            const press = isAirLost ? 0 : calculatePressure(cur);
            ipLiveVal.textContent = press.toFixed(2) + " psi";
            pressureValue.textContent = press.toFixed(2) + " psi";
            if(!isAirLost) showMathOverlay("ipConverter", `3 + ((${cur.toFixed(2)} - 4) &times; 0.75) = <span style="color:#fff">${press.toFixed(2)}psi</span>`);
        }
        if (deviceId === "valve") {
            if(!isAirLost) {
                addLog(`Valve received pneumatic signal`, "cmd");
                moveValveGraphic(target);
            }
        }
    } else {
        if (deviceId === "aiCard") {
            const cur = calculateAICurrent(target).toFixed(2);
            aiLiveVal.textContent = cur + " mA";
            aiFeedbackValue.textContent = cur + " mA";
        }
        if (deviceId === "controller") {
            pvValue.textContent = target.toFixed(1) + " %";
            addLog(`PID Loop Closed. PV = ${target.toFixed(1)}%`, "normal");
        }
    }
}

function moveValveGraphic(pos) {
    currentPosition = pos;
    const maxTravel = 25; 
    const travel = (pos / 100) * maxTravel;
    valveStem.style.transform = `translateY(${travel}px)`;
    valvePlug.style.transform = `translateY(${travel}px)`;
    valvePosVal.textContent = pos.toFixed(1) + "%";
    feedbackValue.textContent = pos.toFixed(1) + " %";
}

// --- Chart.js Integration ---
const ctx = document.getElementById('trendChart').getContext('2d');
const trendChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(20).fill(''),
        datasets: [
            { label: 'SP (Cmd)', data: Array(20).fill(40), borderColor: '#00e5ff', borderWidth: 2, pointRadius: 0, tension: 0.1 },
            { label: 'PV (Feedback)', data: Array(20).fill(40), borderColor: '#10b981', borderWidth: 2, pointRadius: 0, tension: 0.4 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', stepSize: 25 } },
            x: { grid: { display: false } }
        },
        plugins: {
            legend: { labels: { color: '#e2e8f0', boxWidth: 12 } }
        }
    }
});

// Update chart every 1 second (respects pause)
setInterval(() => {
    if (isSystemPaused) return;
    trendChart.data.datasets[0].data.shift();
    trendChart.data.datasets[0].data.push(targetPosition);
    
    trendChart.data.datasets[1].data.shift();
    trendChart.data.datasets[1].data.push(currentPosition);
    
    trendChart.update();
}, 1000);

// Custom pausable timeout wrapper
function pausableTimeout(callback, delay) {
    let timeRemaining = delay;
    let timerId = setInterval(() => {
        if (!isSystemPaused) timeRemaining -= 100;
        if (timeRemaining <= 0) {
            clearInterval(timerId);
            callback();
        }
    }, 100);
}

// --- Interactions ---
slider.addEventListener("input", function() {
    commandValue.textContent = Number(slider.value).toFixed(1);
});

sendBtn.addEventListener("click", function() {
    if (isAnimating || isWireBroken || isAirLost || isSystemPaused) return;
    
    targetPosition = Number(slider.value);
    isAnimating = true;
    
    addLog(`Operator set SP to ${targetPosition.toFixed(1)}%`, "cmd");
    spValue.textContent = targetPosition.toFixed(1) + " %";
    
    animateSignal(forwardSequence, "forward", targetPosition, () => {
        pausableTimeout(() => {
            const actualFeedback = targetPosition - (Math.random() * 0.3);
            addLog(`Transmitting AI feedback...`);
            animateSignal(feedbackSequence, "feedback", actualFeedback, () => {
                isAnimating = false;
            });
        }, 600);
    });
});

// Scenarios
document.getElementById("wireBreakBtn").addEventListener("click", function() {
    isWireBroken = true;
    addLog("SCENARIO: Field Wire Break at Junction Box", "alarm");
    document.getElementById("junction").classList.add("active");
    
    pausableTimeout(() => {
        const failPos = valveAction === "FC" ? 0 : 100;
        currentPosition = failPos;
        moveValveGraphic(failPos);
        
        const currentOutput = calculateAOCurrent(targetPosition).toFixed(2);
        aoLiveVal.textContent = currentOutput + " mA";
        currentValue.textContent = currentOutput + " mA";
        
        aiLiveVal.textContent = "0.00 mA";
        aiFeedbackValue.textContent = "0.00 mA";
        pvValue.textContent = "0.0 %";
        
        addLog(`Open circuit detected (0.00 mA). Valve moves to ${failPos}%`, "alarm");
    }, 500);
});

document.getElementById("airLossBtn").addEventListener("click", function() {
    isAirLost = true;
    addLog("SCENARIO: Loss of Instrument Air", "alarm");
    document.getElementById("ipConverter").classList.add("active");
    
    pausableTimeout(() => {
        ipLiveVal.textContent = "0.00 psi";
        pressureValue.textContent = "0.00 psi";
        
        const failPos = valveAction === "FC" ? 0 : 100;
        currentPosition = failPos;
        moveValveGraphic(failPos);
        
        // Electrical wires are intact. AI reads physical position.
        const failAI = calculateAICurrent(failPos).toFixed(2);
        aiLiveVal.textContent = failAI + " mA";
        aiFeedbackValue.textContent = failAI + " mA";
        pvValue.textContent = failPos.toFixed(1) + " %";
        
        addLog(`Valve drifts to fail-safe (${failPos}%). Transmitter sends ${failAI} mA.`, "alarm");
    }, 500);
});

document.getElementById("alarmBtn").addEventListener("click", function() {
    document.body.classList.toggle("alarm-state");
    const isAlarm = document.body.classList.contains("alarm-state");
    const led = document.getElementById("commLed");
    if (isAlarm) {
        led.classList.replace("green", "red");
        addLog("CRITICAL: Network Communication Fault", "alarm");
    } else {
        led.classList.replace("red", "green");
        addLog("System normalized.", "normal");
    }
});

document.getElementById("resetBtn").addEventListener("click", function() {
    document.body.classList.remove("alarm-state");
    document.getElementById("commLed").classList.replace("red", "green");
    
    isAnimating = false; 
    isWireBroken = false;
    isAirLost = false;
    
    slider.value = 40;
    targetPosition = 40;
    commandValue.textContent = "40.0";
    
    moveValveGraphic(40);
    progressiveUpdate("aoCard", 40, "forward");
    progressiveUpdate("ipConverter", 40, "forward");
    progressiveUpdate("aiCard", 40, "feedback");
    progressiveUpdate("controller", 40, "feedback");
    spValue.textContent = "40.0 %";
    
    addLog("System Reset to Default State", "normal");
});

document.getElementById("fullscreenBtn").addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

// Popups
document.querySelectorAll(".device").forEach(device => {
    device.addEventListener("click", function() {
        popup.classList.add("show");
        popupTitle.textContent = this.querySelector("h3").textContent;
        popupText.textContent = getInformation(this.id);
    });
});
closePopup.onclick = () => popup.classList.remove("show");

function getInformation(id) {
    const db = {
        "operator": "Operator Station used for monitoring and sending commands to the control loop via HMI graphics.",
        "aspect": "Aspect Server manages graphics, objects, user permissions, and engineering database.",
        "connectivity": "Connectivity Server exchanges real-time data between control network and plant network.",
        "history": "History Server stores long-term process values, trends, and alarms.",
        "apc": "Advanced Process Control Server runs multivariable optimization algorithms.",
        "firewall": "Hardware Firewall strictly separates the Plant Network (Level 3) from the Control Network (Level 2).",
        "controller": "AC800M Controller executes the core PID logic and logic blocks in real-time.",
        "commModule": "CI854 Communication Module exchanges Profibus DP messages with remote I/O clusters.",
        "aoCard": "Analog Output Card converts the digital PID output into a physical 4–20 mA signal.",
        "aiCard": "Analog Input Card converts the physical 4-20mA position transmitter feedback into a digital value.",
        "marshalling": "Marshalling Cabinet safely routes and cross-connects multi-core field cables to system cables.",
        "junction": "Junction Box aggregates individual instrument cables in the field into a multi-core home-run cable.",
        "ipConverter": "I/P Converter transforms the 4–20 mA electrical signal into a proportional 3-15 psi pneumatic pressure.",
        "valve": "FV-101 Pneumatic Control Valve. The air pressure moves a diaphragm attached to the valve stem.",
        "kvm": "KVM Switch allows operators to control multiple servers using a single Keyboard, Video, and Mouse console."
    };
    return db[id] || "DCS System Component";
}

// Initial Setup
setTimeout(() => {
    drawConnections();
    addLog("System Initialized & Ready");
    const initVal = 40;
    moveValveGraphic(initVal);
    progressiveUpdate("aoCard", initVal, "forward");
    progressiveUpdate("ipConverter", initVal, "forward");
    progressiveUpdate("aiCard", initVal, "feedback");
    progressiveUpdate("controller", initVal, "feedback");
}, 100);
