export const THEME_INIT_SCRIPT = `(function () {
  try {
    localStorage.removeItem('theme');
    var key = 'lumi-theme-preference';
    var localTheme = localStorage.getItem(key);
    var supportDarkMode =
      window.matchMedia('(prefers-color-scheme: dark)').matches === true;
    if (!localTheme && supportDarkMode) localTheme = 'dark';
    if (!localTheme) localTheme = 'light';

    // Apply class "dark" for Aksel tokens
    if (localTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    document.documentElement.setAttribute('data-theme', localTheme);
    document.documentElement.style.colorScheme = localTheme;

    // Body is often unavailable while this script runs in <head>.
    // Guard to avoid aborting before window.__theme is set.
    if (document.body) {
      document.body.setAttribute('data-theme', localTheme);
      document.body.style.colorScheme = localTheme;
    }

    window.__theme = localTheme;
  } catch (e) {}
})();
`;
