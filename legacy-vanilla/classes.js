class Sprite {
  constructor({ position, image, frames = { max: 1, hold: 10 }, sprites, animate = false }) {
    this.position = position
    this.image = image
    this.frames = { ...frames, val: 0, elapsed: 0 }
    this.animate = animate
    this.sprites = sprites
    this.width = 0
    this.height = 0
    image.onload = () => {
      this.width = image.width / this.frames.max
      this.height = image.height
    }
    if (image.complete && image.width) image.onload()
  }

  draw() {
    const w = this.image.width / this.frames.max
    c.drawImage(
      this.image,
      this.frames.val * w,
      0,
      w,
      this.image.height,
      this.position.x,
      this.position.y,
      w,
      this.image.height
    )

    if (!this.animate) {
      this.frames.val = 0
      return
    }
    if (this.frames.max > 1) this.frames.elapsed++
    if (this.frames.elapsed % this.frames.hold === 0) {
      this.frames.val = (this.frames.val + 1) % this.frames.max
    }
  }
}

class Boundary {
  static size = 48
  constructor({ position }) {
    this.position = position
    this.width = Boundary.size
    this.height = Boundary.size
  }
}
