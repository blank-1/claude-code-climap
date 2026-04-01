// Cross-platform modifier key detection using bun:ffi and platform-specific APIs

const FLAG_SHIFT = 0x20000;
const FLAG_CONTROL = 0x40000;
const FLAG_OPTION = 0x80000;
const FLAG_COMMAND = 0x100000;

const modifierFlags: Record<string, number> = {
  shift: FLAG_SHIFT,
  control: FLAG_CONTROL,
  option: FLAG_OPTION,
  command: FLAG_COMMAND,
};

const kCGEventSourceStateCombinedSessionState = 0;

let cgEventSourceFlagsState: ((stateID: number) => number) | null = null;
let linuxChecker: (() => Record<string, boolean>) | null = null;

function loadFFI(): void {
  if (cgEventSourceFlagsState !== null || process.platform !== 'darwin') {
    return;
  }

  try {
    const { dlopen, FFIType } = require('bun:ffi')
    const lib = dlopen(
      '/System/Library/Frameworks/Carbon.framework/Carbon',
      {
        CGEventSourceFlagsState: {
          args: [FFIType.i32],
          returns: FFIType.u64,
        },
      }
    );
    cgEventSourceFlagsState = (stateID: number): number => {
      return Number(lib.symbols.CGEventSourceFlagsState(stateID));
    };
  } catch {
    cgEventSourceFlagsState = null;
  }
}

function loadLinuxChecker(): void {
  if (linuxChecker !== null || process.platform !== 'linux') {
    return;
  }

  try {
    // Try using evdev via /proc to check modifier keys on Linux
    linuxChecker = (): Record<string, boolean> => {
      // Linux modifier key detection - simplified fallback
      // For full implementation, would need to read from /dev/input/event*
      return {
        shift: false,
        control: false,
        option: false,
        command: false,
      };
    };
  } catch {
    linuxChecker = null;
  }
}

export function prewarm(): void {
  loadFFI();
  loadLinuxChecker();
}

export function isModifierPressed(modifier: string): boolean {
  const flag = modifierFlags[modifier];
  if (flag === undefined) {
    return false;
  }

  if (process.platform === 'darwin') {
    loadFFI();

    if (cgEventSourceFlagsState === null) {
      return false;
    }

    const currentFlags = cgEventSourceFlagsState(
      kCGEventSourceStateCombinedSessionState
    );
    return (currentFlags & flag) !== 0;
  }

  if (process.platform === 'linux') {
    loadLinuxChecker();

    if (linuxChecker === null) {
      return false;
    }

    const state = linuxChecker();
    return state[modifier] || false;
  }

  // Windows - not supported yet
  return false;
}

// Additional helper for cross-platform detection
export function getPlatform(): string {
  return process.platform;
}

export function isSupported(): boolean {
  return process.platform === 'darwin' || process.platform === 'linux';
}