/* Student file page: pay the verification fee with Razorpay. The amount is set by the server, never by this script. */
(function () {
  'use strict';
  var root = document.querySelector('[data-crm-file]');
  if (!root) { return; }
  var token = root.getAttribute('data-token');
  var msg = document.querySelector('[data-pay-msg]');
  function say(t, bad) {
    if (!msg) { return; }
    msg.hidden = false;
    msg.textContent = t;
    msg.setAttribute('role', bad ? 'alert' : 'status');
    msg.style.color = bad ? '#991b1b' : '';
  }
  function post(body) {
    body.t = token;
    return fetch('/api/crm/pay', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Unexpected reply from the server.' }; }); });
  }
  document.querySelectorAll('[data-pay-verify]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof window.Razorpay !== 'function') { say('The payment window could not load. Check your connection and try again.', true); return; }
      btn.disabled = true;
      say('Opening secure checkout...');
      post({ act: 'order', v: parseInt(btn.getAttribute('data-pay-verify'), 10) }).then(function (o) {
        btn.disabled = false;
        if (!o.ok) { say(o.error || 'Could not start the payment.', true); return; }
        var rz = new window.Razorpay({
          key: o.key, amount: o.amount, currency: o.currency, name: o.name, description: o.description, order_id: o.order_id, prefill: o.prefill, theme: { color: '#ea580c' },
          handler: function (r) {
            say('Confirming your payment...');
            post({ act: 'verify', razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature })
              .then(function (v) { say(v.message || v.error, !v.ok); if (v.ok) { setTimeout(function () { location.reload(); }, 1400); } });
          },
          modal: { ondismiss: function () { say('Payment cancelled. You have not been charged.'); } }
        });
        rz.on('payment.failed', function () { say('The payment did not go through. You have not been charged; please try again.', true); });
        rz.open();
      });
    });
  });
})();
