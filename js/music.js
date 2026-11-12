/**
 * Background Music Controller & Seamless Navigation
 * Handles continuous playback across page changes and cute button styling.
 */

(function () {
  const music = document.getElementById('backgroundMusic');
  const musicButton = document.getElementById('musicButton');

  if (!music || !musicButton) return;

  let isRestoring = true;

  // Retrieve saved audio preferences from localStorage
  const savedTime = parseFloat(localStorage.getItem('musicTime') || '0');
  const wasPlaying = localStorage.getItem('musicPlaying') === 'true';

  // Update UI for the music button
  function updateButtonUI(isPlaying) {
    const icon = musicButton.querySelector('.music-icon');
    const label = musicButton.querySelector('.music-label');

    if (isPlaying) {
      musicButton.classList.add('is-playing');
      if (icon) icon.textContent = '🎶';
      if (label) label.textContent = 'Pause Music';
      musicButton.setAttribute('aria-label', 'Pause background music');
    } else {
      musicButton.classList.remove('is-playing');
      if (icon) icon.textContent = '🎵';
      if (label) label.textContent = 'Play Music';
      musicButton.setAttribute('aria-label', 'Play background music');
    }
  }

  // Resume playback on user gesture if browser blocked immediate autoplay
  function setupOneTimeResume() {
    const resume = () => {
      if (localStorage.getItem('musicPlaying') === 'true' && music.paused) {
        music.play().then(() => {
          updateButtonUI(true);
        }).catch(() => {});
      }
      window.removeEventListener('click', resume, true);
      window.removeEventListener('touchstart', resume, true);
      window.removeEventListener('keydown', resume, true);
    };

    window.addEventListener('click', resume, true);
    window.addEventListener('touchstart', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  // Restore audio position and playback state once metadata is ready
  function initAudioPlayback() {
    if (!isNaN(savedTime) && isFinite(savedTime) && savedTime > 0) {
      try {
        music.currentTime = savedTime;
      } catch (e) {
        console.warn('Could not restore currentTime immediately:', e);
      }
    }

    isRestoring = false;

    if (wasPlaying) {
      const playPromise = music.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          updateButtonUI(true);
        }).catch((err) => {
          console.log('Autoplay prevented by browser policy, waiting for interaction:', err);
          updateButtonUI(false);
          setupOneTimeResume();
        });
      }
    } else {
      updateButtonUI(false);
    }
  }

  // Wait for metadata before seeking, so currentTime is not ignored or reset to 0
  if (music.readyState >= 1) {
    initAudioPlayback();
  } else {
    music.addEventListener('loadedmetadata', initAudioPlayback, { once: true });
    // Backup in case loadedmetadata already fired
    music.addEventListener('canplay', () => {
      if (isRestoring) initAudioPlayback();
    }, { once: true });
  }

  // Periodically save playback position, but only after initial restore completes
  music.addEventListener('timeupdate', () => {
    if (!isRestoring && !music.paused && music.currentTime > 0) {
      localStorage.setItem('musicTime', music.currentTime.toString());
    }
  });

  // Save state immediately when leaving the page
  const saveCurrentState = () => {
    if (!isRestoring && !isNaN(music.currentTime)) {
      localStorage.setItem('musicTime', music.currentTime.toString());
    }
    localStorage.setItem('musicPlaying', (!music.paused).toString());
  };

  window.addEventListener('beforeunload', saveCurrentState);
  window.addEventListener('pagehide', saveCurrentState);

  // Play / Pause button click toggle
  musicButton.addEventListener('click', () => {
    if (music.paused) {
      music.play().then(() => {
        localStorage.setItem('musicPlaying', 'true');
        updateButtonUI(true);
      }).catch((err) => {
        console.error('Audio play error:', err);
      });
    } else {
      music.pause();
      localStorage.setItem('musicPlaying', 'false');
      localStorage.setItem('musicTime', music.currentTime.toString());
      updateButtonUI(false);
    }
  });

  // -------------------------------------------------------------
  // Progressive Seamless Page Navigation (PJAX for HTTP/HTTPS)
  // Keeps music playing with 100% zero interruption when running on a web server
  // -------------------------------------------------------------
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';

  if (isHttp && window.history && window.history.pushState) {
    async function loadPage(url, push = true) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response error');

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const newMain = doc.querySelector('main.page');
        const currentMain = document.querySelector('main.page');

        if (newMain && currentMain) {
          // Replace main content smoothly
          currentMain.replaceWith(newMain);
          document.title = doc.title;

          if (push) {
            history.pushState({ path: url }, doc.title, url);
          }

          window.scrollTo({ top: 0, behavior: 'instant' });
          attachNavLinks();
        } else {
          window.location.href = url;
        }
      } catch (err) {
        console.warn('Seamless navigation failed, falling back to MPA:', err);
        window.location.href = url;
      }
    }

    function handleLinkClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const link = e.currentTarget;
      const href = link.getAttribute('href');

      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
        return;
      }

      // Check if same origin and internal link
      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.origin === window.location.origin) {
        if (targetUrl.href === window.location.href) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        e.preventDefault();
        loadPage(targetUrl.href, true);
      }
    }

    function attachNavLinks() {
      const links = document.querySelectorAll('main.page a[href]');
      links.forEach((link) => {
        link.removeEventListener('click', handleLinkClick);
        link.addEventListener('click', handleLinkClick);
      });
    }

    window.addEventListener('popstate', () => {
      loadPage(window.location.href, false);
    });

    attachNavLinks();
  }
})();
