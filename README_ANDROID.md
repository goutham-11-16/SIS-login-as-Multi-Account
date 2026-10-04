# Kalasalingam University SIS Portal - Android Web App & APK Guide

This application provides an **Instagram-style Mobile Web Application & Android APK setup** for Kalasalingam SIS Portal.

## Android Mobile App Features

1. **Persistent Single Sign-On (Login Once)**:
   - Once logged in, your session and credentials are strictly saved locally.
   - You stay logged in across app reopens and app restarts without needing to log in manually.

2. **Instagram-Style Bottom Navigation Bar**:
   - Bottom tab bar featuring **Attendance**, **Marks**, **Fees**, **Hall Ticket**, and **Profile** tabs.

3. **Multi-Account Switching (Instagram Style)**:
   - **Press & Hold (Long Press)** on the bottom right **Profile** icon or click the **Switch Accounts** icon in the top header.
   - Opens a bottom sheet showing all saved student accounts.
   - Click any account to instantly switch sessions without needing to re-enter credentials!

4. **Convert to Native Android APK**:
   - **Method A (PWA / Chrome Web App)**: Open `http://localhost:5000` in Chrome on your Android phone, tap options `(⋮)` -> **Add to Home screen** / **Install App**.
   - **Method B (Native APK using TWA/PWABuilder)**: Generate an `.apk` package using PWABuilder or Android WebView wrappers.
