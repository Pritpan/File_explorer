/**
 * DFS search across the tree.
 *
 * HOW IT WORKS:
 * 1. Recursively walk every node using DFS (pre-order traversal).
 * 2. For each node whose name contains the query (case-insensitive),
 *    mark it as a match and collect every ancestor path so the UI
 *    can auto-expand the folders that lead to it.
 *
 * RETURNS:
 *   { matchedPaths: Set<string>, expandPaths: Set<string> }
 *
 * TIME COMPLEXITY:  O(n) — visits every node exactly once.
 * SPACE COMPLEXITY: O(h) call-stack depth  +  O(m × h) for stored paths,
 *                   where h = tree height, m = number of matches.
 */
export function searchTree(roots, query) {
  const matchedPaths = new Set();
  const expandPaths = new Set();

  if (!query || query.trim() === '') {
    return { matchedPaths, expandPaths };
  }

  const lowerQuery = query.toLowerCase();

  /**
   * Inner DFS.
   * @param {Object}   node       — current tree node
   * @param {string}   path       — full path to this node (e.g. "Local/Documents")
   * @param {string[]} ancestors  — paths of every ancestor above this node
   * @returns {boolean} true if this subtree contains at least one match
   */
  function dfs(node, path, ancestors) {
    let subtreeHasMatch = false;

    // Check current node name against query
    const isMatch = node.name.toLowerCase().includes(lowerQuery);

    if (isMatch) {
      matchedPaths.add(path);
      subtreeHasMatch = true;
    }

    // Recurse into children (folders only)
    if (node.type === 'folder' && node.children) {
      for (const child of node.children) {
        const childPath = `${path}/${child.name}`;
        const childMatched = dfs(child, childPath, [...ancestors, path]);
        if (childMatched) subtreeHasMatch = true;
      }
    }

    // If anything in this subtree matched, expand all ancestors + this node
    if (subtreeHasMatch) {
      for (const ancestorPath of ancestors) {
        expandPaths.add(ancestorPath);
      }
      // Expand this node itself if it's a folder (to reveal matched children)
      if (node.type === 'folder') {
        expandPaths.add(path);
      }
    }

    return subtreeHasMatch;
  }

  // Kick off DFS from each root
  for (const root of roots) {
    dfs(root, root.name, []);
  }

  return { matchedPaths, expandPaths };
}
