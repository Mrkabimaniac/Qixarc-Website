(() => {
  const webUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  };
  const photoUrl = value => {
    if (/^\/assets\/[a-z0-9.-]+\.webp$/.test(value)) return value;
    if (/^[0-9a-f-]{36}\.webp$/.test(value)) {
      return window.QIXARC_SUPABASE?.url + '/storage/v1/object/public/qixarc-team-photos/' + value;
    }
    return '';
  };
  const launch = value => {
    const early = Date.parse(value?.early);
    const full = Date.parse(value?.full);
    return Number.isFinite(early) && Number.isFinite(full) && early < full ? { early, full } : null;
  };
  const team = value => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 24) return null;
    const people = value.map(person => {
      if (!person || typeof person.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(person.id) ||
          typeof person.name !== 'string' || typeof person.role !== 'string') return null;
      const name = person.name.trim();
      const role = person.role.trim();
      const portfolio = webUrl(person.portfolio);
      if (!name || name.length > 80 || !role || role.length > 80 || !portfolio || portfolio.length > 2048) return null;
      return { id: person.id, name, role, portfolio, photo: photoUrl(person.photo) ? person.photo : '' };
    });
    return people.every(Boolean) && new Set(people.map(person => person.id)).size === people.length ? people : null;
  };

  let defaultRequest;
  const defaults = () => defaultRequest ??= fetch('/site-defaults.json', { signal: AbortSignal.timeout(5000) }).then(response => {
    if (!response.ok) throw new Error('Site defaults are unavailable');
    return response.json();
  });
  const read = async () => {
    if (!window.qixarcDB) throw new Error('Connection unavailable');
    const result = await window.qixarcDB.from('qixarc_site_settings')
      .select('key,payload,revision').abortSignal(AbortSignal.timeout(6000));
    if (result.error) throw new Error('Settings could not be loaded');
    return Object.fromEntries(result.data.map(row => [row.key, row]));
  };

  function stage(schedule, now) {
    if (now < schedule.early) return { status: 'Early access scheduled', label: 'Early access launches in', target: schedule.early };
    if (now < schedule.full) return { status: 'Early access deployed', label: 'Early access deployed. Full access launches in', target: schedule.full };
    return { status: 'Full access deployed', label: 'Full access deployed', target: null };
  }

  window.QixarcCompany = Object.freeze({ defaults, read, webUrl, photoUrl, launch, team, stage });
})();
