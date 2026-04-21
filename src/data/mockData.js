/**
 * Mock tree data following the unified data model:
 * { name: string, type: "file" | "folder", children?: Node[] }
 *
 * Two root nodes: "Local" (simulates local file system) and "Cloud" (simulates S3).
 * In later steps, this gets replaced by real data from fs/S3.
 */

export const mockLocalTree = {
  name: 'Local',
  type: 'folder',
  children: [
    {
      name: 'Documents',
      type: 'folder',
      children: [
        {
          name: 'Projects',
          type: 'folder',
          children: [
            { name: 'todo-app', type: 'folder', children: [
              { name: 'index.html', type: 'file' },
              { name: 'style.css', type: 'file' },
              { name: 'app.js', type: 'file' },
              { name: 'README.md', type: 'file' },
            ]},
            { name: 'notes.txt', type: 'file' },
          ],
        },
        { name: 'resume.pdf', type: 'file' },
        { name: 'cover-letter.docx', type: 'file' },
      ],
    },
    {
      name: 'Pictures',
      type: 'folder',
      children: [
        {
          name: 'Vacation',
          type: 'folder',
          children: [
            { name: 'beach.jpg', type: 'file' },
            { name: 'sunset.png', type: 'file' },
          ],
        },
        { name: 'profile.png', type: 'file' },
      ],
    },
    {
      name: 'Downloads',
      type: 'folder',
      children: [],  // Empty folder — edge case
    },
    { name: 'config.json', type: 'file' },
    { name: '.gitignore', type: 'file' },
  ],
};

export const mockCloudTree = {
  name: 'Cloud (S3)',
  type: 'folder',
  children: [
    {
      name: 'backups',
      type: 'folder',
      children: [
        { name: 'db-dump-2025.sql', type: 'file' },
        { name: 'db-dump-2024.sql', type: 'file' },
      ],
    },
    {
      name: 'assets',
      type: 'folder',
      children: [
        {
          name: 'images',
          type: 'folder',
          children: [
            { name: 'logo.svg', type: 'file' },
            { name: 'banner.png', type: 'file' },
          ],
        },
        { name: 'fonts', type: 'folder', children: [] },
      ],
    },
    { name: 'README.md', type: 'file' },
  ],
};
