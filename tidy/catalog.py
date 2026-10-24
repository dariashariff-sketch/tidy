"""The fixed list of messes and decorations the room can show.

The model may only pick from these names, so whatever it writes, the frontend
always has a voxel model to draw.
"""

MESSES = {
    "crumpled_papers": "Crumpled papers",
    "laundry_pile": "Laundry pile",
    "dirty_dishes": "Dirty dishes",
    "book_stack": "A book",
    "cardboard_box": "Unopened boxes",
    "dust_bunny": "Dust bunnies",
    "tangled_cables": "Tangled cables",
    "trash_bag": "Trash bag",
    "pizza_box": "Old pizza boxes",
    "sock_pile": "Lost socks",
}

DECOR = {
    "rug": "Cat rug",
    "fish_rug": "Fish rug",
    "dog_rug": "Dog rug",
    "painting": "Landscape painting",
    "bookshelf": "Bookshelf",
    "record_player": "Record player",
    "flower_box": "Window flower box",
    "banner": "Guild banner",
}

# Decorations unlock at XP milestones. A medium task earns 50 XP,
# so the cat rug arrives after two medium tasks or one large one.
DECOR_UNLOCKS = [
    ("rug", 100),
    ("painting", 220),
    ("fish_rug", 300),
    ("bookshelf", 380),
    ("dog_rug", 470),
    ("record_player", 560),
    ("flower_box", 780),
    ("banner", 1020),
]

# Floor spots for piles (x, z) on the 12x12 room grid, kept clear of furniture. One pile per to-do.
# The first six are the nicest spots; the rest fill a grid across the open floor.
_FAVORITES = [[4.1, 1.6], [-3.0, 2.6], [-0.6, -2.4], [3.8, -1.4], [-3.6, -0.4], [-1.0, 5.0]]


def _blocked(x: float, z: float) -> bool:
    return ((x < -2.4 and z < -1.4)               # bed and nightstand
            or (x > 1.4 and z < -2.6)             # desk and chair
            or (x < -4.6 and 0.4 < z < 4.0)       # bookshelf on the left wall
            or (x > 3.9 and z > 3.6))             # record player corner


_GRID = [[x, z] for z in (-3.2, -1.8, -0.4, 1.0, 2.4, 3.8, 5.2)
         for x in (-4.8, -3.4, -2.0, -0.6, 0.8, 2.2, 3.6, 5.0)
         if not _blocked(x, z)]
MESS_SLOTS = _FAVORITES + [g for g in _GRID
                           if all(abs(g[0] - f[0]) + abs(g[1] - f[1]) > 1.2 for f in _FAVORITES)]


# Floor pieces can be dragged around the room. The others hang on a wall or sit on the sill.
DRAGGABLE = {"rug", "fish_rug", "dog_rug", "record_player", "bookshelf"}
# Wall pieces slide along the back or left wall.
WALL_DRAGGABLE = {"painting", "banner"}

# Room bounds for dragged furniture (x and z), so nothing ends up inside a wall.
ROOM_MIN, ROOM_MAX = -5.2, 5.4

PETS = {"dog": "Dog", "cat": "Cat", "fish": "Fish"}

# Where floor decorations sit by default (x, z) and roughly how much floor they cover (radius),
# so new piles can land in empty space. These match DECOR_MODELS in static/world.js.
FLOOR_FOOTPRINT = {
    "rug": (0.6, 1.4, 2.6),
    "fish_rug": (3.6, 3.4, 1.9),
    "dog_rug": (-2.2, 2.7, 3.1),
    "bookshelf": (-5.7, 2.2, 1.4),
    "record_player": (4.8, 4.4, 0.9),
}
PILE_RADIUS = 0.8
DOG_SPOT = (-4.3, -1.2, 1.0)

# Stress toys sold in the nightstand shop: name -> (label, price in coins).
TOYS = {
    "peanut": ("Peanut squishy", 20),
    "tofu": ("Tofu squishy", 25),
    "strawberry": ("Strawberry squishy", 30),
    "butter": ("Butter squishy", 35),
    "bao": ("Bao bun squishy", 40),
    "cat_squishy": ("Cat squishy", 60),
}


def unlocked_by(xp: int) -> list[str]:
    return [name for name, need in DECOR_UNLOCKS if xp >= need]


def next_unlock(xp: int) -> dict | None:
    for name, need in DECOR_UNLOCKS:
        if xp < need:
            return {"name": name, "label": DECOR[name], "xp": need}
    return None


XP_BY_SIZE = {1: 25, 2: 50, 3: 100}   # small, medium, large (the Tidier decides)
COINS_PER_TASK = 10


def level_for(xp: int) -> dict:
    """Levels get a little longer each time, like most RPGs."""
    level, need, floor = 1, 100, 0
    while xp >= floor + need:
        floor += need
        level += 1
        need = int(need * 1.25)
    return {"level": level, "into_level": xp - floor, "level_size": need}
