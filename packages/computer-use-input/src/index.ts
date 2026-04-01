// Computer Use Input API - Cross-platform keyboard and mouse input

import { execSync } from 'child_process'

interface FrontmostAppInfo {
  bundleId: string
  appName: string
}

// Execute shell command
function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 })
  } catch {
    return ''
  }
}

// Get current mouse position
function getMousePosition(): { x: number; y: number } {
  if (process.platform === 'darwin') {
    const result = runCommand(
      `osascript -e 'tell application "System Events" to get (screen position of mouse)'`
    ).trim()
    const coords = result.split(', ').map(Number)
    return { x: coords[0] || 0, y: coords[1] || 0 }
  }
  return { x: 0, y: 0 }
}

// Move mouse to position
async function moveMouseTo(
  x: number,
  y: number,
  _animated: boolean = false
): Promise<void> {
  if (process.platform === 'darwin') {
    runCommand(`osascript -e 'tell application "System Events" to set position of cursor to {${x}, ${y}}'`)
  }
}

// Press/release a key
async function keyAction(
  key: string,
  action: 'press' | 'release'
): Promise<void> {
  if (process.platform !== 'darwin') return

  const keyCodeMap: Record<string, string> = {
    a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h', i: 'i',
    j: 'j', k: 'k', l: 'l', m: 'm', n: 'n', o: 'o', p: 'p', q: 'q', r: 'r',
    s: 's', t: 't', u: 'u', v: 'v', w: 'w', x: 'x', y: 'y', z: 'z',
    return: 'return', tab: 'tab', space: 'space', delete: 'delete',
    escape: 'escape', up: 'up arrow', down: 'down arrow',
    left: 'left arrow', right: 'right arrow',
  }

  const keyName = keyCodeMap[key.toLowerCase()] || key
  const verb = action === 'press' ? 'key down' : 'key up'
  runCommand(`osascript -e 'tell application "System Events" to ${verb} "${keyName}"'`)
}

// Type multiple keys in sequence
async function keysAction(parts: string[]): Promise<void> {
  for (const part of parts) {
    await keyAction(part, 'press')
    await new Promise((r) => setTimeout(r, 50))
    await keyAction(part, 'release')
    await new Promise((r) => setTimeout(r, 50))
  }
}

// Mouse button action
async function mouseButtonAction(
  button: 'left' | 'right' | 'middle',
  action: 'click' | 'press' | 'release',
  count: number = 1
): Promise<void> {
  if (process.platform !== 'darwin') return

  const buttonName = button === 'right' ? 'secondary' : button
  const clickCount = action === 'click' ? count : 1

  if (action === 'click') {
    runCommand(
      `osascript -e 'tell application "System Events" to click {${buttonName}}'`
    )
  } else {
    const verb = action === 'press' ? 'mouse down' : 'mouse up'
    runCommand(
      `osascript -e 'tell application "System Events" to ${verb} button ${button === 'left' ? 1 : button === 'right' ? 2 : 3}'`
    )
  }
}

// Mouse scroll
async function mouseScrollAction(
  amount: number,
  direction: 'vertical' | 'horizontal'
): Promise<void> {
  if (process.platform !== 'darwin') return

  const sign = amount > 0 ? 1 : -1
  const lines = Math.abs(amount)

  if (direction === 'vertical') {
    runCommand(
      `osascript -e 'tell application "System Events" to scroll window 1 ${sign > 0 ? "down" : "up"} ${lines}'`
    )
  } else {
    runCommand(
      `osascript -e 'tell application "System Events" to scroll window 1 ${sign > 0 ? "right" : "left"} ${lines}'`
    )
  }
}

// Type text
async function typeTextAction(text: string): Promise<void> {
  if (process.platform !== 'darwin') return

  // Escape special characters for AppleScript
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')

  runCommand(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`)
}

// Get frontmost application info
function getFrontmostAppInfo(): FrontmostAppInfo | null {
  if (process.platform !== 'darwin') return null

  try {
    const result = runCommand(`
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        return bundle identifier of frontApp & "|" & name of frontApp
      end tell
    `).trim()

    const [bundleId, appName] = result.split('|')
    return { bundleId, appName }
  } catch {
    return null
  }
}

export class ComputerUseInputAPI {
  isSupported: true = true

  async moveMouse(
    x: number,
    y: number,
    animated: boolean = false
  ): Promise<void> {
    await moveMouseTo(x, y, animated)
  }

  async key(
    key: string,
    action: 'press' | 'release'
  ): Promise<void> {
    await keyAction(key, action)
  }

  async keys(parts: string[]): Promise<void> {
    await keysAction(parts)
  }

  async mouseLocation(): Promise<{ x: number; y: number }> {
    return getMousePosition()
  }

  async mouseButton(
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'press' | 'release',
    count?: number
  ): Promise<void> {
    await mouseButtonAction(button, action, count)
  }

  async mouseScroll(
    amount: number,
    direction: 'vertical' | 'horizontal'
  ): Promise<void> {
    await mouseScrollAction(amount, direction)
  }

  async typeText(text: string): Promise<void> {
    await typeTextAction(text)
  }

  getFrontmostAppInfo(): FrontmostAppInfo | null {
    return getFrontmostAppInfo()
  }
}

interface ComputerUseInputUnsupported {
  isSupported: false
}

export type ComputerUseInput = ComputerUseInputAPI | ComputerUseInputUnsupported

// Factory function to create the API instance
export function createComputerUseInput(): ComputerUseInput {
  if (process.platform === 'darwin') {
    return new ComputerUseInputAPI()
  }
  return { isSupported: false }
}