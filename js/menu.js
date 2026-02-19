(function () {
  const menus = document.querySelectorAll('.menu-dropdown');
  menus.forEach((dropdown) => {
    const button = dropdown.querySelector('.menu-dropdown-toggle');
    if (!button) return;

    function closeMenu() {
      dropdown.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
      const open = !dropdown.classList.contains('is-open');
      dropdown.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    dropdown.addEventListener('mouseleave', () => {
      if (window.matchMedia('(hover: hover)').matches) {
        closeMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  });
})();
