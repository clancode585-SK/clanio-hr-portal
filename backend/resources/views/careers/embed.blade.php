(function () {
    'use strict';

    var API = '{{ $apiBase }}';
    var HOST = '{{ $hostBase }}';
    var mounted = [];

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function styles(accent) {
        if (document.getElementById('clanio-careers-style')) return;

        var css = [
            '.clanio-wrap{--clanio-accent:' + accent + ';--clanio-line:#E3E7EF;--clanio-muted:#5A6478;--clanio-subtle:#8B95AC}',
            '.clanio-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}',
            '.clanio-card{border:1px solid var(--clanio-line);border-radius:12px;padding:22px;background:#fff;display:flex;flex-direction:column;gap:10px;text-align:left}',
            '.clanio-card h3{font-size:18px;margin:0;line-height:1.35}',
            '.clanio-meta{font-size:14px;color:var(--clanio-muted);margin:0}',
            '.clanio-meta b{color:inherit;font-weight:600}',
            '.clanio-tags{display:flex;flex-wrap:wrap;gap:6px}',
            '.clanio-tag{font-size:12px;font-weight:600;color:var(--clanio-muted);background:#F5F7FB;border:1px solid var(--clanio-line);padding:3px 9px;border-radius:999px;text-transform:capitalize}',
            '.clanio-btn{background:var(--clanio-accent);color:#fff;border:0;border-radius:8px;padding:11px 20px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;align-self:flex-start;margin-top:auto}',
            '.clanio-btn:hover{filter:brightness(1.1)}',
            '.clanio-btn[disabled]{opacity:.6;cursor:default}',
            '.clanio-list .clanio-card{flex-direction:row;align-items:center;flex-wrap:wrap}',
            '.clanio-list .clanio-card h3{flex:1 1 240px}',
            '.clanio-list .clanio-btn{margin-top:0}',
            '.clanio-empty{border:1px solid var(--clanio-line);border-radius:12px;padding:40px 24px;text-align:center;color:var(--clanio-muted)}',
            '.clanio-by{margin-top:22px;font-size:13px;color:var(--clanio-subtle);text-align:center}',
            '.clanio-by a{color:inherit}',
            '.clanio-back{background:none;border:0;color:var(--clanio-accent);font:inherit;font-size:14px;cursor:pointer;padding:0;margin-bottom:16px}',
            '.clanio-facts{border:1px solid var(--clanio-line);border-radius:12px;padding:20px 22px;margin-bottom:24px;display:grid;gap:10px 28px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}',
            '.clanio-fact{font-size:15px;margin:0}',
            '.clanio-fact span{color:var(--clanio-muted)}',
            '.clanio-block{margin-bottom:24px}',
            '.clanio-block h4{font-size:18px;margin:0 0 10px}',
            '.clanio-block ul{margin:0;padding-left:22px}',
            '.clanio-block li{margin-bottom:8px;color:var(--clanio-muted)}',
            '.clanio-form{border:1px solid var(--clanio-line);border-radius:12px;padding:26px;display:grid;gap:16px;grid-template-columns:1fr 1fr;background:#fff}',
            '.clanio-form h4{grid-column:1/-1;font-size:18px;margin:0}',
            '.clanio-field{display:flex;flex-direction:column;gap:6px}',
            '.clanio-field.clanio-wide{grid-column:1/-1}',
            '.clanio-field label{font-size:13px;font-weight:600;color:var(--clanio-muted)}',
            '.clanio-field label i{color:#D13B3B;font-style:normal}',
            '.clanio-field input,.clanio-field textarea{font:inherit;font-size:15px;padding:11px 13px;border:1px solid var(--clanio-line);border-radius:8px;width:100%;background:#fff;color:inherit}',
            '.clanio-field input:focus,.clanio-field textarea:focus{outline:0;border-color:var(--clanio-accent)}',
            '.clanio-field textarea{min-height:90px;resize:vertical}',
            '.clanio-field .clanio-hint{font-size:12px;color:var(--clanio-subtle)}',
            '.clanio-honey{position:absolute;left:-9999px}',
            '.clanio-note{display:none;grid-column:1/-1;border-radius:8px;padding:13px 15px;font-size:14px}',
            '.clanio-note.bad{display:block;background:#FDECEC;border:1px solid #D13B3B;color:#8E2020}',
            '.clanio-done{border:1px solid #1E8E5A;border-radius:12px;padding:34px 26px;text-align:center;background:#fff}',
            '.clanio-done h4{margin:0 0 8px;font-size:20px;color:#14683F}',
            '.clanio-done p{margin:0 0 6px;color:var(--clanio-muted)}',
            '@media(max-width:640px){.clanio-form{grid-template-columns:1fr;padding:20px}}',
        ].join('');

        var tag = el('style');
        tag.id = 'clanio-careers-style';
        tag.appendChild(document.createTextNode(css));
        document.head.appendChild(tag);
    }

    function get(path) {
        return fetch(API + path, { headers: { Accept: 'application/json' } }).then(function (response) {
            return response.json().then(function (payload) {
                if (!response.ok) throw new Error((payload && payload.message) || 'Request failed');
                return payload.data;
            });
        });
    }

    function drawList(mount, key, data) {
        mount.textContent = '';
        mount.className = 'clanio-wrap' + (data.page.layout === 'list' ? ' clanio-list' : '');

        if (!data.openings.length) {
            mount.appendChild(el('div', 'clanio-empty', 'No openings are listed right now.'));
            return;
        }

        var grid = el('div', data.page.layout === 'list' ? '' : 'clanio-grid');

        data.openings.forEach(function (job) {
            var card = el('div', 'clanio-card');
            card.appendChild(el('h3', null, job.title));
            card.appendChild(meta('Experience', job.experience_label));
            card.appendChild(meta('Location', job.location));

            var tags = el('div', 'clanio-tags');
            [job.employment_type, job.work_mode, job.department].forEach(function (value) {
                if (value) tags.appendChild(el('span', 'clanio-tag', value));
            });
            if (job.salary) tags.appendChild(el('span', 'clanio-tag', job.salary));
            card.appendChild(tags);

            var open = el('button', 'clanio-btn', 'Apply Now');
            open.type = 'button';
            open.addEventListener('click', function () {
                drawOne(mount, key, job.slug);
            });
            card.appendChild(open);

            grid.appendChild(card);
        });

        mount.appendChild(grid);

        if (data.page.show_powered_by) {
            var by = el('p', 'clanio-by');
            by.innerHTML = 'Hiring runs on <a href="' + HOST + '" target="_blank" rel="noopener">Clanio</a>';
            mount.appendChild(by);
        }
    }

    function meta(label, value) {
        var line = el('p', 'clanio-meta');
        line.appendChild(el('b', null, label));
        line.appendChild(document.createTextNode(' — ' + value));
        return line;
    }

    function block(heading, lines) {
        if (!lines || !lines.length) return null;
        var wrap = el('div', 'clanio-block');
        wrap.appendChild(el('h4', null, heading));
        var list = el('ul');
        lines.forEach(function (line) { list.appendChild(el('li', null, line)); });
        wrap.appendChild(list);
        return wrap;
    }

    function fact(label, value) {
        var node = el('p', 'clanio-fact');
        node.appendChild(el('span', null, label + ':'));
        node.appendChild(document.createTextNode(' ' + value));
        return node;
    }

    var FIELDS = [
        ['name', 'Full Name', 'text', true, false],
        ['email', 'Email', 'email', true, false],
        ['phone', 'Phone', 'tel', true, false],
        ['total_experience', 'Total Experience (years)', 'number', false, false],
        ['current_company', 'Current Company', 'text', false, false],
        ['current_location', 'Current Location', 'text', false, false],
        ['current_ctc', 'Current CTC', 'number', false, false],
        ['expected_ctc', 'Expected CTC', 'number', false, false],
        ['notice_period_days', 'Notice Period (days)', 'number', false, false],
        ['linkedin_url', 'LinkedIn Profile', 'url', false, false],
        ['resume', 'Resume', 'file', true, true],
        ['cover_note', 'Anything else we should know?', 'textarea', false, true],
    ];

    function drawOne(mount, key, slug) {
        mount.textContent = '';
        mount.appendChild(el('p', null, 'Loading'));

        get('/careers/' + key + '/openings/' + encodeURIComponent(slug)).then(function (data) {
            var job = data.opening;
            mount.textContent = '';

            var back = el('button', 'clanio-back', '← All openings');
            back.type = 'button';
            back.addEventListener('click', function () { boot(mount, key); });
            mount.appendChild(back);

            mount.appendChild(el('h3', null, job.title));

            var facts = el('div', 'clanio-facts');
            facts.appendChild(fact('Job Title', job.title));
            facts.appendChild(fact('Location', job.location));
            facts.appendChild(fact('Experience', job.experience_label));
            facts.appendChild(fact('Employment Type', job.employment_type));
            if (job.department) facts.appendChild(fact('Department', job.department));
            if (job.positions > 1) facts.appendChild(fact('Positions', job.positions));
            if (job.salary) facts.appendChild(fact('Salary', job.salary));
            if (job.closes_on) facts.appendChild(fact('Apply by', job.closes_on));
            mount.appendChild(facts);

            if (job.summary) {
                var intro = el('div', 'clanio-block');
                intro.appendChild(el('p', 'clanio-meta', job.summary));
                mount.appendChild(intro);
            }

            [
                block('Key Responsibilities:', job.responsibilities),
                block('Required Skills and Qualifications:', job.requirements),
                block('Good to have:', job.nice_to_have),
            ].forEach(function (part) { if (part) mount.appendChild(part); });

            mount.appendChild(buildForm(mount, key, job));
        }).catch(function (error) {
            mount.textContent = '';
            mount.appendChild(el('div', 'clanio-empty', error.message));
        });
    }

    function buildForm(mount, key, job) {
        var form = el('form', 'clanio-form');
        form.setAttribute('novalidate', 'novalidate');
        form.appendChild(el('h4', null, 'Apply for this role'));

        var note = el('div', 'clanio-note');
        form.appendChild(note);

        FIELDS.forEach(function (spec) {
            var name = spec[0];
            var wrap = el('div', 'clanio-field' + (spec[4] ? ' clanio-wide' : ''));
            var label = el('label', null, spec[1] + ' ');
            label.setAttribute('for', 'clanio-' + name);
            if (spec[3]) label.appendChild(el('i', null, '*'));
            wrap.appendChild(label);

            var input = el(spec[2] === 'textarea' ? 'textarea' : 'input');
            input.id = 'clanio-' + name;
            input.name = name;
            if (spec[2] !== 'textarea') input.type = spec[2];
            if (spec[2] === 'file') input.accept = '.pdf,.doc,.docx';
            if (spec[2] === 'number') input.min = '0';
            if (name === 'total_experience') input.step = '0.5';
            if (spec[3]) input.required = true;
            wrap.appendChild(input);

            if (name === 'resume') wrap.appendChild(el('span', 'clanio-hint', 'PDF or Word, up to 5 MB'));
            form.appendChild(wrap);
        });

        var honey = el('input', 'clanio-honey');
        honey.name = 'company_website';
        honey.tabIndex = -1;
        honey.setAttribute('autocomplete', 'off');
        honey.setAttribute('aria-hidden', 'true');
        form.appendChild(honey);

        var wrapper = el('div', 'clanio-wide');
        var send = el('button', 'clanio-btn', 'Submit Application');
        send.type = 'submit';
        wrapper.appendChild(send);
        form.appendChild(wrapper);

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            note.className = 'clanio-note';
            note.textContent = '';

            var body = new FormData(form);
            body.append('source', 'career_page');

            send.disabled = true;
            send.textContent = 'Sending';

            fetch(API + '/careers/' + key + '/openings/' + encodeURIComponent(job.slug) + '/apply', {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: body,
            }).then(function (response) {
                return response.json().then(function (payload) {
                    return { ok: response.ok, payload: payload };
                });
            }).then(function (result) {
                send.disabled = false;
                send.textContent = 'Submit Application';

                if (!result.ok) {
                    var errors = result.payload && result.payload.errors;
                    note.className = 'clanio-note bad';
                    note.textContent = errors && Object.keys(errors).length
                        ? errors[Object.keys(errors)[0]][0]
                        : (result.payload && result.payload.message) || 'Could not send your application.';
                    return;
                }

                mount.textContent = '';
                var done = el('div', 'clanio-done');
                done.appendChild(el('h4', null, 'Thank you for applying'));
                done.appendChild(el('p', null, 'Your application for ' + job.title + ' has reached the team.'));
                done.appendChild(el('p', null, 'Reference ' + result.payload.data.reference));

                var again = el('button', 'clanio-btn', 'See other openings');
                again.type = 'button';
                again.addEventListener('click', function () { boot(mount, key); });
                done.appendChild(again);
                mount.appendChild(done);
                mount.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }).catch(function () {
                send.disabled = false;
                send.textContent = 'Submit Application';
                note.className = 'clanio-note bad';
                note.textContent = 'Could not reach the server. Please try again.';
            });
        });

        return form;
    }

    function boot(mount, key) {
        mount.textContent = 'Loading openings';

        get('/careers/' + key + '/openings').then(function (data) {
            styles(data.page.accent_color || '#1B2A6B');
            drawList(mount, key, data);
        }).catch(function (error) {
            mount.textContent = '';
            mount.className = 'clanio-wrap';
            mount.appendChild(el('div', 'clanio-empty', error.message));
        });
    }

    function start() {
        var nodes = document.querySelectorAll('[data-key]#clanio-careers, .clanio-careers[data-key]');

        Array.prototype.forEach.call(nodes, function (mount) {
            if (mounted.indexOf(mount) !== -1) return;
            mounted.push(mount);
            boot(mount, mount.getAttribute('data-key'));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
