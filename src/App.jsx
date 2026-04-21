import React from 'react';
import TreeView from './components/TreeView/TreeView';
import FilePreview from './components/FilePreview/FilePreview';

function App() {
  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Header — draggable region for Electron window */}
      <header className="h-12 bg-base-secondary border-b border-border flex items-center px-4 select-none"
              style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">📂</span>
          <h1 className="text-base font-semibold text-txt-primary tracking-tight">File Explorer</h1>
        </div>
      </header>

      {/* Main layout: sidebar + content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar with tree */}
        <aside className="w-[300px] min-w-[200px] max-w-[500px] bg-base-secondary border-r border-border overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
          <TreeView />
        </aside>

        {/* Content area — file preview */}
        <FilePreview />
      </main>
    </div>
  );
}

export default App;
