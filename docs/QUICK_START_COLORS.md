# Quick Start: Update Puzzle Colors

**Goal**: Update the colors on TheChildMod (Baby Yoda) puzzle

## TL;DR - Complete Process

1. Open `stl_admin.html` in browser
2. Select "Baby Yoda" from dropdown
3. Paint the model
4. Click "Export Colors JSON" → save to `assets/3d/baby_yoda_detailed_colors.json`
5. Click "⚙️ Generate Cubies" (wait for completion)
6. Click "💾 Export All Cubies" → save all files to `assets/3d/cubies/baby_yoda_detailed/`
7. Done! Refresh puzzle to see changes

## Do I Need to Re-Generate Cubies?

**YES** - if you want to see your new colors with fast loading.

### Why?
- Colors are **baked into** the pre-cut cubie files
- Updating just the JSON won't update the cubies
- The puzzle loads cubies first (if they exist), which have the old colors

### What Happens If I Don't?
- Puzzle will still use old colors (from existing cubies)
- To see new colors, you'd have to delete the cubie folder (slow loading)

## File Checklist

After updating colors, you should have:

- ✅ `assets/3d/baby_yoda_detailed_colors.json` (updated)
- ✅ `assets/3d/cubies/baby_yoda_detailed/config.json` (new)
- ✅ `assets/3d/cubies/baby_yoda_detailed/cubie_*.bin` (12 files, new)

## Common Mistakes

❌ **Updating JSON only** → Cubies still have old colors  
✅ **Update JSON + regenerate cubies** → Everything works!

❌ **Changing cubie parameters without updating TheChildMod.js** → Misaligned pieces  
✅ **Use default parameters** → Matches puzzle code

## Testing Workflow

### Quick Iteration (while designing colors)
1. Delete `assets/3d/cubies/baby_yoda_detailed/` folder
2. Update colors in STL Painter
3. Export JSON only
4. Refresh puzzle (uses CSG mode, slower but shows new colors immediately)
5. Repeat until satisfied

### Final Export (for production)
1. Generate and export cubies with final colors
2. Save to `assets/3d/cubies/baby_yoda_detailed/`
3. Puzzle now loads fast with new colors!

## Need More Details?

See `COLOR_UPDATE_GUIDE.md` for the complete guide with troubleshooting and detailed explanations.
