// Claude for Chrome MCP - Browser automation using Puppeteer

import puppeteer, { type Browser, type Page } from 'puppeteer-core'

let browser: Browser | null = null
let currentPage: Page | null = null

interface ChromeTools {
  name: string
  description: string
  inputSchema: object
}

interface ChromeContextOptions {
  headless?: boolean
  browserPath?: string
}

class ClaudeForChromeContextImpl {
  private options: ChromeContextOptions

  constructor(options: ChromeContextOptions = {}) {
    this.options = {
      headless: true,
      ...options,
    }
  }

  async getBrowser(): Promise<Browser | null> {
    if (browser) return browser

    try {
      // Find Chrome executable
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/google-chrome',
      ]

      let executablePath = ''
      for (const p of chromePaths) {
        try {
          const fs = require('fs')
          if (fs.existsSync(p)) {
            executablePath = p
            break
          }
        } catch {
          // Continue
        }
      }

      if (!executablePath && this.options.browserPath) {
        executablePath = this.options.browserPath
      }

      if (!executablePath) {
        console.warn('Chrome executable not found')
        return null
      }

      browser = await puppeteer.launch({
        executablePath,
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      return browser
    } catch (error) {
      console.error('Failed to launch browser:', error)
      return null
    }
  }

  async getPage(): Promise<Page | null> {
    if (currentPage) return currentPage

    const b = await this.getBrowser()
    if (!b) return null

    const pages = await b.pages()
    currentPage = pages[0] || (await b.newPage())
    return currentPage
  }

  async navigate(url: string): Promise<boolean> {
    const page = await this.getPage()
    if (!page) return false

    try {
      await page.goto(url, { waitUntil: 'networkidle2' })
      return true
    } catch {
      return false
    }
  }

  async screenshot(): Promise<string | null> {
    const page = await this.getPage()
    if (!page) return null

    try {
      const screenshot = await page.screenshot({ encoding: 'base64' })
      return screenshot
    } catch {
      return null
    }
  }

  async evaluate<T = unknown>(script: string): Promise<T | null> {
    const page = await this.getPage()
    if (!page) return null

    try {
      return await page.evaluate((s) => eval(s), script) as T
    } catch {
      return null
    }
  }

  async close(): Promise<void> {
    if (browser) {
      await browser.close()
      browser = null
      currentPage = null
    }
  }
}

class LoggerImpl {
  info(message: string): void {
    console.log('[Chrome MCP]', message)
  }

  warn(message: string): void {
    console.warn('[Chrome MCP]', message)
  }

  error(message: string): void {
    console.error('[Chrome MCP]', message)
  }
}

export const BROWSER_TOOLS: ChromeTools[] = [
  {
    name: 'chrome_navigate',
    description: 'Navigate to a URL in Chrome',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_evaluate',
    description: 'Execute JavaScript in the page context',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['script'],
    },
  },
  {
    name: 'chrome_click',
    description: 'Click an element by selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'chrome_type',
    description: 'Type text into an input element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
]

export class ClaudeForChromeContext {
  static create(options?: ChromeContextOptions): ClaudeForChromeContextImpl {
    return new ClaudeForChromeContextImpl(options)
  }
}

export class Logger extends LoggerImpl {}

export type PermissionMode = 'allow' | 'deny' | 'ask' | 'skip_all_permission_checks' | 'follow_a_plan'

export function createClaudeForChromeMcpServer(
  _options: any,
  _logger: Logger = new Logger()
): any {
  // Return MCP server configuration
  return {
    name: 'claude-for-chrome',
    version: '1.0.0',
    tools: BROWSER_TOOLS,
    context: ClaudeForChromeContext,
  }
}

// Check if Chrome is available
export async function isChromeAvailable(): Promise<boolean> {
  try {
    const ctx = new ClaudeForChromeContextImpl()
    const browser = await ctx.getBrowser()
    if (browser) {
      await browser.close()
      return true
    }
    return false
  } catch {
    return false
  }
}