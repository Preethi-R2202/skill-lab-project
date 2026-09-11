// Digital Time Capsule — browser-only interactions
const form = document.querySelector('.capsule-form');
const list = document.querySelector('.capsule-list');
const archive = document.querySelector('.archive-grid');
const search = document.querySelector('.archive-head input');
const stored = JSON.parse(localStorage.getItem('timeCapsules') || '[]');

const escapeText = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const displayDate = value => new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
const isUnlocked = capsule => new Date(capsule.unlock) <= new Date();

function renderCapsules() {
  const created = stored.map(capsule => `<article class="capsule-row"><img src="${capsule.image}" alt="Capsule image"><div><h4>${escapeText(capsule.title)}</h4><p><span class="mood hopeful">●</span> ${escapeText(capsule.mood)} · ${isUnlocked(capsule) ? 'Opened' : 'Unlocks'} ${displayDate(capsule.unlock)}</p></div><b class="tag ${isUnlocked(capsule) ? 'opened' : 'locked'}">${isUnlocked(capsule) ? 'Opened' : 'Locked'}</b></article>`).join('');
  if (created) list.insertAdjacentHTML('afterbegin', created);
  const unlocked = stored.filter(isUnlocked);
  if (unlocked.length) archive.innerHTML = unlocked.map(capsule => `<article><img src="${capsule.image}" alt="Capsule image"><h4>${escapeText(capsule.title)}</h4><p>● ${escapeText(capsule.mood)} · ${displayDate(capsule.unlock)}</p><button class="archive-open" data-message="${encodeURIComponent(capsule.message)}">Read memory →</button></article>`).join('');
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const title = form.querySelector('input[type=text]').value.trim();
  const message = form.querySelector('textarea').value.trim();
  const unlock = form.querySelector('input[type=date]').value;
  if (!title || !message || !unlock) return alert('Please enter a title, message, and unlock date.');
  stored.unshift({title, message, unlock: `${unlock}T09:00`, mood: form.querySelector('select').value.replace(/^\S+\s/, ''), image:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=80'});
  localStorage.setItem('timeCapsules', JSON.stringify(stored));
  form.reset(); alert('Your capsule has been sealed safely!'); location.hash = '#dashboard'; location.reload();
});

function tick() {
  let seconds = Math.max(0, Math.floor((new Date('2026-12-15T09:00') - new Date()) / 1000));
  [86400,3600,60,1].forEach((unit, index) => { const value = Math.floor(seconds / unit); seconds %= unit; document.querySelectorAll('.clock b')[index].textContent = String(value).padStart(2,'0'); });
}
search.addEventListener('input', () => document.querySelectorAll('.archive-grid article').forEach(card => card.style.display = card.textContent.toLowerCase().includes(search.value.toLowerCase()) ? '' : 'none'));
document.addEventListener('click', event => { if (event.target.matches('.archive-open')) { document.querySelector('.handwritten').textContent = decodeURIComponent(event.target.dataset.message); location.hash = '#opened'; } });
document.querySelector('.toggle').addEventListener('click', event => { document.body.classList.toggle('dark-theme'); event.target.classList.toggle('on'); });
renderCapsules(); tick(); setInterval(tick, 1000);
