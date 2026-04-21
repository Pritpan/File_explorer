import React, { useEffect } from 'react';
import TreeNode from './TreeNode';
import SearchBar from '../SearchBar/SearchBar';
import useTreeStore from '../../store/useTreeStore';

/**
 * TreeView — root container for the file tree.
 * On mount, initializes the Local root by reading the user's home directory.
 */
function TreeView() {
  const treeData = useTreeStore((state) => state.treeData);
  const initLocalRoot = useTreeStore((state) => state.initLocalRoot);

  // Load real filesystem on mount
  useEffect(() => {
    initLocalRoot();
  }, [initLocalRoot]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <SearchBar />

      {/* Explorer header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs-custom font-semibold uppercase tracking-wider text-txt-secondary">
          Explorer
        </span>
      </div>

      {/* Tree root */}
      <nav aria-label="File tree" className="flex-1 overflow-y-auto">
        <ul className="list-none py-1" role="tree">
          {treeData.map((rootNode) => (
            <TreeNode
              key={rootNode.name}
              node={rootNode}
              depth={0}
              path={rootNode.name}
            />
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default TreeView;
