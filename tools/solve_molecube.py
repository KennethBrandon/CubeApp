
import sys

# Faces
FACES = ['U', 'D', 'L', 'R', 'F', 'B']

# Centers mapping: Face -> Color
CENTERS = {
    'U': 'White',
    'D': 'Yellow',
    'L': 'Orange',
    'R': 'Red',
    'F': 'Green',
    'B': 'Blue'
}

# Colors list
COLORS = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue', 'Pink', 'Black', 'Purple']

# Piece Definitions
# Corners: 3 faces
CORNERS = {
    'UFL': ['U', 'F', 'L'],
    'UFR': ['U', 'F', 'R'],
    'UBL': ['U', 'B', 'L'],
    'UBR': ['U', 'B', 'R'],
    'DFL': ['D', 'F', 'L'],
    'DFR': ['D', 'F', 'R'],
    'DBL': ['D', 'B', 'L'],
    'DBR': ['D', 'B', 'R']
}

# Edges: 2 faces
EDGES = {
    'UF': ['U', 'F'],
    'UL': ['U', 'L'],
    'UB': ['U', 'B'],
    'UR': ['U', 'R'],
    'DF': ['D', 'F'],
    'DL': ['D', 'L'],
    'DB': ['D', 'B'],
    'DR': ['D', 'R'],
    'FL': ['F', 'L'],
    'FR': ['F', 'R'],
    'BL': ['B', 'L'],
    'BR': ['B', 'R']
}

# All positions
POSITIONS = list(CORNERS.keys()) + list(EDGES.keys())

# State: Position -> Color
solution = {}

# Helper to check if a color is already on a face
# But for this specific algorithm, we are constructing it such that we guarantee uniqueness.
# Center covers 1 face. Corner covers 3. Edge covers 2. Total 6.
# If we ensure Corner and Edge don't overlap with Center or each other in terms of faces,
# then we have exactly 1 of that color on every face.

def get_faces(pos):
    if pos in CORNERS: return CORNERS[pos]
    if pos in EDGES: return EDGES[pos]
    return []

def solve():
    # 1. Place Pink Corners (Opposite)
    # User suggestion: DBL and UFR
    solution['DBL'] = 'Pink'
    solution['UFR'] = 'Pink'
    
    # 2. Place Center Colors (White, Yellow, Red, Orange, Green, Blue)
    center_colors = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue']
    
    if solve_colors(center_colors, 0):
        # 3. Place Black and Purple Edges
        if solve_black_purple():
            print_solution()
        else:
            print("Failed to place Black/Purple edges")
    else:
        print("Failed to place Center colors")

def solve_colors(colors, index):
    if index == len(colors):
        return True
    
    color = colors[index]
    
    # Find the center face for this color
    center_face = None
    for f, c in CENTERS.items():
        if c == color:
            center_face = f
            break
            
    # Find valid Corner positions
    # Must not touch center_face
    # Must be empty
    valid_corners = []
    for pos, faces in CORNERS.items():
        if pos not in solution and center_face not in faces:
            valid_corners.append(pos)
            
    for corner_pos in valid_corners:
        # Determine required Edge position
        # Edge must touch the 2 faces NOT covered by Center or Corner
        # Total faces = 6. Center=1, Corner=3. Remaining=2.
        
        covered_faces = set([center_face] + CORNERS[corner_pos])
        needed_faces = [f for f in FACES if f not in covered_faces]
        
        if len(needed_faces) != 2:
            # Should not happen given geometry
            continue
            
        # Find edge that touches needed_faces
        target_edge = None
        for e_pos, e_faces in EDGES.items():
            if set(e_faces) == set(needed_faces):
                target_edge = e_pos
                break
        
        if target_edge and target_edge not in solution:
            # Place them
            solution[corner_pos] = color
            solution[target_edge] = color
            
            if solve_colors(colors, index + 1):
                return True
            
            # Backtrack
            del solution[corner_pos]
            del solution[target_edge]
            
    return False

def solve_black_purple():
    # Remaining edges must be filled with 3 Black and 3 Purple
    # Constraint: Each face must have exactly 1 Black and 1 Purple.
    # Since there are 3 of each, and each touches 2 faces, this means
    # the 3 Black edges must be disjoint (no shared faces).
    # The 3 Purple edges must be disjoint.
    
    empty_edges = [e for e in EDGES.keys() if e not in solution]
    
    if len(empty_edges) != 6:
        print("Error: Expected 6 empty edges, got", len(empty_edges))
        return False
        
    # Try to find 3 edges for Black
    import itertools
    
    for black_edges in itertools.combinations(empty_edges, 3):
        # Check if they cover all 6 faces
        faces_covered = set()
        for e in black_edges:
            faces_covered.update(EDGES[e])
            
        if len(faces_covered) == 6:
            # Valid Black placement
            # The remaining 3 are Purple
            purple_edges = [e for e in empty_edges if e not in black_edges]
            
            # Check Purple coverage (should be guaranteed if Black covers all 6 and geometry is valid, but let's check)
            p_faces = set()
            for e in purple_edges:
                p_faces.update(EDGES[e])
                
            if len(p_faces) == 6:
                # Found solution!
                for e in black_edges: solution[e] = 'Black'
                for e in purple_edges: solution[e] = 'Purple'
                return True
                
    return False

def print_solution():
    # Output in the requested format (generation order)
    # 1. U White ...
    
    # Generation order from previous step
    # X=-1: LDB, LD, LDF, LB, L, LF, LUB, LU, LUF
    # X=0: DB, D, DF, B, F, UB, U, UF
    # X=1: RDB, RD, RDF, RB, R, RF, RUB, RU, RUF
    
    # Map generation names to our position names
    # My solver uses standard notation (UFL).
    # Generation uses LDB etc.
    # Need to map them.
    
    # Mapping table
    # Generation Name -> Solver Name
    # LDB -> DBL
    # LD -> DL
    # LDF -> DFL
    # LB -> BL
    # L -> Center Orange
    # LF -> FL
    # LUB -> UBL
    # LU -> UL
    # LUF -> UFL
    
    # DB -> DB
    # D -> Center Yellow
    # DF -> DF
    # B -> Center Blue
    # F -> Center Green
    # UB -> UB
    # U -> Center White
    # UF -> UF
    
    # RDB -> DBR
    # RD -> DR
    # RDF -> DFR
    # RB -> BR
    # R -> Center Red
    # RF -> FR
    # RUB -> UBR
    # RU -> UR
    # RUF -> UFR
    
    gen_order = [
        ('LDB', 'DBL'), ('LD', 'DL'), ('LDF', 'DFL'), ('LB', 'BL'), ('L', 'Orange'), ('LF', 'FL'), ('LUB', 'UBL'), ('LU', 'UL'), ('LUF', 'UFL'),
        ('DB', 'DB'), ('D', 'Yellow'), ('DF', 'DF'), ('B', 'Blue'), ('F', 'Green'), ('UB', 'UB'), ('U', 'White'), ('UF', 'UF'),
        ('RDB', 'DBR'), ('RD', 'DR'), ('RDF', 'DFR'), ('RB', 'BR'), ('R', 'Red'), ('RF', 'FR'), ('RUB', 'UBR'), ('RU', 'UR'), ('RUF', 'UFR')
    ]
    
    for i, (gen_name, solver_name) in enumerate(gen_order):
        color = ''
        if solver_name in COLORS: # It's a center color
            color = solver_name
        else:
            color = solution.get(solver_name, 'Unknown')
            
        print(f"{i + 1}. {gen_name} {color}")

if __name__ == "__main__":
    solve()
