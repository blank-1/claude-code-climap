// Computer Use Swift API - macOS native operations using JXA/AppleScript

import screenshot from 'screenshot-desktop'
import { execSync } from 'child_process'

interface DisplayGeometry {
  width: number
  height: number
  scaleFactor: number
  displayId: number
}

interface PrepareDisplayResult {
  activated: string
  hidden: string[]
}

interface AppInfo {
  bundleId: string
  displayName: string
}

interface InstalledApp {
  bundleId: string
  displayName: string
  path: string
  iconDataUrl?: string
}

interface RunningApp {
  bundleId: string
  displayName: string
}

interface ScreenshotResult {
  base64: string
  width: number
  height: number
}

interface ResolvePrepareCaptureResult {
  base64: string
  width: number
  height: number
}

interface WindowDisplayInfo {
  bundleId: string
  displayIds: number[]
}

// Helper to run AppleScript
function runAppleScript(script: string): string {
  try {
    return execSync(`osascript -e '${script}'`, { encoding: 'utf-8', timeout: 10000 })
  } catch {
    return ''
  }
}

// Convert Buffer to base64
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

// Apps API implementation
class AppsAPIImpl {
  async prepareDisplay(
    allowlistBundleIds: string[],
    _surrogateHost: string,
    _displayId?: number
  ): Promise<PrepareDisplayResult> {
    // Hide apps not in allowlist
    const hidden: string[] = []
    const running = this.listRunning()

    for (const app of running) {
      if (!allowlistBundleIds.includes(app.bundleId)) {
        try {
          runAppleScript(`tell application "${app.displayName}" to hide`)
          hidden.push(app.bundleId)
        } catch {
          // Ignore errors
        }
      }
    }

    return { activated: allowlistBundleIds[0] || '', hidden }
  }

  async previewHideSet(
    bundleIds: string[],
    _displayId?: number
  ): Promise<AppInfo[]> {
    return bundleIds.map((id) => ({ bundleId: id, displayName: id }))
  }

  async findWindowDisplays(bundleIds: string[]): Promise<WindowDisplayInfo[]> {
    return bundleIds.map((id) => ({ bundleId: id, displayIds: [0] }))
  }

  async appUnderPoint(x: number, y: number): Promise<AppInfo | null> {
    const result = runAppleScript(`
      tell application "System Events"
        set appPath to (path to frontmost application)
        return POSIX path of appPath
      end tell
    `).trim()

    // Simplified - returns frontmost app
    const name = runAppleScript(`tell application "System Events" to name of first application process whose frontmost is true`).trim()
    return { bundleId: name.toLowerCase().replace(/\s+/g, '.'), displayName: name }
  }

  async listInstalled(): Promise<InstalledApp[]> {
    // Get applications from /Applications
    const result = runAppleScript(`
      tell application "System Events"
        set appList to {}
        repeat with a in (path to applications folder)
          try
            set appName to name of (info for a)
            if appName ends with ".app" then
              set end of appList to appName
            end if
          end try
        end repeat
        return appList
      end tell
    `).trim()

    return result.split(', ').map((fullName) => {
      const name = fullName.replace('.app', '')
      return {
        name: name,
        bundleId: name.toLowerCase().replace(/\s+/g, '.'),
        displayName: name,
        path: `/Applications/${fullName}`,
      }
    })
  }

  iconDataUrl(_path: string): string | null {
    // Icon extraction would require native handling
    return null
  }

  listRunning(): RunningApp[] {
    const result = runAppleScript(`
      tell application "System Events"
        set appList to {}
        repeat with p in (every process whose background only is false)
          set end of appList to (name of p & "|" & bundle identifier of p & "|" & pid of p)
        end repeat
        return appList
      end tell
    `).trim()

    return result.split(', ').map((s) => {
      const parts = s.split('|')
      const name = parts[0]
      const bundleId = parts[1] || name.toLowerCase().replace(/\s+/g, '.')
      const pid = parts[2] ? parseInt(parts[2], 10) : 0
      return { name: name, displayName: name, bundleId, pid: pid || undefined }
    })
  }

  async open(bundleId: string): Promise<void> {
    runAppleScript(`tell application "${bundleId}" to activate`)
  }

  async unhide(bundleIds: string[]): Promise<void> {
    for (const id of bundleIds) {
      try {
        runAppleScript(`tell application "${id}" to unhide`)
      } catch {
        // Ignore errors
      }
    }
  }
}

// Display API implementation
class DisplayAPIImpl {
  getSize(_displayId?: number): DisplayGeometry {
    // Get main display size using AppleScript
    const result = runAppleScript(`
      tell application "System Events"
        set screenSize to size of main screen
        return item 1 of screenSize & "," & item 2 of screenSize
      end tell
    `).trim()

    const [width, height] = result.split(',').map(Number)
    return {
      width: width || 1920,
      height: height || 1080,
      scaleFactor: 2,
      displayId: 0,
    }
  }

  listAll(): DisplayGeometry[] {
    const main = this.getSize()
    return [main]
  }
}

// Screenshot API implementation
class ScreenshotAPIImpl {
  async captureExcluding(
    _allowedBundleIds: string[],
    quality: number,
    targetW: number,
    targetH: number,
    _displayId?: number
  ): Promise<ScreenshotResult> {
    try {
      const img = await screenshot({ format: 'png' })

      // Resize if needed (using sharp)
      let width = 0
      let height = 0

      if (img.length > 24 && img[12] === 0x49) {
        width = img.readUInt32BE(16)
        height = img.readUInt32BE(20)
      }

      // Scale down if needed
      let finalImg = img
      if ((targetW && width > targetW) || (targetH && height > targetH)) {
        // For simplicity, just return the original
        // In production, use sharp to resize
        finalImg = img
      }

      return {
        base64: bufferToBase64(finalImg),
        width: targetW || width,
        height: targetH || height,
      }
    } catch {
      return { base64: '', width: 0, height: 0 }
    }
  }

  async captureRegion(
    _allowedBundleIds: string[],
    x: number,
    y: number,
    w: number,
    h: number,
    _outW: number,
    _outH: number,
    _quality: number,
    _displayId?: number
  ): Promise<ScreenshotResult> {
    // Full screen capture, region cropping would need additional processing
    const result = await this.captureExcluding([], 85, 0, 0)
    return {
      base64: result.base64,
      width: w,
      height: h,
    }
  }
}

export class ComputerUseAPI {
  apps = new AppsAPIImpl()
  display = new DisplayAPIImpl()
  screenshot = new ScreenshotAPIImpl()

  async resolvePrepareCapture(
    allowedBundleIds: string[],
    surrogateHost: string,
    quality: number,
    targetW: number,
    targetH: number,
    displayId?: number,
    _autoResolve?: boolean,
    _doHide?: boolean
  ): Promise<ResolvePrepareCaptureResult> {
    await this.apps.prepareDisplay(allowedBundleIds, surrogateHost, displayId)
    const screenshot = await this.screenshot.captureExcluding(
      allowedBundleIds,
      quality,
      targetW,
      targetH,
      displayId
    )

    return {
      base64: screenshot.base64,
      width: screenshot.width,
      height: screenshot.height,
    }
  }
}

// Factory function
export function createComputerUseAPI(): ComputerUseAPI {
  return new ComputerUseAPI()
}