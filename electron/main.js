const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

// Keep a global reference to prevent garbage collection
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Security: isolate renderer from Node.js
      nodeIntegration: false,    // Security: no direct Node access in renderer
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Vite dev server URL — retry loading until Vite is ready
    const loadDevServer = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(loadDevServer, 1000);
      });
    };
    loadDevServer();
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────

/**
 * fs:readDirectory — read a directory and return its entries.
 *
 * Input:  absolute filesystem path (string)
 * Output: { entries: [{ name, type }] } sorted folders-first, then alpha
 *         OR { error: string } on failure
 */
ipcMain.handle('fs:readDirectory', async (_event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const result = entries
      .filter((entry) => {
        // Skip hidden/system files on Windows that tend to cause issues
        return !entry.name.startsWith('$');
      })
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
      }))
      // Sort: folders first, then files, each group alphabetical
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    return { entries: result };
  } catch (err) {
    return { error: err.code === 'EPERM' || err.code === 'EACCES'
      ? 'Permission denied'
      : err.message };
  }
});

/**
 * fs:readFile — read a file's content and metadata.
 *
 * Returns: { content, size, extension, isBinary }
 * For binary or large files (>5MB), content is null.
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
  try {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
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
      result.content = await fs.readFile(filePath, 'utf-8');
    }

    return result;
  } catch (err) {
    return { error: err.code === 'EPERM' || err.code === 'EACCES'
      ? 'Permission denied'
      : err.message };
  }
});

/**
 * fs:getHomePath — return the user's home directory path.
 */
ipcMain.handle('fs:getHomePath', () => {
  return os.homedir();
});

/**
 * fs:openFile — open a file with the system's default application.
 */
ipcMain.handle('fs:openFile', async (_event, filePath) => {
  try {
    const result = await shell.openPath(filePath);
    // shell.openPath returns '' on success, error string on failure
    return result ? { error: result } : { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

/**
 * fs:getDrives — return available drive letters (Windows).
 * Probes A-Z and returns the ones that exist.
 */
ipcMain.handle('fs:getDrives', async () => {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    try {
      await fs.access(drivePath);
      drives.push(drivePath);
    } catch {
      // Drive doesn't exist, skip
    }
  }
  return drives;
});

// ─── App lifecycle ───────────────────────────────────────────────

app.whenReady().then(createWindow);

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

