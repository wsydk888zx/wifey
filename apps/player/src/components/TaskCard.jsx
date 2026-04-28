import React, { useState } from 'react';

import { replacePlaceholders } from '@wifey/story-core';

function normalizeFieldType(type) {
  if (type === 'text') return 'short_text';
  if (type === 'textarea') return 'long_text';
  if (type === 'select') return 'single_select';
  if (type === 'multiselect') return 'multi_select';
  return type || 'short_text';
}

function TaskCard({
  card,
  envelope,
  addressee,
  tweaks,
  onComplete,
  completed,
  onReselect,
  hasChoices,
  responses = {},
  onResponseChange,
}) {
  const rp = (text) => replacePlaceholders(text, tweaks);
  const [now] = useState(() => {
    const date = new Date();
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  });
  const inputs = Array.isArray(card.inputs) ? card.inputs : [];
  const missingRequired = inputs.filter((field) => {
    if (!field?.required) return false;
    const value = responses[field.id];
    if (Array.isArray(value)) return !value.length;
    return typeof value !== 'string' || !value.trim();
  });
  const bodyParagraphs = String(rp(card.body || ''))
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const initial = (addressee || 'M').trim().charAt(0).toUpperCase() || 'M';
  const signoffName = rp(tweaks.hisName || 'M');

  const renderParagraph = (paragraph) => {
    const lines = paragraph.split('\n');
    return lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  const renderInput = (field) => {
    const type = normalizeFieldType(field.type);
    const value = responses[field.id] ?? (type === 'multi_select' ? [] : '');

    if (type === 'long_text') {
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onResponseChange?.(field.id, event.target.value)}
          className="task-input"
          rows={4}
          placeholder={field.placeholder || ''}
        />
      );
    }

    if (type === 'single_select') {
      const options = Array.isArray(field.options) ? field.options : [];
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onResponseChange?.(field.id, event.target.value)}
          className="task-input"
        >
          <option value="">{field.placeholder || 'Select one'}</option>
          {options.map((option, index) => (
            <option key={`${field.id}-${index}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'multi_select') {
      const options = Array.isArray(field.options) ? field.options : [];
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <div className="task-checkbox-group">
          {options.map((option, index) => {
            const checked = selectedValues.includes(option);

            return (
              <label key={`${field.id}-${index}`} className="task-checkbox-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((item) => item !== option);
                    onResponseChange?.(field.id, next);
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <input
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onResponseChange?.(field.id, event.target.value)}
        className="task-input"
        type="text"
        placeholder={field.placeholder || ''}
      />
    );
  };

  return (
    <div className="card-stage visible">
      <div className="card-wrap">
        <div className="ribbon" />
        <article className="task-card">
          <div className="card-seal">{envelope.sealMotif || initial}</div>
          <div className="watermark">{initial}</div>

          <div className="card-inner">
            <div className="date-line">
              {rp(envelope.timeLabel || envelope.label)} · {now}
            </div>
            <div className="salutation">{addressee ? `My ${addressee},` : 'My love,'}</div>
            <div className="letter-heading">{rp(card.heading)}</div>

            <div className="fleuron">· ❦ ·</div>

            <div className="body-text">
              {bodyParagraphs.map((paragraph, index) => (
                <p key={`${paragraph.slice(0, 24)}-${index}`}>{renderParagraph(paragraph)}</p>
              ))}
            </div>

            {card.rule ? (
              <div className="rule-note">
                <span className="label">The rule</span>
                <div>{rp(card.rule)}</div>
              </div>
            ) : null}

            {inputs.length > 0 ? (
              <div className="task-form">
                <div className="task-form-title">Your response</div>
                {inputs.map((field, index) => (
                  <label key={field.id || index} className="task-form-field">
                    <span className="task-form-label">
                      {rp(field.label || `Field ${index + 1}`)}
                      {field.required ? ' *' : ''}
                    </span>
                    {field.helpText ? (
                      <span className="task-form-help">{rp(field.helpText)}</span>
                    ) : null}
                    {renderInput(field)}
                  </label>
                ))}
                {missingRequired.length > 0 && !completed ? (
                  <div className="task-form-error">
                    Complete the required fields before continuing.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="signoff-block">
              <div className="signoff-line">Yours, always</div>
              <div className="signoff-name">{signoffName}.</div>
              <div className="signoff-flourish" />
            </div>
          </div>
        </article>
      </div>

      <div className="actions">
        {hasChoices ? (
          <button className="secondary" onClick={onReselect}>
            Back to choices
          </button>
        ) : (
          <span />
        )}
        <button
          className={`complete ${completed ? 'done' : ''}`}
          onClick={onComplete}
          disabled={!completed && missingRequired.length > 0}
        >
          {completed ? 'Obeyed - Next envelope' : 'Mark obeyed'}
        </button>
      </div>
    </div>
  );
}

export default TaskCard;
