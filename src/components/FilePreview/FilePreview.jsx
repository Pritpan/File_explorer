import React from 'react';
import useTreeStore from '../../store/useTreeStore';

/**
 * Format bytes to human-readable size.
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * FilePreview — displays file content or folder grid in the right panel.
 *
 * File: header + text content with line numbers (or binary/large message).
 * Folder: header + icon grid of child entries.
 */
function FilePreview() {
  const {
    selectedPath, selectedNode,
    filePreview, fileLoading, fileError,
    folderContents, folderLoading, folderError,
  } = useTreeStore();

  // ─── Nothing selected ───
  if (!selectedPath) {
    return (
      <div className="flex-1 bg-base-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-txt-muted">
          <span className="text-5xl opacity-40">📁</span>
          <p className="text-sm">Select a file or folder to view its contents</p>
        </div>
      </div>
    );
  }

  const isFolder = selectedNode?.type === 'folder';
  const isFile = selectedNode?.type === 'file';
  const loading = isFolder ? folderLoading : fileLoading;
  const error = isFolder ? folderError : fileError;

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex-1 bg-base-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-txt-muted">
          <span className="w-6 h-6 border-2 border-txt-muted border-t-accent rounded-full animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex-1 bg-base-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-red-400">
          <span className="text-3xl">⚠</span>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Folder Grid View ───
  if (isFolder && folderContents !== null) {
    const folderCount = folderContents.filter((e) => e.type === 'folder').length;
    const fileCount = folderContents.filter((e) => e.type === 'file').length;
    const { folderTreePath, selectNode: select, toggleExpand, loadChildren } = useTreeStore.getState();

    const handleGridDoubleClick = async (entry) => {
      if (entry.type === 'folder') {
        // Navigate into the folder — update grid + expand in tree
        const childTreePath = folderTreePath ? `${folderTreePath}/${entry.name}` : entry.name;
        const childNode = {
          name: entry.name,
          type: 'folder',
          children: null,
          _fsPath: entry._fsPath,
        };
        // Expand in tree sidebar
        toggleExpand(childTreePath);
        if (entry._fsPath) {
          loadChildren(childTreePath, entry._fsPath);
        }
        // Update right panel to show this folder's contents
        select(childTreePath, childNode);
      } else if (entry.type === 'file' && entry._fsPath && window.electronAPI) {
        // Open file with default app
        await window.electronAPI.openFile(entry._fsPath);
      }
    };

    return (
      <div className="flex-1 bg-base-primary flex flex-col overflow-hidden">
        {/* Folder header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-base-secondary/50">
          <span className="text-lg">📁</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-txt-primary truncate">{selectedNode.name}</h2>
            <div className="flex items-center gap-3 text-[0.6875rem] text-txt-muted mt-0.5">
              <span>{folderContents.length} items</span>
              <span>{folderCount} folders</span>
              <span>{fileCount} files</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto scrollbar-thin p-4">
          {folderContents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-txt-muted">
              <span className="text-4xl opacity-40">📂</span>
              <p className="text-sm">This folder is empty</p>
            </div>
          ) : (
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {folderContents.map((entry) => (
                <div
                  key={entry.name}
                  onDoubleClick={() => handleGridDoubleClick(entry)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                             hover:bg-base-hover transition-colors duration-100
                             cursor-pointer select-none group"
                >
                  <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-100">
                    {entry.type === 'folder' ? '📁' : '📄'}
                  </span>
                  <span className="text-xs-custom text-txt-primary truncate leading-snug" title={entry.name}>
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── File Preview ───
  if (isFile && filePreview) {
    const { content, size, extension, isBinary, modifiedAt, name } = filePreview;
    const fsPath = selectedNode?._fsPath;

    const handleOpenExternal = async () => {
      if (!fsPath || !window.electronAPI) return;
      const result = await window.electronAPI.openFile(fsPath);
      if (result.error) {
        console.error('Failed to open file:', result.error);
      }
    };

    return (
      <div className="flex-1 bg-base-primary flex flex-col overflow-hidden">
        {/* File header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-base-secondary/50">
          <span className="text-lg">📄</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-txt-primary truncate">{name}</h2>
            <div className="flex items-center gap-3 text-[0.6875rem] text-txt-muted mt-0.5">
              {extension && (
                <span className="px-1.5 py-px rounded bg-base-surface text-txt-secondary font-mono uppercase text-[0.625rem]">
                  {extension}
                </span>
              )}
              <span>{formatSize(size)}</span>
              {modifiedAt && (
                <span>Modified {new Date(modifiedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          {/* Open externally button — always available when fsPath exists */}
          {fsPath && window.electronAPI && (
            <button
              onClick={handleOpenExternal}
              className="px-3 py-1.5 text-[0.6875rem] font-medium rounded-md
                         bg-accent/10 text-accent hover:bg-accent/20
                         transition-colors duration-150 flex-shrink-0 cursor-pointer"
            >
              Open ↗
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {content !== null ? (
            <div className="flex text-xs-custom font-mono leading-relaxed">
              {/* Line numbers */}
              <div className="sticky left-0 flex flex-col items-end px-3 py-4 bg-base-secondary/30 text-txt-muted select-none border-r border-border min-w-[3.5rem]">
                {content.split('\n').map((_, i) => (
                  <span key={i} className="leading-relaxed">{i + 1}</span>
                ))}
              </div>
              {/* Code content */}
              <pre className="flex-1 p-4 whitespace-pre overflow-x-auto text-txt-primary">
                {content}
              </pre>
            </div>
          ) : isBinary ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-txt-muted">
              <span className="text-5xl opacity-40">🔒</span>
              <div className="text-center">
                <p className="text-sm font-medium text-txt-secondary">Binary file</p>
                <p className="text-xs mt-1">{extension.toUpperCase()} • {formatSize(size)}</p>
              </div>
              {fsPath && window.electronAPI && (
                <button
                  onClick={handleOpenExternal}
                  className="px-5 py-2 text-sm font-medium rounded-lg
                             bg-accent text-base-primary hover:bg-accent-hover
                             transition-colors duration-150 cursor-pointer"
                >
                  Open with default app
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-txt-muted">
              <span className="text-5xl opacity-40">📦</span>
              <div className="text-center">
                <p className="text-sm font-medium text-txt-secondary">File too large</p>
                <p className="text-xs mt-1">{formatSize(size)} exceeds 5 MB preview limit</p>
              </div>
              {fsPath && window.electronAPI && (
                <button
                  onClick={handleOpenExternal}
                  className="px-5 py-2 text-sm font-medium rounded-lg
                             bg-accent text-base-primary hover:bg-accent-hover
                             transition-colors duration-150 cursor-pointer"
                >
                  Open with default app
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex-1 bg-base-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-txt-muted">
        <span className="text-5xl opacity-40">📁</span>
        <p className="text-sm">Select a file or folder to view its contents</p>
      </div>
    </div>
  );
}

export default FilePreview;
