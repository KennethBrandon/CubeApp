# Documentation Index

This directory contains documentation for the CubeApp project.

## STL Custom Puzzle System

The app supports custom 3D puzzles using the STL file format.

### Quick Links

- **STL Manager Tool**: `../stl_manager.html` - Tool for creating and managing custom STL puzzles
- **Generic STL Puzzle Code**: `../js/puzzles/StlPuzzleMod.js` - Generic puzzle class for STL-based puzzles
- **Manager Logic**: `../js/tools/StlManager.js` - STL puzzle configuration and management
- **Puzzle Registry**: `../assets/puzzles/registry.json` - List of available custom puzzles
- **3D Assets**: `../assets/puzzles/` - Custom puzzle asset directories

## Creating Custom STL Puzzles

To create a new custom STL puzzle:

1. **Open Manager**: Open `stl_manager.html` in your browser
2. **Load STL**: Upload or select an STL file
3. **Configure Puzzle**: Set dimensions, transformations, and cut parameters
4. **Paint Colors**: Use the painting tools to apply vertex colors
5. **Export Configuration**: Save the config.json file to `assets/puzzles/[puzzle-id]/`
6. **Export Colors**: Save colors.json to the puzzle directory
7. **Export Cubie Data** (Optional): Generate pre-computed cubie geometries for faster loading
8. **Register**: Add the puzzle to `assets/puzzles/registry.json`

## Existing Custom Puzzles

Check `assets/puzzles/registry.json` for the list of currently available custom puzzles.

Each puzzle has its own directory under `assets/puzzles/[puzzle-id]/` containing:
- `config.json` - Puzzle configuration (dimensions, STL path, colors, materials)
- `[model].stl` - 3D model file
- `colors.json` - Vertex color data
- `thumbnail.png` - Thumbnail image for the puzzle selector
- `cubies/` (Optional) - Pre-computed cubie geometry files for faster loading
