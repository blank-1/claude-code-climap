// URL Event Handler - cross-platform URL scheme event detection

interface UrlEventListener {
  callback: (url: string) => void
  cleanup: () => void
}

let listener: UrlEventListener | null = null
let lastClipboardUrl = ''

/**
 * Poll clipboard for URL changes (cross-platform fallback)
 * This is a simple implementation that checks if clipboard contains a URL
 */
function createClipboardPoller(callback: (url: string) => void): () => void {
  const interval = setInterval(() => {
    try {
      const result = Bun.spawnSync({
        cmd: ['pbpaste'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const text = result.stdout.toString().trim()

      if (text !== lastClipboardUrl && text.startsWith('http')) {
        lastClipboardUrl = text
        callback(text)
      }
    } catch {
      // Ignore errors
    }
  }, 1000)

  return () => clearInterval(interval)
}

/**
 * macOS: Use AppleScript to register URL scheme handler
 * This registers a handler for custom URL schemes like claude://
 */
function createMacOSUrlListener(callback: (url: string) => void): () => void {
  // For full URL scheme handling, we'd need to register an app bundle
  // For now, use clipboard polling as fallback
  return createClipboardPoller(callback)
}

/**
 * Wait for a URL event (e.g., from browser or external app)
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns The URL that triggered the event, or null if timeout
 */
export async function waitForUrlEvent(timeoutMs?: number): Promise<string | null> {
  return new Promise((resolve) => {
    let cleanup: (() => void) | null = null

    const onUrl = (url: string) => {
      if (cleanup) {
        cleanup()
        cleanup = null
      }
      resolve(url)
    }

    // Set up platform-specific listener
    if (process.platform === 'darwin') {
      cleanup = createMacOSUrlListener(onUrl)
    } else if (process.platform === 'linux') {
      cleanup = createClipboardPoller(onUrl)
    } else {
      // Windows - not supported
      cleanup = () => {}
    }

    // Handle timeout
    if (timeoutMs && timeoutMs > 0) {
      setTimeout(() => {
        if (cleanup) {
          cleanup()
        }
        resolve(null)
      }, timeoutMs)
    }
  })
}

/**
 * Open a URL in the default browser
 */
export function openUrl(url: string): boolean {
  try {
    if (process.platform === 'darwin') {
      Bun.spawnSync({
        cmd: ['open', url],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      return true
    } else if (process.platform === 'linux') {
      Bun.spawnSync({
        cmd: ['xdg-open', url],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      return true
    } else if (process.platform === 'win32') {
      Bun.spawnSync({
        cmd: ['cmd', '/c', 'start', '', url],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      return true
    }
  } catch {
    // Ignore errors
  }
  return false
}

/**
 * Check if URL scheme is supported
 */
export function isSupported(): boolean {
  return process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'win32'
}