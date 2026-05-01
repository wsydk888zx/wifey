import { getDayEnvelopes, normalizeContentModel } from './contentModel.js';

export function getEnvelopeNotificationSchedule(content) {
  const normalized = normalizeContentModel(content);
  const schedule = [];

  normalized.days.forEach((day) => {
    getDayEnvelopes(day).forEach((envelope) => {
      if (envelope.scheduledAt && envelope.notify !== false) {
        schedule.push({
          envelopeId: envelope.id,
          scheduledAt: envelope.scheduledAt,
          title: envelope.label || 'New envelope',
          body: envelope.intro || 'A new message arrived',
        });
      }
    });
  });

  return schedule;
}
