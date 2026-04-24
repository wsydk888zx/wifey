import { defaultContent } from '@wifey/story-content';
import { STORAGE_KEYS } from '@wifey/story-core';

function App() {
  return (
    <main className="admin-shell">
      <section className="admin-card">
        <div className="eyebrow">Admin App Scaffold</div>
        <h1>Story Workspace</h1>
        <p>
          This will become the desktop-only authoring surface. The current root-level admin panel
          remains untouched while we migrate its logic and UI into this app.
        </p>
        <div className="admin-grid">
          <article>
            <strong>Published content source</strong>
            <span>{defaultContent.prologue?.signoff || 'No signoff loaded yet.'}</span>
          </article>
          <article>
            <strong>Content edits key</strong>
            <span>{STORAGE_KEYS.content}</span>
          </article>
          <article>
            <strong>Flow map key</strong>
            <span>{STORAGE_KEYS.flow}</span>
          </article>
        </div>
      </section>
    </main>
  );
}

export default App;
