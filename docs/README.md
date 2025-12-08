# Documentation Index

This directory contains documentation for the CubeApp project.

## Color Update Documentation

Documentation for updating colors on TheChildMod (Baby Yoda) puzzle:

### 📖 [QUICK_START_COLORS.md](QUICK_START_COLORS.md)
**Start here!** Quick reference guide with the essential steps for updating puzzle colors.
- TL;DR complete process
- Common mistakes to avoid
- Quick iteration workflow

### 📚 [COLOR_UPDATE_GUIDE.md](COLOR_UPDATE_GUIDE.md)
**Complete guide** with detailed explanations, troubleshooting, and best practices.
- Step-by-step instructions
- Tool usage details
- File locations and purposes
- Troubleshooting section
- Performance considerations

### 📊 [COLOR_WORKFLOW_DIAGRAM.md](COLOR_WORKFLOW_DIAGRAM.md)
**Visual diagrams** showing the workflow, file flow, and loading priorities.
- Workflow flowcharts
- File relationship diagrams
- Loading priority visualization
- Scenario comparisons

## Quick Links

- **STL Painter Tool**: `../stl_admin.html`
- **Puzzle Code**: `../js/puzzles/TheChildMod.js`
- **Painter Logic**: `../js/tools/StlPainter.js`
- **3D Assets**: `../assets/3d/`

## Summary: Updating Puzzle Colors

To update colors on the TheChildMod puzzle:

1. **Paint**: Open `stl_admin.html`, select Baby Yoda, paint the model
2. **Export Colors**: Save JSON to `assets/3d/baby_yoda_detailed_colors.json`
3. **Generate Cubies**: Click "Generate Cubies" then "Export All Cubies"
4. **Save Cubies**: Save to `assets/3d/cubies/baby_yoda_detailed/`

**Important**: You must re-generate cubies after updating colors because colors are baked into the cubie files.
