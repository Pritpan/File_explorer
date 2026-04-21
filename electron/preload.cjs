const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process
// This is the ONLY bridge between React (frontend) and Node.js (backend)
contextBridge.exposeInMainWorld('electronAPI', {
  // Read a directory's entries (files + folders)
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),

  // Get user's home directory path
  getHomePath: () => ipcRenderer.invoke('fs:getHomePath'),

  // Get available drive letters (Windows)
  getDrives: () => ipcRenderer.invoke('fs:getDrives'),

  // Read a file's content and metadata
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // Open a file with the system's default application
  openFile: (filePath) => ipcRenderer.invoke('fs:openFile', filePath),

  // Placeholder for S3 (Step 4):
  // getS3Files: (bucket, prefix) => ipcRenderer.invoke('s3:listObjects', bucket, prefix),
});
