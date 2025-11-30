
corners = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue', 'Pink', 'Pink']
edges = ['White', 'Yellow', 'Red', 'Orange', 'Green', 'Blue', 'Black', 'Black', 'Black', 'Purple', 'Purple', 'Purple']

cIdx = 0
eIdx = 0

pieces = []

for x in range(-1, 2):
    for y in range(-1, 2):
        for z in range(-1, 2):
            if x == 0 and y == 0 and z == 0:
                continue

            name = ''
            # Y axis (U/D)
            if y == 1: name += 'U'
            if y == -1: name += 'D'
            # Z axis (F/B)
            if z == 1: name += 'F'
            if z == -1: name += 'B'
            # X axis (R/L)
            if x == 1: name += 'R'
            if x == -1: name += 'L'

            color = ''
            absX = abs(x)
            absY = abs(y)
            absZ = abs(z)
            sum_val = absX + absY + absZ

            if sum_val == 1:
                # Center
                if x == 1: color = 'Red'
                if x == -1: color = 'Orange'
                if y == 1: color = 'White'
                if y == -1: color = 'Yellow'
                if z == 1: color = 'Green'
                if z == -1: color = 'Blue'
            elif sum_val == 2:
                # Edge
                color = edges[eIdx]
                eIdx += 1
            elif sum_val == 3:
                # Corner
                color = corners[cIdx]
                cIdx += 1

            pieces.append({'name': name, 'color': color})

for i, p in enumerate(pieces):
    print(f"{i + 1}. {p['name']} {p['color']}")
