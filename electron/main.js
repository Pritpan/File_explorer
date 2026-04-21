import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import { join, extname, dirname, normalize, resolve } from 'path';
import { readdir, stat as _stat, readFile, access } from 'fs/promises';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference to prevent garbage collection
let mainWindow = null;

// ─── Path Validation (Security) ─────────────────────────────────
// Block access to sensitive system locations
const BLOCKED_PATHS_WIN = [
  'C:\\Windows',
  'C:\\Program Files\\WindowsApps',
  'C:\\ProgramData\\Microsoft',
];

const BLOCKED_PATHS_UNIX = [
  '/proc', '/sys', '/dev', '/boot',
];

/**
 * Validate that a path is safe to access.
 * Rejects path traversal attacks and blocks sensitive system directories.
 */
function isPathSafe(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') return false;

  const normalized = normalize(resolve(inputPath));
  const blocked = platform() === 'win32' ? BLOCKED_PATHS_WIN : BLOCKED_PATHS_UNIX;

  for (const blocked_dir of blocked) {
    if (normalized.toLowerCase().startsWith(blocked_dir.toLowerCase())) {
      return false;
    }
  }
  return true;
}

// ─── Window Creation ─────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0b1120',    // Match app theme — no white flash
    icon: join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    const loadDevServer = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(loadDevServer, 1000);
      });
    };
    loadDevServer();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Content Security Policy ─────────────────────────────────────

app.whenReady().then(() => {
  // Set CSP headers for all requests (production security)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
        ],
      },
    });
  });

  createWindow();
});

// ─── IPC Handlers ────────────────────────────────────────────────

/**
 * fs:readDirectory — read a directory and return its entries.
 */
ipcMain.handle('fs:readDirectory', async (_event, dirPath) => {
  if (!isPathSafe(dirPath)) {
    return { error: 'Access denied: this path is restricted.' };
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    const result = entries
      .filter((entry) => {
        // Skip hidden/system files on Windows
        return !entry.name.startsWith('$');
      })
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    return { entries: result };
  } catch (err) {
    return {
      error: err.code === 'EPERM' || err.code === 'EACCES'
        ? 'Permission denied'
        : err.message
    };
  }
});

/**
 * fs:readFile — read a file's content and metadata.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'bin', 'iso', 'img', 'zip', 'rar', '7z', 'tar', 'gz',
  'mp3', 'mp4', 'avi', 'mkv', 'mov', 'wav', 'flac',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'svg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
]);

ipcMain.handle('fs:readFile', async (_event, filePath) => {
  if (!isPathSafe(filePath)) {
    return { error: 'Access denied: this path is restricted.' };
  }

  try {
    const stat = await _stat(filePath);
    const ext = extname(filePath).slice(1).toLowerCase();
    const isBinary = BINARY_EXTENSIONS.has(ext);
    const isTooBig = stat.size > MAX_FILE_SIZE;

    const result = {
      size: stat.size,
      extension: ext,
      isBinary,
      modifiedAt: stat.mtime.toISOString(),
      content: null,
    };

    if (!isBinary && !isTooBig) {
      result.content = await readFile(filePath, 'utf-8');
    }

    return result;
  } catch (err) {
    return {
      error: err.code === 'EPERM' || err.code === 'EACCES'
        ? 'Permission denied'
        : err.message
    };
  }
});

/**
 * fs:getHomePath — return the user's home directory path.
 */
ipcMain.handle('fs:getHomePath', () => {
  return homedir();
});

/**
 * fs:openFile — open a file with the system's default application.
 */
ipcMain.handle('fs:openFile', async (_event, filePath) => {
  if (!isPathSafe(filePath)) {
    return { error: 'Access denied: this path is restricted.' };
  }

  try {
    const result = await shell.openPath(filePath);
    return result ? { error: result } : { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

/**
 * fs:getDrives — return available root paths.
 * Windows: probes A-Z drive letters.
 * macOS/Linux: returns root (/) and home directory.
 */
ipcMain.handle('fs:getDrives', async () => {
  if (platform() === 'win32') {
    // Windows: probe drive letters A-Z
    const drives = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drivePath = `${letter}:\\`;
      try {
        await access(drivePath);
        drives.push(drivePath);
      } catch {
        // Drive doesn't exist, skip
      }
    }
    return drives;
  } else {
    // macOS / Linux: return root and home
    const home = homedir();
    return ['/', home];
  }
});

// ─── App lifecycle ───────────────────────────────────────────────

// macOS: re-create window when dock icon clicked and no windows open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
