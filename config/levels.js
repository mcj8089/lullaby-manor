/**
 * Lullaby Manor — 16 levels.
 *
 * Each map is 11 × 8 cells (cell = 1.7 world units), top row = north.
 *   .  floor            #  dream furniture / wall
 *   P  player spawn     X  exit door
 *   N  memory (3 per level)
 *   E  nightmare         C  creaky floorboard (nursery)
 *   G  thorn gate (garden)  M  mirror frame (gallery)
 *   S  shadow spawn (gallery)  ^  pendulum anchor (attic)
 *
 * Level 16 is the hand-built Weaver arena; it has no map.
 */
export const CELL = 1.7;
export const GRID_W = 11;
export const GRID_H = 8;

export const LEVELS = [
  {
    id: 1, dream: "nursery", family: "ollie", par: 90,
    map: [
      "....N......",
      "..###......",
      "..#.#......",
      "..#.#.E....",
      ".....#...#.",
      ".N...#...#.",
      "...P...X...",
      ".....C..N.."
    ]
  },
  {
    id: 2, dream: "nursery", family: "ollie", par: 105,
    map: [
      ".N....N....",
      "..####.....",
      "..#..#..E..",
      "..#..#.....",
      ".....#..#..",
      "NE.....#...",
      "...P....X..",
      "....C..C..."
    ]
  },
  {
    id: 3, dream: "nursery", family: "ollie", par: 120,
    map: [
      "N.....#....",
      "..##..#....",
      "..#E..#....",
      "..#...##...",
      "..##...N#..",
      "N..E..#.E..",
      "...P...#X..",
      "..C.C..C..."
    ]
  },
  {
    id: 4, dream: "study", family: "theo", par: 105,
    map: [
      "...........",
      ".####......",
      ".#..#..N...",
      ".#..#......",
      ".....##....",
      ".N...E.....",
      "...P..NX...",
      ".....##...."
    ]
  },
  {
    id: 5, dream: "study", family: "theo", par: 120,
    map: [
      "....#......",
      ".###.#..#..",
      ".#...N..#..",
      ".#..##.....",
      "...E...#...",
      "N#....#.E..",
      ".#.P..N.#X.",
      "....#......"
    ]
  },
  {
    id: 6, dream: "study", family: "theo", par: 135,
    map: [
      "..#....N...",
      "..#.###....",
      "..#.#......",
      "..#.#..E...",
      ".N..#..#...",
      "....#..#.E.",
      ".P.....N#.X",
      "....E..#..."
    ]
  },
  {
    id: 7, dream: "garden", family: "biscuit", par: 110,
    map: [
      "........N..",
      ".###...##..",
      ".#.N#..#...",
      ".#..#..#.G.",
      ".#..####...",
      ".#.E...N...",
      ".P...G...X.",
      ".....#....."
    ]
  },
  {
    id: 8, dream: "garden", family: "biscuit", par: 125,
    map: [
      "....N......",
      ".##.###.#..",
      ".#....#.#..",
      ".#.G..#.#..",
      ".#.N..#.#.G",
      ".#.E....#..",
      ".P..N..#..X",
      "....##....."
    ]
  },
  {
    id: 9, dream: "garden", family: "biscuit", par: 145,
    map: [
      ".#......N#.",
      ".#.####.#..",
      ".#.#..#.#E.",
      ".N.#.G..#..",
      ".#.#..#..#.",
      ".#.####..#.",
      ".P..E..E.X.",
      "......N...."
    ]
  },
  {
    id: 10, dream: "attic", family: "clara", par: 115,
    map: [
      "........N..",
      "..##...##..",
      "..#..N..#..",
      "..#.....#..",
      "....E......",
      ".N..#..#...",
      "...P.#...X.",
      "..........."
    ]
  },
  {
    id: 11, dream: "attic", family: "clara", par: 130,
    map: [
      ".#....N..#.",
      ".#.##.##.#.",
      ".#.#...#.#.",
      "...#.E.#...",
      ".#.#.^.#.#.",
      ".#.##.##.#.",
      ".P..N..N.X.",
      "....E......"
    ]
  },
  {
    id: 12, dream: "attic", family: "clara", par: 150,
    map: [
      ".N..#...#N.",
      ".##.#.#.#..",
      ".#....E..#.",
      ".#.####..#.",
      ".#...^...#.",
      ".#.E...#...",
      ".P..N....X.",
      "....#..#..."
    ]
  },
  {
    id: 13, dream: "gallery", family: "june", par: 120,
    map: [
      "...........",
      "..M.....M..",
      "...N...N...",
      "..M..S..M..",
      "...........",
      ".N...M.....",
      "...P...X...",
      "..........."
    ]
  },
  {
    id: 14, dream: "gallery", family: "june", par: 135,
    map: [
      ".M.......M.",
      "...N...N...",
      ".M..S..M...",
      "...........",
      "..M..M..M..",
      "...N.......",
      "...P.S...X.",
      ".M.......M."
    ]
  },
  {
    id: 15, dream: "gallery", family: "june", par: 155,
    map: [
      ".N..M.M..N.",
      "..M.....M..",
      "...S...S...",
      ".M...N...M.",
      "...........",
      "..M..S..M..",
      "...P.....X.",
      ".M.......M."
    ]
  },
  {
    id: 16, dream: "weaver", family: null, par: 240,
    map: null, boss: true
  }
];

export const DREAM_LEVELS = {
  nursery: [1, 2, 3],
  study: [4, 5, 6],
  garden: [7, 8, 9],
  attic: [10, 11, 12],
  gallery: [13, 14, 15],
  weaver: [16]
};

export function levelById(id) {
  return LEVELS.find((l) => l.id === Number(id)) || LEVELS[0];
}
