(function () {
  var toc = document.getElementById('markdown-toc');
  if (!toc) return;

  toc.classList.add('page-toc');

  var panel = document.createElement('div');
  panel.className = 'page-toc__panel';
  panel.setAttribute('role', 'navigation');
  panel.setAttribute('aria-label', 'On this page');
  toc.parentNode.insertBefore(panel, toc);

  var title = document.createElement('p');
  title.className = 'page-toc__title';
  title.textContent = 'On this page';
  panel.appendChild(title);
  panel.appendChild(toc);

  var links = toc.querySelectorAll('a');
  var sections = [];

  Array.prototype.forEach.call(links, function (link) {
    link.classList.add('page-toc__link');
    var id = (link.getAttribute('href') || '').replace(/^#/, '');
    var heading = id ? document.getElementById(id) : null;
    if (heading) sections.push({ link: link, heading: heading });
  });

  if (!sections.length || !('IntersectionObserver' in window)) return;

  function setActive(link) {
    Array.prototype.forEach.call(links, function (item) {
      item.classList.remove('is-active');
    });
    link.classList.add('is-active');
  }

  var visibleHeadings = [];

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var idx = visibleHeadings.indexOf(entry.target);
        if (entry.isIntersecting && idx === -1) {
          visibleHeadings.push(entry.target);
        } else if (!entry.isIntersecting && idx !== -1) {
          visibleHeadings.splice(idx, 1);
        }
      });

      var current = null;

      if (visibleHeadings.length) {
        visibleHeadings.sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        });
        current = visibleHeadings[0];
      } else {
        // Nothing in the spotlight band: pick the last heading scrolled past.
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].heading.getBoundingClientRect().top < 120) {
            current = sections[i].heading;
          }
        }
      }

      if (!current) return;

      for (var j = 0; j < sections.length; j++) {
        if (sections[j].heading === current) {
          setActive(sections[j].link);
          break;
        }
      }
    },
    { rootMargin: '-96px 0px -65% 0px', threshold: 0 }
  );

  sections.forEach(function (section) {
    observer.observe(section.heading);
  });

  setActive(sections[0].link);
})();
