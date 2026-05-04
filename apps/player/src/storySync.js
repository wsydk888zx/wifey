import { defaultContent } from '@wifey/story-content';
import {
  buildCompleteFlowMap,
  normalizeContentModel,
  normalizeStorySettings,
} from '@wifey/story-core';

const EMPTY_PROLOGUE = { lines: [], signoff: '' };

function readPersistedStorySettings(source) {
  const flowMapSettings =
    source?.flow_map && typeof source.flow_map === 'object' && !Array.isArray(source.flow_map)
      ? source.flow_map.storySettings ?? source.flow_map.settings ?? source.flow_map.tweaks
      : undefined;

  return normalizeStorySettings(source?.storySettings ?? source?.settings ?? flowMapSettings);
}

function buildStoryVersionKey(meta) {
  if (meta.source === 'supabase') {
    return [
      'supabase',
      meta.storyId ?? 'published',
      meta.versionNumber ?? 'versionless',
      meta.publishedAt ?? meta.updatedAt ?? 'latest',
    ].join(':');
  }

  return ['bundled', meta.reason ?? 'default'].join(':');
}

function buildStorySnapshot(contentSource, rawFlowMap, meta) {
  const content = normalizeContentModel(contentSource);
  const storySettings = normalizeStorySettings(contentSource?.settings);

  return {
    content,
    storySettings,
    flowMap: buildCompleteFlowMap(content, rawFlowMap || { rules: [] }),
    meta: {
      ...meta,
      storyVersionKey: buildStoryVersionKey(meta),
      loadedAt: new Date().toISOString(),
    },
  };
}

function createBundledFallbackStory(reason, options = {}) {
  return buildStorySnapshot(
    {
      prologue: defaultContent?.prologue || EMPTY_PROLOGUE,
      days: Array.isArray(defaultContent?.days) ? defaultContent.days : [],
      settings: defaultContent?.settings,
    },
    defaultContent?.defaultFlowMap || { rules: [] },
    {
      source: 'bundled-fallback',
      reason,
      liveConfigured: !!options.liveConfigured,
      errorMessage: options.errorMessage || '',
      storyId: null,
      versionNumber: null,
      publishedAt: null,
      updatedAt: null,
    },
  );
}

export async function loadActiveStorySnapshot(supabase) {
  if (!supabase) {
    return createBundledFallbackStory('supabase_config_missing', { liveConfigured: false });
  }

  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[player] Failed to load published story, using bundled fallback:', error);
      return createBundledFallbackStory('published_story_fetch_failed', {
        liveConfigured: true,
        errorMessage: error.message,
      });
    }

    if (!stories || stories.length === 0) {
      console.warn('[player] No published story found, using bundled fallback.');
      return createBundledFallbackStory('published_story_missing', { liveConfigured: true });
    }

    const story = stories[0];
    return buildStorySnapshot(
      {
        prologue: story?.prologue || EMPTY_PROLOGUE,
        days: Array.isArray(story?.days) ? story.days : [],
        settings: readPersistedStorySettings(story),
      },
      story?.flow_map || { rules: [] },
      {
        source: 'supabase',
        reason: 'published_story_loaded',
        liveConfigured: true,
        errorMessage: '',
        storyId: story?.id ?? null,
        versionNumber: story?.version_number ?? null,
        publishedAt: story?.published_at ?? null,
        updatedAt: story?.updated_at ?? null,
      },
    );
  } catch (error) {
    console.error('[player] Error fetching published story, using bundled fallback:', error);
    return createBundledFallbackStory('published_story_fetch_failed', {
      liveConfigured: true,
      errorMessage: error?.message || 'Unknown error',
    });
  }
}

export function subscribeToPublishedStory(supabase, onChange) {
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('player_published_story_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        (payload) => {
          if (payload?.new?.is_published || payload?.old?.is_published) {
            onChange(payload);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('[player] Could not subscribe to published story updates:', error);
    return () => {};
  }
}
