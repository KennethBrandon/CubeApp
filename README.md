# Rubik's Cube Web App

A beautiful, interactive 3D Rubik's Cube puzzle game built with Three.js and Firebase. Features multiple cube sizes, live leaderboards, and smooth animations.

## Features

- 🎮 **Multiple Puzzle Sizes**: 2x2, 3x3, 4x4, 5x5, 6x6, 7x7, and even up to 17x17!
- 🏆 **Live Leaderboards**: Compete with players worldwide, separate rankings for each puzzle size
- ⏱️ **Timing System**: Track your solve times with precision
- 🎨 **Beautiful UI**: Modern design with smooth animations and dynamic camera movements
- 🪞 **Mirror Environment**: Toggle mirrors for a premium visual experience
- 📱 **Responsive**: Works on desktop and mobile devices
- 🎯 **Multiple Control Methods**: Mouse drag, keyboard controls, and touch support

## Controls

- **Drag cube pieces** to rotate layers
- **Drag background** to rotate the entire cube view
- **Scroll** to zoom in/out
- **Keyboard shortcuts**: R, L, U, D, F, B (hold Shift for reverse)

## Technologies

- **Three.js** - 3D graphics and animations
- **Firebase** - Real-time leaderboards and authentication (backend)
- **GitHub Pages** - Static site hosting (frontend)
- **Vanilla CSS** - Modern, responsive styling
- **Vanilla JavaScript** - No framework dependencies

## Live Demo

🎮 **[Play Now on GitHub Pages](https://[your-username].github.io/CubeApp/)**

*(Update the URL above after deploying to GitHub Pages)*

## Deployment to GitHub Pages

This app is designed to be deployed on **GitHub Pages** (free static hosting) while using **Firebase** for backend services (leaderboard database).

### Quick Setup

1. **Push your code to GitHub** (if you haven't already)
2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select your `main` branch
   - Select `/` (root) as the directory
   - Click **Save**
3. **Wait a few minutes** for deployment
4. **Your app will be live** at `https://[your-username].github.io/[repository-name]/`

### How It Works

- **GitHub Pages** hosts your static files (HTML, CSS, JavaScript)
- **Firebase** provides backend services (authentication, Firestore database for leaderboards)
- When users visit your GitHub Pages site, the JavaScript connects to Firebase's backend

No additional configuration needed - just push and deploy! 🚀

## Local Development

1. Clone this repository
2. Start a local server:
   ```bash
   python3 -m http.server 8000
   ```
   Or use the included script:
   ```bash
   ./start_server.sh
   ```
3. Open `http://localhost:8000` in your browser

## Architecture

- **Frontend Hosting**: GitHub Pages (free, automatic HTTPS)
- **Backend Services**: Firebase (authentication, Firestore database)
- **3D Graphics**: Three.js
- **Styling**: Vanilla CSS

The Firebase configuration is publicly visible in the code (this is safe and intentional). Security is handled by Firebase Security Rules, not by hiding API keys.

## License

MIT License - Feel free to use this project however you'd like!
