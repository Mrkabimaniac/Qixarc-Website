(() => {
  const company = window.QixarcCompany;
  const widgets = document.querySelectorAll('[data-scaler-launch]');
  const labels = document.querySelectorAll('[data-scaler-status]');
  const grids = document.querySelectorAll('[data-team-grid]');
  const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' });
  let schedule = widgets.length ? company.launch(widgets[0].dataset) : null;

  function countdown(milliseconds) {
    let seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return [[86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']].map(([unit, label]) => {
      const amount = Math.floor(seconds / unit);
      seconds %= unit;
      return String(amount).padStart(2, '0') + label;
    }).join(' ');
  }

  function updateLaunch() {
    if (!schedule) return;
    const now = Date.now();
    const current = company.stage(schedule, now);
    for (const label of labels) {
      if (label.textContent !== current.status) label.textContent = current.status;
    }
    for (const widget of widgets) {
      const stage = widget.querySelector('[data-launch-stage]');
      const clock = widget.querySelector('[data-launch-clock]');
      const date = widget.querySelector('[data-full-date]');
      if (stage.textContent !== current.label) stage.textContent = current.label;
      clock.hidden = current.target === null;
      if (current.target !== null) clock.textContent = countdown(current.target - now);
      date.parentElement.hidden = current.target !== schedule.early;
      if (!date.parentElement.hidden) {
        date.dateTime = new Date(schedule.full).toISOString();
        date.textContent = dateFormat.format(schedule.full);
      }
    }
  }

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function profile(person) {
    const card = element('article', null, 'team-profile');
    const details = element('details', null, 'team-profile-details');
    const summary = element('summary', 'View portfolio ↗');
    const preview = element('div', null, 'team-preview');
    const url = company.photoUrl(person.photo);
    const portrait = url ? element('img') : element('span', person.name[0], 'team-initials');
    if (url) { portrait.src = url; portrait.alt = ''; portrait.loading = 'lazy'; portrait.decoding = 'async'; }
    else { portrait.setAttribute('aria-hidden', 'true'); }
    const link = element('a', 'Open portfolio ↗');
    link.href = person.portfolio;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Open ' + person.name + '’s portfolio in a new tab');
    preview.append(portrait, link);
    details.append(summary, preview);
    card.append(element('h3', person.name), element('p', person.role), details);
    return card;
  }

  function bindGrid(grid) {
    const cards = [...grid.querySelectorAll('.team-profile')];
    for (const card of cards) {
      const details = card.querySelector('details');
      let hoverOpened = false;
      card.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (!details.open) { hoverOpened = true; details.open = true; }
      });
      card.addEventListener('pointerleave', () => {
        if (hoverOpened && !card.contains(document.activeElement)) details.open = false;
      });
      card.addEventListener('focusout', event => {
        if (hoverOpened && !card.contains(event.relatedTarget) && !card.matches(':hover')) details.open = false;
      });
      details.addEventListener('toggle', () => {
        if (!details.open) { hoverOpened = false; return; }
        for (const other of grid.querySelectorAll('details[open]')) {
          if (other !== details) other.open = false;
        }
      });
      card.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !details.open) return;
        details.open = false;
        details.querySelector('summary').focus();
      });
    }
  }
  for (const grid of grids) bindGrid(grid);
  if (labels.length || widgets.length) {
    updateLaunch();
    setInterval(updateLaunch, 250);
    if (!schedule) company.defaults().then(data => { schedule ??= company.launch(data.launch); updateLaunch(); }).catch(() => {});
  }

  company.read().then(rows => {
    schedule = company.launch(rows.launch?.payload) || schedule;
    updateLaunch();
    const people = company.team(rows.team?.payload);
    if (!people) return;
    for (const grid of grids) {
      if (grid.contains(document.activeElement) || grid.querySelector('details[open]')) continue;
      grid.replaceChildren(...people.map(profile));
      bindGrid(grid);
    }
  }).catch(() => {});
})();
