// A phone has no keyboard. The d-pad and button live in the DOM over the canvas
// like the panel does, and only show up when the pointer is coarse — the same
// media query the CSS uses, so what the player sees and what the game listens
// for can't disagree.

const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

// What to tell the player to press. "SPACE to browse" is a lie on a phone.
const ACTION = COARSE ? 'TAP ●' : 'SPACE'

let held = null // the direction a finger is currently on, if any
let onAction = null

function touchHeading() {
  return held
}

// The action button belongs to whichever scene is running. Scenes register on
// create(), so the newest one wins and there's nothing to unhook on shutdown.
function onTouchAction(handler) {
  onAction = handler
}

// ponytail: one button at a time. Sliding a finger from one arrow to the next
// won't turn you — lift and press. Add pointerenter handling if that grates.
for (const button of document.querySelectorAll('#pad [data-dir]')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault() // or the browser takes the touch for scrolling
    held = button.dataset.dir
  })
}

const release = () => {
  held = null
}
window.addEventListener('pointerup', release)
window.addEventListener('pointercancel', release)

const act = document.querySelector('#pad .act')
if (act) {
  act.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    if (onAction) onAction()
  })
}
