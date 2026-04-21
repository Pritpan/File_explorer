import React, { useState, useRef, useEffect } from 'react';
import useTreeStore from '../../store/useTreeStore';

/**
 * SearchBar — debounced search input for the file tree.
 *
 * DEBOUNCE: We wait 300ms after the user stops typing before
 * triggering the search. This prevents DFS from firing on every
 * keystroke, which would cause flicker for large trees.
 */
function SearchBar() {
  const { searchQuery, setSearch, clearSearch, matchedPaths } = useTreeStore();
  const [localValue, setLocalValue] = useState(searchQuery);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Sync local value if store clears externally
  useEffect(() => {
    if (searchQuery === '' && localValue !== '') {
      setLocalValue('');
    }
  }, [searchQuery]);

  const handleChange = (e) => {
    const value = e.target.value;
    setLocalValue(value);

    // Clear previous debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setLocalValue('');
    clearSearch();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  const matchCount = matchedPaths.size;
  const hasQuery = localValue.trim().length > 0;

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="relative flex items-center">
        {/* Search icon */}
        <span className="absolute left-2.5 text-txt-muted text-sm pointer-events-none">
          🔍
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          id="tree-search-input"
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search files…"
          className="
            w-full pl-8 pr-16 py-[6px] rounded-md
            bg-base-surface text-txt-primary text-xs-custom
            border border-border
            placeholder:text-txt-muted
            outline-none
            focus:border-accent focus:ring-1 focus:ring-accent/30
            transition-colors duration-150
          "
          aria-label="Search files"
        />

        {/* Right side: match count + clear button */}
        {hasQuery && (
          <div className="absolute right-2 flex items-center gap-1.5">
            <span className="text-[0.625rem] text-txt-muted tabular-nums">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
            <button
              onClick={handleClear}
              className="
                flex items-center justify-center w-[18px] h-[18px]
                rounded text-txt-muted text-xs
                hover:bg-base-hover hover:text-txt-primary
                transition-colors duration-100
              "
              aria-label="Clear search"
              title="Clear (Esc)"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchBar;
