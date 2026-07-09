# ⚙️ ABB 800xA DCS Real-Time Simulator

An interactive, real-time web simulation that bridges the gap between Information Technology (IT) networks and Operational Technology (OT) field instrumentation. 

![DCS Simulator Preview](https://img.shields.io/badge/Status-Live-success?style=for-the-badge) ![OT Security](https://img.shields.io/badge/OT-Cybersecurity-blue?style=for-the-badge) ![4-20mA](https://img.shields.io/badge/Signal-4--20mA-orange?style=for-the-badge)

## 🎯 Why This Was Built
In industrial automation, it is often incredibly difficult to visualize how a simple mouse click on an Operator HMI screen actually translates to physical movement out in the field. 

This project was built to **demystify the DCS (Distributed Control System) architecture**. It provides a living, breathing demonstration of how digital packets travel through firewalls, reach a controller, get translated into electrical currents (4-20mA) by I/O cards, and eventually become pneumatic air pressure (3-15 psi) that physically moves a multi-ton control valve. It is designed as an educational and presentation tool for engineering evaluations.

## ✨ Key Features
* **Animated Signal Flow:** Watch the exact path of the signal as it travels from Level 3 (Plant Network) down to Level 0 (Field Devices).
* **Mathematical Transparency:** Real-time math overlays dynamically calculate the exact Ohm's Law and pressure conversions happening at the hardware level.
* **Live SP vs PV Trending:** A real-time Chart.js graph plots the Setpoint (Command) against the physical Process Variable (Valve Position) to demonstrate realistic PID feedback delay and physical inertia.
* **Failure Scenario Engineering:**
  * ⚡ **Wire Break:** Simulates an open circuit (0mA) at the junction box.
  * 💨 **Air Loss:** Simulates a loss of instrument air (0 psi) at the I/P Converter.
* **Valve Configuration:** Toggle the physical behavior of the valve between **Fail Closed (Air-to-Open)** and **Fail Open (Air-to-Close)** to see how the mathematics and failure states invert.
* **OT Cybersecurity:** Accurately depicts network segmentation with a Hardware Firewall isolating the Plant Network from the Control Network.

## 🏗️ Architecture Stack
* **Frontend:** Pure HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript.
* **Graphics:** Dynamic SVG manipulation and CSS Keyframe animations.
* **Data Visualization:** Chart.js for real-time telemetry plotting.
* **Deployment:** Hosted on Vercel.

## 🚀 How to Use
1. Set a desired valve position using the **Control Valve Command** slider.
2. Click **TRANSMIT SP** to watch the signal travel through the system.
3. Mid-transmission, hit the **PAUSE** button to freeze the signal and discuss the real-time mathematical calculations displayed on the screen.
4. Trigger a **Failure Scenario** to observe how the mechanical spring forces the valve to its fail-safe state, and how the AI (Analog Input) feedback loop reacts to the failure.

---
*Developed as a demonstration of Industrial Automation, OT Networks, and Field Instrumentation.*