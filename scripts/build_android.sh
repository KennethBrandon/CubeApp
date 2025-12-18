#!/bin/bash

# 0. Clean previous build
rm -rf www

# 1. Run standard build (populates www with everything)
echo "Running standard build..."
npm run build

# 2. Prune large assets from www (Android only)
echo "Pruning large assets for Android..."

# Grinch
rm -rf www/assets/puzzles/grinch/cubies
rm -f www/assets/puzzles/grinch/grinch.stl
rm -f www/assets/puzzles/grinch/grinch_colors.json
rm -f www/assets/puzzles/grinch/*.3mf

# Baby Yoda
rm -rf www/assets/puzzles/baby_yoda/cubies
rm -f www/assets/puzzles/baby_yoda/baby_yoda.stl
rm -f www/assets/puzzles/baby_yoda/baby_yoda_colors.json
rm -f www/assets/puzzles/baby_yoda/*.3mf

# Fisher Cube
rm -rf www/assets/puzzles/fisher_cube/cubies
rm -f www/assets/puzzles/fisher_cube/fisher_cube.3mf
rm -f www/assets/puzzles/fisher_cube/*.3mf

# Christmas Tree
rm -rf www/assets/puzzles/christmas_tree/cubies
rm -f www/assets/puzzles/christmas_tree/*.3mf

echo "Assets pruned. Syncing with Capacitor..."

# 3. Sync with Android
npx cap sync android

echo "Done! Android build is ready."
