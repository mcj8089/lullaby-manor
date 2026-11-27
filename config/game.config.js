/**
 * Lullaby Manor — tuning knobs.
 * Physics, camera, abilities, dream themes and presentation live here so the
 * level data in levels.js stays about layout, not feel.
 */
export const GAME_CONFIG = {
  appId: "lullaby-manor",
  storageKey: "lullabyManor.save.v1",
  levelCount: 16,

  player: {
    radius: 0.34,
    speed: 3.6,
    quietSpeed: 1.75,
    accel: 18,
    friction: 14,
    turnLerp: 12,
    hearts: 3,
    invulnMs: 1250,
    knockback: 4.2
  },

  camera: {
    fov: 42,
    height: 15.5,
    back: 11.5,
    lookAhead: 0.6,
    follow: 4.5,
    followClampX: 2.1,
    followClampZ: 0.9,
    narrowHeight: 17.4,
    narrowBack: 13.8,
    narrowClampX: 6.2,
    narrowClampZ: 1.5,
    menuHeight: 18,
    menuBack: 14
  },

  ability: {
    bell: { cooldown: 8, radius: 6.4, duration: 2.6 },
    pulse: { cooldown: 9, radius: 7.5, duration: 5.2 },
    whistle: { cooldown: 10, radius: 8.5, duration: 5.0, stun: 2.4 },
    rewind: { cooldown: 12, window: 4.2, stun: 1.2 },
    swap: { cooldown: 10, stun: 2.6, maxRange: 18 }
  },

  boss: {
    maxHp: 100,
    flareDamage: 20,
    chargeCost: 3,
    maxMotes: 3,
    moteRespawnMs: 2600,
    contactRadius: 1.5
  },

  audio: {
    sfxVolume: 0.62,
    musicVolume: 0.42,
    crossfade: 1.1
  },

  stars: {
    // 1 for clearing · +1 no hearts lost · +1 under par time
    parBonus: true
  },

  share: {
    hashtag: "#LullabyManor",
    site: "pipygames.com",
    url: "https://pipygames.com"
  },

  dreams: {
    nursery: {
      id: "nursery",
      order: 1,
      family: "ollie",
      enemy: "hushling",
      ability: "bell",
      accent: "#8fe3cf",
      ink: "#254c4b",
      sky: "#071b1e",
      fog: 0.034,
      par: [90, 105, 120]
    },
    study: {
      id: "study",
      order: 2,
      family: "theo",
      enemy: "eel",
      ability: "pulse",
      accent: "#f0bf7a",
      ink: "#3d2b1c",
      sky: "#140f0b",
      fog: 0.04,
      par: [105, 120, 135]
    },
    garden: {
      id: "garden",
      order: 3,
      family: "biscuit",
      enemy: "hound",
      ability: "whistle",
      accent: "#c9a7ff",
      ink: "#271d3d",
      sky: "#100a1d",
      fog: 0.045,
      par: [110, 125, 145]
    },
    attic: {
      id: "attic",
      order: 4,
      family: "clara",
      enemy: "sentinel",
      ability: "rewind",
      accent: "#ffcf7a",
      ink: "#3b2a17",
      sky: "#160e08",
      fog: 0.038,
      par: [115, 130, 150]
    },
    gallery: {
      id: "gallery",
      order: 5,
      family: "june",
      enemy: "shadow",
      ability: "swap",
      accent: "#9dc7ff",
      ink: "#1b2740",
      sky: "#080f20",
      fog: 0.05,
      par: [120, 135, 155]
    },
    weaver: {
      id: "weaver",
      order: 6,
      family: null,
      enemy: "weaver",
      ability: "flare",
      accent: "#ffb98a",
      ink: "#2a1622",
      sky: "#10060d",
      fog: 0.06,
      par: [240]
    }
  },

  family: {
    ollie: { dream: "nursery", accent: "#8fe3cf" },
    theo: { dream: "study", accent: "#f0bf7a" },
    biscuit: { dream: "garden", accent: "#c9a7ff" },
    clara: { dream: "attic", accent: "#ffcf7a" },
    june: { dream: "gallery", accent: "#9dc7ff" }
  },

  rescueMilestones: { 3: "ollie", 6: "theo", 9: "biscuit", 12: "clara", 15: "june" }
};
