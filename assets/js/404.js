(() => {
  if (!/^\/be(?:\/|$)/.test(window.location.pathname) || document.documentElement.lang.startsWith('be')) return;
  const translations = {"или": "або", "В": "У", "и": "і", "Связаться": "Звязацца", "Минск": "Мінск", "Страница не найдена — CAIO / Практика": "Старонка не знойдзена — CAIO / Практыка", "Ошибка 404": "Памылка 404", "Этой страницы": "Гэтай старонкі", "здесь нет.": "тут няма.", "Возможно, ссылка устарела или в адресе есть опечатка. На главной можно познакомиться с экспертами и выбрать, с кем обсудить вашу задачу.": "Магчыма, спасылка састарэла або ў адрасе ёсць памылка друку. На галоўнай можна пазнаёміцца з экспертамі і выбраць, з кім абмеркаваць вашу задачу.", "На главную": "На галоўную", "Связаться с нами": "Звязацца з намі", "CAIO / Практика": "CAIO / Практыка", "CAIO Практика — на главную": "CAIO Практыка — на галоўную", "практика": "практыка", "К содержанию": "Да зместу", "Навигация в подвале": "Навігацыя ўнізе старонкі", "Работа": "Праца", "Формат": "Фармат", "Публикации": "Публікацыі", "Контакты": "Кантакты", "Навигация": "Навігацыя", "Компании экспертов": "Кампаніі экспертаў", "Практика для AI-лидеров и команд, которые внедряют AI": "Практыка для AI-лідараў і каманд, якія ўкараняюць AI", "Минск · Беларусь": "Мінск · Беларусь"};
  const translated = (value) => translations[value.trim()] || value.trim();
  document.documentElement.lang = 'be-BY';
  document.title = translated(document.title);
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/be/site.webmanifest');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.parentElement.closest('script, style, [data-language-switch]')) return;
    const text = node.textContent;
    if (translations[text.trim()]) node.textContent = text.replace(text.trim(), translated(text));
  });
  document.querySelectorAll('[aria-label], [alt]').forEach((element) => {
    if (element.closest('[data-language-switch]')) return;
    ['aria-label', 'alt'].forEach((name) => {
      const value = element.getAttribute(name);
      if (value && translations[value]) element.setAttribute(name, translated(value));
    });
  });
  document.querySelectorAll('a[href]').forEach((link) => {
    if (link.closest('[data-language-switch]')) return;
    const href = link.getAttribute('href');
    if (href === '/' || href.startsWith('/#') || href.startsWith('/publications/')) link.setAttribute('href', '/be' + href);
  });
  const switcher = document.querySelector('[data-language-switch]');
  switcher?.setAttribute('aria-label', 'Мова сайта');
  switcher?.querySelectorAll('[data-language]').forEach((link) => {
    if (link.dataset.language === 'be') link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
})();
