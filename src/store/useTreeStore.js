import { create } from 'zustand';
// import { mockCloudTree } from '../data/mockData';  // DISABLED — Re-enable for Step 4 (AWS S3)
import { searchTree } from '../utils/searchTree';

/**
 * Zustand store for the file tree.
 *
 * KEY CHANGE (Step 3): Local root now uses REAL filesystem data.
 * Children are lazy-loaded — a folder starts with children: null,
 * and we fetch from the main process via IPC when the user expands it.
 *
 * Cloud root stays as mock data (will be replaced in Step 4 with S3).
 */
const useTreeStore = create((set, get) => ({
  // Tree data — Local root loaded from filesystem
  // Cloud (S3) root is disabled. Re-enable for Step 4 (AWS S3 integration).
  treeData: [
    {
      name: 'Local',
      type: 'folder',
      children: null,     // null = not loaded yet (lazy)
      _fsPath: null,      // actual filesystem path, set on init
    },
    // mockCloudTree,  // DISABLED — Re-enable for Step 4
  ],

  // Tracks which folders are expanded
  expandedPaths: new Set(),

  // Currently selected node's path
  selectedPath: null,

  // Search state
  searchQuery: '',
  matchedPaths: new Set(),
  visiblePaths: new Set(),

  // Snapshot of expanded paths before search started
  _preSearchExpanded: null,

  // Loading & error tracking
  loadingPaths: new Set(),    // paths currently being fetched
  errorPaths: new Map(),      // path → error message

  // Selected node info (for right panel)
  selectedNode: null,         // the full node object
  
  // File preview state
  filePreview: null,          // { content, size, extension, isBinary, modifiedAt, name }
  fileLoading: false,
  fileError: null,

  // Folder preview state
  folderContents: null,       // [{ name, type, _fsPath }] for the selected folder
  folderLoading: false,
  folderError: null,
  folderParentPath: null,     // _fsPath of the currently viewed folder
  folderTreePath: null,       // tree path of the currently viewed folder

  // ─── Actions ────────────────────────────────────────────────

  /**
   * Initialize the Local root — detect drives and create one root per drive.
   * Falls back to mock data when running outside Electron (browser-only).
   */
  initLocalRoot: async () => {
    if (!window.electronAPI) {
      const { mockLocalTree } = await import('../data/mockData');
      set((state) => {
        const newTree = [...state.treeData];
        newTree[0] = mockLocalTree;
        return { treeData: newTree };
      });
      return;
    }

    try {
      const drives = await window.electronAPI.getDrives();

      // Create one root node per drive (e.g. "C:\", "D:\")
      const driveNodes = drives.map((drivePath) => ({
        name: drivePath.replace('\\', ''),  // "C:" display name
        type: 'folder',
        children: null,
        _fsPath: drivePath,
      }));

      set(() => {
        // Replace the Local placeholder with drive nodes
        // Cloud (S3) disabled — re-enable here for Step 4
        return { treeData: driveNodes };
      });
    } catch (err) {
      console.error('Failed to init drives:', err);
    }
  },

  /**
   * Load children for a folder from the real filesystem.
   *
   * @param {string} treePath  — tree path (e.g. "Local/Documents")
   * @param {string} fsPath    — absolute filesystem path
   */
  loadChildren: async (treePath, fsPath) => {
    const state = get();

    // Don't double-load
    if (state.loadingPaths.has(treePath)) return;

    // Mark as loading
    set((s) => {
      const next = new Set(s.loadingPaths);
      next.add(treePath);
      const nextErrors = new Map(s.errorPaths);
      nextErrors.delete(treePath);
      return { loadingPaths: next, errorPaths: nextErrors };
    });

    try {
      const result = await window.electronAPI.readDirectory(fsPath);

      if (result.error) {
        // Store error and clear loading
        set((s) => {
          const next = new Set(s.loadingPaths);
          next.delete(treePath);
          const nextErrors = new Map(s.errorPaths);
          nextErrors.set(treePath, result.error);
          return { loadingPaths: next, errorPaths: nextErrors };
        });
        return;
      }

      // Convert entries to tree nodes with lazy children for folders
      const children = result.entries.map((entry) => ({
        name: entry.name,
        type: entry.type,
        children: entry.type === 'folder' ? null : undefined,
        _fsPath: fsPath + (fsPath.endsWith('\\') || fsPath.endsWith('/') ? '' : '\\') + entry.name,
      }));

      // Splice children into the tree at treePath
      set((s) => {
        const newTree = structuredClone(s.treeData);
        const node = findNodeByPath(newTree, treePath);
        if (node) {
          node.children = children;
        }
        const next = new Set(s.loadingPaths);
        next.delete(treePath);
        return { treeData: newTree, loadingPaths: next };
      });
    } catch (err) {
      set((s) => {
        const next = new Set(s.loadingPaths);
        next.delete(treePath);
        const nextErrors = new Map(s.errorPaths);
        nextErrors.set(treePath, err.message);
        return { loadingPaths: next, errorPaths: nextErrors };
      });
    }
  },

  toggleExpand: (path) => {
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedPaths: next };
    });
  },

  isExpanded: (path) => {
    return get().expandedPaths.has(path);
  },

  selectNode: (path, node) => {
    set({ selectedPath: path, selectedNode: node || null });

    if (!node) return;

    if (node.type === 'file') {
      // Clear folder state, load file
      set({ folderContents: null, folderLoading: false, folderError: null });
      get().loadFileContent(node._fsPath || null, node.name);
    } else if (node.type === 'folder') {
      // Clear file state, load folder contents
      set({ filePreview: null, fileLoading: false, fileError: null });
      get().loadFolderContents(path, node);
    }
  },

  /**
   * Load folder contents for the right-panel grid view.
   */
  loadFolderContents: async (treePath, node) => {
    const parentFsPath = node._fsPath || null;

    // If children are already loaded in the tree, use them directly
    if (node.children && node.children.length > 0) {
      set({
        folderContents: node.children.map((c) => ({
          name: c.name,
          type: c.type,
          _fsPath: c._fsPath || (parentFsPath ? `${parentFsPath}${parentFsPath.endsWith('\\') ? '' : '\\'}${c.name}` : null),
        })),
        folderLoading: false,
        folderError: null,
        folderParentPath: parentFsPath,
        folderTreePath: treePath,
      });
      return;
    }

    // If children are null (not loaded yet) and we have a fsPath, fetch
    if (parentFsPath && window.electronAPI) {
      set({ folderLoading: true, folderError: null, folderContents: null });
      try {
        const result = await window.electronAPI.readDirectory(parentFsPath);
        if (result.error) {
          set({ folderLoading: false, folderError: result.error });
          return;
        }
        set({
          folderContents: result.entries.map((e) => ({
            ...e,
            _fsPath: `${parentFsPath}${parentFsPath.endsWith('\\') ? '' : '\\'}${e.name}`,
          })),
          folderLoading: false,
          folderError: null,
          folderParentPath: parentFsPath,
          folderTreePath: treePath,
        });
      } catch (err) {
        set({ folderLoading: false, folderError: err.message });
      }
      return;
    }

    // Empty folder or browser mode with no children
    set({
      folderContents: [],
      folderLoading: false,
      folderError: null,
      folderParentPath: parentFsPath,
      folderTreePath: treePath,
    });
  },

  /**
   * Load a file's content via IPC for the preview panel.
   */
  loadFileContent: async (fsPath, name) => {
    if (!window.electronAPI) {
      set({
        filePreview: { content: '// File preview not available in browser mode', size: 0, extension: '', isBinary: false, name },
        fileLoading: false,
        fileError: null,
      });
      return;
    }

    set({ fileLoading: true, fileError: null });

    try {
      const result = await window.electronAPI.readFile(fsPath);

      if (result.error) {
        set({ fileLoading: false, fileError: result.error, filePreview: null });
        return;
      }

      set({
        filePreview: { ...result, name },
        fileLoading: false,
        fileError: null,
      });
    } catch (err) {
      set({ fileLoading: false, fileError: err.message, filePreview: null });
    }
  },

  setSearch: (query) => {
    const state = get();
    const preSearch = state._preSearchExpanded ?? new Set(state.expandedPaths);

    if (!query || query.trim() === '') {
      set({
        searchQuery: '',
        matchedPaths: new Set(),
        visiblePaths: new Set(),
        expandedPaths: preSearch,
        _preSearchExpanded: null,
      });
      return;
    }

    const { matchedPaths, expandPaths } = searchTree(state.treeData, query);
    const visiblePaths = new Set([...matchedPaths, ...expandPaths]);

    set({
      searchQuery: query,
      matchedPaths,
      visiblePaths,
      expandedPaths: expandPaths,
      _preSearchExpanded: preSearch,
    });
  },

  clearSearch: () => {
    const preSearch = get()._preSearchExpanded;
    set({
      searchQuery: '',
      matchedPaths: new Set(),
      visiblePaths: new Set(),
      expandedPaths: preSearch ?? new Set(),
      _preSearchExpanded: null,
    });
  },
}));

/**
 * Walk the treeData array to find a node by its tree path.
 * e.g. "Local/Documents/Projects" → root[0].children[?].children[?]
 */
function findNodeByPath(roots, treePath) {
  const parts = treePath.split('/');
  let current = roots.find((r) => r.name === parts[0]);
  for (let i = 1; i < parts.length; i++) {
    if (!current || !current.children) return null;
    current = current.children.find((c) => c.name === parts[i]);
  }
  return current;
}

export default useTreeStore;

