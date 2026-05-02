import {
  STORAGE_KEYS,
  TWEAK_DEFAULTS,
  normalizeContentModel,
  validateStoryExport,
} from '@wifey/story-core';

export const MAX_ADMIN_SNAPSHOTS = 10;

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeFlowMap(flowMap) {
  if (flowMap && typeof flowMap === 'object') return deepClone(flowMap);
  return { rules: [] };
}

function normalizeIntensity(value) {
  const intensity = Number(value);
  if (!Number.isFinite(intensity)) return TWEAK_DEFAULTS.intensity;
  return Math.min(10, Math.max(1, Math.round(intensity)));
}

export function normalizeAdminTweaks(tweaks = {}) {
  const source = tweaks && typeof tweaks === 'object' ? tweaks : {};

  return {
    herName: Object.hasOwn(source, 'herName')
      ? String(source.herName ?? '')
      : TWEAK_DEFAULTS.herName,
    hisName: Object.hasOwn(source, 'hisName')
      ? String(source.hisName ?? '')
      : TWEAK_DEFAULTS.hisName,
    intensity: normalizeIntensity(source.intensity),
  };
}

export function createDefaultAdminTweaks() {
  return normalizeAdminTweaks(TWEAK_DEFAULTS);
}

export function createDefaultAdminDraft(defaultContent, defaultFlowMap) {
  return {
    content: normalizeContentModel(defaultContent),
    flowMap: normalizeFlowMap(defaultFlowMap),
    snapshots: [],
    tweaks: createDefaultAdminTweaks(),
    sourceLabel: 'Package defaults',
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// SUPABASE-BACKED STORAGE
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Load admin draft from Supabase.
 * Fetches the unpublished (draft) story, or falls back to defaults.
 */
export async function loadAdminDraft(supabase, defaultContent, defaultFlowMap) {
  const fallback = createDefaultAdminDraft(defaultContent, defaultFlowMap);

  if (!supabase) return fallback;

  try {
    // Fetch the draft story (is_published = false)
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('is_published', false)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading draft:', error);
      return fallback;
    }

    if (!stories || stories.length === 0) {
      return fallback;
    }

    const story = stories[0];
    return {
      content: normalizeContentModel(story.days ? { days: story.days, prologue: story.prologue } : defaultContent),
      flowMap: normalizeFlowMap(story.flow_map),
      snapshots: [], // Snapshots are in story_versions table, loaded separately if needed
      tweaks: createDefaultAdminTweaks(),
      sourceLabel: `Supabase draft (updated ${new Date(story.updated_at).toLocaleString()})`,
      storyId: story.id,
    };
  } catch (err) {
    console.error('Error loading admin draft:', err);
    return fallback;
  }
}

/**
 * Save admin draft to Supabase.
 * Updates the unpublished story record.
 */
export async function saveAdminDraft(supabase, draft) {
  if (!supabase) return;

  try {
    const storyId = draft.storyId;

    const updateData = {
      prologue: draft.content.prologue,
      days: draft.content.days,
      flow_map: normalizeFlowMap(draft.flowMap),
      updated_at: new Date().toISOString(),
      change_notes: `Auto-saved at ${new Date().toLocaleTimeString()}`,
    };

    if (storyId) {
      // Update existing draft — use .select('id') so we can detect 0-row silent failures
      const { data: updated, error } = await supabase
        .from('stories')
        .update(updateData)
        .eq('id', storyId)
        .eq('is_published', false)
        .select('id');

      if (error) {
        console.error('Error saving draft:', error);
        throw error;
      }

      if (updated && updated.length > 0) {
        // Successfully updated the existing draft row
        return null;
      }

      // 0 rows matched: the draft row was published or deleted (publish race condition).
      // Fall through to INSERT a new draft so content is never silently lost.
      console.warn('[saveAdminDraft] UPDATE matched 0 rows for storyId', storyId, '— draft may have been published. Creating new draft row.');
    }

    // Create new draft (storyId was undefined, or UPDATE matched 0 rows above)
    const { data, error: insertError } = await supabase
      .from('stories')
      .insert([{ ...updateData, is_published: false }])
      .select('id');

    if (insertError) {
      console.error('Error creating draft:', insertError);
      throw insertError;
    }

    if (data && data[0]) {
      return { newStoryId: data[0].id };
    }
  } catch (err) {
    console.error('Error in saveAdminDraft:', err);
    throw err;
  }
  return null;
}

/**
 * Publish the current draft to make it live.
 * Creates an immutable version in story_versions and sets is_published = true.
 */
export async function publishStory(supabase, draft, changeNotes = '') {
  if (!supabase || !draft.storyId) {
    throw new Error('Cannot publish: no story ID');
  }

  try {
    // Get the current draft version
    const { data: stories, error: fetchError } = await supabase
      .from('stories')
      .select('*')
      .eq('id', draft.storyId)
      .eq('is_published', false)
      .single();

    if (fetchError) throw fetchError;

    const story = stories;
    const newVersionNumber = (story.version_number || 0) + 1;

    // Create immutable version record
    const { data: versionData, error: versionError } = await supabase
      .from('story_versions')
      .insert([
        {
          story_id: story.id,
          prologue: story.prologue,
          days: story.days,
          flow_map: story.flow_map,
          version_number: newVersionNumber,
          change_notes: changeNotes || 'Published version',
          is_published_version: true,
          published_at: new Date().toISOString(),
        },
      ])
      .select();

    if (versionError) throw versionError;

    // Unpublish all previously published rows
    const { error: unpublishError } = await supabase
      .from('stories')
      .update({ is_published: false })
      .eq('is_published', true);

    if (unpublishError) throw unpublishError;

    // Mark this draft as the new published story
    const publishedAt = new Date().toISOString();
    const { error: publishError } = await supabase
      .from('stories')
      .update({
        is_published: true,
        published_at: publishedAt,
        version_number: newVersionNumber,
      })
      .eq('id', story.id);

    if (publishError) throw publishError;

    // Create a fresh draft so the admin always has a working draft after publishing
    const { data: newDraft, error: draftError } = await supabase
      .from('stories')
      .insert([{
        prologue: story.prologue,
        days: story.days,
        flow_map: story.flow_map,
        is_published: false,
        version_number: newVersionNumber,
        change_notes: `Draft after publish at ${new Date().toLocaleTimeString()}`,
      }])
      .select();

    if (draftError) throw draftError;

    return {
      versionId: versionData[0]?.id,
      versionNumber: newVersionNumber,
      publishedAt,
      newDraftId: newDraft[0]?.id,
    };
  } catch (err) {
    console.error('Error publishing story:', err);
    throw err;
  }
}

/**
 * Get all published versions for rollback/history.
 */
export async function getStoryVersions(supabase, storyId) {
  if (!supabase || !storyId) return [];

  try {
    const { data, error } = await supabase
      .from('story_versions')
      .select('*')
      .eq('story_id', storyId)
      .eq('is_published_version', true)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Error fetching versions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getStoryVersions:', err);
    return [];
  }
}

/**
 * Rollback to a previous published version.
 * Creates a new draft from the selected version.
 */
export async function rollbackToVersion(supabase, versionId) {
  if (!supabase || !versionId) {
    throw new Error('Cannot rollback: no version ID');
  }

  try {
    // Fetch the version to restore
    const { data: version, error: versionError } = await supabase
      .from('story_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError) throw versionError;

    // Create new draft from this version
    const { data: newStory, error: createError } = await supabase
      .from('stories')
      .insert([
        {
          prologue: version.prologue,
          days: version.days,
          flow_map: version.flow_map,
          is_published: false,
          version_number: version.version_number,
          change_notes: `Rolled back to version ${version.version_number}`,
        },
      ])
      .select();

    if (createError) throw createError;

    return {
      storyId: newStory[0]?.id,
      versionNumber: version.version_number,
    };
  } catch (err) {
    console.error('Error rolling back to version:', err);
    throw err;
  }
}

/**
 * Create an admin snapshot (local/browser storage for quick iteration).
 * Kept for backward compatibility with local snapshot workflow.
 */
export function createAdminSnapshot({ content, flowMap }, name) {
  const timestamp = new Date().toISOString();

  return {
    id: `snapshot-${Date.now()}`,
    name: name?.trim() || `Snapshot ${new Date(timestamp).toLocaleString()}`,
    timestamp,
    content: normalizeContentModel(content),
    flowMap: normalizeFlowMap(flowMap),
  };
}

/**
 * Download admin export as JSON file.
 * Same as before - for backup/sharing.
 */
export function downloadAdminExport(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse admin import from JSON file.
 * Same as before - for importing backups.
 */
export function parseAdminImport(source, fallbackFlowMap) {
  const contentSource =
    source?.content && typeof source.content === 'object' ? source.content : source;
  const flowMap = normalizeFlowMap(
    source?.flowMap || contentSource?.defaultFlowMap || fallbackFlowMap,
  );
  const content = normalizeContentModel(contentSource);
  const validation = validateStoryExport({ content, flowMap });

  return {
    content,
    flowMap,
    validation,
  };
}

/**
 * Create admin export object (for publishing/download).
 */
export function createAdminExport(draft) {
  return {
    content: normalizeContentModel(draft.content),
    flowMap: normalizeFlowMap(draft.flowMap),
  };
}

/**
 * Create admin preview payload (for dev/testing).
 */
export function createAdminPreviewPayload(draft) {
  return {
    ...createAdminExport(draft),
    tweaks: normalizeAdminTweaks(draft.tweaks),
    sourceLabel: draft.sourceLabel || 'Supabase draft',
  };
}

/**
 * Subscribe to player state changes (real-time).
 * Watches the player_state table for updates.
 */
export function subscribeToPlayerState(supabase, callback) {
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('player_state_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'player_state' },
        (payload) => {
          if (payload.new?.state) {
            callback(payload.new.state);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('Error subscribing to player state:', err);
    return () => {};
  }
}

/**
 * Load published story for player.
 * Different from loadAdminDraft - fetches the published version.
 */
export async function loadPublishedStory(supabase) {
  if (!supabase) return null;

  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading published story:', error);
      return null;
    }

    if (!stories || stories.length === 0) return null;

    const story = stories[0];
    return {
      id: story.id,
      prologue: story.prologue,
      days: story.days,
      flowMap: story.flow_map,
      versionNumber: story.version_number,
      publishedAt: story.published_at,
    };
  } catch (err) {
    console.error('Error in loadPublishedStory:', err);
    return null;
  }
}

/**
 * Clear browser-side snapshot storage (if using localStorage fallback).
 */
export function clearAdminDraftStorage() {
  if (typeof window === 'undefined') return;
  try {
    const legacyKeys = [
      STORAGE_KEYS.content,
      STORAGE_KEYS.flow,
      STORAGE_KEYS.snapshots,
      STORAGE_KEYS.tweaks,
    ];
    legacyKeys.forEach((key) => window.localStorage?.removeItem(key));
  } catch (err) {
    console.error('Error clearing storage:', err);
  }
}

/**
 * Create draft fingerprint for dirty-check.
 */
export function createDraftFingerprint(draft) {
  return JSON.stringify({
    content: normalizeContentModel(draft.content),
    flowMap: normalizeFlowMap(draft.flowMap),
    tweaks: normalizeAdminTweaks(draft.tweaks),
  });
}
