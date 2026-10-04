# 🎓 SIS Login & Multi-Account Portal (KARE)

An Instagram-styled, modern client and standalone Android application for the **Kalasalingam Academy of Research and Education (KARE) Student Information System (SIS)**.

[![Android](https://img.shields.io/badge/Platform-Android%207.0%2B-green.svg)](SIS_Portal.apk)
[![Architecture](https://img.shields.io/badge/Architecture-Standalone%20Embedded-blue.svg)](android_build/)
[![UI Theme](https://img.shields.io/badge/Theme-Pure%20OLED%20Black-black.svg)](static/)

---

## 📱 Download Android APK

The pre-compiled, signed standalone Android APK is available directly in this repository:

👉 **[Download `SIS_Portal.apk`](SIS_Portal.apk)** (1.5 MB)

* **Package ID**: `com.kare.sisportal`
* **Target SDK**: Android 14 (API level 34)
* **Minimum SDK**: Android 7.0 (API level 24)
* **Signing**: Signed and verified with APK Signature Scheme v2 & v3

---

## ✨ Features

### 1. 🔄 Instagram-Style Multi-Account Switching
* **Long-press** the profile icon in the bottom navigation bar or click the username dropdown in the header to open the Instagram bottom-sheet drawer.
* Add multiple student accounts and switch between them with **1 tap** without re-entering credentials.
* Remembered accounts stay logged in automatically across app relaunches.

### 2. 🖤 Pure OLED Black (`#000000`) Design
* Designed to look and feel like an authentic Instagram mobile application with deep OLED black background, custom story gradient rings, and smooth rounded cards.

### 3. 📅 Interactive Weekly Timetable (07:00 AM – 07:00 PM)
* Full 12-hour hourly schedule grid for Monday to Friday.
* Dynamic course allocation badges and faculty handling details.

### 4. 📊 Live Attendance & Grade Tracking
* Real-time aggregate percentage tracking with safe-zone indicators (>75% cutoff).
* Subject-by-subject attended vs conducted class counts, duty leaves, and period logs.

### 5. 📄 Customizable PDF Profile Export & WhatsApp Share
* Selectively export verified student information via interactive checkboxes.
* Generates a formal, printable university summary sheet with official branding and issue timestamp.
* Instant formatted WhatsApp share button.

### 6. 🚀 100% Self-Contained Android Engine
* Runs directly on mobile data or Wi-Fi without needing an external PC server.
* Embedded Java loopback daemon (`LocalWebServer.java`) and native scraper (`SisEngine.java`) communicate directly with the official university portal over secure HTTPS.
* Native Android hardware back-button support for seamless drawer and modal navigation.

---

## 🛠️ Project Structure

```
├── SIS_Portal.apk            # Standalone, ready-to-install Android APK
├── server.py                 # Python Flask backend (for browser/desktop use)
├── static/                   # Web frontend assets
│   ├── index.html            # Main single-page application
│   ├── app.js                # Core frontend logic & multi-account state
│   ├── app.css               # Instagram dark mode styles
│   ├── logo.png              # Master high-resolution app icon
│   └── favicon.png           # App favicon & header crest
├── android_build/            # Native Android APK source & build configuration
│   ├── AndroidManifest.xml   # App permissions and manifest
│   ├── res/                  # Styles, strings, and mipmap launcher icons
│   ├── src/com/kare/sisportal/
│   │   ├── MainActivity.java # OLED WebView & hardware back navigation
│   │   ├── LocalWebServer.java # Embedded HTTP bridge
│   │   └── SisEngine.java    # Direct on-device HTTPS scraper
│   └── release.keystore      # Release signing keystore
└── README.md
```

---

## 🚀 Running the Web Version Locally

If you prefer to run the web application locally on your computer:

```bash
# 1. Clone repository
git clone https://github.com/goutham-11-16/SIS-login-as-Multi-Account.git
cd SIS-login-as-Multi-Account

# 2. Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install requirements
pip install flask requests

# 4. Start local server
python3 server.py
```
Open **`http://localhost:5000`** in any web browser.

---

## 🔒 Privacy & Security Note
* Passwords and credentials are stored strictly in your device's private local storage.
* No data is transmitted to any third-party servers. All university requests connect directly to `https://sis.kalasalingam.ac.in`.

---

## 📄 License
Educational & personal utility tool for KARE students.
