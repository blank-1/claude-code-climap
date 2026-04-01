// Computer Use MCP - Cross-platform computer control tools
// Implements screenshot, mouse control, keyboard input via existing packages

import screenshot from 'screenshot-desktop'
import { execSync } from 'child_process'

export const API_RESIZE_PARAMS = {
  max_width: 1920,
  max_height: 1080,
  quality: 85,
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function targetImageSize(width: number, height: number, params: any): [number, number] {
  const maxWidth = params?.max_width || 1920
  const maxHeight = params?.max_height || 1080

  if (width <= maxWidth && height <= maxHeight) {
    return [width, height]
  }

  const scale = Math.min(maxWidth / width, maxHeight / height)
  return [
    Math.round(width * scale),
    Math.round(height * scale),
  ]
}

interface Capabilities {
  screenshotFiltering: 'native'
  platform: string
  hostBundleId?: string
  [key: string]: any
}

interface ToolDefinition {
  name: string
  description: string
  inputSchema: object
}

// Simple screen capture using screenshot-desktop
async function captureScreen(): Promise<Buffer | null> {
  try {
    return await screenshot({ format: 'png' })
  } catch {
    return null
  }
}

// Execute AppleScript for macOS-specific actions
function runAppleScript(script: string): string {
  try {
    return execSync(`osascript -e '${script}'`, { encoding: 'utf-8' })
  } catch {
    return ''
  }
}

// Get display dimensions
function getScreenDimensions(): { width: number; height: number } {
  if (process.platform === 'darwin') {
    const result = runAppleScript(`
      tell application "System Events"
        set screenSize to size of window 1 of process "Finder"
        return item 1 of screenSize & "x" & item 2 of screenSize
      end tell
    `).trim()
    const [width, height] = result.split('x').map(Number)
    return { width: width || 1920, height: height || 1080 }
  }
  return { width: 1920, height: 1080 }
}

// Mouse control (macOS using AppleScript)
function moveMouse(x: number, y: number): boolean {
  if (process.platform !== 'darwin') return false
  try {
    runAppleScript(`tell application "System Events" to set position of cursor to {${x}, ${y}}`)
    return true
  } catch {
    return false
  }
}

// Mouse click (macOS using AppleScript)
function clickMouse(): boolean {
  if (process.platform !== 'darwin') return false
  try {
    runAppleScript(`
      tell application "System Events"
        click
      end tell
    `)
    return true
  } catch {
    return false
  }
}

// Keyboard typing (macOS using AppleScript)
function typeText(text: string): boolean {
  if (process.platform !== 'darwin') return false
  try {
    // Escape special characters
    const escaped = text.replace(/"/g, '\\"')
    runAppleScript(`tell application "System Events" to keystroke "${escaped}"`)
    return true
  } catch {
    return false
  }
}

// Keyboard shortcut (macOS using AppleScript)
function pressKey(key: string, modifiers: string[] = []): boolean {
  if (process.platform !== 'darwin') return false
  try {
    const modMap: Record<string, string> = {
      command: 'command',
      control: 'control',
      option: 'option',
      shift: 'shift',
    }
    const mods = modifiers.map((m) => modMap[m] || m).join(' ')
    const keyName = key.toLowerCase()
    runAppleScript(`tell application "System Events" to keystroke "${keyName}" using {${mods}}`)
    return true
  } catch {
    return false
  }
}

// Get list of running applications
function getRunningApps(): string[] {
  if (process.platform !== 'darwin') return []
  try {
    const result = runAppleScript(`
      tell application "System Events"
        set appList to name of every process whose background only is false
        return appList
      end tell
    `)
    return result.split(', ').map((s) => s.trim())
  } catch {
    return []
  }
}

// Get frontmost application
function getFrontmostApp(): { name: string; bundleId: string } | null {
  if (process.platform !== 'darwin') return null
  try {
    const result = runAppleScript(`
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        return name of frontApp & "|" & bundle identifier of frontApp
      end tell
    `)
    const [name, bundleId] = result.trim().split('|')
    return { name, bundleId }
  } catch {
    return null
  }
}

export class ComputerExecutor {
  capabilities: Capabilities = {
    screenshotFiltering: 'native',
    platform: process.platform,
  }

  async takeScreenshot(): Promise<Buffer | null> {
    return captureScreen()
  }

  moveMouse(x: number, y: number): boolean {
    return moveMouse(x, y)
  }

  clickMouse(): boolean {
    return clickMouse()
  }

  typeText(text: string): boolean {
    return typeText(text)
  }

  pressKey(key: string, modifiers?: string[]): boolean {
    return pressKey(key, modifiers)
  }

  getRunningApps(): string[] {
    return getRunningApps()
  }

  getFrontmostApp() {
    return getFrontmostApp()
  }

  getScreenDimensions() {
    return getScreenDimensions()
  }
}

export type ComputerUseSessionContext = any
export type CuCallToolResult = any
export type CuPermissionRequest = any
export type CuPermissionResponse = any
export const DEFAULT_GRANT_FLAGS = {
  includeAllApps: false,
}
export type DisplayGeometry = any
export type FrontmostApp = { name: string; bundleId: string; displayName?: string; [key: string]: any }
export type InstalledApp = { name: string; bundleId: string; path?: string; [key: string]: any }
export type ResolvePrepareCaptureResult = any
export type RunningApp = { name: string; bundleId: string; displayName?: string; pid?: number; [key: string]: any }
export type ScreenshotDims = { width: number; height: number; displayId?: number; [key: string]: any }
export type ScreenshotResult = { png?: Buffer; base64?: string; width?: number; height?: number; [key: string]: any }

export function bindSessionContext(..._args: any[]): any {
  return new ComputerExecutor()
}

export function buildComputerUseTools(
  capabilities: Capabilities,
  _coordinateMode: string,
  _installedApps?: string[],
): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: 'computer_screenshot',
      description: 'Take a screenshot of the screen',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'computer_mouse_move',
      description: 'Move the mouse cursor to specified coordinates',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'computer_mouse_click',
      description: 'Click the mouse',
      inputSchema: {
        type: 'object',
        properties: {
          button: { type: 'string', enum: ['left', 'right', 'middle'] },
        },
      },
    },
    {
      name: 'computer_keyboard_type',
      description: 'Type text using the keyboard',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['text'],
      },
    },
    {
      name: 'computer_keyboard_hotkey',
      description: 'Press a keyboard hotkey combination',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key to press' },
          modifiers: {
            type: 'array',
            items: { type: 'string', enum: ['command', 'control', 'option', 'shift'] },
            description: 'Modifier keys to hold',
          },
        },
        required: ['key'],
      },
    },
  ]

  return tools
}

export function createComputerUseMcpServer(..._args: any[]): any {
  return null // MCP server creation would require full MCP SDK setup
}