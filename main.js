const FONT = '"Press Start 2P", monospace'

// eslint-disable-next-line no-unused-vars
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true, // nearest-neighbour scaling; the art is 48px tiles
  roundPixels: true, // stops the camera landing on half pixels and shimmering
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.RESIZE, // fill the window; WalkScene zooms to suit
    width: '100%',
    height: '100%'
  },
  // For 120 frames after every start, resume and refocus, Phaser clamps delta to
  // one 60fps frame. Any frame that really took longer than that is charged as
  // 16ms, so the world runs in slow motion until the cooldown ends. Off. The
  // separate "delta over 200ms is nonsense" guard still catches tab switches.
  fps: { panicMax: 0 },
  physics: {
    default: 'arcade',
    arcade: { debug: false } // flip to true to see every collision box
  },
  scene: [Island, VideoStore]
})
