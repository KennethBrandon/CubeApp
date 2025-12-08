# Color Update Workflow Diagram

```mermaid
flowchart TD
    Start([Start: Update Puzzle Colors]) --> Open[Open stl_admin.html]
    Open --> Load[Load Baby Yoda Model]
    Load --> Paint[Paint Model with New Colors]
    
    Paint --> Export1[Export Colors JSON]
    Export1 --> Save1[Save to assets/3d/baby_yoda_detailed_colors.json]
    
    Save1 --> Decision{Want Fast Loading?}
    
    Decision -->|No| Done1[Done: Puzzle uses CSG mode]
    Decision -->|Yes| Generate[Generate Pre-Cut Cubies]
    
    Generate --> Configure[Configure Parameters:<br/>- Fillet Radius: 0.14<br/>- Outer Scale: 2.95<br/>- Rotation: -45°<br/>- Scale: 3.35<br/>- Offset: 2.71, 1.53, -2.38]
    
    Configure --> Click1[Click 'Generate Cubies']
    Click1 --> Wait[Wait for Processing]
    Wait --> Click2[Click 'Export All Cubies']
    Click2 --> Save2[Save 12 .bin files + config.json<br/>to assets/3d/cubies/baby_yoda_detailed/]
    
    Save2 --> Done2[Done: Puzzle uses Pre-Cut mode]
    
    Done1 --> Result1[Slower loading<br/>Colors from JSON]
    Done2 --> Result2[Fast loading<br/>Colors baked in cubies]
    
    style Start fill:#4CAF50
    style Done1 fill:#2196F3
    style Done2 fill:#4CAF50
    style Result1 fill:#FFC107
    style Result2 fill:#4CAF50
```

## File Flow Diagram

```mermaid
flowchart LR
    subgraph Input Files
        STL[baby_yoda_detailed.stl]
        JSON[baby_yoda_detailed_colors.json<br/>Optional: existing colors]
    end
    
    subgraph STL Painter Tool
        Admin[stl_admin.html]
        Painter[StlPainter.js]
    end
    
    subgraph Output Files
        NewJSON[baby_yoda_detailed_colors.json<br/>Updated colors]
        Cubies[Pre-cut Cubies<br/>12 .bin files + config.json]
    end
    
    subgraph Puzzle
        TheChild[TheChildMod.js]
    end
    
    STL --> Admin
    JSON --> Admin
    Admin --> Painter
    
    Painter --> NewJSON
    Painter --> Cubies
    
    NewJSON --> TheChild
    Cubies --> TheChild
    STL --> TheChild
    
    style Admin fill:#2196F3
    style Painter fill:#2196F3
    style NewJSON fill:#4CAF50
    style Cubies fill:#4CAF50
    style TheChild fill:#9C27B0
```

## Loading Priority in TheChildMod.js

```mermaid
flowchart TD
    Start([Puzzle Loads]) --> Check1{Pre-cut cubies<br/>exist?}
    
    Check1 -->|Yes| LoadCubies[Load from<br/>assets/3d/cubies/baby_yoda_detailed/]
    Check1 -->|No| LoadSTL[Load STL + Color JSON]
    
    LoadCubies --> UseCubies[Use Pre-computed Geometry<br/>Colors already baked in<br/>⚡ Fast Loading]
    
    LoadSTL --> LoadFiles[Load:<br/>- baby_yoda_detailed.stl<br/>- baby_yoda_detailed_colors.json]
    LoadFiles --> CSG[Perform CSG Operations<br/>Cut model into 12 pieces<br/>Apply colors from JSON]
    CSG --> UseCSG[Use Computed Geometry<br/>🐌 Slower Loading]
    
    UseCubies --> Display[Display Puzzle]
    UseCSG --> Display
    
    style UseCubies fill:#4CAF50
    style UseCSG fill:#FFC107
    style Display fill:#2196F3
```

## Color Update Scenarios

### Scenario 1: Update Colors Only (Not Recommended)

```mermaid
flowchart LR
    Paint[Paint Model] --> Export[Export JSON]
    Export --> Save[Save JSON]
    Save --> Result[❌ Pre-cut cubies<br/>still have old colors]
    
    style Result fill:#f44336
```

### Scenario 2: Update Colors + Re-Generate Cubies (Recommended)

```mermaid
flowchart LR
    Paint[Paint Model] --> Export[Export JSON]
    Export --> Generate[Generate Cubies]
    Generate --> SaveAll[Save JSON + Cubies]
    SaveAll --> Result[✅ Fast loading<br/>with new colors]
    
    style Result fill:#4CAF50
```

## Quick Reference: What Files Do What?

| File | Purpose | When to Update |
|------|---------|----------------|
| `baby_yoda_detailed.stl` | 3D model geometry | Rarely (only if changing model) |
| `baby_yoda_detailed_colors.json` | Vertex colors | Every time you update colors |
| `cubies/*.bin` (12 files) | Pre-cut geometries with baked colors | Every time you update colors (for performance) |
| `cubies/config.json` | Cubie metadata | Every time you generate cubies |

## Performance Comparison

| Mode | Load Time | When to Use |
|------|-----------|-------------|
| **CSG Mode** (no cubies) | ~3-5 seconds | Testing color changes |
| **Pre-cut Mode** (with cubies) | ~0.1-0.3 seconds | Production use |

**Recommendation**: Use CSG mode while iterating on colors, then generate cubies for the final version.
