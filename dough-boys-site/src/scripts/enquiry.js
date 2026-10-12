/* Friendlier checks for the enquiry form. Without this script the browser's own checks still apply. */
const form = document.getElementById('enq-form');
if (form) {
  form.noValidate = true;
  const err = document.getElementById('f-error');
  const field = (id) => document.getElementById(id);
  const val = (id) => (field(id).value || '').trim();
  const date = field('f-date');
  const now = new Date();
  date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  function fail(e, msg, el) {
    e.preventDefault();
    err.textContent = msg;
    err.hidden = false;
    el.setAttribute('aria-invalid', 'true');
    el.focus();
  }
  form.addEventListener('input', (e) => { if (e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', (e) => {
    err.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const phone = val('f-phone'), email = val('f-email');
    if (!val('f-name')) return fail(e, 'Add your name so we know who we’re talking to.', field('f-name'));
    if (!phone && !email) return fail(e, 'Add a phone number or an email address so we can reply.', field('f-phone'));
    if (phone && phone.replace(/\D/g, '').length < 10) return fail(e, 'Check the phone number. It should have at least 10 digits.', field('f-phone'));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(e, 'Check the email address. It should look like name@example.com.', field('f-email'));
    if (date.value && date.value < date.min) return fail(e, 'Choose a date from today onwards, or leave the date empty.', date);
    if (!val('f-msg')) return fail(e, 'Tell us a little about what you need.', field('f-msg'));
    form.querySelector('[type="submit"]').setAttribute('aria-disabled', 'true');
  });
}
