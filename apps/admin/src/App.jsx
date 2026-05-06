import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import { defaultContent, defaultFlowMap } from '@wifey/story-content';
import {
  DEFAULT_AI_INTENSITY,
  FLOW_OPERATOR_OPTIONS,
  INPUT_TYPE_OPTIONS,
  PLACEHOLDER_TOKEN_OPTIONS,
  STORY_SETTINGS_DEFAULTS,
  buildCompleteFlowMap,
  flattenStoryEnvelopes,
  getFlowOperatorLabel,
  getInputTypeLabel,
  getDayEnvelopes,
  normalizeStorySettings,
  previewPlaceholders,
  replacePlaceholders,
  isSelectInputType,
  normalizeInputType,
  normalizeContentModel,
  validateStoryContent,
} from '@wifey/story-core';

import {
  MAX_ADMIN_SNAPSHOTS,
  clearAdminDraftStorage,
  createAdminExport,
  createAdminSnapshot,
  createDefaultAdminDraft,
  createDraftFingerprint,
  downloadAdminExport,
  loadAdminDraft,
  parseAdminImport,
  saveAdminDraft,
  publishStory,
} from './supabaseStorage.js';

const sections = ['Overview', 'Settings', 'Story', 'Flow', 'Responses', 'AI Drafts', 'Snapshots', 'Publish', 'Notifications'];
const sectionHeadings = {
  Overview: { id: 'overview-heading', title: 'Content Health' },
  Settings: { id: 'settings-heading', title: 'Settings' },
  Story: { id: 'story-heading', title: 'Story Editor' },
  Flow: { id: 'flow-heading', title: 'Flow Routes' },
  Responses: { id: 'responses-heading', title: 'Player Responses' },
  'AI Drafts': { id: 'ai-drafts-heading', title: 'AI Drafts' },
  Snapshots: { id: 'snapshots-heading', title: 'Snapshots' },
  Publish: { id: 'publish-heading', title: 'Publish Checkpoint' },
  Notifications: { id: 'notifications-heading', title: 'Notification Schedule' },
};
const ADMIN_LOCAL_SERVICE_BASE_URL =
  import.meta.env.VITE_ADMIN_LOCAL_SERVICE_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_CONFIG_MISSING = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const supabase = SUPABASE_CONFIG_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
if (SUPABASE_CONFIG_MISSING && typeof console !== 'undefined') {
  console.error(
    '[admin] Supabase env vars missing at build time. ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set on the Vercel project (or in apps/admin/.env.local for local dev). ' +
    'Login will not work until this is fixed. See docs/ops-playbook.md §7.'
  );
}
const ADMIN_AI_BASE_URL =
  import.meta.env.VITE_ADMIN_AI_BASE_URL || ADMIN_LOCAL_SERVICE_BASE_URL;
const AI_DRAFT_GOAL_OPTIONS = [
  { value: 'rewrite', label: 'Rewrite' },
  { value: 'clearer', label: 'Clearer' },
  { value: 'intense', label: 'More Intense' },
  { value: 'softer', label: 'Softer' },
];
const AI_TONE_OPTIONS = [
  { value: 'romantic', label: 'Romantic' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'playful', label: 'Playful' },
  { value: 'possessive', label: 'Possessive' },
  { value: 'explicit', label: 'Explicit' },
];
const AI_CARD_DRAFT_FIELDS = [
  { key: 'title', label: 'Choice Title', source: 'choice' },
  { key: 'hint', label: 'Choice Hint', source: 'choice' },
  { key: 'heading', label: 'Card Heading', source: 'card' },
  { key: 'body', label: 'Card Body', source: 'card' },
  { key: 'rule', label: 'Card Rule', source: 'card' },
];
const AI_ENVELOPE_DRAFT_FIELDS = [
  { key: 'intro', label: 'Intro' },
  { key: 'choicesHeading', label: 'Choice Screen Heading' },
  { key: 'choicesIntro', label: 'Choice Screen Intro' },
];
const MAX_STORY_DAYS = 5;
const LEGACY_ENVELOPE_SLOTS = ['prologue', 'morning', 'evening'];
const ENVELOPE_TIME_LABELS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
  'Late Night',
  'After Midnight',
];

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIdSlug(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function createUniqueId(base, usedIds) {
  const root = createIdSlug(base, 'item');
  let id = root;
  let index = 2;

  while (usedIds.has(id)) {
    id = `${root}-${index}`;
    index += 1;
  }

  usedIds.add(id);
  return id;
}

function getEnvelopeTimeLabel(index) {
  return ENVELOPE_TIME_LABELS[index] || `Envelope ${index + 1}`;
}

function getUsedDayIds(content) {
  return new Set((content.days || []).map((day) => day?.id).filter(Boolean));
}

function getUsedEnvelopeIds(content) {
  return new Set(
    flattenStoryEnvelopes(content)
      .map((item) => item.envelope?.id)
      .filter(Boolean),
  );
}

function getUsedChoiceIds(content) {
  return new Set(
    flattenStoryEnvelopes(content)
      .flatMap((item) => (Array.isArray(item.envelope?.choices) ? item.envelope.choices : []))
      .map((choice) => choice?.id)
      .filter(Boolean),
  );
}

function getEnvelopeChoiceIds(envelope) {
  return new Set(
    (Array.isArray(envelope?.choices) ? envelope.choices : [])
      .map((choice) => choice?.id)
      .filter(Boolean),
  );
}

function getExplicitFlowRules(flowMap) {
  return Array.isArray(flowMap?.rules) ? flowMap.rules : [];
}

function syncDayEnvelopes(day, envelopes) {
  const nextEnvelopes = envelopes.filter(Boolean);
  day.envelopes = nextEnvelopes;

  LEGACY_ENVELOPE_SLOTS.forEach((slot) => {
    const slotEnvelope = nextEnvelopes.find((envelope) => envelope?.slot === slot);
    if (slotEnvelope) {
      day[slot] = slotEnvelope;
    } else {
      delete day[slot];
    }
  });
}

function createDefaultChoice(content, envelope, choices) {
  const usedChoiceIds = getUsedChoiceIds(content);
  const envelopeSlug = createIdSlug(envelope?.id || envelope?.label, 'choice');
  const id = createUniqueId(`${envelopeSlug}-choice-${choices.length + 1}`, usedChoiceIds);

  return {
    id,
    title: 'New Choice',
    hint: 'Draft the path label.',
    card: {
      heading: 'New card heading',
      body: 'Draft the card body here.',
      rule: 'Add the completion rule here.',
      inputs: [],
      revealItems: [],
    },
  };
}

function createDefaultEnvelope(content, dayIndex, day, envelopes) {
  const dayNumber = dayIndex + 1;
  const envelopeIndex = envelopes.length;
  const timeLabel = getEnvelopeTimeLabel(envelopeIndex);
  const usedEnvelopeIds = getUsedEnvelopeIds(content);
  const usedSlots = new Set(envelopes.map((envelope) => envelope?.slot).filter(Boolean));
  const slot = createUniqueId(`slot-${envelopeIndex + 1}`, usedSlots);
  const envelope = {
    id: createUniqueId(`d${dayNumber}-${timeLabel}`, usedEnvelopeIds),
    slot,
    timeLabel,
    label: `Day ${dayNumber} - ${timeLabel}`,
    sealMotif: String(dayNumber),
    intro: '',
    choicesHeading: 'Choose what happens next.',
    choicesIntro: '',
    branchOnly: !!day?.branchOnly,
    choices: [],
  };

  envelope.choices = [createDefaultChoice(content, envelope, [])];
  return envelope;
}

function createDefaultDay(content) {
  const dayNumber = Math.min((content.days || []).length + 1, MAX_STORY_DAYS);
  const usedDayIds = getUsedDayIds(content);
  const day = {
    id: createUniqueId(`day-${dayNumber}`, usedDayIds),
    day: dayNumber,
    theme: `Day ${dayNumber}`,
    branchOnly: false,
    dayPrelude: {
      enabled: false,
      kicker: `Day ${dayNumber}`,
      heading: `Before Day ${dayNumber} Begins`,
      body: '',
      buttonLabel: 'Begin the day',
    },
    envelopes: [],
  };

  day.envelopes = [createDefaultEnvelope(content, dayNumber - 1, day, [])];
  return day;
}

function shouldContinueDanger(message) {
  return typeof window === 'undefined' || window.confirm(message);
}

function getStatus(validation) {
  if (validation.errors.length) return { label: 'Needs Attention', tone: 'error' };
  if (validation.warnings.length) return { label: 'Warnings', tone: 'warning' };
  return { label: 'Healthy', tone: 'success' };
}

function getFilenameDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

function createFilenameSlug(value) {
  return String(value || 'snapshot')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'snapshot';
}

function formatMetricDelta(currentValue, snapshotValue) {
  const diff = currentValue - snapshotValue;
  if (diff === 0) return 'Same';
  return `Current ${diff > 0 ? '+' : ''}${diff}`;
}

function createSnapshotExport(snapshot) {
  return {
    content: normalizeContentModel(snapshot.content),
    flowMap: snapshot.flowMap || { rules: [] },
  };
}

function createReleaseFilename() {
  return `yours-watching-release_${getFilenameDate()}.json`;
}

function createResponseInputId(choice, inputs) {
  const base = String(choice?.id || 'response')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'response';
  const usedIds = new Set(inputs.map((input) => input?.id).filter(Boolean));
  let index = inputs.length + 1;
  let id = `${base}_field_${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `${base}_field_${index}`;
  }

  return id;
}

function createDefaultResponseInput(choice, inputs) {
  return {
    id: createResponseInputId(choice, inputs),
    label: 'New response field',
    type: 'short_text',
    required: false,
    placeholder: '',
    helpText: '',
    options: ['Option 1', 'Option 2'],
  };
}

function createRevealItemId(choice, revealItems) {
  const base = String(choice?.id || 'reveal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'reveal';
  const usedIds = new Set(revealItems.map((item) => item?.id).filter(Boolean));
  let index = revealItems.length + 1;
  let id = `${base}_reveal_${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `${base}_reveal_${index}`;
  }

  return id;
}

function createDefaultRevealItem(choice, revealItems) {
  return {
    id: createRevealItemId(choice, revealItems),
    title: 'Reveal item title',
    description: '',
  };
}

function getOptionsText(input) {
  return Array.isArray(input?.options) ? input.options.join('\n') : '';
}

function parseOptionsText(value) {
  return value
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean);
}

function createFlowRuleId(sourceChoiceId, rules) {
  const base = String(sourceChoiceId || 'choice')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'choice';
  const usedIds = new Set(rules.map((rule) => rule?.id).filter(Boolean));
  let index = rules.length + 1;
  let id = `route-${base}-${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `route-${base}-${index}`;
  }

  return id;
}

function createDefaultFlowRule(sourceChoiceId, targetEnvelopeId, rules) {
  return {
    id: createFlowRuleId(sourceChoiceId, rules),
    sourceChoiceId,
    sourceFieldId: '',
    operator: 'always',
    value: '',
    targetEnvelopeId,
  };
}

function describeFlowRule(rule, field) {
  if ((rule?.operator || 'always') === 'always') return 'Always';

  const fieldLabel = field?.label || field?.id || 'Response field';
  if (rule.operator === 'is_filled') return `${fieldLabel} is filled`;
  if (rule.operator === 'equals') return `${fieldLabel} equals ${rule.value || '...'}`;
  if (rule.operator === 'contains') return `${fieldLabel} contains ${rule.value || '...'}`;
  return getFlowOperatorLabel(rule.operator);
}

function getAdminAiUrl(path) {
  return `${ADMIN_AI_BASE_URL}${path}`;
}

function getAdminLocalServiceUrl(path) {
  return `${ADMIN_LOCAL_SERVICE_BASE_URL}${path}`;
}

function normalizeCompareText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function getChoiceDraftValue(choice, field) {
  if (field.source === 'card') return choice?.card?.[field.key] || '';
  return choice?.[field.key] || '';
}

function getEnvelopeDraftValue(envelope, field) {
  return envelope?.[field.key] || '';
}

function createPlaceholderPreviewRow(label, value, storySettings) {
  const preview = previewPlaceholders(value, storySettings);
  if (!preview) return null;

  return {
    label,
    raw: value,
    preview,
  };
}

function LoadingScreen({ message = 'Checking admin access…' }) {
  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--loading">
        <h1>Yours, Watching</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function LoginScreen({ initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setLoading(false);
  }

  const S = {
    root: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--parchment)',
      fontFamily: 'var(--sans)',
      padding: '16px',
      width: '100%',
    },
    card: {
      background: '#fff',
      border: '1px solid var(--brass)',
      borderRadius: 8,
      boxSizing: 'border-box',
      padding: '2.5rem 2rem',
      width: '100%',
      maxWidth: 320,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    },
    heading: {
      fontFamily: 'var(--serif)',
      fontSize: '1.5rem',
      color: 'var(--brass)',
      margin: 0,
      textAlign: 'center',
    },
    label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem', color: '#444' },
    input: {
      padding: '0.5rem 0.6rem',
      border: '1px solid #ccc',
      borderRadius: 4,
      fontSize: '0.95rem',
      fontFamily: 'var(--sans)',
    },
    button: {
      background: 'var(--brass)',
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      padding: '0.6rem',
      fontSize: '0.95rem',
      fontFamily: 'var(--sans)',
      cursor: 'pointer',
      opacity: loading ? 0.7 : 1,
    },
    error: { color: '#c0392b', fontSize: '0.85rem', textAlign: 'center' },
  };

  if (SUPABASE_CONFIG_MISSING) {
    return (
      <div style={S.root}>
        <div style={{ ...S.card, borderColor: '#c0392b' }}>
          <h1 style={{ ...S.heading, color: '#c0392b' }}>Configuration error</h1>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            Supabase env vars are missing in this build. Login cannot work.
          </p>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
            Fix: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> on the
            Vercel <code>wifey</code> project, then redeploy. See <code>docs/ops-playbook.md §7</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <form style={S.card} onSubmit={handleSubmit}>
        <h1 style={S.heading}>Yours, Watching</h1>
        <label style={S.label}>
          Email
          <input
            style={S.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label style={S.label}>
          Password
          <input
            style={S.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p style={S.error}>{error}</p>}
        <button style={S.button} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setAuthChecked(true);
      return undefined;
    }

    async function bootstrapSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        setAuthError('');
      } catch (err) {
        console.error('Failed to check admin auth session:', err);
        if (!active) return;
        setAuthError('Could not verify the current session. Sign in to reconnect.');
      } finally {
        if (active) setAuthChecked(true);
      }
    }

    bootstrapSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authChecked) return <LoadingScreen />;
  if (supabase && !session) return <LoginScreen initialError={authError} />;
  return <AdminApp />;
}

function AdminApp() {
  const defaultDraft = createDefaultAdminDraft(defaultContent, defaultFlowMap);
  const [draft, setDraft] = useState(defaultDraft);
  const [savedFingerprint, setSavedFingerprint] = useState(() => createDraftFingerprint(defaultDraft));
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [publishLoading, setPublishLoading] = useState(false);
  const isPublishingRef = useRef(false);
  const [notice, setNotice] = useState(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [activeSection, setActiveSection] = useState('Overview');
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeEnvelopeIndex, setActiveEnvelopeIndex] = useState(0);
  const [activeChoiceIndex, setActiveChoiceIndex] = useState(0);
  const [newFlowSourceChoiceId, setNewFlowSourceChoiceId] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [aiTargetType, setAiTargetType] = useState('card');
  const [aiDraftGoal, setAiDraftGoal] = useState('rewrite');
  const [aiTone, setAiTone] = useState('romantic');
  const [aiIntensity, setAiIntensity] = useState(DEFAULT_AI_INTENSITY);
  const [aiBoundaries, setAiBoundaries] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiDraftResult, setAiDraftResult] = useState(null);
  const [aiDraftError, setAiDraftError] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [playerResponses, setPlayerResponses] = useState(null);

  // Load draft from Supabase on mount
  useEffect(() => {
    async function loadDraft() {
      if (!supabase) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        const loaded = await loadAdminDraft(supabase, defaultContent, defaultFlowMap);
        setDraft(loaded);
        setSavedFingerprint(createDraftFingerprint(loaded));
      } catch (err) {
        console.error('Failed to load draft:', err);
        setNotice({ tone: 'error', text: 'Failed to load draft from Supabase.' });
      } finally {
        setIsLoadingDraft(false);
      }
    }

    loadDraft();
  }, []);

  // Auto-save draft to Supabase
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!supabase || isLoadingDraft || isPublishingRef.current) return;

      try {
        const result = await saveAdminDraft(supabase, draft);
        if (result?.newStoryId) {
          setDraft(prev => ({ ...prev, storyId: result.newStoryId }));
        }
        setSavedFingerprint(createDraftFingerprint(draft));
      } catch (err) {
        console.error('Failed to save draft:', err);
      }
    }, 2000); // Debounce saves by 2 seconds

    return () => clearTimeout(timer);
  }, [draft, supabase, isLoadingDraft]);

  useEffect(() => {
    if (!supabase) return;

    const refreshPlayerResponses = async () => {
      const { data, error } = await supabase
        .from('player_responses')
        .select('envelope_id, choice_id, responses, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load player responses:', error);
        return;
      }

      const merged = {};
      data?.forEach((row) => {
        const key = `${row.envelope_id}::${row.choice_id}`;
        if (!Object.hasOwn(merged, key)) merged[key] = row.responses;
      });
      setPlayerResponses(merged);
    };

    refreshPlayerResponses();

    const channel = supabase
      .channel('player_responses_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_responses' }, () => {
        refreshPlayerResponses();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const content = draft.content;
  const flowMap = draft.flowMap;
  const snapshots = draft.snapshots;
  const storySettings = normalizeStorySettings(content.settings);
  const activeHeading = sectionHeadings[activeSection] || sectionHeadings.Overview;
  const mainHeadingId = activeHeading.id;
  const mainHeading = activeHeading.title;
  const prologueLines = Array.isArray(content.prologue?.lines) ? content.prologue.lines : [];
  const prologueText = prologueLines.join('\n');
  const prologueSignoff = content.prologue?.signoff || '';
  const visiblePrologueLines = prologueLines.filter((line) => line.trim());
  const completeFlowMap = useMemo(
    () => buildCompleteFlowMap(content, flowMap),
    [content, flowMap],
  );
  const validation = useMemo(
    () => validateStoryContent(content, flowMap),
    [content, flowMap],
  );
  const isDirty = useMemo(
    () => createDraftFingerprint(draft) !== savedFingerprint,
    [draft, savedFingerprint],
  );
  const status = getStatus(validation);
  const safeDayIndex = Math.min(activeDayIndex, Math.max(content.days.length - 1, 0));
  const selectedDay = content.days[safeDayIndex] || null;
  const selectedEnvelopes = selectedDay ? getDayEnvelopes(selectedDay) : [];
  const safeEnvelopeIndex = Math.min(
    activeEnvelopeIndex,
    Math.max(selectedEnvelopes.length - 1, 0),
  );
  const selectedEnvelope = selectedEnvelopes[safeEnvelopeIndex] || null;
  const selectedChoices = Array.isArray(selectedEnvelope?.choices)
    ? selectedEnvelope.choices
    : [];
  const safeChoiceIndex = Math.min(
    activeChoiceIndex,
    Math.max(selectedChoices.length - 1, 0),
  );
  const selectedChoice = selectedChoices[safeChoiceIndex] || null;
  const selectedResponseInputs = Array.isArray(selectedChoice?.card?.inputs)
    ? selectedChoice.card.inputs
    : [];
  const selectedRevealItems = Array.isArray(selectedChoice?.card?.revealItems)
    ? selectedChoice.card.revealItems
    : [];
  const previewCopy = (value, fallback = '') =>
    replacePlaceholders(value || fallback, storySettings);
  const placeholderPreviewRows = [
    ...prologueLines.map((line, index) =>
      createPlaceholderPreviewRow(`Prologue Line ${index + 1}`, line, storySettings),
    ),
    createPlaceholderPreviewRow('Prologue Sign-off', prologueSignoff, storySettings),
    createPlaceholderPreviewRow('Day Theme', selectedDay?.theme, storySettings),
    createPlaceholderPreviewRow('Day Prelude Kicker', selectedDay?.dayPrelude?.kicker, storySettings),
    createPlaceholderPreviewRow('Day Prelude Heading', selectedDay?.dayPrelude?.heading, storySettings),
    createPlaceholderPreviewRow('Day Prelude Body', selectedDay?.dayPrelude?.body, storySettings),
    createPlaceholderPreviewRow('Day Prelude Button', selectedDay?.dayPrelude?.buttonLabel, storySettings),
    createPlaceholderPreviewRow('Envelope Label', selectedEnvelope?.label, storySettings),
    createPlaceholderPreviewRow('Envelope Time Label', selectedEnvelope?.timeLabel, storySettings),
    createPlaceholderPreviewRow('Envelope Intro', selectedEnvelope?.intro, storySettings),
    createPlaceholderPreviewRow('Choice Screen Heading', selectedEnvelope?.choicesHeading, storySettings),
    createPlaceholderPreviewRow('Choice Screen Intro', selectedEnvelope?.choicesIntro, storySettings),
    createPlaceholderPreviewRow('Choice Title', selectedChoice?.title, storySettings),
    createPlaceholderPreviewRow('Choice Hint', selectedChoice?.hint, storySettings),
    createPlaceholderPreviewRow('Card Heading', selectedChoice?.card?.heading, storySettings),
    createPlaceholderPreviewRow('Card Body', selectedChoice?.card?.body, storySettings),
    createPlaceholderPreviewRow('Card Rule', selectedChoice?.card?.rule, storySettings),
    ...selectedRevealItems.flatMap((item, itemIndex) => [
      createPlaceholderPreviewRow(
        `Reveal ${itemIndex + 1} Title`,
        item?.title,
        storySettings,
      ),
      createPlaceholderPreviewRow(
        `Reveal ${itemIndex + 1} Description`,
        item?.description,
        storySettings,
      ),
    ]),
    ...selectedResponseInputs.flatMap((input, inputIndex) => [
      createPlaceholderPreviewRow(
        `Response ${inputIndex + 1} Label`,
        input?.label,
        storySettings,
      ),
      createPlaceholderPreviewRow(
        `Response ${inputIndex + 1} Placeholder`,
        input?.placeholder,
        storySettings,
      ),
      createPlaceholderPreviewRow(
        `Response ${inputIndex + 1} Help`,
        input?.helpText,
        storySettings,
      ),
      ...(Array.isArray(input?.options)
        ? input.options.map((option, optionIndex) =>
            createPlaceholderPreviewRow(
              `Response ${inputIndex + 1} Option ${optionIndex + 1}`,
              option,
              storySettings,
            ),
          )
        : []),
    ]),
  ].filter(Boolean);
  const selectedAiFields =
    aiTargetType === 'card' ? AI_CARD_DRAFT_FIELDS : AI_ENVELOPE_DRAFT_FIELDS;
  const selectedAiTargetLabel =
    aiTargetType === 'card'
      ? selectedChoice?.title || selectedChoice?.id || 'No choice selected'
      : selectedEnvelope?.label || selectedEnvelope?.timeLabel || 'No envelope selected';
  const aiDraftIsCurrent =
    !!aiDraftResult &&
    aiDraftResult.targetType === aiTargetType &&
    aiDraftResult.dayIndex === safeDayIndex &&
    aiDraftResult.envelopeIndex === safeEnvelopeIndex &&
    (aiTargetType !== 'card' || aiDraftResult.choiceIndex === safeChoiceIndex);
  const activeAiDraft = aiDraftIsCurrent ? aiDraftResult.draft : null;
  const aiFieldRows = selectedAiFields.map((field) => {
    const currentValue =
      aiTargetType === 'card'
        ? getChoiceDraftValue(selectedChoice, field)
        : getEnvelopeDraftValue(selectedEnvelope, field);
    const draftValue = activeAiDraft?.[field.key] || '';

    return {
      ...field,
      currentValue,
      draftValue,
      changed:
        !!activeAiDraft &&
        normalizeCompareText(currentValue) !== normalizeCompareText(draftValue),
    };
  });
  const aiChangedFieldCount = aiFieldRows.filter((field) => field.changed).length;
  const canGenerateAiDraft =
    !!selectedDay && !!selectedEnvelope && (aiTargetType !== 'card' || !!selectedChoice);

  const routeEnvelopeOptions = useMemo(
    () =>
      flattenStoryEnvelopes(content)
        .filter((item) => item.envelopeId)
        .map((item) => ({
          id: item.envelopeId,
          label: `Day ${item.dayIndex + 1} - ${
            item.envelope?.timeLabel || `Envelope ${item.envelopeIndex + 1}`
          }`,
          subtitle: item.envelope?.label || item.envelopeId,
          theme: item.day?.theme || 'Untitled',
          branchOnly: item.branchOnly,
        })),
    [content],
  );
  const routeChoiceOptions = useMemo(
    () =>
      flattenStoryEnvelopes(content).flatMap((item) => {
        const choices = Array.isArray(item.envelope?.choices) ? item.envelope.choices : [];

        return choices
          .filter((choice) => choice?.id)
          .map((choice) => ({
            id: choice.id,
            title: choice.title || choice.id,
            hint: choice.hint || '',
            location: `Day ${item.dayIndex + 1} - ${
              item.envelope?.timeLabel || `Envelope ${item.envelopeIndex + 1}`
            }`,
            envelopeLabel: item.envelope?.label || item.envelopeId || 'Untitled envelope',
            fields: Array.isArray(choice.card?.inputs)
              ? choice.card.inputs.filter((field) => field?.id)
              : [],
          }));
      }),
    [content],
  );
  const routeChoiceById = useMemo(
    () => new Map(routeChoiceOptions.map((choice) => [choice.id, choice])),
    [routeChoiceOptions],
  );
  const routeEnvelopeById = useMemo(
    () => new Map(routeEnvelopeOptions.map((envelope) => [envelope.id, envelope])),
    [routeEnvelopeOptions],
  );
  const explicitFlowRules = Array.isArray(flowMap?.rules) ? flowMap.rules : [];
  const generatedDefaultRules = useMemo(
    () => buildCompleteFlowMap(content, { rules: [] }).rules || [],
    [content],
  );
  const autoRouteMap = useMemo(() => {
    const routes = new Map();
    generatedDefaultRules.forEach((rule) => {
      if (!routes.has(rule.sourceChoiceId)) routes.set(rule.sourceChoiceId, rule.targetEnvelopeId);
    });
    return routes;
  }, [generatedDefaultRules]);
  const explicitRulesByChoice = useMemo(() => {
    const grouped = new Map();
    explicitFlowRules.forEach((rule) => {
      if (!grouped.has(rule.sourceChoiceId)) grouped.set(rule.sourceChoiceId, []);
      grouped.get(rule.sourceChoiceId).push(rule);
    });
    return grouped;
  }, [explicitFlowRules]);
  const explicitRouteGroups = Array.from(
    new Set(explicitFlowRules.map((rule) => rule.sourceChoiceId || '')),
  ).map((sourceChoiceId, index) => ({
    choice:
      routeChoiceById.get(sourceChoiceId) || {
        id: sourceChoiceId || `missing-source-${index + 1}`,
        title: sourceChoiceId || 'Missing source choice',
        hint: '',
        location: 'Unknown source',
        envelopeLabel: 'Validation issue',
        fields: [],
      },
    rules: explicitRulesByChoice.get(sourceChoiceId) || [],
  }));
  const automaticRouteRows = routeChoiceOptions
    .map((choice) => ({
      choice,
      targetEnvelope: routeEnvelopeById.get(autoRouteMap.get(choice.id)),
      explicitRules: explicitRulesByChoice.get(choice.id) || [],
    }))
    .filter((row) => row.targetEnvelope);
  const endingRouteRows = routeChoiceOptions.filter(
    (choice) => !autoRouteMap.has(choice.id) && !(explicitRulesByChoice.get(choice.id) || []).length,
  );
  const selectedFlowSourceChoiceId = routeChoiceById.has(newFlowSourceChoiceId)
    ? newFlowSourceChoiceId
    : routeChoiceOptions[0]?.id || '';

  const daySummaries = content.days.map((day, index) => {
    const envelopes = getDayEnvelopes(day);
    const choices = envelopes.reduce(
      (total, envelope) => total + (Array.isArray(envelope.choices) ? envelope.choices.length : 0),
      0,
    );

    return {
      id: day.id || `day-${index + 1}`,
      label: `Day ${index + 1}`,
      theme: day.theme || 'Untitled',
      envelopes: envelopes.length,
      choices,
    };
  });

  const visibleFlowRuleCount = Array.isArray(completeFlowMap.rules)
    ? completeFlowMap.rules.length
    : 0;
  const explicitFlowRuleCount = explicitFlowRules.length;
  const validationMessages = [
    ...validation.errors.map((text) => ({ level: 'error', text })),
    ...validation.warnings.map((text) => ({ level: 'warning', text })),
  ].slice(0, 6);
  const currentSnapshotMetrics = {
    days: validation.stats.days,
    envelopes: validation.stats.envelopes,
    choices: validation.stats.choices,
    visibleFlowRules: visibleFlowRuleCount,
    explicitFlowRules: explicitFlowRuleCount,
    errors: validation.errors.length,
    warnings: validation.warnings.length,
  };
  const currentExportFingerprint = useMemo(
    () => JSON.stringify(createSnapshotExport({ content, flowMap })),
    [content, flowMap],
  );
  const snapshotRows = useMemo(
    () =>
      snapshots.map((snapshot) => {
        const snapshotValidation = validateStoryContent(snapshot.content, snapshot.flowMap);
        const snapshotFlowMap = buildCompleteFlowMap(snapshot.content, snapshot.flowMap);
        const visibleSnapshotRules = Array.isArray(snapshotFlowMap.rules)
          ? snapshotFlowMap.rules.length
          : 0;
        const explicitSnapshotRules = Array.isArray(snapshot.flowMap?.rules)
          ? snapshot.flowMap.rules.length
          : 0;

        return {
          snapshot,
          validation: snapshotValidation,
          status: getStatus(snapshotValidation),
          isCurrent: JSON.stringify(createSnapshotExport(snapshot)) === currentExportFingerprint,
          metrics: {
            days: snapshotValidation.stats.days,
            envelopes: snapshotValidation.stats.envelopes,
            choices: snapshotValidation.stats.choices,
            visibleFlowRules: visibleSnapshotRules,
            explicitFlowRules: explicitSnapshotRules,
            errors: snapshotValidation.errors.length,
            warnings: snapshotValidation.warnings.length,
          },
        };
      }),
    [currentExportFingerprint, snapshots],
  );
  const activeSnapshotRow =
    snapshotRows.find((row) => row.snapshot.id === selectedSnapshotId) || snapshotRows[0] || null;
  const currentSnapshotRow = snapshotRows.find((row) => row.isCurrent) || null;
  const snapshotComparisonRows = activeSnapshotRow
    ? [
        ['Days', currentSnapshotMetrics.days, activeSnapshotRow.metrics.days],
        ['Envelopes', currentSnapshotMetrics.envelopes, activeSnapshotRow.metrics.envelopes],
        ['Choices', currentSnapshotMetrics.choices, activeSnapshotRow.metrics.choices],
        ['Visible Flow Rules', currentSnapshotMetrics.visibleFlowRules, activeSnapshotRow.metrics.visibleFlowRules],
        ['Explicit Flow Rules', currentSnapshotMetrics.explicitFlowRules, activeSnapshotRow.metrics.explicitFlowRules],
        ['Errors', currentSnapshotMetrics.errors, activeSnapshotRow.metrics.errors],
        ['Warnings', currentSnapshotMetrics.warnings, activeSnapshotRow.metrics.warnings],
      ]
    : [];
  const recentSnapshots = snapshots.slice(0, 4);
  const publishReadinessItems = [
    {
      label: 'Validation',
      tone: validation.errors.length ? 'error' : validation.warnings.length ? 'warning' : 'success',
      detail: validation.errors.length
        ? `${validation.errors.length} blocking errors`
        : validation.warnings.length
          ? `${validation.warnings.length} warnings to review`
          : 'No validation issues',
    },
    {
      label: 'Draft Storage',
      tone: isDirty ? 'warning' : 'success',
      detail: isDirty
        ? 'Unsaved editor changes are still pending'
        : supabase
          ? 'Draft synced to Supabase'
          : 'Draft is only available locally in this session',
    },
    {
      label: 'Snapshot',
      tone: currentSnapshotRow ? 'success' : 'warning',
      detail: currentSnapshotRow
        ? `Current draft matches ${currentSnapshotRow.snapshot.name}`
        : 'No snapshot matches the current draft',
    },
    {
      label: 'Export Shape',
      tone: 'success',
      detail: 'Downloads a { content, flowMap } wrapper',
    },
  ];
  const publishWarningCount =
    validation.warnings.length +
    (isDirty ? 1 : 0) +
    (currentSnapshotRow ? 0 : 1);
  const canPublish = validation.errors.length === 0;
  const canSavePackageCopy = Boolean(ADMIN_LOCAL_SERVICE_BASE_URL);
  const syncSummaryItems = [
    {
      label: 'Draft Source',
      value: draft.sourceLabel || 'Package defaults',
    },
    {
      label: 'Supabase',
      value: supabase ? 'Connected' : 'Configuration missing',
    },
    {
      label: 'Draft Row',
      value: draft.storyId ? `#${draft.storyId}` : 'Not created yet',
    },
    {
      label: 'Sync State',
      value: isDirty ? 'Unsaved changes pending' : 'Latest edits saved',
    },
    {
      label: 'Snapshots',
      value: `${snapshots.length} / ${MAX_ADMIN_SNAPSHOTS}`,
    },
    {
      label: 'Visible Flow Rules',
      value: String(visibleFlowRuleCount),
    },
  ];

  const handlePublishStory = async () => {
    if (!supabase) {
      setNotice({ tone: 'error', text: 'No Supabase connection — cannot publish live.' });
      return;
    }

    setPublishLoading(true);
    isPublishingRef.current = true;
    try {
      let draftToPublish = draft;
      const saveResult = await saveAdminDraft(supabase, draft);

      if (saveResult?.newStoryId) {
        draftToPublish = { ...draft, storyId: saveResult.newStoryId };
        setDraft(draftToPublish);
      }

      setSavedFingerprint(createDraftFingerprint(draftToPublish));

      if (!draftToPublish.storyId) {
        throw new Error('Draft not ready for publishing. Save the draft again and retry.');
      }

      const result = await publishStory(
        supabase,
        draftToPublish,
        `Published at ${new Date().toLocaleString()}`,
      );
      setNotice({ tone: 'success', text: `Story published live as version ${result.versionNumber}.` });

      // Switch to the new draft so subsequent auto-saves don't overwrite the published row
      if (result.newDraftId) {
        setDraft(prev => ({ ...prev, storyId: result.newDraftId }));
      }
    } catch (err) {
      console.error('Publish error:', err);
      setNotice({ tone: 'error', text: `Publish failed: ${err.message}` });
    } finally {
      setPublishLoading(false);
      isPublishingRef.current = false;
    }
  };

  const handleSaveDraft = async () => {
    if (!supabase) {
      setNotice({ tone: 'warning', text: 'No Supabase connection — changes will only persist in this browser session.' });
      return;
    }
    try {
      const result = await saveAdminDraft(supabase, draft);
      if (result?.newStoryId) {
        setDraft(prev => ({ ...prev, storyId: result.newStoryId }));
      }
      setSavedFingerprint(createDraftFingerprint(draft));
      setNotice({ tone: 'success', text: 'Draft saved to Supabase.' });
    } catch (err) {
      setNotice({ tone: 'error', text: `Save failed: ${err.message}` });
    }
  };

  const handleResetDraft = () => {
    clearAdminDraftStorage();
    const nextDraft = createDefaultAdminDraft(defaultContent, defaultFlowMap);
    setDraft(nextDraft);
    setSavedFingerprint(createDraftFingerprint(nextDraft));
    setAiIntensity(DEFAULT_AI_INTENSITY);
    setNotice({ tone: 'warning', text: 'Draft reset to package defaults. Legacy local cache was cleared.' });
    setSnapshotName('');
    setActiveDayIndex(0);
    setActiveEnvelopeIndex(0);
    setActiveChoiceIndex(0);
    setSelectedSnapshotId('');
  };

  const handleExport = () => {
    downloadAdminExport(createAdminExport(draft), `yours-watching-config_${getFilenameDate()}.json`);
    setNotice({ tone: 'success', text: 'Exported current content and flow map.' });
  };

  const handleExportSnapshot = (snapshot) => {
    downloadAdminExport(
      createSnapshotExport(snapshot),
      `${createFilenameSlug(snapshot.name)}_${getFilenameDate()}.json`,
    );
    setNotice({ tone: 'success', text: `Exported ${snapshot.name}.` });
  };

  const handlePublishExport = () => {
    if (!canPublish) {
      setNotice({ tone: 'error', text: `Release blocked: ${validation.errors[0]}` });
      return;
    }

    downloadAdminExport(createAdminExport(draft), createReleaseFilename());
    setNotice({
      tone: publishWarningCount ? 'warning' : 'success',
      text: publishWarningCount
        ? 'Release JSON exported with checkpoint warnings still visible.'
        : 'Release JSON exported from the validated current draft.',
    });
  };

  const handlePublishSnapshotAndExport = async () => {
    if (!canPublish) {
      setNotice({ tone: 'error', text: `Release blocked: ${validation.errors[0]}` });
      return;
    }

    const snapshot = createAdminSnapshot(
      { content, flowMap },
      snapshotName || `Release ${getFilenameDate()}`,
    );
    const nextDraft = {
      ...draft,
      snapshots: [snapshot, ...draft.snapshots].slice(0, MAX_ADMIN_SNAPSHOTS),
    };

    setDraft(nextDraft);
    setSavedFingerprint(createDraftFingerprint(nextDraft));
    setSelectedSnapshotId(snapshot.id);
    setSnapshotName('');
    downloadAdminExport(createAdminExport(nextDraft), createReleaseFilename());
    setNotice({
      type: validation.warnings.length ? 'warning' : 'success',
      text: validation.warnings.length
        ? 'Release snapshot saved and exported (with validation warnings).'
        : 'Release snapshot saved and exported.',
    });
  };

  const handleSaveToFile = async () => {
    if (!canPublish) {
      setNotice({ tone: 'error', text: `Save blocked: ${validation.errors[0]}` });
      return;
    }
    if (!ADMIN_LOCAL_SERVICE_BASE_URL) {
      setNotice({ tone: 'error', text: 'Package copy saving is only available during local admin development.' });
      return;
    }

    try {
      const response = await fetch(getAdminLocalServiceUrl('/api/save-content'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createAdminExport(draft)),
      });
      const json = await response.json();
      if (!response.ok) {
        setNotice({ tone: 'error', text: json.error || 'Save failed.' });
        return;
      }
      setNotice({ tone: 'success', text: 'Package story file updated from the current draft.' });
    } catch (err) {
      setNotice({ tone: 'error', text: `Save failed: ${err.message}` });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const source = JSON.parse(await file.text());
      const imported = parseAdminImport(source, defaultFlowMap);

      if (imported.validation.errors.length) {
        setNotice({
          tone: 'error',
          text: `Import blocked: ${imported.validation.errors[0]}`,
        });
        return;
      }

      setDraft((current) => ({
        ...current,
        content: imported.content,
        flowMap: imported.flowMap,
        sourceLabel: file.name,
      }));
      setActiveDayIndex(0);
      setActiveEnvelopeIndex(0);
      setActiveChoiceIndex(0);
      setNotice({
        tone: imported.validation.warnings.length ? 'warning' : 'success',
        text: imported.validation.warnings.length
          ? `Imported with warning: ${imported.validation.warnings[0]}`
          : `Imported ${file.name}. Save the draft to keep it in browser storage.`,
      });
    } catch {
      setNotice({ tone: 'error', text: 'Import failed. Choose a valid JSON config file.' });
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveSnapshot = () => {
    const snapshot = createAdminSnapshot({ content, flowMap }, snapshotName);
    setDraft((current) => ({
      ...current,
      snapshots: [snapshot, ...current.snapshots].slice(0, MAX_ADMIN_SNAPSHOTS),
    }));
    setSelectedSnapshotId(snapshot.id);
    setSnapshotName('');
    setNotice({ tone: 'success', text: 'Snapshot staged. Save the draft to persist it.' });
  };

  const handleRestoreSnapshot = (snapshot) => {
    setDraft((current) => ({
      ...current,
      content: normalizeContentModel(snapshot.content),
      flowMap: snapshot.flowMap || { rules: [] },
      sourceLabel: snapshot.name,
    }));
    setActiveDayIndex(0);
    setActiveEnvelopeIndex(0);
    setActiveChoiceIndex(0);
    setNotice({ tone: 'warning', text: `Restored ${snapshot.name}. Save the draft to persist it.` });
  };

  const handleDeleteSnapshot = (id) => {
    setDraft((current) => ({
      ...current,
      snapshots: current.snapshots.filter((snapshot) => snapshot.id !== id),
    }));
    setSelectedSnapshotId((currentId) => (currentId === id ? '' : currentId));
    setNotice({ tone: 'warning', text: 'Snapshot removed. Save the draft to persist it.' });
  };

  const handleCompareSnapshot = (snapshot) => {
    setSelectedSnapshotId(snapshot.id);
    setNotice({ tone: 'success', text: `Comparing current draft with ${snapshot.name}.` });
  };

  const updateContent = (updater) => {
    setDraft((current) => ({
      ...current,
      content: (() => {
        const nextContent = normalizeContentModel(current.content);
        updater(nextContent);
        return nextContent;
      })(),
    }));
  };

  const updateContentAndFlow = (updater) => {
    setDraft((current) => {
      const nextContent = normalizeContentModel(current.content);
      const nextFlowMap = {
        ...(current.flowMap || {}),
        rules: getExplicitFlowRules(current.flowMap).map(cloneValue),
      };

      const result = updater(nextContent, nextFlowMap);
      if (result === false) return current;

      return {
        ...current,
        content: nextContent,
        flowMap: nextFlowMap,
      };
    });
  };

  const updateStorySettings = (updates) => {
    updateContent((nextContent) => {
      nextContent.settings = normalizeStorySettings({
        ...nextContent.settings,
        ...updates,
      });
    });
  };

  const handleResetStorySettings = () => {
    updateContent((nextContent) => {
      nextContent.settings = normalizeStorySettings(STORY_SETTINGS_DEFAULTS);
    });
    setNotice({ tone: 'warning', text: 'Story settings reset to package defaults.' });
  };

  const updatePrologue = (updates) => {
    updateContent((nextContent) => {
      nextContent.prologue = {
        ...(nextContent.prologue || {}),
        ...updates,
      };
    });
  };

  const handleResetPrologue = () => {
    updatePrologue(cloneValue(defaultContent.prologue || { lines: [], signoff: '' }));
    setNotice({ tone: 'warning', text: 'Prologue reset to package defaults.' });
  };

  const updateDay = (dayIndex, updates) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;
      Object.assign(day, updates);
    });
  };

  const updateDayId = (dayIndex, id) => {
    updateDay(dayIndex, { id });
  };

  const updateDayPrelude = (dayIndex, updates) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;
      day.dayPrelude = {
        ...(day.dayPrelude || {}),
        ...updates,
      };
    });
  };

  const updateEnvelope = (dayIndex, envelopeIndex, updates) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return;

      const nextEnvelope = {
        ...currentEnvelope,
        ...updates,
      };
      envelopes[envelopeIndex] = nextEnvelope;
      syncDayEnvelopes(day, envelopes);
    });
  };

  const updateEnvelopeId = (dayIndex, envelopeIndex, id) => {
    updateContentAndFlow((nextContent, nextFlowMap) => {
      const day = nextContent.days[dayIndex];
      if (!day) return false;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return false;

      const previousId = currentEnvelope.id || '';
      currentEnvelope.id = id;
      envelopes[envelopeIndex] = currentEnvelope;
      syncDayEnvelopes(day, envelopes);

      if (previousId !== id) {
        nextFlowMap.rules = nextFlowMap.rules.map((rule) =>
          rule.targetEnvelopeId === previousId ? { ...rule, targetEnvelopeId: id } : rule,
        );
      }

      return true;
    });
  };

  const updateChoice = (dayIndex, envelopeIndex, choiceIndex, updates) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return;

      const choices = Array.isArray(currentEnvelope.choices)
        ? currentEnvelope.choices.map(cloneValue)
        : [];
      const currentChoice = choices[choiceIndex];
      if (!currentChoice) return;

      const { card: cardUpdates, ...choiceUpdates } = updates;
      const nextChoice = {
        ...currentChoice,
        ...choiceUpdates,
        card: {
          ...(currentChoice.card || {}),
          ...(cardUpdates || {}),
        },
      };

      choices[choiceIndex] = nextChoice;
      currentEnvelope.choices = choices;
      envelopes[envelopeIndex] = currentEnvelope;
      syncDayEnvelopes(day, envelopes);
    });
  };

  const updateChoiceId = (dayIndex, envelopeIndex, choiceIndex, id) => {
    updateContentAndFlow((nextContent, nextFlowMap) => {
      const day = nextContent.days[dayIndex];
      if (!day) return false;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return false;

      const choices = Array.isArray(currentEnvelope.choices)
        ? currentEnvelope.choices.map(cloneValue)
        : [];
      const currentChoice = choices[choiceIndex];
      if (!currentChoice) return false;

      const previousId = currentChoice.id || '';
      currentChoice.id = id;
      choices[choiceIndex] = currentChoice;
      currentEnvelope.choices = choices;
      envelopes[envelopeIndex] = currentEnvelope;
      syncDayEnvelopes(day, envelopes);

      if (previousId !== id) {
        nextFlowMap.rules = nextFlowMap.rules.map((rule) =>
          rule.sourceChoiceId === previousId ? { ...rule, sourceChoiceId: id } : rule,
        );
      }

      return true;
    });
  };

  const addDay = () => {
    if (content.days.length >= MAX_STORY_DAYS) {
      setNotice({
        tone: 'warning',
        text: `Workspace content is capped at ${MAX_STORY_DAYS} canonical days. Use branch-only envelopes inside day five for overflow paths.`,
      });
      return;
    }

    updateContent((nextContent) => {
      nextContent.days.push(createDefaultDay(nextContent));
    });
    setActiveDayIndex(content.days.length);
    setActiveEnvelopeIndex(0);
    setActiveChoiceIndex(0);
    setNotice({ tone: 'success', text: 'Day added with a valid starter envelope and choice.' });
  };

  const removeDay = (dayIndex) => {
    if (content.days.length <= 1) return;
    if (
      !shouldContinueDanger(
        'Remove this day? Its envelopes, choices, and dependent explicit flow rules will be removed from the draft.',
      )
    ) {
      return;
    }

    updateContentAndFlow((nextContent, nextFlowMap) => {
      const day = nextContent.days[dayIndex];
      if (!day) return false;

      const envelopes = getDayEnvelopes(day);
      const removedEnvelopeIds = new Set(envelopes.map((envelope) => envelope?.id).filter(Boolean));
      const removedChoiceIds = new Set(
        envelopes.flatMap((envelope) => Array.from(getEnvelopeChoiceIds(envelope))),
      );

      nextContent.days.splice(dayIndex, 1);
      nextFlowMap.rules = nextFlowMap.rules.filter(
        (rule) =>
          !removedChoiceIds.has(rule.sourceChoiceId) &&
          !removedEnvelopeIds.has(rule.targetEnvelopeId),
      );

      return true;
    });

    setActiveDayIndex(Math.max(0, Math.min(dayIndex, content.days.length - 2)));
    setActiveEnvelopeIndex(0);
    setActiveChoiceIndex(0);
    setNotice({ tone: 'warning', text: 'Day removed. Dependent explicit routes were pruned.' });
  };

  const addEnvelope = (dayIndex) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const envelope = createDefaultEnvelope(nextContent, dayIndex, day, envelopes);
      syncDayEnvelopes(day, [...envelopes, envelope]);
    });
    setActiveEnvelopeIndex(selectedEnvelopes.length);
    setActiveChoiceIndex(0);
    setNotice({ tone: 'success', text: 'Envelope added with one valid starter choice.' });
  };

  const removeEnvelope = (dayIndex, envelopeIndex) => {
    if (selectedEnvelopes.length <= 1) return;
    if (
      !shouldContinueDanger(
        'Remove this envelope? Its choices and dependent explicit flow rules will be removed from the draft.',
      )
    ) {
      return;
    }

    updateContentAndFlow((nextContent, nextFlowMap) => {
      const day = nextContent.days[dayIndex];
      if (!day) return false;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const removedEnvelope = envelopes[envelopeIndex];
      if (!removedEnvelope) return false;

      const removedEnvelopeIds = new Set([removedEnvelope.id].filter(Boolean));
      const removedChoiceIds = getEnvelopeChoiceIds(removedEnvelope);
      syncDayEnvelopes(
        day,
        envelopes.filter((_, index) => index !== envelopeIndex),
      );
      nextFlowMap.rules = nextFlowMap.rules.filter(
        (rule) =>
          !removedChoiceIds.has(rule.sourceChoiceId) &&
          !removedEnvelopeIds.has(rule.targetEnvelopeId),
      );

      return true;
    });

    setActiveEnvelopeIndex(Math.max(0, Math.min(envelopeIndex, selectedEnvelopes.length - 2)));
    setActiveChoiceIndex(0);
    setNotice({ tone: 'warning', text: 'Envelope removed. Dependent explicit routes were pruned.' });
  };

  const moveEnvelope = (dayIndex, envelopeIndex, direction) => {
    const nextIndex = envelopeIndex + direction;
    if (nextIndex < 0 || nextIndex >= selectedEnvelopes.length) return;

    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const movingEnvelope = envelopes[envelopeIndex];
      if (!movingEnvelope) return;

      envelopes[envelopeIndex] = envelopes[nextIndex];
      envelopes[nextIndex] = movingEnvelope;
      syncDayEnvelopes(day, envelopes);
    });
    setActiveEnvelopeIndex(nextIndex);
    setActiveChoiceIndex(0);
    setNotice({ tone: 'success', text: 'Envelope order updated.' });
  };

  const addChoice = (dayIndex, envelopeIndex) => {
    updateContent((nextContent) => {
      const day = nextContent.days[dayIndex];
      if (!day) return;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return;

      const choices = Array.isArray(currentEnvelope.choices)
        ? currentEnvelope.choices.map(cloneValue)
        : [];
      currentEnvelope.choices = [
        ...choices,
        createDefaultChoice(nextContent, currentEnvelope, choices),
      ];
      envelopes[envelopeIndex] = currentEnvelope;
      syncDayEnvelopes(day, envelopes);
    });
    setActiveChoiceIndex(selectedChoices.length);
    setNotice({ tone: 'success', text: 'Choice added with a valid starter card.' });
  };

  const removeChoice = (dayIndex, envelopeIndex, choiceIndex) => {
    if (selectedChoices.length <= 1) return;
    if (
      !shouldContinueDanger(
        'Remove this choice? Its dependent explicit flow rules will be removed from the draft.',
      )
    ) {
      return;
    }

    updateContentAndFlow((nextContent, nextFlowMap) => {
      const day = nextContent.days[dayIndex];
      if (!day) return false;

      const envelopes = getDayEnvelopes(day).map(cloneValue);
      const currentEnvelope = envelopes[envelopeIndex];
      if (!currentEnvelope) return false;

      const choices = Array.isArray(currentEnvelope.choices)
        ? currentEnvelope.choices.map(cloneValue)
        : [];
      const removedChoice = choices[choiceIndex];
      if (!removedChoice) return false;

      currentEnvelope.choices = choices.filter((_, index) => index !== choiceIndex);
      envelopes[envelopeIndex] = currentEnvelope;
      syncDayEnvelopes(day, envelopes);
      nextFlowMap.rules = nextFlowMap.rules.filter(
        (rule) => rule.sourceChoiceId !== removedChoice.id,
      );

      return true;
    });

    setActiveChoiceIndex(Math.max(0, Math.min(choiceIndex, selectedChoices.length - 2)));
    setNotice({ tone: 'warning', text: 'Choice removed. Dependent explicit routes were pruned.' });
  };

  const getChoiceAt = (dayIndex, envelopeIndex, choiceIndex) => {
    const day = content.days[dayIndex];
    const envelope = day ? getDayEnvelopes(day)[envelopeIndex] : null;
    const choices = Array.isArray(envelope?.choices) ? envelope.choices : [];
    return choices[choiceIndex] || null;
  };

  const getChoiceInputs = (dayIndex, envelopeIndex, choiceIndex) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    return Array.isArray(choice?.card?.inputs) ? choice.card.inputs : [];
  };

  const updateChoiceInputs = (dayIndex, envelopeIndex, choiceIndex, inputs) => {
    updateChoice(dayIndex, envelopeIndex, choiceIndex, {
      card: { inputs },
    });
  };

  const getChoiceRevealItems = (dayIndex, envelopeIndex, choiceIndex) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    return Array.isArray(choice?.card?.revealItems) ? choice.card.revealItems : [];
  };

  const updateChoiceRevealItems = (dayIndex, envelopeIndex, choiceIndex, revealItems) => {
    updateChoice(dayIndex, envelopeIndex, choiceIndex, {
      card: { revealItems },
    });
  };

  const addResponseInput = (dayIndex, envelopeIndex, choiceIndex) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    if (!choice) return;

    const inputs = getChoiceInputs(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    updateChoiceInputs(dayIndex, envelopeIndex, choiceIndex, [
      ...inputs,
      createDefaultResponseInput(choice, inputs),
    ]);
  };

  const updateResponseInput = (dayIndex, envelopeIndex, choiceIndex, inputIndex, updates) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    const inputs = getChoiceInputs(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    const currentInput = inputs[inputIndex];
    if (!currentInput) return;

    const nextInput = {
      ...currentInput,
      ...updates,
    };

    if (Object.hasOwn(updates, 'type')) {
      nextInput.type = normalizeInputType(updates.type);
      if (isSelectInputType(nextInput.type) && !Array.isArray(nextInput.options)) {
        nextInput.options = ['Option 1', 'Option 2'];
      }
    }

    inputs[inputIndex] = nextInput;
    updateChoiceInputs(dayIndex, envelopeIndex, choiceIndex, inputs);

    if (
      choice?.id &&
      Object.hasOwn(updates, 'id') &&
      currentInput.id &&
      currentInput.id !== updates.id
    ) {
      updateFlowRules(
        explicitFlowRules.map((rule) =>
          rule.sourceChoiceId === choice.id && rule.sourceFieldId === currentInput.id
            ? { ...rule, sourceFieldId: updates.id }
            : rule,
        ),
      );
    }
  };

  const removeResponseInput = (dayIndex, envelopeIndex, choiceIndex, inputIndex) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    const inputs = getChoiceInputs(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    const removedInput = inputs[inputIndex];
    updateChoiceInputs(
      dayIndex,
      envelopeIndex,
      choiceIndex,
      inputs.filter((_, index) => index !== inputIndex),
    );

    if (choice?.id && removedInput?.id) {
      updateFlowRules(
        explicitFlowRules.filter(
          (rule) =>
            rule.sourceChoiceId !== choice.id || rule.sourceFieldId !== removedInput.id,
        ),
      );
    }
  };

  const addRevealItem = (dayIndex, envelopeIndex, choiceIndex) => {
    const choice = getChoiceAt(dayIndex, envelopeIndex, choiceIndex);
    if (!choice) return;

    const revealItems = getChoiceRevealItems(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    updateChoiceRevealItems(dayIndex, envelopeIndex, choiceIndex, [
      ...revealItems,
      createDefaultRevealItem(choice, revealItems),
    ]);
  };

  const updateRevealItem = (
    dayIndex,
    envelopeIndex,
    choiceIndex,
    revealItemIndex,
    updates,
  ) => {
    const revealItems = getChoiceRevealItems(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    const currentItem = revealItems[revealItemIndex];
    if (!currentItem) return;

    revealItems[revealItemIndex] = {
      ...currentItem,
      ...updates,
    };
    updateChoiceRevealItems(dayIndex, envelopeIndex, choiceIndex, revealItems);
  };

  const removeRevealItem = (dayIndex, envelopeIndex, choiceIndex, revealItemIndex) => {
    const revealItems = getChoiceRevealItems(dayIndex, envelopeIndex, choiceIndex).map(cloneValue);
    updateChoiceRevealItems(
      dayIndex,
      envelopeIndex,
      choiceIndex,
      revealItems.filter((_, index) => index !== revealItemIndex),
    );
  };

  const updateFlowRules = (rules) => {
    setDraft((current) => ({
      ...current,
      flowMap: {
        ...(current.flowMap || {}),
        rules,
      },
    }));
  };

  const addFlowRule = (sourceChoiceId = selectedFlowSourceChoiceId) => {
    if (!sourceChoiceId) return;

    const targetEnvelopeId = autoRouteMap.get(sourceChoiceId) || routeEnvelopeOptions[0]?.id || '';
    updateFlowRules([
      ...explicitFlowRules,
      createDefaultFlowRule(sourceChoiceId, targetEnvelopeId, explicitFlowRules),
    ]);
    setNewFlowSourceChoiceId(sourceChoiceId);
    setNotice({ tone: 'success', text: 'Route rule added to the draft.' });
  };

  const updateFlowRule = (ruleId, updates) => {
    updateFlowRules(
      explicitFlowRules.map((rule) => {
        if (rule.id !== ruleId) return rule;

        const nextRule = {
          ...rule,
          ...updates,
        };

        if (Object.hasOwn(updates, 'sourceChoiceId')) {
          nextRule.sourceFieldId = '';
          nextRule.targetEnvelopeId =
            autoRouteMap.get(updates.sourceChoiceId) ||
            nextRule.targetEnvelopeId ||
            routeEnvelopeOptions[0]?.id ||
            '';
        }

        if (Object.hasOwn(updates, 'operator')) {
          if (updates.operator === 'always') {
            nextRule.sourceFieldId = '';
            nextRule.value = '';
          }

          if (updates.operator === 'is_filled') {
            nextRule.value = '';
          }
        }

        return nextRule;
      }),
    );
  };

  const removeFlowRule = (ruleId) => {
    updateFlowRules(explicitFlowRules.filter((rule) => rule.id !== ruleId));
    setNotice({ tone: 'warning', text: 'Route rule removed from the draft.' });
  };

  const clearAiDraft = () => {
    setAiDraftResult(null);
    setAiDraftError('');
  };

  const handleAiTargetTypeChange = (targetType) => {
    setAiTargetType(targetType);
    clearAiDraft();
  };

  const handleAiDayChange = (dayIndex) => {
    setActiveDayIndex(dayIndex);
    setActiveEnvelopeIndex(0);
    setActiveChoiceIndex(0);
    clearAiDraft();
  };

  const handleAiEnvelopeChange = (envelopeIndex) => {
    setActiveEnvelopeIndex(envelopeIndex);
    setActiveChoiceIndex(0);
    clearAiDraft();
  };

  const handleAiChoiceChange = (choiceIndex) => {
    setActiveChoiceIndex(choiceIndex);
    clearAiDraft();
  };

  const handleGenerateAiDraft = async () => {
    if (!canGenerateAiDraft) {
      setAiDraftError('Select a valid draft target first.');
      return;
    }

    setAiDraftLoading(true);
    setAiDraftError('');
    setAiDraftResult(null);

    const endpoint = aiTargetType === 'card' ? '/api/card-draft' : '/api/envelope-draft';
    const payload =
      aiTargetType === 'card'
        ? {
            dayTheme: selectedDay?.theme || '',
            envelopeLabel: selectedEnvelope?.label || selectedEnvelope?.timeLabel || '',
            envelopeIntro: selectedEnvelope?.intro || selectedEnvelope?.choicesIntro || '',
            choice: {
              title: selectedChoice?.title || '',
              hint: selectedChoice?.hint || '',
              heading: selectedChoice?.card?.heading || '',
              body: selectedChoice?.card?.body || '',
              rule: selectedChoice?.card?.rule || '',
            },
            draftGoal: aiDraftGoal,
            tone: aiTone,
            intensity: aiIntensity,
            boundaries: aiBoundaries,
            notes: aiNotes,
          }
        : {
            dayTheme: selectedDay?.theme || '',
            envelopeLabel: selectedEnvelope?.label || selectedEnvelope?.timeLabel || '',
            intro: selectedEnvelope?.intro || '',
            choicesHeading: selectedEnvelope?.choicesHeading || '',
            choicesIntro: selectedEnvelope?.choicesIntro || '',
            draftGoal: aiDraftGoal,
            tone: aiTone,
            intensity: aiIntensity,
            boundaries: aiBoundaries,
            notes: aiNotes,
          };

    try {
      const response = await fetch(getAdminAiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Draft generation failed.');
      }

      if (!data?.draft || typeof data.draft !== 'object') {
        throw new Error('Draft generation returned no draft.');
      }

      setAiDraftResult({
        targetType: aiTargetType,
        dayIndex: safeDayIndex,
        envelopeIndex: safeEnvelopeIndex,
        choiceIndex: safeChoiceIndex,
        targetLabel: selectedAiTargetLabel,
        draft: data.draft,
        model: data.model || '',
        responseId: data.responseId || '',
      });
      setNotice({ tone: 'success', text: 'AI draft staged. Review it before applying fields.' });
    } catch (error) {
      setAiDraftError(error.message || 'Draft generation failed.');
    } finally {
      setAiDraftLoading(false);
    }
  };

  const handleApplyAiDraftField = (field) => {
    if (!aiDraftIsCurrent || !activeAiDraft || !Object.hasOwn(activeAiDraft, field.key)) return;

    const value = activeAiDraft[field.key] || '';

    if (aiTargetType === 'card') {
      updateChoice(
        aiDraftResult.dayIndex,
        aiDraftResult.envelopeIndex,
        aiDraftResult.choiceIndex,
        field.source === 'card' ? { card: { [field.key]: value } } : { [field.key]: value },
      );
    } else {
      updateEnvelope(aiDraftResult.dayIndex, aiDraftResult.envelopeIndex, {
        [field.key]: value,
      });
    }

    setNotice({
      tone: 'success',
      text: `Applied ${field.label} from the staged AI draft. Save the draft to persist it.`,
    });
  };

  const handleApplyAiDraftAll = () => {
    if (!aiDraftIsCurrent || !activeAiDraft) return;

    if (aiTargetType === 'card') {
      const choiceUpdates = {};
      const cardUpdates = {};

      AI_CARD_DRAFT_FIELDS.forEach((field) => {
        if (!Object.hasOwn(activeAiDraft, field.key)) return;
        if (field.source === 'card') {
          cardUpdates[field.key] = activeAiDraft[field.key] || '';
        } else {
          choiceUpdates[field.key] = activeAiDraft[field.key] || '';
        }
      });

      updateChoice(aiDraftResult.dayIndex, aiDraftResult.envelopeIndex, aiDraftResult.choiceIndex, {
        ...choiceUpdates,
        card: cardUpdates,
      });
    } else {
      const envelopeUpdates = {};
      AI_ENVELOPE_DRAFT_FIELDS.forEach((field) => {
        if (Object.hasOwn(activeAiDraft, field.key)) {
          envelopeUpdates[field.key] = activeAiDraft[field.key] || '';
        }
      });

      updateEnvelope(aiDraftResult.dayIndex, aiDraftResult.envelopeIndex, envelopeUpdates);
    }

    setNotice({
      tone: 'success',
      text: 'Applied staged AI draft. Save the draft to persist it.',
    });
  };

  return (
    <main className="admin-shell">
      <aside className="admin-nav" aria-label="Admin sections">
        <div>
          <div className="workspace-label">Between Us</div>
          <h1>Story Workspace</h1>
        </div>
        <nav>
          {sections.map((section) => (
            <button
              className={section === activeSection ? 'active' : ''}
              key={section}
              onClick={() => setActiveSection(section)}
              type="button"
            >
              {section}
            </button>
          ))}
        </nav>
      </aside>

      <section
        className="admin-main"
        aria-labelledby={mainHeadingId}
      >
        <header className="admin-toolbar">
          <div>
            <span className="workspace-label">{activeSection}</span>
            <h2 id={mainHeadingId}>{mainHeading}</h2>
          </div>
          <div className="toolbar-status">
            <span className={`status-pill ${isDirty ? 'warning' : 'success'}`}>
              {isDirty ? 'Unsaved Draft' : 'Draft Saved'}
            </span>
            <span className={`status-pill ${status.tone}`}>{status.label}</span>
            {supabase && (
              <button
                type="button"
                className="control-button"
                style={{ fontSize: '0.75rem', padding: '2px 10px' }}
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {activeSection === 'Overview' ? (
          <>
            <div className="metric-grid" aria-label="Story metrics">
              <div>
                <span>Days</span>
                <strong>{validation.stats.days}</strong>
              </div>
              <div>
                <span>Envelopes</span>
                <strong>{validation.stats.envelopes}</strong>
              </div>
              <div>
                <span>Choices</span>
                <strong>{validation.stats.choices}</strong>
              </div>
              <div>
                <span>Flow Rules</span>
                <strong>{validation.stats.flowRules}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="draft-heading">
              <div className="panel-heading">
                <h3 id="draft-heading">Draft</h3>
                <span>{draft.sourceLabel}</span>
              </div>
              <div className="action-panel">
                <div className="button-row" aria-label="Draft actions">
                  <button className="control-button primary" type="button" onClick={handleSaveDraft}>
                    Save Draft
                  </button>
                  <button className="control-button" type="button" onClick={handleExport}>
                    Export JSON
                  </button>
                  <label className="control-button">
                    Import JSON
                    <input
                      className="visually-hidden"
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImport}
                    />
                  </label>
                  <button className="control-button danger" type="button" onClick={handleResetDraft}>
                    Reset Draft
                  </button>
                </div>
                {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="days-heading">
              <div className="panel-heading">
                <h3 id="days-heading">Days</h3>
                <span>{daySummaries.length} total</span>
              </div>
              <div className="day-table" role="table">
                <div className="table-row table-head" role="row">
                  <span role="columnheader">Day</span>
                  <span role="columnheader">Theme</span>
                  <span role="columnheader">Envelopes</span>
                  <span role="columnheader">Choices</span>
                </div>
                {daySummaries.map((day) => (
                  <div className="table-row" key={day.id} role="row">
                    <span role="cell">{day.label}</span>
                    <span role="cell">{day.theme}</span>
                    <span role="cell">{day.envelopes}</span>
                    <span role="cell">{day.choices}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : activeSection === 'Settings' ? (
          <>
            <div className="metric-grid" aria-label="Settings summary">
              <div>
                <span>Her Name</span>
                <strong>{storySettings.herName || STORY_SETTINGS_DEFAULTS.herName}</strong>
              </div>
              <div>
                <span>His Name</span>
                <strong>{storySettings.hisName || STORY_SETTINGS_DEFAULTS.hisName}</strong>
              </div>
              <div>
                <span>Sync</span>
                <strong>{isDirty ? 'Pending' : 'Current'}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="settings-editor-heading">
              <div className="panel-heading">
                <h3 id="settings-editor-heading">Story Settings</h3>
                <span>{supabase ? 'Saved with the story draft' : 'Local session only'}</span>
              </div>
              <div className="settings-workbench">
                <div className="field-stack">
                  <div className="split-fields">
                    <label className="field-block">
                      <span>Her Name</span>
                      <input
                        value={storySettings.herName}
                        onChange={(event) => updateStorySettings({ herName: event.target.value })}
                      />
                    </label>
                    <label className="field-block">
                      <span>His Name</span>
                      <input
                        value={storySettings.hisName}
                        onChange={(event) => updateStorySettings({ hisName: event.target.value })}
                      />
                    </label>
                  </div>
                  <p className="field-note">
                    Placeholder tokens like <code>{'{{herName}}'}</code> and <code>{'{{hisName}}'}</code> use these story settings.
                  </p>
                  <div className="button-row" aria-label="Story settings actions">
                    <button className="control-button primary" type="button" onClick={handleSaveDraft}>
                      Save Draft
                    </button>
                    <button className="control-button danger" type="button" onClick={handleResetStorySettings}>
                      Reset Story Settings
                    </button>
                  </div>
                  {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
                </div>
                <div className="settings-preview" aria-label="Settings preview">
                  <span>Preview</span>
                  <div className="settings-preview-panel">
                    <div>
                      <span>Addressed To</span>
                      <strong>{replacePlaceholders('{{HerName}}', storySettings)}</strong>
                    </div>
                    <div>
                      <span>Signed</span>
                      <strong>{replacePlaceholders('{{hisName}}', storySettings)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : activeSection === 'Flow' ? (
          <>
            <div className="metric-grid" aria-label="Flow metrics">
              <div>
                <span>Visible Rules</span>
                <strong>{visibleFlowRuleCount}</strong>
              </div>
              <div>
                <span>Explicit Rules</span>
                <strong>{explicitFlowRuleCount}</strong>
              </div>
              <div>
                <span>Auto Defaults</span>
                <strong>{automaticRouteRows.length}</strong>
              </div>
              <div>
                <span>End Points</span>
                <strong>{endingRouteRows.length}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="flow-tools-heading">
              <div className="panel-heading">
                <h3 id="flow-tools-heading">Route Tools</h3>
                <span>{routeChoiceOptions.length} choices</span>
              </div>
              <div className="flow-tools">
                <label className="field-block">
                  <span>Source Choice</span>
                  <select
                    value={selectedFlowSourceChoiceId}
                    disabled={!routeChoiceOptions.length}
                    onChange={(event) => setNewFlowSourceChoiceId(event.target.value)}
                  >
                    {routeChoiceOptions.length ? null : <option value="">No choices</option>}
                    {routeChoiceOptions.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.location} - {choice.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flow-tool-actions">
                  <button
                    className="control-button primary"
                    type="button"
                    disabled={!selectedFlowSourceChoiceId}
                    onClick={() => addFlowRule()}
                  >
                    Add Rule
                  </button>
                  <button className="control-button" type="button" onClick={handleSaveDraft}>
                    Save Draft
                  </button>
                  <button className="control-button" type="button" onClick={handleExport}>
                    Export JSON
                  </button>
                </div>
                {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="automatic-routes-heading">
              <div className="panel-heading">
                <h3 id="automatic-routes-heading">Automatic Defaults</h3>
                <span>{automaticRouteRows.length} routes</span>
              </div>
              {automaticRouteRows.length ? (
                <div className="flow-route-table" role="table">
                  <div className="flow-route-row flow-route-head" role="row">
                    <span role="columnheader">Choice</span>
                    <span role="columnheader">Condition</span>
                    <span role="columnheader">Destination</span>
                    <span role="columnheader">State</span>
                    <span role="columnheader">Action</span>
                  </div>
                  {automaticRouteRows.map((row) => (
                    <div className="flow-route-row" role="row" key={`auto-${row.choice.id}`}>
                      <div role="cell">
                        <strong>{row.choice.title}</strong>
                        <span>{row.choice.location}</span>
                      </div>
                      <span role="cell">Always</span>
                      <div role="cell">
                        <strong>{row.targetEnvelope.label}</strong>
                        <span>{row.targetEnvelope.subtitle}</span>
                      </div>
                      <span
                        className={`status-pill ${
                          row.explicitRules.length ? 'warning' : 'success'
                        }`}
                        role="cell"
                      >
                        {row.explicitRules.length ? 'Customized' : 'Auto'}
                      </span>
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => addFlowRule(row.choice.id)}
                      >
                        Add Rule
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No automatic routes available.</p>
              )}
              {endingRouteRows.length ? (
                <div className="flow-ending-list" aria-label="Choices without automatic routes">
                  {endingRouteRows.map((choice) => (
                    <div key={`ending-${choice.id}`}>
                      <div>
                        <strong>{choice.title}</strong>
                        <span>{choice.location}</span>
                      </div>
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => addFlowRule(choice.id)}
                      >
                        Add Rule
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="data-panel" aria-labelledby="explicit-routes-heading">
              <div className="panel-heading">
                <h3 id="explicit-routes-heading">Explicit Rules</h3>
                <span>{explicitFlowRuleCount} rules</span>
              </div>
              {explicitRouteGroups.length ? (
                <div className="flow-rule-groups">
                  {explicitRouteGroups.map(({ choice, rules }) => {
                    const fallbackEnvelope = routeEnvelopeById.get(autoRouteMap.get(choice.id));

                    return (
                      <div className="flow-rule-group" key={`rules-${choice.id}`}>
                        <div className="flow-source-summary">
                          <div>
                            <span>{choice.location}</span>
                            <strong>{choice.title}</strong>
                            <em>{choice.envelopeLabel}</em>
                          </div>
                          {fallbackEnvelope ? (
                            <small>
                              Fallback: {fallbackEnvelope.label} - {fallbackEnvelope.subtitle}
                            </small>
                          ) : null}
                          {routeChoiceById.has(choice.id) ? (
                            <button
                              className="control-button"
                              type="button"
                              onClick={() => addFlowRule(choice.id)}
                            >
                              Add Rule
                            </button>
                          ) : null}
                        </div>

                        <div className="flow-rule-list">
                          {rules.map((rule, ruleIndex) => {
                            const sourceChoice = routeChoiceById.get(rule.sourceChoiceId);
                            const fieldOptions = sourceChoice?.fields || [];
                            const selectedField = fieldOptions.find(
                              (field) => field.id === rule.sourceFieldId,
                            );
                            const fieldType = normalizeInputType(selectedField?.type);
                            const operator = rule.operator || 'always';
                            const needsField = operator !== 'always';
                            const needsValue = operator === 'equals' || operator === 'contains';
                            const targetEnvelope = routeEnvelopeById.get(rule.targetEnvelopeId);
                            const selectOptions = Array.isArray(selectedField?.options)
                              ? selectedField.options
                              : [];

                            return (
                              <div className="flow-rule-card" key={rule.id}>
                                <div className="flow-rule-header">
                                  <div>
                                    <strong>Rule {ruleIndex + 1}</strong>
                                    <span>{describeFlowRule(rule, selectedField)}</span>
                                  </div>
                                  <button
                                    className="control-button danger"
                                    type="button"
                                    onClick={() => removeFlowRule(rule.id)}
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="flow-rule-grid">
                                  <label className="field-block">
                                    <span>From Choice</span>
                                    <select
                                      value={rule.sourceChoiceId || ''}
                                      onChange={(event) =>
                                        updateFlowRule(rule.id, {
                                          sourceChoiceId: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Select choice</option>
                                      {routeChoiceOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                          {option.location} - {option.title}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="field-block">
                                    <span>Operator</span>
                                    <select
                                      value={operator}
                                      onChange={(event) =>
                                        updateFlowRule(rule.id, { operator: event.target.value })
                                      }
                                    >
                                      {FLOW_OPERATOR_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {needsField ? (
                                    <label className="field-block">
                                      <span>Source Field</span>
                                      <select
                                        value={rule.sourceFieldId || ''}
                                        onChange={(event) =>
                                          updateFlowRule(rule.id, {
                                            sourceFieldId: event.target.value,
                                          })
                                        }
                                      >
                                        <option value="">Select field</option>
                                        {fieldOptions.map((field) => (
                                          <option key={field.id} value={field.id}>
                                            {field.label || field.id}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  ) : null}

                                  {needsValue ? (
                                    <label className="field-block">
                                      <span>Comparison Value</span>
                                      {isSelectInputType(fieldType) && selectOptions.length ? (
                                        <select
                                          value={rule.value || ''}
                                          onChange={(event) =>
                                            updateFlowRule(rule.id, { value: event.target.value })
                                          }
                                        >
                                          <option value="">Select value</option>
                                          {selectOptions.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          value={rule.value || ''}
                                          onChange={(event) =>
                                            updateFlowRule(rule.id, { value: event.target.value })
                                          }
                                        />
                                      )}
                                    </label>
                                  ) : null}

                                  <label className="field-block">
                                    <span>Target Envelope</span>
                                    <select
                                      value={rule.targetEnvelopeId || ''}
                                      onChange={(event) =>
                                        updateFlowRule(rule.id, {
                                          targetEnvelopeId: event.target.value,
                                        })
                                      }
                                    >
                                      <option value="">Select envelope</option>
                                      {routeEnvelopeOptions.map((envelope) => (
                                        <option key={envelope.id} value={envelope.id}>
                                          {envelope.label} - {envelope.subtitle}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>

                                {targetEnvelope ? (
                                  <div className="flow-target-preview">
                                    <strong>{targetEnvelope.label}</strong>
                                    <span>{targetEnvelope.subtitle}</span>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">No explicit route rules.</p>
              )}
            </section>
          </>
        ) : activeSection === 'AI Drafts' ? (
          <>
            <div className="metric-grid" aria-label="AI draft metrics">
              <div>
                <span>Target</span>
                <strong>{aiTargetType === 'card' ? 'Card' : 'Envelope'}</strong>
              </div>
              <div>
                <span>Fields</span>
                <strong>{selectedAiFields.length}</strong>
              </div>
              <div>
                <span>Staged Changes</span>
                <strong>{activeAiDraft ? aiChangedFieldCount : 0}</strong>
              </div>
              <div>
                <span>Server</span>
                <strong>{ADMIN_AI_BASE_URL ? 'Local' : 'Origin'}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="ai-setup-heading">
              <div className="panel-heading">
                <h3 id="ai-setup-heading">Draft Setup</h3>
                <span>{selectedAiTargetLabel}</span>
              </div>
              <div className="ai-workbench">
                <div className="field-stack">
                  <div className="segmented-control" aria-label="AI draft target">
                    <button
                      className={aiTargetType === 'card' ? 'active' : ''}
                      type="button"
                      onClick={() => handleAiTargetTypeChange('card')}
                    >
                      Card
                    </button>
                    <button
                      className={aiTargetType === 'envelope' ? 'active' : ''}
                      type="button"
                      onClick={() => handleAiTargetTypeChange('envelope')}
                    >
                      Envelope
                    </button>
                  </div>
                  <div className="split-fields">
                    <label className="field-block">
                      <span>Day</span>
                      <select
                        value={safeDayIndex}
                        disabled={!content.days.length}
                        onChange={(event) => handleAiDayChange(Number(event.target.value))}
                      >
                        {content.days.map((day, index) => (
                          <option key={day.id || `ai-day-${index}`} value={index}>
                            Day {index + 1} - {day.theme || 'Untitled'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Envelope</span>
                      <select
                        value={safeEnvelopeIndex}
                        disabled={!selectedEnvelopes.length}
                        onChange={(event) => handleAiEnvelopeChange(Number(event.target.value))}
                      >
                        {selectedEnvelopes.map((envelope, index) => (
                          <option key={envelope.id || `ai-envelope-${index}`} value={index}>
                            {envelope.timeLabel || `Envelope ${index + 1}`} -{' '}
                            {envelope.label || envelope.id || 'Untitled'}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {aiTargetType === 'card' ? (
                    <label className="field-block">
                      <span>Choice</span>
                      <select
                        value={safeChoiceIndex}
                        disabled={!selectedChoices.length}
                        onChange={(event) => handleAiChoiceChange(Number(event.target.value))}
                      >
                        {selectedChoices.map((choice, index) => (
                          <option key={choice.id || `ai-choice-${index}`} value={index}>
                            {choice.title || choice.id || `Choice ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="field-stack">
                  <div className="split-fields">
                    <label className="field-block">
                      <span>Goal</span>
                      <select
                        value={aiDraftGoal}
                        onChange={(event) => {
                          setAiDraftGoal(event.target.value);
                          clearAiDraft();
                        }}
                      >
                        {AI_DRAFT_GOAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>Tone</span>
                      <select
                        value={aiTone}
                        onChange={(event) => {
                          setAiTone(event.target.value);
                          clearAiDraft();
                        }}
                      >
                        {AI_TONE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field-block">
                    <span>Intensity: {aiIntensity}/10</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={aiIntensity}
                      onChange={(event) => {
                        setAiIntensity(Number(event.target.value));
                        clearAiDraft();
                      }}
                    />
                  </label>
                </div>

                <label className="field-block">
                  <span>Boundaries</span>
                  <textarea
                    value={aiBoundaries}
                    rows={4}
                    onChange={(event) => {
                      setAiBoundaries(event.target.value);
                      clearAiDraft();
                    }}
                  />
                </label>

                <label className="field-block">
                  <span>Notes</span>
                  <textarea
                    value={aiNotes}
                    rows={4}
                    onChange={(event) => {
                      setAiNotes(event.target.value);
                      clearAiDraft();
                    }}
                  />
                </label>

                <div className="ai-workbench-actions">
                  <button
                    className="control-button primary"
                    type="button"
                    disabled={!canGenerateAiDraft || aiDraftLoading}
                    onClick={handleGenerateAiDraft}
                  >
                    {aiDraftLoading ? 'Generating' : 'Generate Draft'}
                  </button>
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => setActiveSection('Story')}
                  >
                    Open Story Target
                  </button>
                  <button className="control-button" type="button" onClick={handleSaveDraft}>
                    Save Draft
                  </button>
                </div>
                {aiDraftError ? <p className="notice error">{aiDraftError}</p> : null}
                {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="ai-current-heading">
              <div className="panel-heading">
                <h3 id="ai-current-heading">Current Target</h3>
                <span>{selectedAiTargetLabel}</span>
              </div>
              {canGenerateAiDraft ? (
                <div className="ai-field-grid">
                  {aiFieldRows.map((field) => (
                    <div className="ai-field-card" key={`current-${field.key}`}>
                      <span>{field.label}</span>
                      <p>{field.currentValue || 'Empty'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No draft target available.</p>
              )}
            </section>

            <section className="data-panel" aria-labelledby="ai-staged-heading">
              <div className="panel-heading">
                <h3 id="ai-staged-heading">Staged Draft</h3>
                <span>{activeAiDraft ? `${aiChangedFieldCount} changed` : 'No staged draft'}</span>
              </div>
              {activeAiDraft ? (
                <div className="ai-draft-stage">
                  <div className="ai-draft-meta">
                    <span className="status-pill warning">Not Applied</span>
                    {aiDraftResult.model ? (
                      <span className="status-pill">{aiDraftResult.model}</span>
                    ) : null}
                    {activeAiDraft.rationale ? <p>{activeAiDraft.rationale}</p> : null}
                  </div>
                  <div className="ai-draft-list">
                    {aiFieldRows.map((field) => (
                      <div
                        className={`ai-draft-row ${field.changed ? 'changed' : ''}`}
                        key={`draft-${field.key}`}
                      >
                        <div>
                          <span>{field.label}</span>
                          <strong>{field.changed ? 'Changed' : 'Same'}</strong>
                        </div>
                        <p className="ai-current-value">{field.currentValue || 'Empty'}</p>
                        <p className="ai-draft-value">{field.draftValue || 'Empty'}</p>
                        <button
                          className="control-button"
                          type="button"
                          onClick={() => handleApplyAiDraftField(field)}
                        >
                          Apply Field
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="button-row ai-stage-actions">
                    <button
                      className="control-button primary"
                      type="button"
                      onClick={handleApplyAiDraftAll}
                    >
                      Apply All
                    </button>
                    <button className="control-button danger" type="button" onClick={clearAiDraft}>
                      Discard
                    </button>
                    <button className="control-button" type="button" onClick={handleSaveDraft}>
                      Save Draft
                    </button>
                  </div>
                </div>
              ) : (
                <p className="empty-state">Generate a draft to stage field-level changes here.</p>
              )}
            </section>
          </>
        ) : activeSection === 'Snapshots' ? (
          <>
            <div className="metric-grid" aria-label="Snapshot metrics">
              <div>
                <span>Snapshots</span>
                <strong>{snapshots.length}</strong>
              </div>
              <div>
                <span>Limit</span>
                <strong>{MAX_ADMIN_SNAPSHOTS}</strong>
              </div>
              <div>
                <span>Current Matches</span>
                <strong>{snapshotRows.filter((row) => row.isCurrent).length}</strong>
              </div>
              <div>
                <span>Unsaved State</span>
                <strong>{isDirty ? 'Dirty' : 'Clean'}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="snapshot-tools-heading">
              <div className="panel-heading">
                <h3 id="snapshot-tools-heading">Snapshot Tools</h3>
                <span>{draft.sourceLabel}</span>
              </div>
              <div className="snapshot-workbench">
                <label className="field-block">
                  <span>Name</span>
                  <input
                    value={snapshotName}
                    placeholder="Snapshot name"
                    onChange={(event) => setSnapshotName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleSaveSnapshot();
                    }}
                  />
                </label>
                <div className="snapshot-workbench-actions">
                  <button className="control-button primary" type="button" onClick={handleSaveSnapshot}>
                    Save Snapshot
                  </button>
                  <button className="control-button" type="button" onClick={handleSaveDraft}>
                    Save Draft
                  </button>
                  <button className="control-button" type="button" onClick={handleExport}>
                    Export Current
                  </button>
                </div>
                {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="snapshot-compare-heading">
              <div className="panel-heading">
                <h3 id="snapshot-compare-heading">Compare</h3>
                <span>{activeSnapshotRow ? activeSnapshotRow.snapshot.name : 'No snapshot'}</span>
              </div>
              {activeSnapshotRow ? (
                <div className="snapshot-compare-grid">
                  <div className="snapshot-compare-summary">
                    <span className={`status-pill ${activeSnapshotRow.status.tone}`}>
                      {activeSnapshotRow.status.label}
                    </span>
                    <div>
                      <h4>{activeSnapshotRow.snapshot.name}</h4>
                      <p>{formatDateTime(activeSnapshotRow.snapshot.timestamp)}</p>
                    </div>
                    <div className="snapshot-state-row">
                      <span className={`status-pill ${activeSnapshotRow.isCurrent ? 'success' : 'warning'}`}>
                        {activeSnapshotRow.isCurrent ? 'Matches Current' : 'Differs From Current'}
                      </span>
                      <span className={`status-pill ${isDirty ? 'warning' : 'success'}`}>
                        {isDirty ? 'Current Unsaved' : 'Current Saved'}
                      </span>
                    </div>
                    <div className="snapshot-actions wide">
                      <button
                        type="button"
                        onClick={() => handleRestoreSnapshot(activeSnapshotRow.snapshot)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportSnapshot(activeSnapshotRow.snapshot)}
                      >
                        Export
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => handleDeleteSnapshot(activeSnapshotRow.snapshot.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="snapshot-compare-table" role="table">
                    <div className="snapshot-compare-row snapshot-compare-head" role="row">
                      <span role="columnheader">Metric</span>
                      <span role="columnheader">Current</span>
                      <span role="columnheader">Snapshot</span>
                      <span role="columnheader">Change</span>
                    </div>
                    {snapshotComparisonRows.map(([label, currentValue, snapshotValue]) => (
                      <div className="snapshot-compare-row" role="row" key={label}>
                        <span role="cell">{label}</span>
                        <strong role="cell">{currentValue}</strong>
                        <strong role="cell">{snapshotValue}</strong>
                        <em role="cell">{formatMetricDelta(currentValue, snapshotValue)}</em>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state">No snapshots available for comparison.</p>
              )}
            </section>

            <section className="data-panel" aria-labelledby="snapshot-library-heading">
              <div className="panel-heading">
                <h3 id="snapshot-library-heading">Snapshot Library</h3>
                <span>
                  {snapshots.length} / {MAX_ADMIN_SNAPSHOTS}
                </span>
              </div>
              {snapshotRows.length ? (
                <div className="snapshot-table" role="table">
                  <div className="snapshot-table-row snapshot-table-head" role="row">
                    <span role="columnheader">Snapshot</span>
                    <span role="columnheader">Content</span>
                    <span role="columnheader">Flow</span>
                    <span role="columnheader">State</span>
                    <span role="columnheader">Actions</span>
                  </div>
                  {snapshotRows.map((row) => (
                    <div
                      className={`snapshot-table-row ${
                        row.snapshot.id === activeSnapshotRow?.snapshot.id ? 'active' : ''
                      }`}
                      role="row"
                      key={row.snapshot.id}
                    >
                      <div role="cell">
                        <strong>{row.snapshot.name}</strong>
                        <span>{formatDateTime(row.snapshot.timestamp)}</span>
                      </div>
                      <div role="cell">
                        <strong>{row.metrics.days} days</strong>
                        <span>
                          {row.metrics.envelopes} envelopes - {row.metrics.choices} choices
                        </span>
                      </div>
                      <div role="cell">
                        <strong>{row.metrics.visibleFlowRules} visible</strong>
                        <span>{row.metrics.explicitFlowRules} explicit</span>
                      </div>
                      <div className="snapshot-status-stack" role="cell">
                        <span className={`status-pill ${row.status.tone}`}>{row.status.label}</span>
                        <span className={`status-pill ${row.isCurrent ? 'success' : 'warning'}`}>
                          {row.isCurrent ? 'Current' : 'Different'}
                        </span>
                      </div>
                      <div className="snapshot-actions" role="cell">
                        <button type="button" onClick={() => handleCompareSnapshot(row.snapshot)}>
                          Compare
                        </button>
                        <button type="button" onClick={() => handleRestoreSnapshot(row.snapshot)}>
                          Restore
                        </button>
                        <button type="button" onClick={() => handleExportSnapshot(row.snapshot)}>
                          Export
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => handleDeleteSnapshot(row.snapshot.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No snapshots saved.</p>
              )}
            </section>
          </>
        ) : activeSection === 'Responses' ? (
          <>
            <div className="metric-grid" aria-label="Response metrics">
              <div>
                <span>Form Responses</span>
                <strong>{playerResponses ? Object.keys(playerResponses).length : 0}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{playerResponses ? 'Receiving' : 'Waiting'}</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="responses-heading">
              <div className="panel-heading">
                <h3 id="responses-heading">Player Form Input (Read-Only)</h3>
                <span>Realtime from Supabase. Latest response wins per envelope and choice.</span>
              </div>

              {!playerResponses ? (
                <p className="empty-state">No responses yet. Player needs to fill in a form field.</p>
              ) : Object.keys(playerResponses).length === 0 ? (
                <p className="empty-state">No form input yet. The player needs to interact with a choice to see responses.</p>
              ) : (
                <div className="responses-list">
                  {Object.entries(playerResponses).map(([key, fieldResponses]) => {
                    const [envelopeId, choiceId] = key.split('::');
                    const envelope = flattenStoryEnvelopes(content).find(
                      (item) => item.envelope?.id === envelopeId,
                    );
                    const choice = envelope?.envelope?.choices?.find((c) => c.id === choiceId);

                    return (
                      <div key={key} className="response-group">
                        <div className="response-group-header">
                          <strong>{envelope?.envelope?.label || envelopeId}</strong>
                          <span className="response-choice">{choice?.title || choiceId}</span>
                        </div>
                        <div className="response-fields">
                          {Object.entries(fieldResponses).map(([fieldId, fieldValue]) => {
                            const input = choice?.card?.inputs?.find((inp) => inp.id === fieldId);
                            return (
                              <div key={fieldId} className="response-field">
                                <span className="response-field-label">
                                  {input?.label || fieldId}
                                </span>
                                <span className="response-field-value">
                                  {Array.isArray(fieldValue) ? fieldValue.join(', ') : String(fieldValue || '')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="panel-info-note">
              <p>
                <strong>Shared backend sync:</strong> These responses come from Supabase, so desktop admin and
                mobile player stay in sync as long as the player is writing responses successfully.
              </p>
            </div>
          </>
        ) : activeSection === 'Publish' ? (
          <>
            <div className="metric-grid" aria-label="Publish metrics">
              <div>
                <span>Release State</span>
                <strong>{canPublish ? 'Ready' : 'Blocked'}</strong>
              </div>
              <div>
                <span>Warnings</span>
                <strong>{publishWarningCount}</strong>
              </div>
              <div>
                <span>Snapshot</span>
                <strong>{currentSnapshotRow ? 'Current' : 'Needed'}</strong>
              </div>
              <div>
                <span>Export</span>
                <strong>Wrapper</strong>
              </div>
            </div>

            <section className="data-panel" aria-labelledby="publish-readiness-heading">
              <div className="panel-heading">
                <h3 id="publish-readiness-heading">Release Readiness</h3>
                <span>{canPublish ? 'Exportable' : 'Blocked'}</span>
              </div>
              <div className="publish-checklist">
                {publishReadinessItems.map((item) => (
                  <div className="publish-check" key={item.label}>
                    <span className={`status-pill ${item.tone}`}>{item.label}</span>
                    <strong>{item.detail}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="publish-export-heading">
              <div className="panel-heading">
                <h3 id="publish-export-heading">Release Export</h3>
                <span>{createReleaseFilename()}</span>
              </div>
              <div className="publish-workbench">
                <div className="publish-summary">
                  <div>
                    <span>Export Format</span>
                    <strong>{'{ content, flowMap }'}</strong>
                    <p>
                      This is the same JSON wrapper accepted by Import JSON and the content
                      validator.
                    </p>
                  </div>
                  <div>
                    <span>Current Draft</span>
                    <strong>{draft.sourceLabel}</strong>
                    <p>
                      {isDirty
                        ? 'There are unsaved editor changes. Export still uses the current in-memory draft.'
                        : supabase
                          ? 'The current draft matches the last saved Supabase state.'
                          : 'The current draft matches the last local editor state.'}
                    </p>
                  </div>
                </div>

                <div className="publish-actions">
                  {supabase ? (
                    <button
                      className="control-button primary"
                      type="button"
                      disabled={!canPublish || publishLoading}
                      onClick={handlePublishStory}
                    >
                      {publishLoading ? 'Publishing Live…' : 'Publish Live Story'}
                    </button>
                  ) : null}
                  {canSavePackageCopy ? (
                    <button
                      className="control-button"
                      type="button"
                      disabled={!canPublish}
                      onClick={handleSaveToFile}
                    >
                      Save Package Copy
                    </button>
                  ) : null}
                  <button className="control-button" type="button" onClick={handleSaveDraft}>
                    Save Draft
                  </button>
                  <button
                    className="control-button"
                    type="button"
                    onClick={handleSaveSnapshot}
                  >
                    Save Snapshot
                  </button>
                  <button
                    className="control-button primary"
                    type="button"
                    disabled={!canPublish}
                    onClick={handlePublishExport}
                  >
                    Export Release JSON
                  </button>
                  <button
                    className="control-button primary"
                    type="button"
                    disabled={!canPublish}
                    onClick={handlePublishSnapshotAndExport}
                  >
                    Snapshot And Export
                  </button>
                </div>
                {!canPublish ? (
                  <p className="notice error">Fix validation errors before exporting a release.</p>
                ) : null}
                {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="publish-snapshot-heading">
              <div className="panel-heading">
                <h3 id="publish-snapshot-heading">Snapshot Context</h3>
                <span>{activeSnapshotRow ? activeSnapshotRow.snapshot.name : 'No snapshot'}</span>
              </div>
              {activeSnapshotRow ? (
                <div className="publish-snapshot-grid">
                  <div className="publish-snapshot-card">
                    <span className={`status-pill ${activeSnapshotRow.status.tone}`}>
                      {activeSnapshotRow.status.label}
                    </span>
                    <div>
                      <h4>{activeSnapshotRow.snapshot.name}</h4>
                      <p>{formatDateTime(activeSnapshotRow.snapshot.timestamp)}</p>
                    </div>
                    <span className={`status-pill ${activeSnapshotRow.isCurrent ? 'success' : 'warning'}`}>
                      {activeSnapshotRow.isCurrent ? 'Matches Current Draft' : 'Differs From Current Draft'}
                    </span>
                    <div className="button-row">
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => setActiveSection('Snapshots')}
                      >
                        Open Snapshots
                      </button>
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => handleExportSnapshot(activeSnapshotRow.snapshot)}
                      >
                        Export Snapshot
                      </button>
                    </div>
                  </div>

                  <div className="snapshot-compare-table" role="table">
                    <div className="snapshot-compare-row snapshot-compare-head" role="row">
                      <span role="columnheader">Metric</span>
                      <span role="columnheader">Current</span>
                      <span role="columnheader">Snapshot</span>
                      <span role="columnheader">Change</span>
                    </div>
                    {snapshotComparisonRows.map(([label, currentValue, snapshotValue]) => (
                      <div className="snapshot-compare-row" role="row" key={`publish-${label}`}>
                        <span role="cell">{label}</span>
                        <strong role="cell">{currentValue}</strong>
                        <strong role="cell">{snapshotValue}</strong>
                        <em role="cell">{formatMetricDelta(currentValue, snapshotValue)}</em>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state">Save a snapshot to anchor this release checkpoint.</p>
              )}
            </section>
          </>
        ) : activeSection === 'Notifications' ? (
          <>
            <section className="data-panel" aria-labelledby="notifications-heading">
              <div className="panel-heading">
                <h3 id="notifications-heading">Notification Schedule</h3>
                <span>
                  {content.days.flatMap((d) => getDayEnvelopes(d)).filter((e) => e?.scheduledAt && e?.notify !== false).length} scheduled
                </span>
              </div>
              <p style={{ padding: '0 0 12px', color: 'var(--ink-muted, #6b5c48)', fontSize: '0.85rem' }}>
                Notifications are driven by the <strong>Scheduled At</strong> field on each envelope in the Story editor.
                Set a date/time there and check "Send notification" — then Publish. The Supabase Edge Function fires
                the push at that time.
              </p>
              <div className="notification-schedule-list">
                {content.days.map((day, dayIndex) =>
                  getDayEnvelopes(day).map((envelope, envIndex) => {
                    if (!envelope) return null;
                    const hasTime = !!envelope.scheduledAt;
                    const willNotify = hasTime && envelope.notify !== false;
                    return (
                      <div
                        key={envelope.id || `${dayIndex}-${envIndex}`}
                        className={`notif-row ${willNotify ? 'notif-row--active' : 'notif-row--off'}`}
                      >
                        <div className="notif-row-meta">
                          <span className="notif-row-label">
                            Day {dayIndex + 1} · {envelope.timeLabel || `Envelope ${envIndex + 1}`}
                          </span>
                          <span className={`status-pill ${willNotify ? 'success' : 'neutral'}`}>
                            {willNotify ? 'Will notify' : hasTime ? 'Notify off' : 'No time set'}
                          </span>
                        </div>
                        <div className="notif-row-time">
                          {hasTime
                            ? new Date(envelope.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                            : '—'}
                        </div>
                        <div className="notif-row-fields">
                          <label className="field-block">
                            <span>Notification Title</span>
                            <input
                              type="text"
                              placeholder={`Day ${dayIndex + 1} is here`}
                              value={envelope.notificationTitle || ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  notificationTitle: e.target.value,
                                });
                              }}
                            />
                          </label>
                          <label className="field-block">
                            <span>Notification Body</span>
                            <input
                              type="text"
                              placeholder="Your next envelope is waiting."
                              value={envelope.notificationBody || ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  notificationBody: e.target.value,
                                });
                              }}
                            />
                          </label>
                        </div>
                        <div className="notif-row-fields" style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
                          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginBottom: 8, display: 'block' }}>Reminders — if no choice made</span>
                          <label className="field-block">
                            <span>First Reminder At</span>
                            <input
                              type="datetime-local"
                              value={envelope.reminderAt ? envelope.reminderAt.slice(0, 16) : ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                                });
                              }}
                            />
                          </label>
                          <label className="field-block">
                            <span>Repeat Every (minutes)</span>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 60"
                              value={envelope.reminderIntervalMinutes || ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  reminderIntervalMinutes: e.target.value ? parseInt(e.target.value, 10) : null,
                                });
                              }}
                            />
                          </label>
                          <label className="field-block">
                            <span>Max Reminders (0 = unlimited)</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={envelope.reminderMaxCount ?? 0}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  reminderMaxCount: parseInt(e.target.value, 10) || 0,
                                });
                              }}
                            />
                          </label>
                          <label className="field-block">
                            <span>Reminder Title</span>
                            <input
                              type="text"
                              placeholder="Still waiting…"
                              value={envelope.reminderTitle || ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  reminderTitle: e.target.value,
                                });
                              }}
                            />
                          </label>
                          <label className="field-block">
                            <span>Reminder Body</span>
                            <input
                              type="text"
                              placeholder="You still have a choice waiting."
                              value={envelope.reminderBody || ''}
                              onChange={(e) => {
                                updateEnvelope(dayIndex, envIndex, {
                                  reminderBody: e.target.value,
                                });
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="field-note" style={{ marginTop: 16 }}>
                After editing, go to <strong>Publish</strong> to push the updated schedule to Supabase.
                The Edge Function should read the published story data in <code>stories</code>.
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="data-panel" aria-labelledby="placeholder-preview-heading">
              <div className="panel-heading">
                <h3 id="placeholder-preview-heading">Placeholder Preview</h3>
                <span>{placeholderPreviewRows.length} active fields</span>
              </div>
              <div className="placeholder-preview-workbench">
                <p className="field-note">
                  Using story settings:
                  {' '}
                  <strong>{storySettings.herName || STORY_SETTINGS_DEFAULTS.herName}</strong>
                  {' / '}
                  <strong>{storySettings.hisName || STORY_SETTINGS_DEFAULTS.hisName}</strong>
                </p>
                <div className="token-chip-list" aria-label="Supported placeholder tokens">
                  {PLACEHOLDER_TOKEN_OPTIONS.map((option) => (
                    <span key={option.token} title={option.label}>
                      {option.token}
                    </span>
                  ))}
                </div>
                {placeholderPreviewRows.length ? (
                  <div className="placeholder-preview-list">
                    {placeholderPreviewRows.map((row, rowIndex) => (
                      <div className="placeholder-preview-row" key={`${row.label}-${rowIndex}`}>
                        <span>{row.label}</span>
                        <p>{row.preview}</p>
                        <code>{row.raw}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No placeholder tokens in the selected story fields.</p>
                )}
              </div>
            </section>

            <section className="data-panel" aria-labelledby="prologue-editor-heading">
              <div className="panel-heading">
                <h3 id="prologue-editor-heading">Opening Sequence</h3>
                <span>{visiblePrologueLines.length} lines</span>
              </div>
              <div className="editor-grid">
                <div className="field-stack">
                  <label className="field-block">
                    <span>Lines</span>
                    <textarea
                      value={prologueText}
                      rows={11}
                      onChange={(event) =>
                        updatePrologue({ lines: event.target.value.split('\n') })
                      }
                    />
                  </label>
                  <label className="field-block">
                    <span>Sign-off</span>
                    <input
                      value={prologueSignoff}
                      onChange={(event) => updatePrologue({ signoff: event.target.value })}
                    />
                  </label>
                  <div className="button-row" aria-label="Prologue actions">
                    <button className="control-button primary" type="button" onClick={handleSaveDraft}>
                      Save Draft
                    </button>
                    <button className="control-button" type="button" onClick={handleExport}>
                      Export JSON
                    </button>
                    <button className="control-button danger" type="button" onClick={handleResetPrologue}>
                      Reset Prologue
                    </button>
                  </div>
                  {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
                </div>
                <div className="prologue-preview" aria-label="Prologue preview">
                  <span>Preview</span>
                  <div className="preview-letter">
                    {visiblePrologueLines.length ? (
                      visiblePrologueLines.map((line, index) => (
                        <p key={`${line}-${index}`}>{previewCopy(line)}</p>
                      ))
                    ) : (
                      <p className="empty-preview">No prologue lines.</p>
                    )}
                    <strong>{previewCopy(prologueSignoff, 'No sign-off')}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="data-panel" aria-labelledby="day-envelope-editor-heading">
              <div className="panel-heading">
                <h3 id="day-envelope-editor-heading">Days And Envelopes</h3>
                <span>{content.days.length} days</span>
              </div>
              {selectedDay ? (
                <>
                  <div className="story-editor-grid">
                    <div className="day-picker" aria-label="Day selector">
                      {content.days.map((day, index) => {
                        const envelopes = getDayEnvelopes(day);

                        return (
                          <button
                            className={index === safeDayIndex ? 'active' : ''}
                            key={day.id || `day-${index + 1}`}
                            type="button"
                            onClick={() => {
                              setActiveDayIndex(index);
                              setActiveEnvelopeIndex(0);
                              setActiveChoiceIndex(0);
                            }}
                          >
                            <strong>Day {index + 1}</strong>
                            <span>{day.theme || 'Untitled'}</span>
                            <em>{envelopes.length} envelopes</em>
                          </button>
                        );
                      })}
                      <button
                        className="control-button primary"
                        type="button"
                        disabled={content.days.length >= MAX_STORY_DAYS}
                        onClick={addDay}
                      >
                        Add Day
                      </button>
                    </div>

                    <div className="field-stack">
                    <div className="editor-section-title">
                      <h4>Day {safeDayIndex + 1}</h4>
                      <span>{selectedDay.branchOnly ? 'Branch-only' : 'Main sequence'}</span>
                    </div>
                    <div className="split-fields">
                      <label className="field-block">
                        <span>Day ID</span>
                        <input
                          value={selectedDay.id || ''}
                          onChange={(event) => updateDayId(safeDayIndex, event.target.value)}
                        />
                      </label>
                      <label className="field-block">
                        <span>Theme</span>
                        <input
                          value={selectedDay.theme || ''}
                          onChange={(event) => updateDay(safeDayIndex, { theme: event.target.value })}
                        />
                      </label>
                    </div>
                    <div className="structure-actions">
                      <label className="toggle-field">
                        <input
                          type="checkbox"
                          checked={!!selectedDay.branchOnly}
                          onChange={(event) =>
                            updateDay(safeDayIndex, { branchOnly: event.target.checked })
                          }
                        />
                        <span>Branch-only day</span>
                      </label>
                      <button
                        className="control-button danger"
                        type="button"
                        disabled={content.days.length <= 1}
                        onClick={() => removeDay(safeDayIndex)}
                      >
                        Remove Day
                      </button>
                    </div>

                    <div className="editor-section-title">
                      <h4>Day Prelude</h4>
                      <span>{selectedDay.dayPrelude?.enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <label className="toggle-field">
                      <input
                        type="checkbox"
                        checked={!!selectedDay.dayPrelude?.enabled}
                        onChange={(event) =>
                          updateDayPrelude(safeDayIndex, { enabled: event.target.checked })
                        }
                      />
                      <span>Show prelude before this day</span>
                    </label>
                    <div className="split-fields">
                      <label className="field-block">
                        <span>Kicker</span>
                        <input
                          value={selectedDay.dayPrelude?.kicker || ''}
                          onChange={(event) =>
                            updateDayPrelude(safeDayIndex, { kicker: event.target.value })
                          }
                        />
                      </label>
                      <label className="field-block">
                        <span>Button Label</span>
                        <input
                          value={selectedDay.dayPrelude?.buttonLabel || ''}
                          onChange={(event) =>
                            updateDayPrelude(safeDayIndex, { buttonLabel: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="field-block">
                      <span>Heading</span>
                      <input
                        value={selectedDay.dayPrelude?.heading || ''}
                        onChange={(event) =>
                          updateDayPrelude(safeDayIndex, { heading: event.target.value })
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>Body</span>
                      <textarea
                        value={selectedDay.dayPrelude?.body || ''}
                        rows={5}
                        onChange={(event) =>
                          updateDayPrelude(safeDayIndex, { body: event.target.value })
                        }
                      />
                    </label>
                  </div>

                    <div className="field-stack">
                    <div className="editor-section-title">
                      <h4>Envelope Details</h4>
                      <div className="structure-actions">
                        <span>{selectedEnvelopes.length} in day</span>
                        <button
                          className="control-button"
                          type="button"
                          onClick={() => addEnvelope(safeDayIndex)}
                        >
                          Add Envelope
                        </button>
                      </div>
                    </div>
                    {selectedEnvelopes.length ? (
                      <>
                        <div className="envelope-tabs" aria-label="Envelope selector">
                          {selectedEnvelopes.map((envelope, index) => (
                            <button
                              className={index === safeEnvelopeIndex ? 'active' : ''}
                              key={envelope.id || `${envelope.slot}-${index}`}
                              type="button"
                              onClick={() => {
                                setActiveEnvelopeIndex(index);
                                setActiveChoiceIndex(0);
                              }}
                            >
                              <strong>{envelope.timeLabel || `Envelope ${index + 1}`}</strong>
                              <span>{envelope.label || envelope.id || 'Untitled'}</span>
                            </button>
                          ))}
                        </div>
                        {selectedEnvelope ? (
                          <>
                            <div className="split-fields">
                              <label className="field-block">
                                <span>Envelope ID</span>
                                <input
                                  value={selectedEnvelope.id || ''}
                                  onChange={(event) =>
                                    updateEnvelopeId(
                                      safeDayIndex,
                                      safeEnvelopeIndex,
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label className="field-block">
                                <span>Label</span>
                                <input
                                  value={selectedEnvelope.label || ''}
                                  onChange={(event) =>
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      label: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <div className="split-fields">
                              <label className="field-block">
                                <span>Time Label</span>
                                <input
                                  value={selectedEnvelope.timeLabel || ''}
                                  onChange={(event) =>
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      timeLabel: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="field-block">
                                <span>Seal Motif</span>
                                <input
                                  value={selectedEnvelope.sealMotif || ''}
                                  onChange={(event) =>
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      sealMotif: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <div className="split-fields">
                              <label className="field-block">
                                <span>Notification Time</span>
                                <input
                                  type="datetime-local"
                                  value={selectedEnvelope.scheduledAt ? selectedEnvelope.scheduledAt.slice(0, 16) : ''}
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      scheduledAt: val ? new Date(val).toISOString() : null,
                                    });
                                  }}
                                />
                              </label>
                              <label className="field-block checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedEnvelope.notify !== false}
                                  onChange={(event) =>
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      notify: event.target.checked,
                                    })
                                  }
                                  disabled={!selectedEnvelope.scheduledAt}
                                />
                                <span>Send notification</span>
                              </label>
                            </div>
                            <div className="field-note">
                              Times are stored in your browser's local timezone. Notifications will fire at this time on iOS devices.
                            </div>
                            <div className="structure-actions">
                              <label className="toggle-field">
                                <input
                                  type="checkbox"
                                  checked={!!selectedEnvelope.branchOnly}
                                  onChange={(event) =>
                                    updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                      branchOnly: event.target.checked,
                                    })
                                  }
                                />
                                <span>Branch-only envelope</span>
                              </label>
                              <button
                                className="control-button"
                                type="button"
                                disabled={safeEnvelopeIndex <= 0}
                                onClick={() => moveEnvelope(safeDayIndex, safeEnvelopeIndex, -1)}
                              >
                                Move Up
                              </button>
                              <button
                                className="control-button"
                                type="button"
                                disabled={safeEnvelopeIndex >= selectedEnvelopes.length - 1}
                                onClick={() => moveEnvelope(safeDayIndex, safeEnvelopeIndex, 1)}
                              >
                                Move Down
                              </button>
                              <button
                                className="control-button danger"
                                type="button"
                                disabled={selectedEnvelopes.length <= 1}
                                onClick={() => removeEnvelope(safeDayIndex, safeEnvelopeIndex)}
                              >
                                Remove Envelope
                              </button>
                            </div>
                            <label className="field-block">
                              <span>Intro</span>
                              <textarea
                                value={selectedEnvelope.intro || ''}
                                rows={6}
                                onChange={(event) =>
                                  updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                    intro: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>Choice Screen Heading</span>
                              <input
                                value={selectedEnvelope.choicesHeading || ''}
                                onChange={(event) =>
                                  updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                    choicesHeading: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field-block">
                              <span>Choice Screen Intro</span>
                              <textarea
                                value={selectedEnvelope.choicesIntro || ''}
                                rows={3}
                                onChange={(event) =>
                                  updateEnvelope(safeDayIndex, safeEnvelopeIndex, {
                                    choicesIntro: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <p className="empty-state">No envelopes for this day.</p>
                    )}
                  </div>
                  </div>
                  {selectedEnvelope ? (
                    <div className="choice-card-editor" aria-label="Choice card editor">
                      <div className="editor-section-title">
                        <h4>Choices</h4>
                        <div className="structure-actions">
                          <span>{selectedChoices.length} in envelope</span>
                          <button
                            className="control-button"
                            type="button"
                            onClick={() => addChoice(safeDayIndex, safeEnvelopeIndex)}
                          >
                            Add Choice
                          </button>
                        </div>
                      </div>
                      {selectedChoices.length ? (
                        <>
                          <div className="choice-tabs" aria-label="Choice selector">
                            {selectedChoices.map((choice, index) => (
                              <button
                                className={index === safeChoiceIndex ? 'active' : ''}
                                key={choice.id || `choice-${index + 1}`}
                                type="button"
                                onClick={() => setActiveChoiceIndex(index)}
                              >
                                <strong>{choice.title || `Choice ${index + 1}`}</strong>
                                <span>{choice.hint || choice.id || 'Untitled'}</span>
                              </button>
                            ))}
                          </div>

                          {selectedChoice ? (
                            <div className="choice-editor-grid">
                              <div className="field-stack">
                                <div className="split-fields">
                                  <label className="field-block">
                                    <span>Choice ID</span>
                                    <input
                                      value={selectedChoice.id || ''}
                                      onChange={(event) =>
                                        updateChoiceId(
                                          safeDayIndex,
                                          safeEnvelopeIndex,
                                          safeChoiceIndex,
                                          event.target.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label className="field-block">
                                    <span>Choice Title</span>
                                    <input
                                      value={selectedChoice.title || ''}
                                      onChange={(event) =>
                                        updateChoice(safeDayIndex, safeEnvelopeIndex, safeChoiceIndex, {
                                          title: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                                <div className="split-fields">
                                  <label className="field-block">
                                    <span>Choice Hint</span>
                                    <input
                                      value={selectedChoice.hint || ''}
                                      onChange={(event) =>
                                        updateChoice(safeDayIndex, safeEnvelopeIndex, safeChoiceIndex, {
                                          hint: event.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  <button
                                    className="control-button danger align-field-end"
                                    type="button"
                                    disabled={selectedChoices.length <= 1}
                                    onClick={() =>
                                      removeChoice(
                                        safeDayIndex,
                                        safeEnvelopeIndex,
                                        safeChoiceIndex,
                                      )
                                    }
                                  >
                                    Remove Choice
                                  </button>
                                </div>
                                <label className="field-block">
                                  <span>Card Heading</span>
                                  <input
                                    value={selectedChoice.card?.heading || ''}
                                    onChange={(event) =>
                                      updateChoice(safeDayIndex, safeEnvelopeIndex, safeChoiceIndex, {
                                        card: { heading: event.target.value },
                                      })
                                    }
                                  />
                                </label>
                                <label className="field-block">
                                  <span>Card Body</span>
                                  <textarea
                                    value={selectedChoice.card?.body || ''}
                                    rows={8}
                                    onChange={(event) =>
                                      updateChoice(safeDayIndex, safeEnvelopeIndex, safeChoiceIndex, {
                                        card: { body: event.target.value },
                                      })
                                    }
                                  />
                                </label>
                                <label className="field-block">
                                  <span>Card Rule / Footer</span>
                                  <textarea
                                    value={selectedChoice.card?.rule || ''}
                                    rows={3}
                                    onChange={(event) =>
                                      updateChoice(safeDayIndex, safeEnvelopeIndex, safeChoiceIndex, {
                                        card: { rule: event.target.value },
                                      })
                                    }
                                  />
                                </label>
                                <div className="response-fields-panel" aria-label="Reveal item editor">
                                  <div className="editor-section-title">
                                    <h4>Final Reveal Items</h4>
                                    <span>{selectedRevealItems.length} defined</span>
                                  </div>
                                  <div className="button-row">
                                    <button
                                      className="control-button"
                                      type="button"
                                      onClick={() =>
                                        addRevealItem(
                                          safeDayIndex,
                                          safeEnvelopeIndex,
                                          safeChoiceIndex,
                                        )
                                      }
                                    >
                                      Add Reveal Item
                                    </button>
                                  </div>
                                  {selectedRevealItems.length ? (
                                    <div className="response-field-list">
                                      {selectedRevealItems.map((item, itemIndex) => (
                                        <div
                                          className="response-field-card"
                                          key={item.id || `reveal-item-${itemIndex + 1}`}
                                        >
                                          <div className="response-field-header">
                                            <div>
                                              <strong>{item.title || `Reveal Item ${itemIndex + 1}`}</strong>
                                              <span>{item.id || `reveal-item-${itemIndex + 1}`}</span>
                                            </div>
                                            <button
                                              className="control-button danger"
                                              type="button"
                                              onClick={() =>
                                                removeRevealItem(
                                                  safeDayIndex,
                                                  safeEnvelopeIndex,
                                                  safeChoiceIndex,
                                                  itemIndex,
                                                )
                                              }
                                            >
                                              Remove
                                            </button>
                                          </div>
                                          <label className="field-block">
                                            <span>Reveal Item ID</span>
                                            <input
                                              value={item.id || ''}
                                              onChange={(event) =>
                                                updateRevealItem(
                                                  safeDayIndex,
                                                  safeEnvelopeIndex,
                                                  safeChoiceIndex,
                                                  itemIndex,
                                                  { id: event.target.value },
                                                )
                                              }
                                            />
                                          </label>
                                          <label className="field-block">
                                            <span>Reveal Title</span>
                                            <input
                                              value={item.title || ''}
                                              onChange={(event) =>
                                                updateRevealItem(
                                                  safeDayIndex,
                                                  safeEnvelopeIndex,
                                                  safeChoiceIndex,
                                                  itemIndex,
                                                  { title: event.target.value },
                                                )
                                              }
                                            />
                                          </label>
                                          <label className="field-block">
                                            <span>Reveal Description</span>
                                            <textarea
                                              value={item.description || ''}
                                              rows={3}
                                              onChange={(event) =>
                                                updateRevealItem(
                                                  safeDayIndex,
                                                  safeEnvelopeIndex,
                                                  safeChoiceIndex,
                                                  itemIndex,
                                                  { description: event.target.value },
                                                )
                                              }
                                            />
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="empty-state">
                                      No reveal items yet. Add them to show a final authored reveal in the player.
                                    </p>
                                  )}
                                </div>
                                <div className="response-fields-panel" aria-label="Response input editor">
                                  <div className="editor-section-title">
                                    <h4>Response Fields</h4>
                                    <span>{selectedResponseInputs.length} defined</span>
                                  </div>
                                  <div className="button-row">
                                    <button
                                      className="control-button"
                                      type="button"
                                      onClick={() =>
                                        addResponseInput(
                                          safeDayIndex,
                                          safeEnvelopeIndex,
                                          safeChoiceIndex,
                                        )
                                      }
                                    >
                                      Add Field
                                    </button>
                                  </div>
                                  {selectedResponseInputs.length ? (
                                    <div className="response-field-list">
                                      {selectedResponseInputs.map((input, inputIndex) => {
                                        const normalizedType = normalizeInputType(input.type);

                                        return (
                                          <div
                                            className="response-field-card"
                                            key={input.id || `input-${inputIndex}`}
                                          >
                                            <div className="response-field-header">
                                              <div>
                                                <strong>
                                                  Field {inputIndex + 1}
                                                </strong>
                                                <span>{getInputTypeLabel(normalizedType)}</span>
                                              </div>
                                              <button
                                                className="control-button danger"
                                                type="button"
                                                onClick={() =>
                                                  removeResponseInput(
                                                    safeDayIndex,
                                                    safeEnvelopeIndex,
                                                    safeChoiceIndex,
                                                    inputIndex,
                                                  )
                                                }
                                              >
                                                Remove
                                              </button>
                                            </div>
                                            <div className="split-fields">
                                              <label className="field-block">
                                                <span>Field ID</span>
                                                <input
                                                  value={input.id || ''}
                                                  onChange={(event) =>
                                                    updateResponseInput(
                                                      safeDayIndex,
                                                      safeEnvelopeIndex,
                                                      safeChoiceIndex,
                                                      inputIndex,
                                                      { id: event.target.value },
                                                    )
                                                  }
                                                />
                                              </label>
                                              <label className="field-block">
                                                <span>Label</span>
                                                <input
                                                  value={input.label || ''}
                                                  onChange={(event) =>
                                                    updateResponseInput(
                                                      safeDayIndex,
                                                      safeEnvelopeIndex,
                                                      safeChoiceIndex,
                                                      inputIndex,
                                                      { label: event.target.value },
                                                    )
                                                  }
                                                />
                                              </label>
                                            </div>
                                            <div className="split-fields">
                                              <label className="field-block">
                                                <span>Type</span>
                                                <select
                                                  value={normalizedType}
                                                  onChange={(event) =>
                                                    updateResponseInput(
                                                      safeDayIndex,
                                                      safeEnvelopeIndex,
                                                      safeChoiceIndex,
                                                      inputIndex,
                                                      { type: event.target.value },
                                                    )
                                                  }
                                                >
                                                  {INPUT_TYPE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                      {option.label}
                                                    </option>
                                                  ))}
                                                </select>
                                              </label>
                                              <label className="field-block">
                                                <span>Placeholder</span>
                                                <input
                                                  value={input.placeholder || ''}
                                                  onChange={(event) =>
                                                    updateResponseInput(
                                                      safeDayIndex,
                                                      safeEnvelopeIndex,
                                                      safeChoiceIndex,
                                                      inputIndex,
                                                      { placeholder: event.target.value },
                                                    )
                                                  }
                                                />
                                              </label>
                                            </div>
                                            <label className="field-block">
                                              <span>Help Text</span>
                                              <input
                                                value={input.helpText || ''}
                                                onChange={(event) =>
                                                  updateResponseInput(
                                                    safeDayIndex,
                                                    safeEnvelopeIndex,
                                                    safeChoiceIndex,
                                                    inputIndex,
                                                    { helpText: event.target.value },
                                                  )
                                                }
                                              />
                                            </label>
                                            <label className="toggle-field">
                                              <input
                                                type="checkbox"
                                                checked={!!input.required}
                                                onChange={(event) =>
                                                  updateResponseInput(
                                                    safeDayIndex,
                                                    safeEnvelopeIndex,
                                                    safeChoiceIndex,
                                                    inputIndex,
                                                    { required: event.target.checked },
                                                  )
                                                }
                                              />
                                              <span>Required before the player can continue</span>
                                            </label>
                                            {isSelectInputType(normalizedType) ? (
                                              <label className="field-block">
                                                <span>Options</span>
                                                <textarea
                                                  value={getOptionsText(input)}
                                                  rows={4}
                                                  onChange={(event) =>
                                                    updateResponseInput(
                                                      safeDayIndex,
                                                      safeEnvelopeIndex,
                                                      safeChoiceIndex,
                                                      inputIndex,
                                                      { options: parseOptionsText(event.target.value) },
                                                    )
                                                  }
                                                />
                                              </label>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="empty-state">No response fields on this card.</p>
                                  )}
                                </div>
                              </div>

                              <div className="choice-preview" aria-label="Choice preview">
                                <span>Path Button</span>
                                <div className="choice-path-preview">
                                  <strong>{previewCopy(selectedChoice.title, 'Untitled choice')}</strong>
                                  <p>{previewCopy(selectedChoice.hint, 'No hint')}</p>
                                </div>
                                <span>Opened Card</span>
                                <div className="choice-card-preview">
                                  <h5>{previewCopy(selectedChoice.card?.heading, 'No heading')}</h5>
                                  <p>{previewCopy(selectedChoice.card?.body, 'No body')}</p>
                                  {selectedChoice.card?.rule ? (
                                    <blockquote>{previewCopy(selectedChoice.card.rule)}</blockquote>
                                  ) : null}
                                </div>
                                <span>Final Reveal</span>
                                <div className="response-preview">
                                  {selectedRevealItems.length ? (
                                    selectedRevealItems.map((item, itemIndex) => (
                                      <div
                                        className="response-preview-field"
                                        key={item.id || `reveal-preview-${itemIndex}`}
                                      >
                                        <div>
                                          <strong>
                                            {previewCopy(item.title, `Reveal item ${itemIndex + 1}`)}
                                          </strong>
                                          <span>{item.id || `reveal-item-${itemIndex + 1}`}</span>
                                        </div>
                                        {item.description ? <p>{previewCopy(item.description)}</p> : null}
                                      </div>
                                    ))
                                  ) : (
                                    <p className="empty-preview">No reveal items.</p>
                                  )}
                                </div>
                                <span>Response Fields</span>
                                <div className="response-preview">
                                  {selectedResponseInputs.length ? (
                                    selectedResponseInputs.map((input, inputIndex) => {
                                      const normalizedType = normalizeInputType(input.type);

                                      return (
                                        <div
                                          className="response-preview-field"
                                          key={input.id || `preview-input-${inputIndex}`}
                                        >
                                          <div>
                                            <strong>
                                              {previewCopy(input.label, `Field ${inputIndex + 1}`)}
                                              {input.required ? ' *' : ''}
                                            </strong>
                                            <span>{getInputTypeLabel(normalizedType)}</span>
                                          </div>
                                          {input.helpText ? <p>{previewCopy(input.helpText)}</p> : null}
                                          {isSelectInputType(normalizedType) &&
                                          Array.isArray(input.options) &&
                                          input.options.length ? (
                                            <div className="option-chip-list">
                                              {input.options.map((option, optionIndex) => (
                                                <span key={`${option}-${optionIndex}`}>
                                                  {previewCopy(option)}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="empty-preview">No response fields.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="empty-state">No choices for this envelope.</p>
                      )}
                    </div>
                  ) : null}
                  <div className="action-panel story-editor-actions">
                    <div className="button-row" aria-label="Story editor actions">
                      <button className="control-button primary" type="button" onClick={handleSaveDraft}>
                        Save Draft
                      </button>
                      <button className="control-button" type="button" onClick={handleExport}>
                        Export JSON
                      </button>
                    </div>
                    {notice ? <p className={`notice ${notice.tone}`}>{notice.text}</p> : null}
                  </div>
                </>
              ) : (
                <p className="empty-state">No days available.</p>
              )}
            </section>
          </>
        )}
      </section>

      <aside className="admin-rail" aria-label="Validation details">
        <section className="data-panel">
          <div className="panel-heading">
            <h3>Validation</h3>
            <span>{validation.errors.length} errors</span>
          </div>
          {validationMessages.length ? (
            <ul className="validation-list">
              {validationMessages.map((message) => (
                <li className={message.level} key={message.text}>
                  {message.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No validation issues.</p>
          )}
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h3>Sync</h3>
            <span>{isDirty ? 'pending' : 'current'}</span>
          </div>
          <dl className="storage-list">
            {syncSummaryItems.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h3>Snapshots</h3>
            <span>
              {snapshots.length} / {MAX_ADMIN_SNAPSHOTS}
            </span>
          </div>
          {recentSnapshots.length ? (
            <ul className="rail-summary-list">
              {recentSnapshots.map((snapshot) => (
                <li key={snapshot.id}>
                  <div>
                    <strong>{snapshot.name}</strong>
                    <span>{formatDateTime(snapshot.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No snapshots saved.</p>
          )}
          <div className="action-panel compact">
            <button
              className="control-button"
              type="button"
              onClick={() => setActiveSection('Snapshots')}
            >
              Open Snapshots
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}

export default App;
