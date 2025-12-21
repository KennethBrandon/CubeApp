import * as THREE from 'three';
import { SPACING } from '../shared/constants.js';

export class Puzzle {
    constructor(config) {
        this.config = config;
    }

    /**
     * Creates and returns the geometry for the puzzle.
     * @returns {THREE.Group} The group containing all puzzle pieces.
     */
    createGeometry() {
        throw new Error("Method 'createGeometry()' must be implemented.");
    }

    getSpacing() {
        return SPACING;
    }


    /**
     * Returns the rotation axes for the puzzle.
     * @returns {Object} Map of axis names to THREE.Vector3.
     */
    getRotationAxes() {
        throw new Error("Method 'getRotationAxes()' must be implemented.");
    }

    /**
     * Get notation for a move.
     * @param {string} axis - Axis string ('x', 'y', 'z' or numerical for some puzzles)
     * @param {number} sliceVal - Slice coordinate (Infinity for whole puzzle)
     * @param {number} turns - Number of turns (e.g., 1, -1, 2)
     * @param {boolean} isDrag - Whether the move was triggered by a drag
     * @param {THREE.Vector3} dragRotationAxis - The axis vector used for the drag
     * @returns {string|null}
     */
    getNotation(axis, sliceVal, turns, isDrag, dragRotationAxis) {
        return null;
    }

    /**
     * Handles keyboard input.
     * @param {KeyboardEvent} event 
     * @returns {boolean} True if handled.
     */
    handleKeyDown(event) {
        return false;
    }

    /**
     * Returns information needed to animate a move.
     * @param {string} axis 
     * @param {number} direction 
     * @param {number} sliceVal 
     * @returns {Object|null} { axisVector, cubies, angle }
     */
    getMoveInfo(axis, direction, sliceVal) {
        return null;
    }

    /**
     * Returns cubies in a specific slice.
     * @param {string} axis 
     * @param {number} sliceVal 
     * @returns {Array} List of cubies.
     */
    getSliceCubies(axis, sliceVal) {
        return [];
    }

    /**
     * Returns the move cycle length (e.g. 4 for cube, 3 for Pyraminx/Skewb).
     * @returns {number}
     */
    getCycleLength() {
        return 4;
    }

    /**
     * Returns the snap angle for moves (default 90 degrees).
     * @returns {number}
     */
    getSnapAngle() {
        return Math.PI / 2;
    }

    /**
     * Checks if a face is rectangular (non-square).
     * @param {string} axis 
     * @returns {boolean}
     */
    isFaceRectangular(axis) {
        return false;
    }

    /**
     * Returns the locked rotation axis for a background drag, if applicable.
     * @param {string} axis 
     * @returns {THREE.Vector3|null}
     */
    /**
     * Disposes of the puzzle by removing cubies from their parent.
     */
    dispose() {
        if (this.cubieList) {
            this.cubieList.forEach(c => {
                if (c.parent) c.parent.remove(c);
            });
            this.cubieList.length = 0;
        }
    }
}
