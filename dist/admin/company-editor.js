(() => {
  function createEditor({ db, authorize, isActive }) {
    const company = window.QixarcCompany;
    const panel = document.querySelector('#company-panel');
    const launchForm = panel.querySelector('#scaler-launch-form');
    const teamForm = panel.querySelector('#team-member-form');
    const peopleList = panel.querySelector('#company-team-list');
    const addButton = panel.querySelector('#new-team-member');
    const feedback = panel.querySelector('[data-company-feedback]');
    const refresh = panel.querySelector('#refresh-company');
    const indiaOffset = 330 * 60 * 1000;
    const toIndiaInput = date => new Date(date + indiaOffset).toISOString().slice(0, 16);
    const say = message => { if (isActive()) feedback.textContent = message; };
    let rows = {}, people = [], request = 0, saving = false;

    function hideMember() {
      teamForm.hidden = true;
      teamForm.reset();
    }

    function reset() {
      request++;
      hideMember();
      launchForm.reset();
      launchForm.querySelector('fieldset').disabled = true;
      addButton.disabled = true;
      peopleList.replaceChildren();
      feedback.textContent = '';
    }

    function openMember(person) {
      hideMember();
      const fields = teamForm.elements;
      fields.id.value = person?.id || '';
      fields.name.value = person?.name || '';
      fields.role.value = person?.role || '';
      fields.portfolio.value = person?.portfolio || '';
      teamForm.querySelector('h3').textContent = person ? 'Edit team member' : 'Add team member';
      const photo = teamForm.querySelector('[data-current-portrait]');
      const url = person && company.photoUrl(person.photo);
      photo.hidden = !url;
      if (url) photo.src = url;
      else photo.removeAttribute('src');
      teamForm.hidden = false;
      fields.name.focus();
    }

    function drawPeople() {
      peopleList.replaceChildren(...people.map(person => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = person.name + ' · ' + person.role;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button outline';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', 'Edit ' + person.name);
        edit.addEventListener('click', () => { if (!saving) openMember(person); });
        item.append(label, edit);
        return item;
      }));
      addButton.disabled = people.length >= 24;
    }

    async function load() {
      reset();
      const ticket = request;
      say('Loading website settings…');
      try {
        const [base, saved] = await Promise.all([company.defaults(), company.read()]);
        if (ticket !== request || !isActive()) return;
        const dates = company.launch(saved.launch?.payload ?? base.launch);
        people = company.team(saved.team?.payload ?? base.team);
        if (!dates || !people) throw new Error('Invalid settings');
        rows = saved;
        launchForm.elements.early.value = toIndiaInput(dates.early);
        launchForm.elements.full.value = toIndiaInput(dates.full);
        launchForm.querySelector('fieldset').disabled = false;
        drawPeople();
        say('');
      } catch {
        if (ticket === request) say('Website settings could not load. Check the connection and try Refresh.');
      }
    }

    async function save(key, payload) {
      const previous = rows[key];
      const table = db.from('qixarc_site_settings');
      const query = previous
        ? table.update({ payload, revision: previous.revision + 1 }).eq('key', key).eq('revision', previous.revision)
        : table.insert({ key, payload });
      const { data, error } = await query.select('key,payload,revision').maybeSingle();
      if (error?.code === '23505' || (!error && !data)) {
        throw new Error('Someone else saved these settings first. Refresh before applying your changes.');
      }
      if (error) throw new Error('The changes could not be saved. Your edits are still here. Please retry.');
      rows[key] = data;
    }

    async function submit(form, action) {
      if (saving || !isActive()) return;
      const ticket = request;
      const button = form.querySelector('[type=submit]');
      saving = true;
      button.disabled = refresh.disabled = true;
      say('Saving…');
      try {
        if (!await authorize() || ticket !== request || !isActive()) return;
        await action(() => ticket === request && isActive());
      } catch (error) {
        if (ticket === request) say(error.message || 'Could not save. Please retry.');
      } finally {
        saving = false;
        button.disabled = refresh.disabled = false;
      }
    }

    launchForm.addEventListener('submit', event => {
      event.preventDefault();
      const { early, full } = launchForm.elements;
      const payload = { early: early.value + ':00+05:30', full: full.value + ':00+05:30' };
      if (!company.launch(payload)) { say('Full access must launch after early access.'); return; }
      submit(launchForm, async active => {
        await save('launch', payload);
        if (active()) say('Launch schedule saved.');
      });
    });

    async function uploadPortrait(file) {
      if (file.size > 15 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Choose a JPG, PNG or WebP photo under 15 MB.');
      }
      const image = await createImageBitmap(file).catch(() => { throw new Error('This photo could not be opened.'); });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      try { canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); }
      finally { image.close(); }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .83));
      if (!blob || blob.type !== 'image/webp' || blob.size > 524288) {
        throw new Error('This photo could not be prepared. Try a smaller image.');
      }
      const path = crypto.randomUUID() + '.webp';
      const { error } = await db.storage.from('qixarc-team-photos').upload(path, blob, {
        contentType: 'image/webp', cacheControl: '31536000', upsert: false
      });
      if (error) throw new Error('Could not upload the portrait. Check the connection and retry.');
      return path;
    }

    teamForm.addEventListener('submit', event => {
      event.preventDefault();
      const fields = teamForm.elements;
      const id = fields.id.value || crypto.randomUUID();
      const existing = people.find(person => person.id === id);
      const person = {
        id, name: fields.name.value.trim(), role: fields.role.value.trim(),
        portfolio: company.webUrl(fields.portfolio.value.trim()), photo: existing?.photo || ''
      };
      const updated = existing ? people.map(item => item.id === id ? person : item) : [...people, person];
      if (!company.team(updated)) { say('Enter a name, role and valid HTTPS portfolio link.'); return; }
      const file = fields.photo.files[0];
      submit(teamForm, async active => {
        if (file) person.photo = await uploadPortrait(file);
        if (!active()) return;
        await save('team', updated);
        if (!active()) return;
        people = updated;
        hideMember();
        drawPeople();
        say('Team member saved.');
      });
    });

    addButton.addEventListener('click', () => { if (!saving) openMember(); });
    panel.querySelector('#cancel-team-edit').addEventListener('click', () => { if (!saving) hideMember(); });
    refresh.addEventListener('click', load);
    return { load, reset };
  }

  window.QixarcCompanyEditor = Object.freeze({ createEditor });
})();
