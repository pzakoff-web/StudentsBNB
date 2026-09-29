// Real places in Varna. Coordinates from OpenStreetMap (Nominatim), September 2026.
// Student e-mail domains are best-effort and must be confirmed with each university before launch.

export const VARNA_CENTER = { lat: 43.2141, lng: 27.9147 };

export const UNIVERSITIES = [
  { id: "IU", short: "ИУ", name: "Икономически университет – Варна", address: "бул. „Княз Борис I“ 77",
    lat: 43.209402, lng: 27.923707, domains: ["ue-varna.bg"] },
  { id: "MU", short: "МУ", name: "Медицински университет „Проф. д-р Параскев Стоянов“", address: "ул. „Марин Дринов“ 55",
    lat: 43.212140, lng: 27.921279, domains: ["mu-varna.bg"] },
  { id: "TU", short: "ТУ", name: "Технически университет – Варна", address: "ул. „Студентска“ 1",
    lat: 43.223742, lng: 27.935655, domains: ["tu-varna.bg"] },
  { id: "VSU", short: "ВСУ", name: "Варненски свободен университет „Черноризец Храбър“", address: "к.к. Чайка",
    lat: 43.258190, lng: 28.027399, domains: ["vfu.bg"] },
  { id: "NVNA", short: "ВВМУ", name: "Висше военноморско училище „Н. Й. Вапцаров“", address: "ул. „Васил Друмев“ 73",
    lat: 43.213161, lng: 27.931881, domains: ["nvna.eu", "naval-acad.bg"] },
  { id: "VUM", short: "ВУМ", name: "Варненски университет по мениджмънт", address: "ул. „Оборище“ 13А",
    lat: 43.212118, lng: 27.909339, domains: ["vum.bg"] },
];

export const uniById = id => UNIVERSITIES.find(u => u.id === id) || null;

// Rough centroids of residential areas, used for seed data and for naming a picked point.
export const DISTRICTS = [
  { name: "Център", lat: 43.2045, lng: 27.9115 },
  { name: "Гръцка махала", lat: 43.2033, lng: 27.9193 },
  { name: "Окръжна болница", lat: 43.2137, lng: 27.9150 },
  { name: "Лятно кино Тракия", lat: 43.2143, lng: 27.9065 },
  { name: "Цветен квартал", lat: 43.2239, lng: 27.9138 },
  { name: "Левски", lat: 43.2236, lng: 27.9215 },
  { name: "Чайка", lat: 43.2159, lng: 27.9397 },
  { name: "Бриз", lat: 43.2215, lng: 27.9503 },
  { name: "Победа", lat: 43.2185, lng: 27.8990 },
  { name: "Младост", lat: 43.2240, lng: 27.8867 },
  { name: "Трошево", lat: 43.2290, lng: 27.8810 },
  { name: "Възраждане", lat: 43.2376, lng: 27.8850 },
  { name: "Кайсиева градина", lat: 43.2368, lng: 27.8573 },
  { name: "Владиславово", lat: 43.2468, lng: 27.8505 },
  { name: "Виница", lat: 43.2291, lng: 27.9769 },
  { name: "Аспарухово", lat: 43.1805, lng: 27.8971 },
];

// Points along the city beach, used for the "близо до морето" tag.
export const COAST = [
  [43.2005, 27.9180], [43.2034, 27.9252], [43.2075, 27.9330], [43.2125, 27.9440],
  [43.2170, 27.9545], [43.2215, 27.9640], [43.2265, 27.9760], [43.2330, 27.9890],
];
