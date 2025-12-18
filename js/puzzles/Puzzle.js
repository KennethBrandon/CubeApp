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

    /**
     * Returns the rotation axes for the puzzle.
     * @returns {Object} Map of axis names to THREE.Vector3.
     */
    getRotationAxes() {
        throw new Error("Method 'getRotationAxes()' must be implemented.");
    }

    /**
     * Performs a move on the puzzle.
     * @param {string} axis - The axis of rotation.
     * @param {number} direction - The direction of rotation (1 or -1).
     * @param {number} duration - Animation duration.
     * @param {number} sliceVal - The slice value (optional).
     */
    performMove(axis, direction, duration, sliceVal) {
        throw new Error("Method 'performMove()' must be implemented.");
    }

    /**
     * Checks if the puzzle is solved.
     * @returns {boolean} True if solved, false otherwise.
     */
    isSolved() {
        throw new Error("Method 'isSolved()' must be implemented.");
    }

    /**
     * Generates a scramble sequence for the puzzle.
     * @returns {Array} List of moves.
     */
    getScramble() {
        throw new Error("Method 'getScramble()' must be implemented.");
    }

    /**
     * Gets the notation for a move.
     * @param {string} axis 
     * @param {number} sliceVal 
     * @param {number} turns 
     * @returns {string} Move notation.
     */
    getNotation(axis, sliceVal, turns) {
        throw new Error("Method 'getNotation()' must be implemented.");
    }

    /**
     * Parses a notation string into move parameters.
     * @param {string} notation 
     * @returns {Object|null} { axis, dir, sliceVal } or null if invalid
     */
    parseNotation(notation) {
        // Optional implementation. If not implemented, scramble.js falls back to default logic.
        return null;
    }

    /**
     * Determines the drag axis based on mouse movement.
     * @param {THREE.Vector3} faceNormal 
     * @param {THREE.Vector2} screenMoveVec 
     * @returns {Object} { axis, rotationAxis, angleScale }
     */
    getDragAxis(faceNormal, screenMoveVec) {
        throw new Error("Method 'getDragAxis()' must be implemented.");
    }
    /**
     * Snaps the cubies to their grid positions and rotations.
     * @param {Array} cubies - List of cubies to snap.
     */
    snapCubies(cubies) {
        throw new Error("Method 'snapCubies()' must be implemented.");
    }

    /**
     * Cleans up any resources or objects created by the puzzle.
     */
    dispose() {
        // Default implementation does nothing
    }

    /**
     * Returns the spacing between cubies.
     * @returns {number} Spacing value.
     */
    getSpacing() {
        return SPACING;
    }
}
