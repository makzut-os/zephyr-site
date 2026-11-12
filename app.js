const tabs = document.querySelectorAll('[data-image]');
const productShot = document.querySelector('#product-shot');
const shotCaption = document.querySelector('#shot-caption');

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const item of tabs) {
      item.classList.toggle('active', item === tab);
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    }
    productShot.src = tab.dataset.image;
    productShot.alt = tab.dataset.caption;
    shotCaption.textContent = tab.dataset.caption;
  });

  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const items = [...tabs];
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    items[(items.indexOf(tab) + direction + items.length) % items.length].focus();
  });
}

const hashButton = document.querySelector('.hash-button');
hashButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(hashButton.dataset.hash);
    hashButton.textContent = 'SHA‑256 скопирован';
  } catch {
    hashButton.textContent = hashButton.dataset.hash;
  }
  window.setTimeout(() => { hashButton.textContent = 'Скопировать SHA‑256'; }, 2400);
});

function readConsent() {
  return document.cookie.split('; ').find(item => item.startsWith('zephyr_cookie_consent='))?.split('=')[1] || null;
}

function saveConsent(value) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `zephyr_cookie_consent=${value}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
}

// Keep consent and deletion receipts when upgrading from the previous brands.
function migratePreviousBrandData() {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  for (const prefix of ['flyspot', 'nimbus']) {
    const key = `${prefix}_cookie_consent`;
    const value = document.cookie.split('; ').find(item => item.startsWith(`${key}=`))?.split('=')[1];
    if (!readConsent() && ['essential', 'analytics'].includes(value)) saveConsent(value);
    if (value && readConsent()) document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    try {
      const previousKey = `${prefix}_feedback_receipts`;
      const previous = JSON.parse(localStorage.getItem(previousKey) || '[]');
      const current = JSON.parse(localStorage.getItem('zephyr_feedback_receipts') || '[]');
      if (!Array.isArray(previous) || !Array.isArray(current)) continue;
      const merged = new Map([...previous, ...current].filter(item => item?.id && item?.deleteToken).map(item => [item.id, item]));
      if (previous.length) {
        localStorage.setItem('zephyr_feedback_receipts', JSON.stringify([...merged.values()]));
        localStorage.removeItem(previousKey);
      }
    } catch { /* Preserve old receipts if browser storage is unavailable. */ }
  }
}
migratePreviousBrandData();

async function analyticsEvent(event) {
  if (readConsent() !== 'analytics') return;
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, consent: 'analytics' }),
      keepalive: true
    });
  } catch { /* Analytics must never block the page. */ }
}

let cookieBanner = document.querySelector('#cookie-banner');
if (!cookieBanner) {
  cookieBanner = document.createElement('section');
  cookieBanner.className = 'cookie-banner';
  cookieBanner.id = 'cookie-banner';
  cookieBanner.setAttribute('role', 'dialog');
  cookieBanner.setAttribute('aria-labelledby', 'cookie-title');
  cookieBanner.setAttribute('aria-describedby', 'cookie-description');
  cookieBanner.hidden = true;
  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'cookie-title';
  title.textContent = 'Настройки cookie';
  const description = document.createElement('p');
  description.id = 'cookie-description';
  description.append('Обязательный cookie сохраняет выбор. Агрегированная аналитика включается только с согласия. ');
  const policy = document.createElement('a');
  policy.href = 'cookies.html';
  policy.textContent = 'Подробнее';
  description.append(policy, '.');
  copy.append(title, description);
  const actions = document.createElement('div');
  actions.className = 'cookie-actions';
  for (const [choice, label] of [['essential', 'Только обязательные'], ['analytics', 'Разрешить аналитику']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.cookieChoice = choice;
    button.textContent = label;
    actions.append(button);
  }
  cookieBanner.append(copy, actions);
  document.body.append(cookieBanner);
}
if (!readConsent() && cookieBanner) cookieBanner.hidden = false;
for (const button of document.querySelectorAll('[data-cookie-choice]')) {
  button.addEventListener('click', () => {
    saveConsent(button.dataset.cookieChoice);
    cookieBanner.hidden = true;
    if (button.dataset.cookieChoice === 'analytics') analyticsEvent('page_view');
  });
}
if (readConsent() === 'analytics') analyticsEvent('page_view');

for (const download of document.querySelectorAll('a[download]')) {
  download.addEventListener('click', () => analyticsEvent('download'));
}

const feedbackForm = document.querySelector('#feedback-form');
const formStatus = document.querySelector('#form-status');
const startedAt = document.querySelector('#form-started-at');
if (startedAt) startedAt.value = String(Date.now());

function feedbackReceipts() {
  try { return JSON.parse(localStorage.getItem('zephyr_feedback_receipts') || '[]'); }
  catch { return []; }
}

function saveFeedbackReceipts(receipts) {
  localStorage.setItem('zephyr_feedback_receipts', JSON.stringify(receipts));
}

feedbackForm?.addEventListener('submit', async event => {
  event.preventDefault();
  formStatus.textContent = '';
  if (!feedbackForm.reportValidity()) return;
  const data = new FormData(feedbackForm);
  const payload = {
    topic: data.get('topic'),
    message: data.get('message'),
    contact: data.get('contact'),
    website: data.get('website'),
    startedAt: Number(data.get('startedAt')),
    privacyConsent: data.get('privacyConsent') === 'on',
    ageConfirmed: data.get('ageConfirmed') === 'on'
  };
  const submit = feedbackForm.querySelector('[type="submit"]');
  submit.disabled = true;
  formStatus.textContent = 'Отправка…';
  try {
    const response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось отправить обращение.');
    if (result.id && result.deleteToken) {
      const receipts = feedbackReceipts();
      receipts.push({ id: result.id, deleteToken: result.deleteToken });
      saveFeedbackReceipts(receipts);
    }
    feedbackForm.reset();
    startedAt.value = String(Date.now());
    formStatus.textContent = 'Обращение сохранено. Его можно удалить кнопкой слева в течение 30 дней.';
  } catch (error) {
    formStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

const deleteButton = document.querySelector('#delete-feedback');
const deleteStatus = document.querySelector('#delete-status');
deleteButton?.addEventListener('click', async () => {
  const receipts = feedbackReceipts();
  if (!receipts.length) {
    deleteStatus.textContent = 'В этом браузере нет сохранённых обращений.';
    return;
  }
  deleteButton.disabled = true;
  let deleted = 0;
  const remaining = [];
  for (const receipt of receipts) {
    try {
      const response = await fetch(`/api/feedback/${encodeURIComponent(receipt.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: receipt.deleteToken })
      });
      if (response.ok || response.status === 404) deleted += 1;
      else remaining.push(receipt);
    } catch { remaining.push(receipt); }
  }
  saveFeedbackReceipts(remaining);
  deleteStatus.textContent = deleted ? `Удалено обращений: ${deleted}.` : 'Не удалось удалить обращения. Попробуй позже.';
  deleteButton.disabled = false;
});
