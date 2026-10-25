/* Travel Buddy — catalogue: plans, services, toolkit.
   Single source of truth. `node tools/make-seed.mjs` turns this file into backend/supabase/seed.sql,
   so the prices the site shows are the prices the server charges. */
(function () {
  'use strict';
  var T = function (en, ar, ru, de) { return { en: en, ar: ar, ru: ru, de: de }; };

  /* ---------- Membership plans (USD) ---------- */
  var plans = [
    { id: 'explorer', rank: 0, month: 0, year: 0, discount: 0, credits: 0, concierge: 0, planner: 1, board: 0, support: 'community', icon: 'compass',
      name: T('Explorer', 'مستكشف', 'Исследователь', 'Explorer'),
      tag: T('Everything you need to land and look around — free.', 'كل اللي تحتاجه عشان تبدأ رحلتك — مجانًا.', 'Всё, чтобы начать знакомство с городом, — бесплатно.', 'Alles für den Start – kostenlos.') },
    { id: 'buddy', rank: 1, month: 9, year: 90, discount: 10, credits: 0, concierge: 1, planner: -1, board: 1, support: 'chat', icon: 'user-group',
      name: T('Buddy', 'بادي', 'Buddy', 'Buddy'),
      tag: T('Member prices, the Buddy Board and a human on WhatsApp.', 'أسعار الأعضاء ولوحة الرفقاء ومساعد حقيقي على واتساب.', 'Цены для участников, доска Buddy и живой помощник в WhatsApp.', 'Mitgliederpreise, Buddy-Board und echte Hilfe per WhatsApp.') },
    { id: 'plus', rank: 2, month: 19, year: 190, discount: 15, credits: 0, concierge: 3, planner: -1, board: 2, support: 'priority', icon: 'star', popular: true,
      name: T('Buddy Plus', 'بادي بلس', 'Buddy Plus', 'Buddy Plus'),
      tag: T('Bigger savings and 24/7 priority support for the whole trip.', 'خصم أكبر ودعم أولوية ٢٤/٧ طول رحلتك.', 'Больше скидок и приоритетная поддержка 24/7.', 'Mehr sparen und Prioritäts-Support rund um die Uhr.') },
    { id: 'vip', rank: 3, month: 49, year: 490, discount: 20, credits: 2, concierge: -1, planner: -1, board: 2, support: 'concierge', icon: 'crown',
      name: T('VIP Concierge', 'في آي بي كونسيرج', 'VIP-консьерж', 'VIP Concierge'),
      tag: T('A personal concierge, two airport transfers included every month.', 'كونسيرج شخصي ورحلتين مطار مجانًا كل شهر.', 'Личный консьерж и два трансфера в месяц включены.', 'Persönlicher Concierge, zwei Flughafentransfers pro Monat inklusive.') }
  ];

  /* ---------- Categories ---------- */
  var categories = [
    { id: 'sea', icon: 'sailboat', c1: '#0ea5e9', c2: '#0369a1', name: T('Sea trips', 'رحلات بحرية', 'Морские туры', 'Bootstouren') },
    { id: 'desert', icon: 'mountain-sun', c1: '#f59e0b', c2: '#b45309', name: T('Desert & mountains', 'صحراء وجبال', 'Пустыня и горы', 'Wüste & Berge') },
    { id: 'diving', icon: 'water', c1: '#06b6d4', c2: '#1e3a8a', name: T('Diving', 'غطس', 'Дайвинг', 'Tauchen') },
    { id: 'transfers', icon: 'van-shuttle', c1: '#64748b', c2: '#1e293b', name: T('Transfers', 'ترانسفير', 'Трансферы', 'Transfers') },
    { id: 'food', icon: 'utensils', c1: '#f43f5e', c2: '#9f1239', name: T('Food & nights', 'أكل وسهر', 'Еда и вечера', 'Essen & Nachtleben') },
    { id: 'wellness', icon: 'spa', c1: '#a78bfa', c2: '#5b21b6', name: T('Wellness', 'استرخاء', 'Велнес', 'Wellness') },
    { id: 'active', icon: 'person-snowboarding', c1: '#22c55e', c2: '#166534', name: T('Active & rentals', 'أنشطة وتأجير', 'Активный отдых и аренда', 'Aktiv & Miete') },
    { id: 'essentials', icon: 'life-ring', c1: '#ec4899', c2: '#831843', name: T('Travel essentials', 'خدمات أساسية', 'Нужное в поездке', 'Reise-Essentials') }
  ];

  /* ---------- "What's included" labels ---------- */
  var inc = {
    pickup: T('Hotel pickup & drop-off', 'استلام وتوصيل من الفندق', 'Трансфер из отеля и обратно', 'Hotelabholung & Rückfahrt'),
    guide: T('Licensed guide', 'مرشد مرخّص', 'Лицензированный гид', 'Lizenzierter Guide'),
    lunch: T('Lunch', 'غداء', 'Обед', 'Mittagessen'),
    gear: T('Snorkel gear', 'معدات سنوركل', 'Снаряжение для снорклинга', 'Schnorchelausrüstung'),
    fees: T('Park & entry fees', 'رسوم الدخول', 'Входные билеты', 'Eintrittsgebühren'),
    drinks: T('Water & soft drinks', 'مياه ومشروبات', 'Вода и напитки', 'Wasser & Softdrinks'),
    dinner: T('Dinner', 'عشاء', 'Ужин', 'Abendessen'),
    instructor: T('Certified instructor', 'مدرب معتمد', 'Сертифицированный инструктор', 'Zertifizierter Instruktor'),
    equip: T('Full equipment', 'معدات كاملة', 'Всё оборудование', 'Komplette Ausrüstung'),
    insurance: T('Insurance', 'تأمين', 'Страховка', 'Versicherung'),
    meet: T('Meet at arrivals', 'استقبال في الوصول', 'Встреча в зале прилёта', 'Empfang in der Ankunftshalle'),
    flight: T('Flight tracking', 'متابعة الرحلة', 'Отслеживание рейса', 'Flugverfolgung'),
    wait: T('Waiting time', 'وقت انتظار', 'Ожидание', 'Wartezeit'),
    photos: T('Edited photos', 'صور معدّلة', 'Обработанные фото', 'Bearbeitete Fotos'),
    fuel: T('Fuel & helmets', 'بنزين وخوذ', 'Топливо и шлемы', 'Sprit & Helme'),
    towels: T('Towels & oils', 'فوط وزيوت', 'Полотенца и масла', 'Handtücher & Öle'),
    data: T('15 GB data', '١٥ جيجا إنترنت', '15 ГБ интернета', '15 GB Daten'),
    captain: T('Captain & crew', 'قبطان وطاقم', 'Капитан и экипаж', 'Skipper & Crew'),
    tea: T('Bedouin tea', 'شاي بدوي', 'Чай у бедуинов', 'Beduinentee'),
    shuttle: T('Round-trip shuttle', 'مواصلات رايح جاي', 'Трансфер туда-обратно', 'Hin- & Rückfahrt')
  };

  /* ---------- Services (price in USD; unit = what the price is per) ---------- */
  // needs: what the booking form must collect  ('hotel' | 'flight' | 'none')
  var services = [
    { id: 'ras-mohammed', cat: 'sea', icon: 'fish', price: 45, unit: 'person', hrs: 9, group: true, cap: 30, needs: 'hotel', top: true, inc: ['pickup', 'fees', 'gear', 'lunch', 'guide'],
      title: T('Ras Mohammed National Park Snorkeling', 'رحلة سنوركل محمية رأس محمد', 'Снорклинг в нацпарке Рас-Мохаммед', 'Schnorcheln im Ras-Mohammed-Nationalpark'),
      desc: T('Full-day boat trip to the famous marine park: Shark Observatory, Yolanda reef and two snorkel stops.', 'رحلة بحرية ليوم كامل لمحمية رأس محمد: مرصد القروش وشعاب يولاندا مع محطتين سنوركل.', 'Целый день на лодке в знаменитом морском парке: Shark Observatory, риф Yolanda и две остановки для снорклинга.', 'Ganztägige Bootstour im berühmten Meeresschutzgebiet: Shark Observatory, Yolanda-Riff und zwei Schnorchelstopps.') },
    { id: 'tiran', cat: 'sea', icon: 'water', price: 40, unit: 'person', hrs: 8, group: true, cap: 30, needs: 'hotel', top: true, inc: ['pickup', 'gear', 'lunch', 'drinks', 'guide'],
      title: T('Tiran Island Reef Cruise', 'رحلة جزيرة تيران', 'Круиз на остров Тиран', 'Tiran-Island-Riffkreuzfahrt'),
      desc: T('Boat day to the Straits of Tiran with snorkeling at Jackson and Woodhouse reefs, lunch on board.', 'رحلة بحرية لمضيق تيران مع سنوركل عند شعاب جاكسون وودهاوس وغداء على المركب.', 'Лодочный день в проливе Тиран: снорклинг на рифах Джексон и Вудхаус, обед на борту.', 'Bootstag in der Straße von Tiran mit Schnorcheln an den Riffen Jackson und Woodhouse, Mittagessen an Bord.') },
    { id: 'white-island', cat: 'sea', icon: 'umbrella-beach', price: 38, unit: 'person', hrs: 5, group: true, cap: 24, needs: 'hotel', inc: ['pickup', 'fees', 'gear', 'drinks'],
      title: T('White Island Sandbar & Snorkel', 'جزيرة وايت آيلاند والسنوركل', 'Белый остров и снорклинг', 'White Island Sandbank & Schnorcheln'),
      desc: T('Half-day trip to the sandbar island with relaxed snorkeling and plenty of beach time.', 'رحلة نصف يوم لجزيرة الرمال البيضاء مع سنوركل هادئ ووقت على الشاطئ.', 'Полдня на песчаном острове: спокойный снорклинг и пляж.', 'Halbtagestour zur Sandbank-Insel mit entspanntem Schnorcheln und Strandzeit.') },
    { id: 'glass-boat', cat: 'sea', icon: 'eye', price: 20, unit: 'person', hrs: 2.5, group: true, cap: 20, needs: 'hotel', inc: ['gear', 'drinks', 'guide'],
      title: T('Glass-Bottom Boat & Reef Visit', 'قارب زجاجي وزيارة الشعاب', 'Лодка со стеклянным дном', 'Glasbodenboot & Riffbesuch'),
      desc: T('See the coral reef without getting wet — perfect for kids and families.', 'شوف الشعاب المرجانية من غير ما تتبل — مناسبة للأطفال والعائلات.', 'Рифы без погружения — отлично для семей с детьми.', 'Korallenriff erleben, ohne nass zu werden – ideal für Familien.') },
    { id: 'sunset-sail', cat: 'sea', icon: 'sun', price: 55, unit: 'person', hrs: 3, group: true, cap: 20, needs: 'hotel', inc: ['pickup', 'dinner', 'drinks', 'captain'],
      title: T('Sunset Sailing with Dinner', 'رحلة شراعية عند الغروب مع العشاء', 'Парусный круиз на закате с ужином', 'Segeltörn bei Sonnenuntergang mit Dinner'),
      desc: T('Three hours on a traditional sailboat along the coast with dinner and soft drinks.', 'ثلاث ساعات على مركب شراعي تقليدي مع عشاء ومشروبات.', 'Три часа на традиционной яхте вдоль побережья, ужин и напитки.', 'Drei Stunden auf einem traditionellen Segelboot, inklusive Dinner und Softdrinks.') },
    { id: 'boat-charter', cat: 'sea', icon: 'ship', price: 180, unit: 'boat', hrs: 4, group: false, needs: 'hotel', inc: ['captain', 'gear', 'drinks', 'fees'],
      title: T('Private Boat Charter (4h)', 'تأجير مركب خاص (٤ ساعات)', 'Частная лодка (4 ч)', 'Privates Boot (4 Std.)'),
      desc: T('Your own boat with captain for up to 8 people — you choose the route and snorkel stops.', 'مركب خاص بقبطان لحد ٨ أشخاص — إنت اللي بتختار المسار ومحطات السنوركل.', 'Лодка с капитаном до 8 человек — маршрут и точки снорклинга выбираете вы.', 'Boot mit Skipper für bis zu 8 Personen – Route und Schnorchelstopps nach Wunsch.') },

    { id: 'sinai-sunrise', cat: 'desert', icon: 'mountain-sun', price: 55, unit: 'person', hrs: 12, group: true, cap: 16, needs: 'hotel', top: true, inc: ['pickup', 'guide', 'fees', 'drinks'],
      title: T('Mount Sinai Sunrise & St. Catherine', 'شروق جبل سيناء ودير سانت كاترين', 'Рассвет на горе Синай и монастырь Св. Екатерины', 'Sonnenaufgang am Sinai & Katharinenkloster'),
      desc: T('Overnight trip: night climb (or camel ride) to the summit for sunrise, then St. Catherine’s Monastery.', 'رحلة ليلية: صعود الجبل (أو بالجمل) لمشاهدة الشروق ثم زيارة دير سانت كاترين.', 'Ночная поездка: подъём (или верблюд) на вершину к рассвету, затем монастырь.', 'Nachttour: Aufstieg (oder Kamelritt) zum Gipfel zum Sonnenaufgang, danach Katharinenkloster.') },
    { id: 'quad-safari', cat: 'desert', icon: 'motorcycle', price: 40, unit: 'person', hrs: 5, group: true, cap: 16, needs: 'hotel', top: true, inc: ['pickup', 'fuel', 'tea', 'dinner', 'guide'],
      title: T('Quad Bike Safari & Bedouin Dinner', 'سفاري كواد وعشاء بدوي', 'Квадроциклы и ужин у бедуинов', 'Quad-Safari & Beduinen-Dinner'),
      desc: T('Ride through Sinai dunes at sunset, tea with Bedouins and dinner under the stars.', 'قيادة كواد وسط كثبان سيناء عند الغروب وشاي بدوي وعشاء تحت النجوم.', 'Закат среди дюн Синая, чай с бедуинами и ужин под звёздами.', 'Fahrt durch die Sinai-Dünen bei Sonnenuntergang, Tee bei Beduinen und Dinner unter Sternen.') },
    { id: 'stargazing', cat: 'desert', icon: 'star-and-crescent', price: 45, unit: 'person', hrs: 5, group: true, cap: 14, days: [1, 4], needs: 'hotel', inc: ['pickup', 'guide', 'tea', 'dinner'],
      title: T('Bedouin Stargazing Night', 'ليلة النجوم مع البدو', 'Ночь под звёздами у бедуинов', 'Sternenbeobachtung bei Beduinen'),
      desc: T('Desert camp with a guide who maps the constellations, hot drinks and a campfire. Mon & Thu.', 'معسكر صحراوي مع مرشد يشرح الأبراج ومشروبات ساخنة ونار مخيم. الاثنين والخميس.', 'Лагерь в пустыне, гид покажет созвездия, горячие напитки и костёр. Пн и чт.', 'Wüstencamp mit Guide für die Sternbilder, heiße Getränke und Lagerfeuer. Mo & Do.') },
    { id: 'dahab-bluehole', cat: 'desert', icon: 'mountain', price: 50, unit: 'person', hrs: 10, group: true, cap: 14, days: [2, 4, 6], needs: 'hotel', inc: ['pickup', 'guide', 'lunch', 'gear'],
      title: T('Dahab & Blue Hole Day Tour', 'جولة دهب والبلو هول', 'Дахаб и Блю-Хоул за день', 'Dahab & Blue Hole Tagestour'),
      desc: T('Day trip to Dahab: Blue Hole viewpoint, free time for snorkeling and lunch by the sea. Tue, Thu & Sat.', 'رحلة يوم لدهب: إطلالة البلو هول ووقت حر للسنوركل وغداء على البحر. الثلاثاء والخميس والسبت.', 'Поездка в Дахаб: Блю-Хоул, снорклинг и обед у моря. Вт, чт и сб.', 'Tagesausflug nach Dahab: Blue Hole, Zeit zum Schnorcheln, Mittagessen am Meer. Di, Do & Sa.') },

    { id: 'intro-dive', cat: 'diving', icon: 'water', price: 65, unit: 'person', hrs: 4, group: false, needs: 'hotel', top: true, inc: ['pickup', 'instructor', 'equip', 'insurance'],
      title: T('Discover Scuba Diving', 'تجربة غطس للمبتدئين', 'Пробное погружение', 'Schnuppertauchen'),
      desc: T('Never dived? A certified instructor takes you on your first shallow dive — no experience needed.', 'أول غطسة ليك مع مدرب معتمد في مياه ضحلة — من غير أي خبرة.', 'Первое погружение с сертифицированным инструктором — опыт не нужен.', 'Erster Tauchgang mit zertifiziertem Instruktor – keine Erfahrung nötig.') },
    { id: 'two-dives', cat: 'diving', icon: 'person-swimming', price: 75, unit: 'person', hrs: 7, group: true, cap: 16, needs: 'hotel', inc: ['pickup', 'guide', 'lunch', 'drinks'],
      title: T('2 Boat Dives (certified divers)', 'غطستين من المركب (للغطاسين المعتمدين)', '2 погружения с лодки (для дайверов)', '2 Bootstauchgänge (zertifizierte Taucher)'),
      desc: T('Two guided dives at the best reefs around Sharm. Bring your certification card; equipment rental available.', 'غطستين مع مرشد في أجمل شعاب شرم. هات كارت الشهادة، وتأجير المعدات متاح.', 'Два погружения с гидом на лучших рифах. Возьмите сертификат; аренда снаряжения доступна.', 'Zwei geführte Tauchgänge an Sharms besten Riffen. Brevet mitbringen; Ausrüstung leihbar.') },
    { id: 'open-water', cat: 'diving', icon: 'graduation-cap', price: 350, unit: 'person', hrs: 30, group: false, needs: 'hotel', inc: ['instructor', 'equip', 'insurance'],
      title: T('Open Water Diver Course (3–4 days)', 'كورس أوبن ووتر (٣-٤ أيام)', 'Курс Open Water (3–4 дня)', 'Open-Water-Kurs (3–4 Tage)'),
      desc: T('Learn to dive and get certified: theory, pool and four open-water dives.', 'اتعلم الغطس واحصل على الشهادة: نظري ومسبح وأربع غطسات في البحر.', 'Научитесь нырять и получите сертификат: теория, бассейн, четыре погружения.', 'Tauchen lernen und zertifizieren: Theorie, Pool und vier Freiwassertauchgänge.') },
    { id: 'thistlegorm', cat: 'diving', icon: 'anchor', price: 110, unit: 'person', hrs: 12, group: true, cap: 12, needs: 'hotel', inc: ['pickup', 'guide', 'lunch', 'drinks'],
      title: T('SS Thistlegorm Wreck Dive', 'غطس حطام سفينة ثيستلجورم', 'Дайвинг на затонувшем судне Thistlegorm', 'Wracktauchen SS Thistlegorm'),
      desc: T('The legendary WWII wreck — a full day trip for experienced divers (advanced certification recommended).', 'حطام الحرب العالمية الأسطوري — رحلة يوم كامل للغطاسين ذوي الخبرة (يفضّل شهادة متقدمة).', 'Легендарное судно времён Второй мировой — целый день для опытных дайверов.', 'Das legendäre Weltkriegswrack – Tagestour für erfahrene Taucher.') },

    { id: 'airport-sedan', cat: 'transfers', icon: 'car-side', price: 20, unit: 'vehicle', hrs: 0.5, group: false, needs: 'flight', top: true, inc: ['meet', 'flight', 'wait', 'drinks'],
      title: T('Airport Transfer — Private Sedan', 'ترانسفير المطار — سيارة خاصة', 'Трансфер из аэропорта — седан', 'Flughafentransfer – Privat-Limousine'),
      desc: T('Sharm El-Sheikh Airport ↔ your hotel. Fixed price per car (up to 3 guests); the driver tracks your flight.', 'مطار شرم ↔ فندقك. سعر ثابت للسيارة (لحد ٣ أشخاص) والسواق بيتابع رحلتك.', 'Аэропорт Шарм-эль-Шейх ↔ отель. Фиксированная цена за авто (до 3 гостей), водитель следит за рейсом.', 'Flughafen Sharm ↔ Hotel. Festpreis pro Auto (bis 3 Gäste), Fahrer verfolgt Ihren Flug.') },
    { id: 'airport-van', cat: 'transfers', icon: 'van-shuttle', price: 30, unit: 'vehicle', hrs: 0.5, group: false, needs: 'flight', inc: ['meet', 'flight', 'wait', 'drinks'],
      title: T('Airport Transfer — Private Minivan', 'ترانسفير المطار — ميني فان', 'Трансфер из аэропорта — минивэн', 'Flughafentransfer – Minivan'),
      desc: T('For families and groups of up to 7 with luggage.', 'للعائلات والمجموعات لحد ٧ أشخاص مع الشنط.', 'Для семей и групп до 7 человек с багажом.', 'Für Familien und Gruppen bis 7 Personen mit Gepäck.') },
    { id: 'local-ride', cat: 'transfers', icon: 'taxi', price: 15, unit: 'vehicle', hrs: 3, group: false, needs: 'hotel', inc: ['wait', 'shuttle'],
      title: T('Hotel ↔ Naama Bay / Old Market Ride', 'مشوار فندق ↔ خليج نعمة / السوق القديم', 'Поездка отель ↔ Наама-Бей / Старый рынок', 'Fahrt Hotel ↔ Naama Bay / Altstadtmarkt'),
      desc: T('Private round trip within Sharm with waiting time included.', 'مشوار خاص رايح جاي في شرم ووقت الانتظار شامل.', 'Частная поездка туда-обратно по Шарму, ожидание включено.', 'Private Hin- und Rückfahrt in Sharm, Wartezeit inklusive.') },
    { id: 'dahab-transfer', cat: 'transfers', icon: 'road', price: 55, unit: 'vehicle', hrs: 1.5, group: false, needs: 'hotel', inc: ['wait', 'drinks'],
      title: T('Private Transfer Sharm ↔ Dahab', 'ترانسفير خاص شرم ↔ دهب', 'Частный трансфер Шарм ↔ Дахаб', 'Privattransfer Sharm ↔ Dahab'),
      desc: T('Fixed price per car, about 1.5 hours each way.', 'سعر ثابت للسيارة، حوالي ساعة ونص في الاتجاه.', 'Фиксированная цена за авто, около 1,5 часа в одну сторону.', 'Festpreis pro Auto, ca. 1,5 Stunden pro Strecke.') },

    { id: 'food-walk', cat: 'food', icon: 'bowl-food', price: 25, unit: 'person', hrs: 3, group: true, cap: 12, days: [0, 2, 4], needs: 'hotel', inc: ['guide', 'tea'],
      title: T('Old Market Food & Culture Walk', 'جولة أكل وثقافة في السوق القديم', 'Гастропрогулка по Старому рынку', 'Food-Walk durch den Altstadtmarkt'),
      desc: T('Walk with a local guide: Egyptian street snacks, sweets and mint tea. Sun, Tue & Thu.', 'جولة مشي مع مرشد محلي: أكل شارع مصري وحلويات وشاي بالنعناع. الأحد والثلاثاء والخميس.', 'Прогулка с местным гидом: уличные закуски, сладости, мятный чай. Вс, вт и чт.', 'Rundgang mit lokalem Guide: ägyptische Snacks, Süßes und Minztee. So, Di & Do.') },
    { id: 'nightlife', cat: 'food', icon: 'martini-glass-citrus', price: 30, unit: 'person', hrs: 5, group: true, cap: 20, days: [3, 5, 6], needs: 'hotel', inc: ['shuttle', 'guide'],
      title: T('Naama Bay Night Out', 'سهرة خليج نعمة', 'Вечер в Наама-Бей', 'Abend in Naama Bay'),
      desc: T('Guided evening: round-trip shuttle, a local host and entry to a lounge or club of your choice. Wed, Fri & Sat. 18+.', 'سهرة مع مرشد: مواصلات رايح جاي ومضيف محلي ودخول لاونج أو نادي من اختيارك. الأربعاء والجمعة والسبت. ١٨+', 'Вечер с хостом: трансфер туда-обратно и вход в лаунж или клуб на выбор. Ср, пт и сб. 18+', 'Geführter Abend: Hin- und Rückfahrt, lokaler Host und Eintritt in Lounge oder Club. Mi, Fr & Sa. 18+') },

    { id: 'hammam', cat: 'wellness', icon: 'spa', price: 45, unit: 'person', hrs: 1.5, group: false, needs: 'hotel', inc: ['towels', 'pickup'],
      title: T('Traditional Hammam & Massage', 'حمّام تقليدي ومساج', 'Хаммам и массаж', 'Traditionelles Hammam & Massage'),
      desc: T('90 minutes: steam, scrub and oil massage.', '٩٠ دقيقة: بخار وتقشير ومساج بالزيوت.', '90 минут: пар, пилинг и массаж с маслами.', '90 Minuten: Dampfbad, Peeling und Ölmassage.') },
    { id: 'yoga', cat: 'wellness', icon: 'person-praying', price: 15, unit: 'person', hrs: 1, group: true, cap: 12, needs: 'hotel', inc: ['instructor'],
      title: T('Sunrise Beach Yoga', 'يوجا الشروق على الشاطئ', 'Йога на рассвете на пляже', 'Yoga bei Sonnenaufgang am Strand'),
      desc: T('A calm class by the sea, all levels welcome.', 'حصة هادية على البحر لكل المستويات.', 'Спокойное занятие у моря, подходит для всех уровней.', 'Ruhige Stunde am Meer, für alle Level.') },

    { id: 'sup-windsurf', cat: 'active', icon: 'person-snowboarding', price: 40, unit: 'person', hrs: 2, group: false, needs: 'hotel', inc: ['instructor', 'equip'],
      title: T('Stand-Up Paddle & Windsurf Lesson', 'درس ستاند أب بادل وويند سيرف', 'SUP и виндсерфинг: урок', 'SUP- & Windsurf-Kurs'),
      desc: T('Two hours with an instructor, equipment included.', 'ساعتين مع مدرب والمعدات شاملة.', 'Два часа с инструктором, оборудование включено.', 'Zwei Stunden mit Instruktor, Ausrüstung inklusive.') },
    { id: 'parasailing', cat: 'active', icon: 'parachute-box', price: 35, unit: 'person', hrs: 0.5, group: false, needs: 'hotel', inc: ['equip', 'insurance'],
      title: T('Parasailing', 'باراسيلينج', 'Парасейлинг', 'Parasailing'),
      desc: T('Fly above the Red Sea coast with an experienced crew.', 'حلّق فوق ساحل البحر الأحمر مع طاقم خبير.', 'Полёт над побережьем Красного моря, опытная команда.', 'Flug über der Küste des Roten Meeres mit erfahrenem Team.') },
    { id: 'car-rental', cat: 'active', icon: 'key', price: 35, unit: 'day', hrs: 24, group: false, needs: 'hotel', inc: ['insurance', 'pickup'],
      title: T('Car Rental (per day)', 'تأجير سيارة (باليوم)', 'Аренда авто (в день)', 'Mietwagen (pro Tag)'),
      desc: T('Compact car, self-drive. A valid licence is required; insurance included.', 'سيارة صغيرة بدون سواق. لازم رخصة سارية والتأمين شامل.', 'Компакт без водителя. Нужны права; страховка включена.', 'Kompaktwagen zum Selbstfahren. Führerschein nötig; Versicherung inklusive.') },

    { id: 'esim', cat: 'essentials', icon: 'sim-card', price: 15, unit: 'person', hrs: 0, group: false, needs: 'none', inc: ['data'],
      title: T('Egypt Tourist SIM / eSIM (15 GB)', 'شريحة / eSIM للسياح (١٥ جيجا)', 'Туристическая SIM / eSIM (15 ГБ)', 'Touristen-SIM / eSIM (15 GB)'),
      desc: T('Mobile data for your trip, delivered to the airport or hotel, or as an instant eSIM.', 'إنترنت لرحلتك، تسليم في المطار أو الفندق أو eSIM فوري.', 'Интернет на время поездки: доставка в аэропорт/отель или мгновенная eSIM.', 'Mobiles Internet für Ihre Reise: Lieferung zu Flughafen/Hotel oder sofortige eSIM.') },
    { id: 'fast-track', cat: 'essentials', icon: 'person-walking-luggage', price: 35, unit: 'person', hrs: 1, group: false, needs: 'flight', inc: ['meet', 'flight'],
      title: T('Airport Fast-Track & Assistance', 'مساعدة المطار والتخليص السريع', 'Fast-track и встреча в аэропорту', 'Fast-Track & Betreuung am Flughafen'),
      desc: T('Meet on arrival and get help with passport control and luggage.', 'استقبال عند الوصول ومساعدة في الجوازات والشنط.', 'Встреча по прилёту, помощь с паспортным контролем и багажом.', 'Empfang bei Ankunft, Hilfe bei Passkontrolle und Gepäck.') },
    { id: 'doctor', cat: 'essentials', icon: 'user-doctor', price: 60, unit: 'visit', hrs: 1, group: false, needs: 'hotel', inc: [],
      title: T('Doctor-on-Call at Your Hotel', 'دكتور في الفندق', 'Врач в отель', 'Arzt ins Hotel'),
      desc: T('We arrange a doctor visit to your room. Price covers the consultation; medicine and tests are extra. For emergencies call 123.', 'بننسّق زيارة دكتور لحد أوضتك. السعر للكشف فقط، والأدوية والتحاليل بالإضافة. في الطوارئ اتصل ١٢٣.', 'Организуем визит врача в номер. Цена — консультация, лекарства и анализы отдельно. В экстренных случаях — 123.', 'Wir organisieren einen Arztbesuch im Zimmer. Preis = Konsultation, Medikamente/Tests extra. Notfall: 123.') },
    { id: 'photoshoot', cat: 'essentials', icon: 'camera-retro', price: 80, unit: 'session', hrs: 1, group: false, needs: 'hotel', inc: ['photos'],
      title: T('Private Photo Shoot (1h)', 'جلسة تصوير خاصة (ساعة)', 'Частная фотосессия (1 ч)', 'Privates Fotoshooting (1 Std.)'),
      desc: T('A professional photographer at Sharm’s best spots, 15 edited photos.', 'مصور محترف في أجمل أماكن شرم و١٥ صورة معدّلة.', 'Фотограф в лучших локациях Шарма, 15 обработанных фото.', 'Fotograf an Sharms schönsten Orten, 15 bearbeitete Fotos.') }
  ];

  /* ---------- Toolkit ---------- */
  var emergency = [
    { n: '122', icon: 'shield-halved', t: T('Police', 'الشرطة', 'Полиция', 'Polizei') },
    { n: '123', icon: 'truck-medical', t: T('Ambulance', 'الإسعاف', 'Скорая помощь', 'Rettungsdienst') },
    { n: '180', icon: 'fire-extinguisher', t: T('Fire brigade', 'المطافئ', 'Пожарные', 'Feuerwehr') },
    { n: '126', icon: 'user-shield', t: T('Tourist police', 'شرطة السياحة', 'Туристическая полиция', 'Touristenpolizei') }
  ];

  var phrases = [
    { ar: 'أهلاً', tr: 'Ahlan', t: T('Hello', 'مرحبا', 'Привет', 'Hallo') },
    { ar: 'شكراً', tr: 'Shukran', t: T('Thank you', 'شكراً', 'Спасибо', 'Danke') },
    { ar: 'لو سمحت', tr: 'Law samaht', t: T('Please / Excuse me', 'من فضلك', 'Пожалуйста / Извините', 'Bitte / Entschuldigung') },
    { ar: 'أيوه', tr: 'Aywa', t: T('Yes', 'نعم', 'Да', 'Ja') },
    { ar: 'لأ', tr: 'La', t: T('No', 'لا', 'Нет', 'Nein') },
    { ar: 'لأ شكراً', tr: 'La shukran', t: T('No, thank you', 'لا، شكراً', 'Нет, спасибо', 'Nein, danke') },
    { ar: 'بكام ده؟', tr: 'Bikam da?', t: T('How much is this?', 'كم سعر هذا؟', 'Сколько это стоит?', 'Wie viel kostet das?') },
    { ar: 'ده غالي', tr: 'Da ghali', t: T('That’s too expensive', 'هذا غالٍ', 'Это слишком дорого', 'Das ist zu teuer') },
    { ar: 'مياه', tr: 'Mayya', t: T('Water', 'ماء', 'Вода', 'Wasser') },
    { ar: 'فين …؟', tr: 'Fein …?', t: T('Where is …?', 'أين …؟', 'Где …?', 'Wo ist …?') },
    { ar: 'الحساب لو سمحت', tr: 'El-hesab law samaht', t: T('The bill, please', 'الحساب من فضلك', 'Счёт, пожалуйста', 'Die Rechnung, bitte') },
    { ar: 'لذيذ', tr: 'Laziz', t: T('Delicious', 'لذيذ', 'Вкусно', 'Lecker') },
    { ar: 'ساعدني', tr: 'Sa3edni', t: T('Help me', 'ساعدني', 'Помогите мне', 'Helfen Sie mir') },
    { ar: 'محتاج دكتور', tr: 'Mehtag doktor', t: T('I need a doctor', 'أحتاج طبيباً', 'Мне нужен врач', 'Ich brauche einen Arzt') }
  ];

  var tips = [
    { icon: 'fish', t: T('Look, don’t touch: never stand on or break coral — it is protected and fines are heavy. Use reef-safe sunscreen.', 'اتفرج ومتلمسش: ممنوع الوقوف على الشعاب أو كسرها — محمية والغرامات كبيرة. استخدم واقي شمس آمن للشعاب.', 'Смотрите, но не трогайте: нельзя вставать на кораллы или ломать их — это охраняется, штрафы высокие. Берите «рифобезопасный» крем.', 'Anschauen, nicht anfassen: Niemals auf Korallen stehen oder sie abbrechen – geschützt, hohe Bußgelder. Riff-freundliche Sonnencreme nutzen.') },
    { icon: 'bottle-water', t: T('Drink bottled or filtered water only, including for brushing teeth.', 'اشرب مياه معبأة أو مفلترة فقط، حتى لغسيل الأسنان.', 'Пейте только бутилированную или фильтрованную воду, в том числе для зубов.', 'Nur Flaschen- oder gefiltertes Wasser trinken, auch zum Zähneputzen.') },
    { icon: 'sun', t: T('UV is strong all year. Cover up between 11:00 and 15:00, drink plenty and wear a hat.', 'الأشعة قوية طول السنة. غطّي نفسك من ١١ لـ ٣ العصر واشرب كتير والبس قبعة.', 'УФ сильный круглый год. С 11:00 до 15:00 закрывайтесь, пейте больше воды, носите шляпу.', 'UV ist das ganze Jahr stark. Zwischen 11 und 15 Uhr bedecken, viel trinken, Hut tragen.') },
    { icon: 'hand-holding-dollar', t: T('Tipping (baksheesh) of 10% is normal in restaurants and for guides and drivers.', 'البقشيش ١٠٪ عادي في المطاعم ومع المرشدين والسواقين.', 'Чаевые (бакшиш) около 10% — норма в ресторанах, для гидов и водителей.', 'Trinkgeld (Bakschisch) von ca. 10 % ist in Restaurants und für Guides/Fahrer üblich.') },
    { icon: 'scale-balanced', t: T('Bargaining is expected in the Old Market — smile, start at half and enjoy it. Fixed-price shops are marked.', 'الفصال متوقع في السوق القديم — ابتسم وابدأ بنص السعر واستمتع. المحلات ثابتة السعر بتكون واضحة.', 'В Старом рынке принято торговаться — улыбайтесь, начинайте с половины цены.', 'Im Altstadtmarkt wird gefeilscht – lächeln, bei der Hälfte beginnen, Spaß haben.') },
    { icon: 'shirt', t: T('Beachwear is fine at resorts and beaches; cover shoulders and knees in town and at religious sites.', 'لبس البحر عادي في المنتجعات والشواطئ؛ غطّي الكتف والركبة في البلد والأماكن الدينية.', 'Пляжная одежда — в отелях и на пляже; в городе и у святынь закрывайте плечи и колени.', 'Strandkleidung ist in Resorts/Stränden okay; in der Stadt und an religiösen Stätten Schultern und Knie bedecken.') },
    { icon: 'camera', t: T('Do not photograph military or police sites. Drones need a permit and are otherwise prohibited.', 'ممنوع تصوير المواقع العسكرية أو الشرطية. الدرونز محتاجة تصريح وممنوعة غير كده.', 'Не фотографируйте военные и полицейские объекты. Дроны — только по разрешению.', 'Keine Fotos von Militär- oder Polizeianlagen. Drohnen nur mit Genehmigung.') },
    { icon: 'passport', t: T('Staying only in South Sinai? Many nationalities get a free entry stamp (up to 15 days) at Sharm airport. Check the official rules for your passport before you fly.', 'قاعد في جنوب سيناء بس؟ جنسيات كتير بتاخد ختم دخول مجاني (لحد ١٥ يوم) في مطار شرم. راجع القواعد الرسمية لجوازك قبل السفر.', 'Остаётесь только в Южном Синае? Многим гражданам выдают бесплатный штамп (до 15 дней) в аэропорту Шарма. Проверьте официальные правила для вашего паспорта.', 'Nur Süd-Sinai? Viele Nationalitäten erhalten am Flughafen Sharm einen kostenlosen Einreisestempel (bis 15 Tage). Offizielle Regeln für Ihren Pass vorab prüfen.') },
    { icon: 'taxi', t: T('Agree the price before getting in a street taxi, or book a fixed-price transfer with us.', 'اتفق على السعر قبل ما تركب تاكسي الشارع، أو احجز ترانسفير بسعر ثابت معانا.', 'Договаривайтесь о цене до посадки в уличное такси или бронируйте трансфер с фиксированной ценой.', 'Preis vor dem Einsteigen ins Straßentaxi vereinbaren oder festen Transfer bei uns buchen.') },
    { icon: 'wine-glass', t: T('Alcohol is served in licensed hotels and venues only; never drink and dive or drive.', 'الكحول بتتقدم في الفنادق والأماكن المرخصة بس؛ ممنوع الشرب قبل الغطس أو السواقة.', 'Алкоголь — только в лицензированных отелях и заведениях; не пейте перед дайвингом и за рулём.', 'Alkohol nur in lizenzierten Hotels/Lokalen; nie trinken und tauchen oder fahren.') }
  ];

  /* ---------- Helpers ---------- */
  var unitLabel = {
    person: T('per person', 'للفرد', 'за человека', 'pro Person'),
    vehicle: T('per car', 'للسيارة', 'за авто', 'pro Fahrzeug'),
    boat: T('per boat', 'للمركب', 'за лодку', 'pro Boot'),
    session: T('per session', 'للجلسة', 'за сессию', 'pro Sitzung'),
    day: T('per day', 'لليوم', 'за день', 'pro Tag'),
    visit: T('per visit', 'للزيارة', 'за визит', 'pro Besuch')
  };

  function planById(id) { return plans.filter(function (p) { return p.id === id; })[0] || plans[0]; }
  function serviceById(id) { return services.filter(function (s) { return s.id === id; })[0] || null; }
  function catById(id) { return categories.filter(function (c) { return c.id === id; })[0] || null; }
  function round2(n) { return Math.round(n * 100) / 100; }

  /** Member price: same formula as the SQL (round(base*(100-pct)/100, 2)). */
  function memberPrice(base, pct) { return round2(base * (100 - pct) / 100); }
  /** Total for a booking. persons only matter when unit === 'person'. */
  function bookingTotal(svc, pax, planId) {
    var pct = planById(planId || 'explorer').discount;
    var qty = svc.unit === 'person' ? Math.max(1, pax | 0) : 1;
    var base = round2(svc.price * qty);
    return { qty: qty, base: base, pct: pct, total: memberPrice(base, pct) };
  }
  function planPrice(plan, period) { return period === 'year' ? plan.year : plan.month; }

  window.TB = window.TB || {};
  TB.data = {
    plans: plans, categories: categories, services: services, inc: inc, unitLabel: unitLabel,
    emergency: emergency, phrases: phrases, tips: tips,
    planById: planById, serviceById: serviceById, catById: catById,
    memberPrice: memberPrice, bookingTotal: bookingTotal, planPrice: planPrice, round2: round2
  };
})();
