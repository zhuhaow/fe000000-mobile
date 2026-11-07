/* Appearance is local to this installation; it never changes game progression. */
(() => {
  if (new URLSearchParams(location.search).has('legacy')) return;
  document.documentElement.classList.add('modern-ui');
  let choice = 'system';
  try { choice = localStorage.getItem('fe000000-ui-theme') || choice; } catch (_) {}
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
