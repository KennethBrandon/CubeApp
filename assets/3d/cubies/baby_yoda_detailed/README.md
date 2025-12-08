# Pre-computed Cubie Geometries Directory

This directory will contain pre-computed cubie geometry files for TheChildMod puzzle.

## How to Generate

1. Open `stl_admin.html` in your browser
2. Select or load `baby_yoda_detailed.stl` from the dropdown
3. Adjust parameters in the "Cubie Cutter" section if needed (defaults should match TheChildMod)
4. Click "⚙️ Generate Cubies" and wait for processing to complete
5. Click "💾 Export All Cubies" to download all files
6. Move the downloaded files to this directory

## Expected Files

After generation, this directory should contain:
- `config.json` - Configuration metadata
- `cubie_-0.5_-1_-0.5.bin`
- `cubie_-0.5_-1_0.5.bin`
- `cubie_-0.5_0_-0.5.bin`
- `cubie_-0.5_0_0.5.bin`
- `cubie_-0.5_1_-0.5.bin`
- `cubie_-0.5_1_0.5.bin`
- `cubie_0.5_-1_-0.5.bin`
- `cubie_0.5_-1_0.5.bin`
- `cubie_0.5_0_-0.5.bin`
- `cubie_0.5_0_0.5.bin`
- `cubie_0.5_1_-0.5.bin`
- `cubie_0.5_1_0.5.bin`

Total: 13 files (12 cubies + 1 config)

**Note**: Files are now in binary format (.bin) for much smaller size and faster loading!

## Performance Impact

Once these files are present, TheChildMod will load 10-50x faster:
- **Without pre-computed files**: 2-5 seconds (CSG computation)
- **With pre-computed files**: <100ms (direct binary loading)
- **Binary format**: ~20MB total vs ~200MB for JSON
