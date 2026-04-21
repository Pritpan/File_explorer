import React, { memo, useCallback } from 'react';
import useTreeStore from '../../store/useTreeStore';

/**
 * TreeNode — a single node (file or folder), renders recursively.
 *
 * LAZY LOADING (Step 3):
 * When a folder has children === null, it hasn't been loaded yet.
 * On expand, we call loadChildren() which fetches from the filesystem
 * via IPC, then React re-renders with the real children.
 *
 * SEARCH HIGHLIGHTING:
 * Matched nodes get a colored left border + <mark> substring emphasis.
 *
 * PERFORMANCE: Wrapped in React.memo.
 */
function TreeNode({ node, depth, path, isSearchResult }) {
  const {
    expandedPaths, toggleExpand, selectNode, selectedPath,
    matchedPaths, visiblePaths, searchQuery,
    loadChildren, loadingPaths, errorPaths,
  } = useTreeStore();

  const isFolder = node.type === 'folder';
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;
  const isMatched = matchedPaths.has(path);
  const isLoading = loadingPaths.has(path);
  const error = errorPaths.get(path);
  const isNotLoaded = isFolder && node.children === null;
  const hasChildren = isFolder && node.children && node.children.length > 0;
  const isSearchActive = searchQuery && searchQuery.trim().length > 0;

  // During search: filter children to only show visible (matched + ancestors)
  const visibleChildren = hasChildren && isSearchActive
    ? node.children.filter((child) => visiblePaths.has(`${path}/${child.name}`))
    : (hasChildren ? node.children : []);

  const isEmpty = isFolder && !isNotLoaded && !isLoading && visibleChildren.length === 0;

  const handleClick = useCallback(() => {
    selectNode(path, node);
    if (isFolder) {
      if (node.children === null && node._fsPath) {
        loadChildren(path, node._fsPath);
      }
      toggleExpand(path);
    }
  }, [path, isFolder, node, selectNode, toggleExpand, loadChildren]);

  /**
   * Highlight the matching substring inside the node name.
   */
  const renderName = () => {
    if (!isMatched || !searchQuery) {
      return node.name;
    }

    const lowerName = node.name.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const parts = [];
    let cursor = 0;

    while (cursor < node.name.length) {
      const idx = lowerName.indexOf(lowerQuery, cursor);
      if (idx === -1) {
        parts.push(node.name.slice(cursor));
        break;
      }
      if (idx > cursor) {
        parts.push(node.name.slice(cursor, idx));
      }
      parts.push(
        <mark
          key={idx}
          className="bg-match-bg text-match-text rounded-sm px-px font-semibold"
          style={{ textDecoration: 'none' }}
        >
          {node.name.slice(idx, idx + searchQuery.length)}
        </mark>
      );
      cursor = idx + searchQuery.length;
    }

    return parts;
  };

  return (
    <li className={`list-none ${isSearchResult ? 'animate-slide-down' : ''}`}>
      {/* Node row */}
      <div
        className={`
          flex items-center gap-1 py-[3px] px-2 cursor-pointer select-none
          rounded mx-1 min-h-[28px]
          transition-all duration-150 ease-in-out
          hover:bg-base-hover
          focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent focus-visible:-outline-offset-1
          ${isSelected ? 'bg-base-active text-accent' : ''}
          ${isMatched ? 'border-l-2 border-l-accent bg-accent/[0.06]' : 'border-l-2 border-l-transparent'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Chevron / spinner */}
        {isFolder ? (
          isLoading ? (
            <span className="inline-flex items-center justify-center w-4 h-4 flex-shrink-0">
              <span className="w-3 h-3 border-2 border-txt-muted border-t-accent rounded-full animate-spin" />
            </span>
          ) : (
            <span className={`
              inline-flex items-center justify-center w-4 h-4 text-sm text-txt-muted
              transition-transform duration-100 ease-in-out flex-shrink-0
              ${isExpanded ? 'rotate-90' : ''}
            `}>
              ›
            </span>
          )
        ) : (
          <span className="inline-flex w-4 h-4 flex-shrink-0 invisible">›</span>
        )}

        {/* Icon */}
        <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-sm flex-shrink-0">
          {isFolder ? (isEmpty ? '📂' : '📁') : '📄'}
        </span>

        {/* Name */}
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs-custom leading-snug" title={node.name}>
          {renderName()}
        </span>

        {/* Empty badge */}
        {isEmpty && (
          <span className="text-[0.625rem] px-[5px] py-px rounded-lg font-medium flex-shrink-0 bg-base-surface text-txt-muted border border-border">
            empty
          </span>
        )}
      </div>

      {/* Error state */}
      {isFolder && isExpanded && error && (
        <div
          className="flex items-center gap-1.5 py-1 text-[0.6875rem] text-red-400 opacity-80"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Recursion: render children if folder is expanded */}
      {isFolder && isExpanded && visibleChildren.length > 0 && (
        <ul className="list-none p-0 m-0 relative" role="group">
          {/* Nesting guide line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-border opacity-50"
            style={{ left: `${depth * 16 + 20}px` }}
          />
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              path={`${path}/${child.name}`}
              isSearchResult
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default memo(TreeNode);
