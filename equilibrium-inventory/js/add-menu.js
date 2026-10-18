const menu = document.getElementById('quickAddMenu');
const button = document.getElementById('quickAddButton');
if (menu && button) {
  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close add menu' : 'Add inventory or delivery');
  }
  button.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', e => {
    if (!e.target.closest('.quick-add')) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setOpen(false); button.focus(); }
  });
}
