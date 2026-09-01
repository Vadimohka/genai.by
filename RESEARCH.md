# Исследование и проектные решения

Дата исследования: 1 сентября 2026.

## 1. Что болит у CAIO

Роль CAIO находится на стыке стратегии, экономики, данных, архитектуры, рисков, внедрения и развития навыков. Поэтому сайт не строится вокруг «изучения AI-инструментов» — он показывает проблемы operating model.

Ключевые темы, подтверждённые источниками:

1. **Нужны ясные роли и линии ответственности.** NIST AI RMF отдельно требует документировать роли, ответственность и коммуникацию для управления AI-рисками.
2. **Governance должен быть встроен в работу, а не добавлен после пилота.** NIST организует управление рисками через Govern, Map, Measure и Manage; IBM включает governance, этику, приватность, безопасность и соответствие требованиям в мандат CAIO.
3. **Главный барьер масштаба — не только модель.** Исследования McKinsey и Deloitte связывают масштабирование с готовностью данных, operating model, интеграцией функций и ясностью decision rights.
4. **CAIO должен соединять C-level и разрозненные инициативы.** IBM описывает необходимость общего AI-видения и синхронизации руководителей; Deloitte — снижение фрагментации и ясность прав принятия решений.
5. **Обучение и adoption — часть роли.** IBM относит advocacy и education к функциям CAIO; практические кейсы корпоративного внедрения показывают, что сотрудники и владельцы процессов становятся отдельным ограничением масштаба.

### Источники по роли и внедрению

- NIST AI RMF Core: https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
- NIST AI RMF Playbook: https://airc.nist.gov/airmf-resources/playbook/
- IBM — Chief AI Officer: https://www.ibm.com/think/topics/chief-ai-officer
- IBM — CAIO and CEO alignment: https://www.ibm.com/think/leadership/the-billion-dollar-misfire/caio-ceo-alignment
- Deloitte — AI operating model: https://www.deloitte.com/us/en/insights/topics/technology-management/rewiring-ai-operating-model.html
- McKinsey — AI data readiness: https://www.mckinsey.com/capabilities/mckinsey-technology/our-insights/ai-data-readiness-the-key-to-scaling-impact

## 2. Что работает в UI/UX экспертного B2B-сайта

### Реализовано

- **Ценность понятна в первом экране.** Заголовок сразу определяет ответственность CAIO, а не перечисляет услуги.
- **Сначала узнавание боли, потом эксперты.** Пользователь видит собственную ситуацию до биографий и контактов.
- **Объективный, сканируемый текст.** Короткие абзацы, смысловые карточки, конкретные артефакты, минимум рекламных формулировок.
- **Прямой контакт вместо формы.** Два Telegram-контакта, без lead capture и промежуточных экранов.
- **Нет выдуманного social proof.** Не используются неподтверждённые цифры, отзывы и логотипы клиентов.
- **Минимум JavaScript.** Это улучшает скорость, стабильность и отзывчивость.
- **Доступность.** Видимый keyboard focus, семантическая структура, skip-link, достаточный контраст, поддержка `prefers-reduced-motion`.
- **Mobile-first адаптация.** Bento-сетка и сложные блоки перестраиваются в один столбец без потери порядка чтения.

### Не использовано намеренно

- формы «оставьте телефон»;
- таймеры, дефицит мест и искусственная срочность;
- абстрактные обещания «трансформировать бизнес»;
- фальшивые метрики dashboard;
- карусели, autoplay-видео и тяжёлые UI-библиотеки;
- stock-фото и неподтверждённые портреты;
- длинная навигация и несколько конкурирующих CTA.

### Источники по UX

- Nielsen Norman Group — ясность и доверие в B2B: https://www.nngroup.com/articles/b2b-trust-from-b2c/
- Nielsen Norman Group — принципы главной страницы: https://www.nngroup.com/articles/homepage-design-principles/
- Nielsen Norman Group — concise, scannable, objective writing: https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/
- web.dev — избегать лишнего JavaScript: https://web.dev/articles/top-cwv
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG Quick Reference, reduced motion и focus visible: https://www.w3.org/WAI/WCAG22/quickref/

## 3. Фактическая основа экспертных блоков

- Вадим Владымцев: пользователь указал роли co-founder Century и CTO StackLevel Group; публичный сайт описывает фокус на enterprise AI product, architecture, engineering и governed production.
- Виталий Бахмат: пользователь указал партнёрство; публичный LinkedIn указывает роль CEO / co-founder Century, а материалы BY DATA подтверждают практику выбора пилотов, вовлечения сотрудников и масштабирования AI-практики.
- Century: публичный сайт описывает корпоративную AI-платформу, закрытые варианты размещения, доступ к данным, логи, роли, аудит и интеграции.
- StackLevel Group: публичный сайт описывает AI engineering, audit и compliance для регулируемых сред.

### Публичные источники

- https://vadimohka.com/
- https://century-ai.by/
- https://stacklevel.group/
- https://www.linkedin.com/in/vbakhmat/
- https://dgline.by/bydata


## 4. Как применён `style.md`

- obsidian shell на чёрном viewport;
- primary accent `#ccff00`;
- Space Grotesk для заголовков и JetBrains Mono для технических меток;
- glass-слои с blur не менее 16px;
- сетка 60×60px, noise overlay, крупные glow-сферы;
- bento-композиция проблем и контрастная светлая секция экспертов;
- крупные скругления, pill-навигация и lime CTA без агрессивной срочности.
