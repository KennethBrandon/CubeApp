# Color Update Guide for TheChildMod Puzzle

This guide explains how to update the colors on the TheChildMod puzzle (Baby Yoda) using the STL Painter tool and how to export the necessary files for the puzzle to use the new colors.

## Overview

The color update process involves three main steps:
1. **Paint the model** using the STL Painter tool
2. **Export the color JSON** to save the new colors
3. **Generate and export pre-cut cubies** with the new colors baked in

## Prerequisites

- The STL model file: `assets/3d/baby_yoda_detailed.stl`
- The STL Painter admin interface: `stl_admin.html`
- The puzzle file: `js/puzzles/TheChildMod.js`

## Step 1: Load the Model and Paint

1. **Open the STL Painter**
   - Open `stl_admin.html` in your browser
   - This is the admin interface for painting 3D models

2. **Load the Model**
   - In the sidebar, under "1. Load Model & Colors", select "Baby Yoda" from the dropdown
   - OR upload the STL file manually: `assets/3d/baby_yoda_detailed.stl`
   - If you have existing colors, upload the JSON file: `assets/3d/baby_yoda_detailed_colors.json`

3. **Paint the Model**
   - **Select a color**: Use the color picker or click a color from the palette
   - **Choose a tool**:
     - 🖌️ **Brush**: Click and drag to paint specific areas
     - 🔄 **Replace**: Click on a color to replace all instances of that color
     - **Fill Entire Mesh**: Paint the entire model with the selected color
   - **Adjust brush size**: Use the "Brush Size" slider to control the painting area
   - **Add colors to palette**: Click "+ Add Current to Palette" to save frequently used colors

4. **Camera Controls**
   - **Left Click + Drag**: Paint (when using brush tool)
   - **Right Click + Drag**: Rotate camera
   - **Middle Click / Shift + Drag**: Pan camera
   - **Scroll**: Zoom in/out

## Step 2: Export the Color JSON

Once you're satisfied with the colors:

1. **Export Colors**
   - Click the "Export Colors JSON" button in the header
   - This will download a file named `baby_yoda_detailed_colors.json`
   - Save this file to `assets/3d/baby_yoda_detailed_colors.json`

2. **What This Does**
   - The JSON file contains vertex color data for every vertex in the 3D model
   - This file is loaded by `TheChildMod.js` to apply colors to the puzzle
   - **Important**: You can update this file anytime and the puzzle will use the new colors on the next load

## Step 3: Generate Pre-Cut Cubies (Optional but Recommended)

Pre-cut cubies dramatically improve loading performance by pre-computing the geometry for each puzzle piece.

### Why Generate Pre-Cut Cubies?

- **Without pre-cut cubies**: The puzzle uses CSG (Constructive Solid Geometry) to cut the model into pieces every time it loads, which is slow
- **With pre-cut cubies**: The puzzle loads pre-computed geometry files, which is much faster
- **Color baking**: The colors are baked into the pre-cut cubie files, so they load instantly

### How to Generate Pre-Cut Cubies

1. **Configure Parameters** (in the "3. Cubie Cutter" section)
   - **Fillet Radius**: Roundness of the cuts (default: 0.14)
   - **Outer Scale**: How much to extend outer faces (default: 2.95)
   - **Rotation**: Y-axis rotation in degrees (default: -45)
   - **Scale**: Overall model scale (default: 3.35)
   - **X/Y/Z Offset**: Position adjustments (default: 2.71, 1.53, -2.38)
   
   > **Note**: These parameters should match the values used in `TheChildMod.js`. Only change them if you're intentionally modifying the puzzle geometry.

2. **Generate Cubies**
   - Click "⚙️ Generate Cubies"
   - Wait for the processing to complete (this may take a minute)
   - You'll see a loading overlay while the cubies are being generated

3. **Export Cubies**
   - Once generation is complete, the "💾 Export All Cubies" button will be enabled
   - Click it to download all 12 cubie files (2×3×2 grid)
   - Files will be downloaded as:
     - `cubie_-0.5_-1_-0.5.bin`
     - `cubie_-0.5_-1_0.5.bin`
     - `cubie_-0.5_0_-0.5.bin`
     - ... (12 files total)
     - `config.json` (metadata file)

4. **Save Cubie Files**
   - Create the directory: `assets/3d/cubies/baby_yoda_detailed/`
   - Move all downloaded files to this directory
   - The puzzle will automatically detect and use these files

## How TheChildMod Uses These Files

The puzzle (`js/puzzles/TheChildMod.js`) loads files in this order:

1. **First, try to load pre-cut cubies**:
   - Looks for `assets/3d/cubies/baby_yoda_detailed/config.json`
   - If found, loads all 12 `.bin` files
   - **Colors are already baked into these files**

2. **If pre-cut cubies don't exist, fall back to CSG**:
   - Loads `assets/3d/baby_yoda_detailed.stl`
   - Loads `assets/3d/baby_yoda_detailed_colors.json`
   - Performs CSG operations to cut the model into pieces
   - Applies colors from the JSON file

## Do You Need to Re-Generate Cubies After Updating Colors?

**Yes, if you want the best performance.**

Here's what happens in each scenario:

### Scenario 1: Update Colors Only (No Cubie Re-generation)
- Update colors in STL Painter
- Export `baby_yoda_detailed_colors.json`
- **Result**: 
  - If pre-cut cubies exist, they will still use the OLD colors (because colors are baked in)
  - To see new colors, you'd need to delete the cubie files to force CSG fallback
  - This defeats the purpose of having pre-cut cubies

### Scenario 2: Update Colors + Re-Generate Cubies (Recommended)
- Update colors in STL Painter
- Export `baby_yoda_detailed_colors.json` (for backup/reference)
- Generate and export new pre-cut cubies
- **Result**:
  - Pre-cut cubies contain the new colors
  - Fast loading with updated colors
  - Best of both worlds!

## Quick Reference: Complete Workflow

1. Open `stl_admin.html`
2. Load "Baby Yoda" model (or upload STL + JSON)
3. Paint the model with desired colors
4. Export Colors JSON → Save to `assets/3d/baby_yoda_detailed_colors.json`
5. Generate Cubies (with default parameters)
6. Export All Cubies → Save to `assets/3d/cubies/baby_yoda_detailed/`
7. Refresh the puzzle to see the changes

## Troubleshooting

### The puzzle isn't showing my new colors
- Check that you saved the files to the correct locations
- If using pre-cut cubies, make sure you re-generated them after updating colors
- Clear your browser cache and reload

### Pre-cut cubies aren't loading
- Check that `config.json` exists in `assets/3d/cubies/baby_yoda_detailed/`
- Verify all 12 `.bin` files are present
- Check the browser console for error messages

### The puzzle is loading slowly
- Generate and use pre-cut cubies for faster loading
- Pre-cut cubies reduce load time from several seconds to nearly instant

### I want to tweak colors without re-generating cubies
- Delete the `assets/3d/cubies/baby_yoda_detailed/` directory
- The puzzle will fall back to CSG mode
- Update colors and export JSON
- Test your changes
- When satisfied, re-generate cubies for production use

## File Locations Summary

| File Type | Location | Purpose |
|-----------|----------|---------|
| STL Model | `assets/3d/baby_yoda_detailed.stl` | 3D model geometry |
| Color JSON | `assets/3d/baby_yoda_detailed_colors.json` | Vertex color data |
| Pre-cut Cubies | `assets/3d/cubies/baby_yoda_detailed/*.bin` | Pre-computed cubie geometries (12 files) |
| Cubie Config | `assets/3d/cubies/baby_yoda_detailed/config.json` | Metadata for cubies |
| Puzzle Code | `js/puzzles/TheChildMod.js` | Puzzle implementation |
| STL Painter | `stl_admin.html` | Color editing tool |
| Painter Logic | `js/tools/StlPainter.js` | STL Painter implementation |

## Notes

- The color JSON file uses a flat array of RGB values (0-1 range) for each vertex
- Pre-cut cubie files use a binary format for efficiency
- The puzzle automatically detects which loading method to use based on file availability
- You can switch between CSG and pre-cut modes by adding/removing the cubie directory
