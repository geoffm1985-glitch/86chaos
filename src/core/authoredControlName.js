// Keep the weekly scheduler's visible names stable when App adds legacy control metadata.
// A select's option text and a field's current value are not part of its label.
export function authoredScheduleControlName(element) {
  if (!element.closest?.('[data-testid="schedule-workspace"]')) return '';
  const labels = Array.from(element.labels || []);
  const label = labels.map(node => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input, select, textarea, button').forEach(control => control.remove());
    return copy.textContent;
  }).join(' ');
  const buttonText = element.matches?.('button, a, [role="button"], [role="tab"]') ? element.textContent : '';
  return String(label || buttonText || '').replace(/\s+/g, ' ').trim().slice(0, 140);
}
