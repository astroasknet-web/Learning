/* Resume Studio editor: form, live preview + score, job tailoring, before/after, saving. */
(function () {
    'use strict';
    var bootEl = document.getElementById('se-boot');
    if (!bootEl) { return; }
    var B = JSON.parse(bootEl.textContent);
    var RS = window.RS;
    var S = { data: B.data, template: B.template, versions: B.versions, wait: B.wait, pro: B.pro, jd: '', last: null, seq: 0, timer: null, dirty: false, saving: false, baseScore: null };
    var $ = function (s, r) { return (r || document).querySelector(s); };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text != null) { e.textContent = text; } return e; }
    function tplOf(id) { return B.templates.filter(function (t) { return t.id === id; })[0]; }

    // ---------- tiny path helpers ----------
    function getp(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, S.data); }
    function setp(path, v) { var k = path.split('.'), o = S.data; for (var i = 0; i < k.length - 1; i++) { o = o[k[i]]; } o[k[k.length - 1]] = v; }
    function toField(v, kind) { if (kind === 'lines') { return (v || []).join('\n'); } if (kind === 'csv') { return (v || []).join(', '); } return v == null ? '' : String(v); }
    function fromField(v, kind) {
        if (kind === 'lines') { return v.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
        if (kind === 'csv') { return v.split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
        return v;
    }

    // ---------- form building ----------
    function field(label, path, o) {
        o = o || {};
        var id = 'f-' + path.replace(/[^a-z0-9]+/gi, '-');
        var w = el('div', 'fld' + (o.cls ? ' ' + o.cls : ''));
        var l = el('label', null, label); l.htmlFor = id;
        var c;
        if (o.rows) { c = document.createElement('textarea'); c.rows = o.rows; } else { c = document.createElement('input'); c.type = o.type || 'text'; }
        c.id = id; c.setAttribute('data-path', path); if (o.kind) { c.setAttribute('data-kind', o.kind); }
        if (o.ph) { c.placeholder = o.ph; } if (o.max) { c.maxLength = o.max; } if (o.ac) { c.autocomplete = o.ac; }
        c.value = toField(getp(path), o.kind);
        w.appendChild(l); w.appendChild(c);
        if (o.help) { w.appendChild(el('p', 'se-help', o.help)); }
        return w;
    }
    function checkbox(label, path) {
        var w = el('label', 'se-check'); var c = document.createElement('input'); c.type = 'checkbox'; c.setAttribute('data-path', path); c.setAttribute('data-kind', 'bool'); c.checked = !!getp(path);
        w.appendChild(c); w.appendChild(el('span', null, label)); return w;
    }
    function section(id, title, open) {
        var d = el('details', 'se-form-sec'); d.id = 'sec-' + id; if (open) { d.open = true; }
        d.appendChild(el('summary', null, title)); var body = el('div', 'se-form-body'); d.appendChild(body); return { d: d, body: body };
    }
    function listButtons(listName, label) { var b = el('button', 'se-link', '+ ' + label); b.type = 'button'; b.setAttribute('data-act', 'add'); b.setAttribute('data-list', listName); return b; }
    function entryHead(listName, i, title) {
        var h = el('div', 'se-entry-head'); h.appendChild(el('span', null, title));
        var r = el('button', 'se-link se-danger', 'Remove'); r.type = 'button'; r.setAttribute('data-act', 'remove'); r.setAttribute('data-list', listName); r.setAttribute('data-i', String(i)); r.setAttribute('aria-label', 'Remove ' + title); h.appendChild(r); return h;
    }
    function pair() { var d = el('div', 'se-two'); for (var i = 0; i < arguments.length; i++) { d.appendChild(arguments[i]); } return d; }

    var BLANK = {
        experience: { title: '', company: '', location: '', start: '', end: '', current: false, bullets: [], hours: '', salary: '', supervisor: '' },
        education: { degree: '', field: '', institution: '', location: '', year: '', score: '' },
        projects: { name: '', link: '', bullets: [] }, certifications: { name: '', issuer: '', year: '' },
        languages: { name: '', level: '' }, 'personal.links': { label: '', url: '' }
    };
    var BUILD = {
        'personal.links': function (body) {
            var arr = S.data.personal.links; body.innerHTML = '';
            arr.forEach(function (x, i) { var e = el('div', 'se-entry'); e.appendChild(entryHead('personal.links', i, 'Link ' + (i + 1))); e.appendChild(pair(field('Label', 'personal.links.' + i + '.label', { ph: 'LinkedIn', max: 40 }), field('Web address', 'personal.links.' + i + '.url', { type: 'url', ph: 'https://', max: 200 }))); body.appendChild(e); });
            if (arr.length < 6) { body.appendChild(listButtons('personal.links', 'Add a link (LinkedIn, portfolio, GitHub)')); }
        },
        experience: function (body) {
            var arr = S.data.experience; body.innerHTML = '';
            arr.forEach(function (x, i) {
                var p = 'experience.' + i, e = el('div', 'se-entry'); e.appendChild(entryHead('experience', i, x.title || x.company || 'Job ' + (i + 1)));
                e.appendChild(pair(field('Job title', p + '.title', { max: 100 }), field('Company', p + '.company', { max: 100 })));
                e.appendChild(field('Location', p + '.location', { max: 80 }));
                e.appendChild(pair(field('Start (YYYY-MM)', p + '.start', { type: 'month', ph: '2023-07', max: 7 }), field('End (YYYY-MM)', p + '.end', { type: 'month', ph: '2024-09', max: 7 })));
                e.appendChild(checkbox('I still work here', p + '.current'));
                e.appendChild(field('What you achieved', p + '.bullets', { rows: 5, kind: 'lines', help: 'One achievement per line. Start with a strong verb and include a number where you can (for example "Cut costs by 18%").' }));
                var fed = el('div', 'se-fedx'); fed.hidden = (tplOf(S.template) || {}).structure !== 'us_fed';
                fed.appendChild(pair(field('Hours per week', p + '.hours', { max: 6 }), field('Salary', p + '.salary', { max: 40 }))); fed.appendChild(field('Supervisor name and phone', p + '.supervisor', { max: 100 })); e.appendChild(fed);
                body.appendChild(e);
            });
            body.appendChild(listButtons('experience', 'Add a job'));
        },
        education: function (body) {
            var arr = S.data.education; body.innerHTML = '';
            arr.forEach(function (x, i) {
                var p = 'education.' + i, e = el('div', 'se-entry'); e.appendChild(entryHead('education', i, x.degree || 'Qualification ' + (i + 1)));
                e.appendChild(pair(field('Degree / qualification', p + '.degree', { max: 120 }), field('Field of study', p + '.field', { max: 100 })));
                e.appendChild(pair(field('School / university', p + '.institution', { max: 140 }), field('Location', p + '.location', { max: 80 })));
                e.appendChild(pair(field('Year finished', p + '.year', { max: 12, ph: '2023' }), field('Grade / GPA / CGPA', p + '.score', { max: 30, ph: '3.8/4.0' })));
                body.appendChild(e);
            });
            body.appendChild(listButtons('education', 'Add education'));
        },
        projects: function (body) {
            var arr = S.data.projects; body.innerHTML = '';
            arr.forEach(function (x, i) { var p = 'projects.' + i, e = el('div', 'se-entry'); e.appendChild(entryHead('projects', i, x.name || 'Project ' + (i + 1)));
                e.appendChild(pair(field('Project name', p + '.name', { max: 120 }), field('Link (optional)', p + '.link', { type: 'url', max: 200, ph: 'https://' }))); e.appendChild(field('What it is and what you did', p + '.bullets', { rows: 3, kind: 'lines', help: 'One point per line.' })); body.appendChild(e); });
            body.appendChild(listButtons('projects', 'Add a project'));
        },
        certifications: function (body) {
            var arr = S.data.certifications; body.innerHTML = '';
            arr.forEach(function (x, i) { var p = 'certifications.' + i, e = el('div', 'se-entry'); e.appendChild(entryHead('certifications', i, x.name || 'Certification ' + (i + 1)));
                e.appendChild(field('Certification', p + '.name', { max: 140 })); e.appendChild(pair(field('Issued by', p + '.issuer', { max: 100 }), field('Year', p + '.year', { max: 12 }))); body.appendChild(e); });
            body.appendChild(listButtons('certifications', 'Add a certification'));
        },
        languages: function (body) {
            var arr = S.data.languages; body.innerHTML = '';
            arr.forEach(function (x, i) { var p = 'languages.' + i, e = el('div', 'se-entry'); e.appendChild(entryHead('languages', i, x.name || 'Language ' + (i + 1)));
                e.appendChild(pair(field('Language', p + '.name', { max: 40 }), field('Level', p + '.level', { max: 40, ph: 'Fluent' }))); body.appendChild(e); });
            body.appendChild(listButtons('languages', 'Add a language'));
        }
    };

    function buildForm() {
        var f = $('#se-form'); f.innerHTML = '';
        var s1 = section('contact', 'Contact details', true);
        s1.body.appendChild(field('Full name', 'personal.name', { max: 100, ac: 'name' }));
        s1.body.appendChild(field('Headline (optional)', 'personal.headline', { max: 120, ph: 'Marketing Analyst' }));
        s1.body.appendChild(pair(field('Email', 'personal.email', { type: 'email', max: 190, ac: 'email' }), field('Phone', 'personal.phone', { type: 'tel', max: 30, ac: 'tel' })));
        s1.body.appendChild(field('Location', 'personal.location', { max: 100, ph: 'City, Country' }));
        var links = el('div', 'se-links'); links.setAttribute('data-build', 'personal.links'); s1.body.appendChild(links); BUILD['personal.links'](links);
        var reg = el('div', 'se-region'); reg.id = 'se-region';
        reg.appendChild(el('p', 'se-help', 'This region customarily includes the details below. They are optional: leave them empty if you prefer not to share.'));
        reg.appendChild(pair(field('Date of birth', 'personal.dob', { type: 'date', cls: 'rg-dob' }), field('Nationality', 'personal.nationality', { max: 60, cls: 'rg-nationality' })));
        reg.appendChild(pair(field('Marital status', 'personal.marital', { max: 30, cls: 'rg-marital' }), field('Visa status', 'personal.visa', { max: 80, cls: 'rg-visa' })));
        s1.body.appendChild(reg); f.appendChild(s1.d);
        var s2 = section('summary', 'Summary', true); s2.body.appendChild(field('Professional summary', 'summary', { rows: 4, max: 1200, help: '2 to 4 sentences: who you are, your strongest skills, and what you want next.' })); f.appendChild(s2.d);
        [['experience', 'Work experience', true], ['education', 'Education', true]].forEach(function (x) { var s = section(x[0], x[1], x[2]); s.body.setAttribute('data-build', x[0]); BUILD[x[0]](s.body); f.appendChild(s.d); });
        var sk = section('skills', 'Skills', true); sk.body.appendChild(field('Skills', 'skills', { rows: 3, kind: 'csv', help: 'Separate with commas. Put the skills the job asks for first.' })); f.appendChild(sk.d);
        [['projects', 'Projects', false], ['certifications', 'Certifications', false]].forEach(function (x) { var s = section(x[0], x[1], x[2]); s.body.setAttribute('data-build', x[0]); BUILD[x[0]](s.body); f.appendChild(s.d); });
        var aw = section('awards', 'Awards and achievements', false); aw.body.appendChild(field('Awards', 'awards', { rows: 3, kind: 'lines', help: 'One per line.' })); f.appendChild(aw.d);
        var pb = section('publications', 'Publications', false); pb.body.appendChild(field('Publications', 'publications', { rows: 3, kind: 'lines', help: 'One per line. Mostly for academic CVs.' })); f.appendChild(pb.d);
        var lg = section('languages', 'Languages', false); lg.body.setAttribute('data-build', 'languages'); BUILD.languages(lg.body); f.appendChild(lg.d);
        applyRegion();
    }

    function applyRegion() {
        var t = tplOf(S.template) || {}, ok = t.personal || [];
        var box = $('#se-region'); if (!box) { return; }
        box.hidden = ok.length === 0;
        [['dob', '.rg-dob'], ['nationality', '.rg-nationality'], ['marital', '.rg-marital'], ['visa', '.rg-visa']].forEach(function (p) { var n = $(p[1], box); if (n) { n.hidden = ok.indexOf(p[0]) < 0; } });
        document.querySelectorAll('.se-fedx').forEach(function (n) { n.hidden = t.structure !== 'us_fed'; });
    }

    // form events (delegated)
    var formEl = $('#se-form');
    formEl.addEventListener('input', function (e) {
        var t = e.target, p = t.getAttribute && t.getAttribute('data-path'); if (!p) { return; }
        setp(p, t.type === 'checkbox' ? t.checked : fromField(t.value, t.getAttribute('data-kind'))); schedule();
    });
    formEl.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-act]') : null; if (!b) { return; }
        var name = b.getAttribute('data-list'), arr = getp(name), act = b.getAttribute('data-act');
        if (act === 'add') { arr.push(JSON.parse(JSON.stringify(BLANK[name]))); } else { arr.splice(parseInt(b.getAttribute('data-i'), 10), 1); }
        var host = formEl.querySelector('[data-build="' + name + '"]'); BUILD[name](host); applyRegion(); schedule();
        if (act === 'add') { var last = host.querySelectorAll('.se-entry'); var inp = last.length ? last[last.length - 1].querySelector('input,textarea') : null; if (inp) { inp.focus(); } }
    });

    // ---------- template picker ----------
    function buildPicker() {
        var sel = $('#se-tpl'); sel.innerHTML = '';
        var groups = {};
        B.templates.forEach(function (t) { (groups[t.format_name] = groups[t.format_name] || []).push(t); });
        Object.keys(groups).forEach(function (g) {
            var og = document.createElement('optgroup'); og.label = g;
            groups[g].forEach(function (t) { var o = document.createElement('option'); o.value = t.id; o.textContent = t.format_name + ' - ' + t.style + ' (' + t.paper + (t.ats === 'caution' ? ', ATS caution' : '') + ')' + (S.pro || t.free ? '' : ' - Pro'); if (t.id === S.template) { o.selected = true; } og.appendChild(o); });
            sel.appendChild(og);
        });
        sel.setAttribute('aria-label', 'Template: choose a format and style');
    }
    $('#se-tpl').addEventListener('change', function () {
        var t = tplOf(this.value);
        if (t && !S.pro && !t.free) { this.value = S.template; RS.openUpgrade(); return; }
        S.template = this.value; applyRegion(); schedule(true);
    });

    // ---------- live loop ----------
    function status(t) { $('#se-status').textContent = t; }
    function schedule(now) { S.dirty = true; status('Editing...'); clearTimeout(S.timer); S.timer = setTimeout(live, now ? 50 : 650); }
    function live() {
        var my = ++S.seq; status('Scoring...');
        RS.post('/api/studio/live', { id: B.id, template: S.template, data: S.data, jd: S.jd }).then(function (r) {
            if (my !== S.seq) { return; }
            if (r._status === 402 || r.locked) { S.template = (S.last && S.last.template) || 'chrono-classic'; $('#se-tpl').value = S.template; RS.openUpgrade(); status('That template needs Pro.'); return; }
            if (!r.ok) { status(r.error || 'Could not update the preview.'); toast(r.error || 'Could not update the preview.', true); return; }
            S.last = r; S.last.template = S.template; S.dirty = false;
            renderPreview(r); renderScore(r); renderJD(r.jd);
            var d = new Date(); status('Draft saved ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, function () { status('Offline? We will retry when you keep typing.'); });
    }

    function fitPaper() {
        var wrap = $('#se-paperwrap'), paper = $('#se-paper'); if (!wrap || !paper || wrap.offsetWidth === 0) { return; }
        var rs = paper.firstElementChild; if (!rs) { return; }
        var pw = (S.last && S.last.paper === 'Letter') ? 816 : 794; paper.style.width = pw + 'px';
        var s = wrap.clientWidth / pw; paper.style.transform = 'scale(' + s + ')'; wrap.style.height = Math.ceil(paper.offsetHeight * s) + 'px';
    }
    function renderPreview(r) {
        $('#se-paper').innerHTML = r.html; fitPaper();
        var ats = $('#se-ats'); ats.innerHTML = ''; (r.ats || []).forEach(function (n) { ats.appendChild(el('p', null, n)); });
        $('#se-pages').textContent = r.words + ' words, about ' + r.pages + (r.pages === 1 ? ' page' : ' pages') + '. Aim for one page early in your career, two at most with experience.';
    }
    if (window.ResizeObserver) { new ResizeObserver(fitPaper).observe($('#se-paperwrap')); }

    function baseScore() { var b = S.versions.filter(function (v) { return v.id === B.baseline; })[0]; return b && b.score != null ? b.score : null; }
    function renderScore(r) {
        var ring = $('#se-ring'), num = $('#se-ringnum');
        if (!r.scored) { ring.style.setProperty('--v', 0); num.textContent = '--'; $('#se-pill').textContent = '--'; $('#se-grade').textContent = ''; $('#se-msg').textContent = r.message || ''; $('#se-sections').innerHTML = ''; $('#se-tips').innerHTML = ''; $('#se-delta').textContent = 'RQ Score, out of 100'; return; }
        ring.style.setProperty('--v', Math.round(r.score)); num.textContent = Math.round(r.score); $('#se-pill').textContent = Math.round(r.score); $('#se-grade').textContent = r.grade; $('#se-msg').textContent = '';
        var b = baseScore(); var d = $('#se-delta');
        if (b != null) { var diff = Math.round((r.score - b) * 10) / 10; d.textContent = (diff > 0 ? '+' : '') + diff + ' since you started (' + Math.round(b) + ')'; } else { d.textContent = 'RQ Score, out of 100'; }
        var ul = $('#se-sections'); ul.innerHTML = '';
        r.sections.forEach(function (s) { var li = el('li'); li.appendChild(el('span', null, s.name)); var tr = el('span', 'se-track'); tr.setAttribute('aria-hidden', 'true'); var i = el('i'); i.style.width = s.pct + '%'; tr.appendChild(i); li.appendChild(tr); li.appendChild(el('b', null, s.pct + '%')); ul.appendChild(li); });
        var ol = $('#se-tips'); ol.innerHTML = '';
        if (!r.tips.length) { ol.appendChild(el('li', null, 'Nothing major to fix. Polish wording and add numbers to your bullets.')); }
        r.tips.forEach(function (t) { var li = el('li'); li.appendChild(el('b', null, t.name)); li.appendChild(el('small', null, t.reason)); ol.appendChild(li); });
    }

    // ---------- job description ----------
    var jdTimer = null;
    $('#se-jd').addEventListener('input', function () { S.jd = this.value; clearTimeout(jdTimer); jdTimer = setTimeout(function () { schedule(true); }, 700); });
    function chips(list, cls, label) {
        var ul = el('ul', 'se-chips'); list.forEach(function (f) { var li = el('li', cls); li.textContent = f.term + (label && f.level === 'must' ? ' (required)' : ''); ul.appendChild(li); }); return ul;
    }
    function renderJD(j) {
        var out = $('#se-jdout'); out.innerHTML = ''; if (!j) { return; }
        var top = el('div', 'se-cov'); var ring = el('div', 'ring ring-lg ring-onlight'); ring.style.setProperty('--v', j.coverage); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', 'Keyword match ' + j.coverage + ' percent'); ring.appendChild(el('b', null, j.coverage + '%'));
        var tx = el('div'); tx.appendChild(el('b', 'big', 'Keyword match')); tx.appendChild(el('p', 'muted', j.total ? 'This job names ' + j.total + ' skills and tools. Required ones count double.' : 'No recognisable skills found in that text.')); top.appendChild(ring); top.appendChild(tx); out.appendChild(top);
        if (j.matched.length) { out.appendChild(el('h3', null, 'Already on your resume')); out.appendChild(chips(j.matched, 'have', false)); }
        if (j.missing.length) { out.appendChild(el('h3', null, 'Asked for, not on your resume')); out.appendChild(chips(j.missing, 'need', true)); out.appendChild(el('p', 'se-help', 'Add one only if it is true for you, in your Skills and in a bullet that shows how you used it.')); }
        if (j.extra_missing.length) { out.appendChild(el('h3', null, 'Other words the job repeats')); var u = el('ul', 'se-chips'); j.extra_missing.forEach(function (w) { u.appendChild(el('li', 'nice', w)); }); out.appendChild(u); }
        if (j.tips.length) { out.appendChild(el('h3', null, 'What to do')); var ol = el('ol', 'se-tips'); j.tips.forEach(function (t) { ol.appendChild(el('li', null, t)); }); out.appendChild(ol); }
    }

    // ---------- saving + downloads ----------
    function toast(msg, bad) { var t = el('div', 'se-toast' + (bad ? ' bad' : ''), msg); t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200); }
    function fmtWait(s) { var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? h + ' h ' + m + ' min' : Math.max(1, m) + ' min'; }
    function renderHint() {
        var h = $('#se-savehint');
        if (S.pro || S.wait <= 0) { h.textContent = ''; return; }
        h.textContent = 'Free plan: your next saved update is in ' + fmtWait(S.wait) + '. Editing and live scoring are unlimited. Pro removes the wait.';
    }
    setInterval(function () { if (!S.pro && S.wait > 0) { S.wait = Math.max(0, S.wait - 30); renderHint(); } }, 30000);
    function renderDownloads() {
        var m = $('#se-dl-menu'); m.innerHTML = ''; var v = S.versions[0];
        if (!v) { m.appendChild(el('p', 'muted', 'Save an update first.')); return; }
        var links = [['Print / PDF', 'print'], B.docx ? ['Word (.docx)', 'docx'] : null, ['Plain text', 'txt']].filter(Boolean);
        links.forEach(function (l) { var a = el('a', null, l[0]); a.href = '/studio/export?v=' + v.id + '&fmt=' + l[1]; if (l[1] === 'print') { a.target = '_blank'; a.rel = 'noopener'; } m.appendChild(a); });
        m.appendChild(el('p', 'muted se-fine', 'Downloads use your last saved update.'));
    }
    $('#se-save').addEventListener('click', function () {
        if (S.saving) { return; }
        if (!S.pro && S.wait > 0) { toast('Free plan: next saved update in ' + fmtWait(S.wait) + '.', true); RS.openUpgrade(); return; }
        S.saving = true; this.disabled = true; status('Saving update...');
        var btn = this;
        RS.post('/api/studio/save', { id: B.id, template: S.template, data: S.data }).then(function (r) {
            S.saving = false; btn.disabled = false;
            if (r.cooldown) { S.wait = r.wait; renderHint(); toast(r.error, true); RS.openUpgrade(); return; }
            if (r.locked) { RS.openUpgrade(); return; }
            if (!r.ok) { toast(r.error || 'Could not save.', true); status(r.error || 'Not saved.'); return; }
            S.wait = r.wait; S.pro = r.pro; renderHint();
            S.versions.unshift({ id: r.version, kind: 'save', score: r.score, grade: r.grade, when: new Date().toISOString(), template: S.template });
            renderDownloads(); buildCompareSelects(); loadCompare();
            toast('Saved. RQ Score ' + Math.round(r.score) + (r.delta != null ? ' (' + (r.delta > 0 ? '+' : '') + r.delta + ')' : '') + '.'); status('Update saved.');
        });
    });

    // ---------- before / after ----------
    function versionLabel(v, i, all) {
        var n = all.filter(function (x) { return x.kind === 'save'; }).length - all.slice(0, i).filter(function (x) { return x.kind === 'save'; }).length;
        var d = new Date(String(v.when).replace(' ', 'T') + (String(v.when).indexOf('Z') < 0 && String(v.when).indexOf('+') < 0 ? 'Z' : ''));
        return (v.kind === 'import' ? 'Where you started' : 'Update ' + n) + ' - score ' + (v.score != null ? Math.round(v.score) : '--') + ' (' + (isNaN(d) ? '' : d.toLocaleDateString([], { day: 'numeric', month: 'short' })) + ')';
    }
    function buildCompareSelects() {
        var a = $('#se-ca'), b = $('#se-cb'), va = a.value, vb = b.value; a.innerHTML = ''; b.innerHTML = '';
        S.versions.forEach(function (v, i) { [a, b].forEach(function (s) { var o = document.createElement('option'); o.value = v.id; o.textContent = versionLabel(v, i, S.versions); s.appendChild(o); }); });
        var oldest = S.versions[S.versions.length - 1], newest = S.versions[0];
        a.value = (va && !S.justSaved && S.versions.some(function (v) { return String(v.id) === va; })) ? va : (oldest ? oldest.id : '');
        b.value = newest ? newest.id : '';
    }
    function loadCompare() {
        var out = $('#se-cmpout'), a = $('#se-ca').value, b = $('#se-cb').value, apply = $('#se-apply');
        if (!a || !b || a === b) { out.innerHTML = ''; out.appendChild(el('p', 'muted', 'Save an update to compare it with where you started.')); apply.hidden = true; return; }
        RS.post('/api/studio/compare', { a: parseInt(a, 10), b: parseInt(b, 10) }).then(function (r) {
            out.innerHTML = ''; if (!r.ok) { out.appendChild(el('p', 'muted', r.error)); return; }
            var box = el('div', 'se-cmp'), sc = el('div', 'se-cmpscores');
            var one = function (v, t) { var d = el('div'); d.appendChild(el('div', 'se-n', v.score != null ? String(Math.round(v.score)) : '--')); d.appendChild(el('small', 'muted', t + (v.grade ? ' - ' + v.grade : ''))); return d; };
            var diff = (r.a.score != null && r.b.score != null) ? Math.round((r.b.score - r.a.score) * 10) / 10 : null;
            var mid = el('div'); mid.appendChild(el('div', 'arrow', '→')); if (diff != null) { mid.appendChild(el('span', 'se-delta ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'), (diff > 0 ? '+' : '') + diff)); }
            sc.appendChild(one(r.a, 'Before')); sc.appendChild(mid); sc.appendChild(one(r.b, 'After')); box.appendChild(sc);
            var ul = el('ul', 'se-bars'); r.b.sections.forEach(function (s) { var o = r.a.sections.filter(function (x) { return x.name === s.name; })[0]; var li = el('li'); li.appendChild(el('span', null, s.name)); var tr = el('span', 'se-track'); tr.setAttribute('aria-hidden', 'true');
                if (o) { var oi = el('i', 'old'); oi.style.width = o.pct + '%'; tr.appendChild(oi); } var ni = el('i'); ni.style.width = s.pct + '%'; ni.style.opacity = o ? '.55' : '1'; tr.appendChild(ni); li.appendChild(tr);
                var d = o ? s.pct - o.pct : null; li.appendChild(el('b', null, (o ? o.pct + ' → ' : '') + s.pct + '%' + (d ? ' (' + (d > 0 ? '+' : '') + d + ')' : ''))); ul.appendChild(li); });
            box.appendChild(el('h3', null, 'By section (grey = before)')); box.appendChild(ul);
            box.appendChild(el('p', 'muted', r.b.words + ' words now, ' + r.a.words + ' before. ' + r.stats.added + ' lines added, ' + r.stats.removed + ' removed.'));
            var df = el('div', 'se-diff'); df.setAttribute('tabindex', '0'); df.setAttribute('role', 'region'); df.setAttribute('aria-label', 'Line by line changes');
            r.diff.forEach(function (x) { df.appendChild(el('div', x[0], x[1] === '' ? ' ' : x[1])); }); box.appendChild(df); out.appendChild(box);
            apply.hidden = false; apply.setAttribute('data-v', String(r.b.id));
        });
    }
    $('#se-ca').addEventListener('change', loadCompare); $('#se-cb').addEventListener('change', loadCompare);
    $('#se-apply').addEventListener('click', function () {
        var v = parseInt(this.getAttribute('data-v'), 10); this.disabled = true; var btn = this;
        RS.post('/api/studio/save', { act: 'apply', version: v }).then(function (r) { btn.disabled = false; toast(r.ok ? (r.message + ' RQ Score ' + Math.round(r.score) + '.') : (r.error || 'Could not apply.'), !r.ok); });
    });

    // ---------- tabs ----------
    var wide = window.matchMedia('(min-width: 1000px)');
    function showTab(name) {
        var panes = { edit: $('#pane-edit'), preview: $('#pane-preview'), score: $('#pane-score'), job: $('#pane-job'), compare: $('#pane-compare') };
        if (wide.matches && name === 'edit') { name = 'preview'; }
        Object.keys(panes).forEach(function (k) { panes[k].hidden = (k === 'edit' && wide.matches) ? false : k !== name; });
        document.querySelectorAll('.se-tabs [role=tab]').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-tab') === name ? 'true' : 'false'); });
        if (name === 'preview') { setTimeout(fitPaper, 30); }
    }
    document.querySelectorAll('.se-tabs [role=tab]').forEach(function (t) { t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); }); });
    if (wide.addEventListener) { wide.addEventListener('change', function () { showTab(wide.matches ? 'preview' : 'edit'); }); }

    // ---------- go ----------
    buildForm(); buildPicker(); renderHint(); renderDownloads(); buildCompareSelects();
    showTab(wide.matches ? 'preview' : 'edit');
    if (S.versions.length > 1) { loadCompare(); }
    live();
})();
