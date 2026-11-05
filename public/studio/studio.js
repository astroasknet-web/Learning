/* Resume Studio, shared: scaled template thumbnails, upgrade dialog, Razorpay checkout. */
(function () {
    'use strict';
    window.RS = window.RS || {};

    // ---- thumbnails: scale each A4 / Letter page to fit its card ----
    function scaleThumbs() {
        document.querySelectorAll('.sh-thumb').forEach(function (t) {
            var rs = t.querySelector('.rs');
            if (!rs) { return; }
            var w = parseFloat(t.getAttribute('data-w')) || 794;
            rs.style.transform = 'scale(' + (t.clientWidth / w) + ')';
        });
    }
    scaleThumbs();
    if (window.ResizeObserver) { document.querySelectorAll('.sh-grid').forEach(function (g) { new ResizeObserver(scaleThumbs).observe(g); }); }
    window.addEventListener('resize', scaleThumbs);

    // ---- filter selects submit on change ----
    document.querySelectorAll('select[data-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });

    // ---- upgrade dialog ----
    var dlg = document.getElementById('upgrade-dlg');
    function openUpgrade() { if (dlg && dlg.showModal && !dlg.open) { dlg.showModal(); } else if (dlg) { dlg.setAttribute('open', ''); } }
    RS.openUpgrade = openUpgrade;
    document.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-upgrade]') : null;
        if (b) { e.preventDefault(); openUpgrade(); }
    });

    // ---- JSON post helper (used by the editor too) ----
    RS.csrf = function () { var el = document.querySelector('[data-csrf]'); return el ? el.getAttribute('data-csrf') : ''; };
    RS.post = function (url, body) {
        body = body || {}; body._csrf = RS.csrf();
        return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }, function () { return { ok: false, error: 'Unexpected reply from the server.', _status: r.status }; }); });
    };

    // ---- pay with Razorpay ----
    var payMsg = document.querySelector('[data-pay-msg]');
    function say(t, bad) { if (payMsg) { payMsg.hidden = false; payMsg.textContent = t; payMsg.style.background = bad ? '#fee2e2' : '#eef2ff'; } }
    document.querySelectorAll('[data-pay-start]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (typeof window.Razorpay !== 'function') { say('The payment window could not load. Check your connection and try again.', true); return; }
            btn.disabled = true; say('Opening secure checkout...');
            RS.post('/api/studio/pay', { act: 'order' }).then(function (o) {
                btn.disabled = false;
                if (!o.ok) { say(o.error || 'Could not start the payment.', true); return; }
                var rzp = new window.Razorpay({
                    key: o.key, amount: o.amount, currency: o.currency, name: o.name, description: o.description, order_id: o.order_id, prefill: o.prefill, theme: { color: '#4338ca' },
                    handler: function (r) {
                        say('Confirming your payment...');
                        RS.post('/api/studio/pay', { act: 'verify', razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature })
                            .then(function (v) { say(v.message || v.error, !v.ok); if (v.ok) { setTimeout(function () { location.reload(); }, 1400); } });
                    },
                    modal: { ondismiss: function () { say('Payment cancelled. You have not been charged.'); } }
                });
                rzp.on('payment.failed', function () { say('The payment did not go through. You have not been charged; please try again.', true); });
                rzp.open();
            });
        });
    });
})();
