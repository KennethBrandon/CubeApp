# Rubik's Cube Web App

A beautiful, interactive 3D Rubik's Cube puzzle game built with Three.js and Firebase. Features multiple cube sizes, live leaderboards, and smooth animations.

## Features

- 🎮 **Multiple Puzzle Types**: Standard cubes (2x2 to 17x17), cuboids, Mirror Blocks, 9-color Molecube, and Void Cube!
- 🏆 **Live Leaderboards**: Compete with players worldwide, separate rankings for each puzzle type
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

🎮 **[Play Now on GitHub Pages](https://kennethbrandon.github.io/CubeApp/)**

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

### Debug Tools

This project includes a local-only debug page for inspecting leaderboard data:

- **URL**: `http://localhost:8000/leaderboard_admin.html`
- **Purpose**: View raw database records, sort by any field, and verify data integrity.
- **Security**: This page includes a runtime check that **blocks access** on production domains (`kennethbrandon.github.io`, `cube.redkb.com`). It will automatically redirect to the home page if accessed in production.

### In-App Debug Menu

There is also a hidden debug menu within the application itself, which provides controls for:
- Showing FPS counter
- Tuning Mirror Blocks parameters (stickers, dimensions, materials)
- Testing victory animations
- Creating custom puzzles by string definition

**How to Access:**
Tap the **Mirror** button (🪞) and **Lock** button (🔒) in an alternating sequence **3 times** (total 6 taps) within 3 seconds:
`Mirror -> Lock -> Mirror -> Lock -> Mirror -> Lock`


## Architecture

- **Frontend Hosting**: GitHub Pages (free, automatic HTTPS)
- **Backend Services**: Firebase (authentication, Firestore database)
- **3D Graphics**: Three.js
- **Styling**: Vanilla CSS

The Firebase configuration is publicly visible in the code (this is safe and intentional). Security is handled by Firebase Security Rules, not by hiding API keys.

## License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

This project is free for personal, educational, and non-commercial use. You are welcome to modify and share it under the same terms. Commercial use (selling the code, wrapping it with ads, etc.) is strictly prohibited without prior permission.
