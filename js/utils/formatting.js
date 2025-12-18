
export function formatScramble(scramble, puzzleType) {
    if (!scramble) return "";

    // Handle array or string input
    const moves = Array.isArray(scramble) ? scramble : scramble.trim().split(/\s+/);

    if (puzzleType && puzzleType.toLowerCase().includes('megaminx')) {
        let result = "";
        for (let i = 0; i < moves.length; i++) {
            result += moves[i];
            // Add space if not last move
            if (i < moves.length - 1) {
                // Check format: add newline every 11 moves
                if ((i + 1) % 11 === 0) {
                    result += "\n";
                } else {
                    result += " "; // Single space
                }
            }
        }
        return result;
    }

    // Default behavior for other puzzles or general case
    // If it was an array, join with double space (matching original showWinModal behavior)
    // If it was a string, we effectively reconstructed it with single spaces or double spaces.
    // Original showWinModal used .join("  "). Console used .join(" ").

    // Let's stick to double space for display as it is clearer, unless the input string had its own spacing?
    // If input was string, we split by whitespace, so we lost original spacing.
    // Consistently return double-spaced string for display unless specified otherwise?
    // But formatScramble handles "formatting".

    return moves.join("  ");
}
