// Deterministic demo data: students, landlords, listings, reviews.
// Same output on every run, so tests and screenshots stay stable.
import { DISTRICTS, UNIVERSITIES } from "./places.js";
import { approximate, offsetM } from "../geo.js";

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FACULTIES = {
  IU: ["Информатика", "Финанси", "Маркетинг", "Икономика на туризма", "Международни икономически отношения", "Счетоводство"],
  MU: ["Медицина", "Дентална медицина", "Фармация", "Медицинска сестра", "Рехабилитация"],
  TU: ["Компютърни системи", "Корабостроене", "Електроника", "Автоматика", "Софтуерни и интернет технологии"],
  VSU: ["Архитектура", "Право", "Психология", "Международни отношения"],
  NVNA: ["Корабоводене", "Корабни машини", "Навигация"],
  VUM: ["Хотелиерство", "Бизнес администрация", "Кулинарно изкуство"],
};

// [first name, last name, gender, university, year, smoke, sleep, clean, guests, bio, languages, verified]
const STUDENTS = [
  ["Иван", "Петков", "m", "IU", 3, 0, "late", 2, 2, "Уча информатика и работя почасово като QA. Вечер съм на компютъра или във фитнеса. Съквартирантът ми завърши и търся спокоен човек за следващите 2 години.", ["Български", "Английски"], true],
  ["Мария", "Димитрова", "f", "MU", 2, 0, "early", 3, 1, "Медицина, втори курс. Ставам рано, уча много, обичам чиста кухня и тишина след 22:00.", ["Български", "Английски", "Немски"], true],
  ["Георги", "Николов", "m", "TU", 4, 1, "late", 1, 3, "Корабостроене. Свиря на китара, често имаме гости в събота. Пуша на балкона.", ["Български"], true],
  ["Никола", "Стоянов", "m", "TU", 4, 1, "late", 2, 3, "Работя в пицария вечер. Готвя добре и деля.", ["Български", "Руски"], true],
  ["Елена", "Колева", "f", "VSU", 1, 0, "late", 2, 2, "Архитектура, първи курс. Рисувам до късно, но със слушалки.", ["Български", "Английски", "Италиански"], true],
  ["Стефан", "Василев", "m", "IU", 3, 0, "early", 2, 1, "Финанси. Сутрин тичам в Морската, следобед съм на стаж в банка.", ["Български", "Английски"], true],
  ["Калоян", "Тодоров", "m", "NVNA", 2, 1, "late", 2, 2, "Навигация във ВВМУ. Лятото съм на кораб, през годината съм тук.", ["Български", "Английски"], true],
  ["Десислава", "Славова", "f", "MU", 5, 0, "early", 3, 1, "Дентална медицина, последна година. Търся тиха съквартирантка.", ["Български", "Английски"], true],
  ["Мартин", "Георгиев", "m", "TU", 2, 0, "late", 2, 3, "Електроника, играя баскетбол в отбора на ТУ.", ["Български"], true],
  ["Виктория", "Иванова", "f", "IU", 2, 0, "late", 2, 2, "Маркетинг. Правя снимки и съдържание за малки бизнеси.", ["Български", "Английски", "Испански"], true],
  ["Йоана", "Христова", "f", "MU", 3, 0, "early", 3, 2, "Фармация. Обичам растения и имам котка — Бисквитка.", ["Български", "Френски"], true],
  ["Даниел", "Атанасов", "m", "IU", 1, 0, "late", 2, 2, "Първа година в ИУ, от Шумен съм. Търся стая близо до университета.", ["Български", "Английски"], false],
  ["Радослав", "Петров", "m", "VSU", 3, 0, "early", 2, 1, "Право във ВСУ. Работя в кантора на половин ден.", ["Български", "Английски"], true],
  ["Габриела", "Маринова", "f", "VUM", 2, 1, "late", 2, 3, "Хотелиерство. Лятото работя в Златни пясъци.", ["Български", "Английски", "Руски"], true],
  ["Ахмед", "Юсеинов", "m", "MU", 4, 0, "late", 3, 2, "Медицина на английски. Готвя, спортувам, спя мирно.", ["Български", "Турски", "Английски"], true],
  ["Теодора", "Кирилова", "f", "IU", 4, 0, "early", 2, 1, "Международни икономически отношения. Спокойна, организирана.", ["Български", "Английски"], true],
  ["Борис", "Янков", "m", "TU", 3, 0, "late", 1, 2, "Софтуерни технологии. Работя дистанционно като junior developer.", ["Български", "Английски"], true],
  ["Надежда", "Павлова", "f", "MU", 1, 0, "early", 2, 1, "Медицинска сестра, първи курс.", ["Български"], false],
  ["Лъчезар", "Димов", "m", "NVNA", 3, 0, "early", 3, 1, "Корабни машини. Ред и дисциплина — навик от училището.", ["Български", "Английски"], true],
  ["Симона", "Добрева", "f", "VSU", 2, 0, "late", 2, 2, "Психология. Обичам настолни игри и чай.", ["Български", "Английски"], true],
  ["Петър", "Илиев", "m", "IU", 2, 0, "late", 2, 2, "Икономика на туризма. Живея в Чайка, работя в хотел през уикендите.", ["Български", "Английски"], true],
  ["Кристина", "Попова", "f", "IU", 3, 1, "late", 2, 2, "Счетоводство. Пуша само навън.", ["Български"], true],
  ["Александър", "Петров", "m", "IU", 2, 0, "late", 2, 2, "Втори курс Информатика в ИУ. Идвам от Добрич. Търся стая за поне година, до €350 със сметките.", ["Български", "Английски"], true],
  ["Мирослав", "Ганчев", "m", "TU", 1, 0, "early", 2, 1, "Автоматика, първи курс. Търся съквартиранти за цяло жилище.", ["Български"], false],
  ["Ралица", "Стефанова", "f", "MU", 2, 0, "early", 3, 1, "Рехабилитация. Тренирам плуване сутрин.", ["Български", "Английски"], true],
  ["Иво", "Банов", "m", "VUM", 3, 1, "late", 1, 3, "Кулинарно изкуство. Готвя за всички.", ["Български", "Английски"], true],
  ["Цветелина", "Русева", "f", "VSU", 4, 0, "late", 2, 2, "Международни отношения. Пиша магистърска теза, много съм вкъщи.", ["Български", "Английски", "Гръцки"], true],
  ["Емил", "Каменов", "m", "MU", 3, 0, "late", 2, 2, "Фармация. Карам колело навсякъде.", ["Български", "Английски"], true],
  ["Кирил", "Минев", "m", "NVNA", 3, 0, "early", 3, 1, "Курсант, корабоводене. Спортувам всяка сутрин.", ["Български", "Английски"], true],
  ["Анелия", "Костова", "f", "MU", 1, 0, "early", 3, 1, "Първи курс медицина, от Русе. Търся стая до МУ със спокойна съквартирантка.", ["Български", "Английски"], true],
  ["Живко", "Райков", "m", "TU", 2, 1, "late", 2, 2, "Компютърни системи. Търся стая до ТУ, пуша само навън.", ["Български"], true],
  ["Сара", "Ибрямова", "f", "IU", 1, 0, "late", 2, 2, "Маркетинг, първи курс. Търся съквартирантки за цяло жилище.", ["Български", "Турски", "Английски"], false],
  ["Николай", "Денев", "m", "VSU", 3, 0, "late", 1, 3, "Право. Обичам компания, търся весели съквартиранти.", ["Български", "Английски"], true],
  ["Моника", "Ангелова", "f", "VUM", 2, 0, "early", 3, 1, "Бизнес администрация. Работя в хотел, търся тиха стая.", ["Български", "Английски", "Немски"], true],
  ["Христо", "Велчев", "m", "MU", 2, 0, "early", 2, 1, "Дентална медицина. Търся стая за 2 години, до €350.", ["Български", "Английски"], true],
  ["Полина", "Добрева", "f", "TU", 3, 0, "late", 2, 2, "Софтуерни технологии. Работя дистанционно, търся светла стая.", ["Български", "Английски"], true],
  ["Деян", "Колев", "m", "IU", 3, 0, "late", 2, 1, "Финанси. Търся стая в Чайка или Левски.", ["Български", "Английски"], true],
];

// Specialty named in the bio, where there is one.
const FACULTY_OF = {
  "Иван Петков": "Информатика", "Мария Димитрова": "Медицина", "Георги Николов": "Корабостроене", "Елена Колева": "Архитектура",
  "Стефан Василев": "Финанси", "Калоян Тодоров": "Навигация", "Десислава Славова": "Дентална медицина", "Мартин Георгиев": "Електроника",
  "Виктория Иванова": "Маркетинг", "Йоана Христова": "Фармация", "Радослав Петров": "Право", "Габриела Маринова": "Хотелиерство",
  "Ахмед Юсеинов": "Медицина", "Теодора Кирилова": "Международни икономически отношения", "Борис Янков": "Софтуерни и интернет технологии",
  "Надежда Павлова": "Медицинска сестра", "Лъчезар Димов": "Корабни машини", "Симона Добрева": "Психология", "Петър Илиев": "Икономика на туризма",
  "Кристина Попова": "Счетоводство", "Александър Петров": "Информатика", "Мирослав Ганчев": "Автоматика", "Ралица Стефанова": "Рехабилитация",
  "Иво Банов": "Кулинарно изкуство", "Цветелина Русева": "Международни отношения", "Емил Каменов": "Фармация", "Кирил Минев": "Корабоводене",
  "Анелия Костова": "Медицина", "Живко Райков": "Компютърни системи", "Сара Ибрямова": "Маркетинг", "Николай Денев": "Право",
  "Моника Ангелова": "Бизнес администрация", "Христо Велчев": "Дентална медицина", "Полина Добрева": "Софтуерни и интернет технологии", "Деян Колев": "Финанси",
};

// [name, kind, bio]
const LANDLORDS = [
  ["Росица Андонова", "landlord", "Отдавам апартамента на родителите си. Предпочитам студенти — досега само добри впечатления."],
  ["Имоти Приморски", "agency", "Агенция с 12 години опит. 0% комисиона за студенти с потвърден имейл."],
  ["Владимир Желев", "landlord", "Инженер, живея в Бургас. Жилищата се поддържат от брат ми във Варна."],
  ["Студентски квартири ЕООД", "agency", "Управляваме 40 жилища близо до университетите. Договор, фактура, бърз ремонт."],
  ["Жана Михайлова", "landlord", "Пенсионирана учителка. Живея на съседния етаж и помагам при нужда."],
];

// Listings. [hostIdx, type, district, rent, util, occupants, genderPref, minMonths, availableFromOffsetDays, rooms, area, floor,
//            amenities, landlordConsent, title, description, [extra resident idx], photoKinds, dx, dy]
// hostIdx < 100 → STUDENTS index, >= 100 → LANDLORDS index - 100.
const LISTINGS = [
  [0, "room", "Младост", 600, 65, 2, "m", 24, 2, 2, 64, 4, ["furnished","wifi","washer","ac","heating","kitchen","desk","balcony"], true,
    "Свободна спалня в двустаен, Младост", "Съквартирантът ми завърши и остава свободна спалня (14 м²) с легло, гардероб и бюро. Апартаментът е тухлен, с климатик в двете стаи. До спирка на 2 минути — 409 и 148 до ИУ.\n\nНаемът е €600 общо, сметките излизат средно €65 на месец и делим всичко на две. Търся спокоен съквартирант за 2 години.", [], ["bedroom","living","kitchen","bath","balcony"], 40, -60],
  [1, "room", "Чайка", 560, 70, 2, "f", 10, 16, 2, 58, 2, ["furnished","wifi","washer","heating","kitchen","balcony","desk"], true,
    "Стая с балкон до Морската градина", "Светла стая с балкон към двора, на 5 минути пеша от Морската градина и 10 от МУ. Търся съквартирантка, която обича ред и тишина вечер.", [], ["bedroom","balcony","living","kitchen","bath"], -30, 80],
  [2, "room", "Левски", 780, 90, 3, "m", 12, 0, 3, 82, 6, ["furnished","wifi","washer","kitchen","balcony","tv"], false,
    "Трета стая в тристаен, Левски", "Двама сме от ТУ и търсим трети. Стаята е 11 м², с легло и шкаф. Имаме PlayStation и голям хол. Пушим на балкона.", [3], ["living","bedroom","kitchen","bath"], 60, 30],
  [100, "whole", "Център", 420, 60, 1, "any", 12, 2, 1, 32, 3, ["furnished","wifi","washer","ac","heating","kitchen","desk"], true,
    "Гарсониера до Медицинския университет", "Обзаведена гарсониера на 7 минути пеша от МУ. Ново обзавеждане, климатик, пералня. Подходяща за един студент.", [], ["studio","kitchen","bath","desk"], 20, -40],
  [4, "room", "Бриз", 700, 80, 2, "f", 12, 33, 2, 70, 5, ["furnished","wifi","washer","ac","kitchen","balcony","elevator","dishwasher"], true,
    "Светла стая, 5 мин от плажа", "Ново строителство в Бриз, асансьор, съдомиялна. Стаята гледа към морето. Търся съквартирантка.", [], ["bedroom","balcony","living","kitchen","bath"], -50, 0],
  [5, "room", "Възраждане", 460, 55, 2, "any", 6, 0, 2, 60, 7, ["furnished","wifi","washer","heating","kitchen","desk"], true,
    "Стая в двустаен, тиха улица", "Панелен, но ремонтиран апартамент. Лягам рано и уча вечер, затова търся спокоен човек. Автобуси 17 и 22 до центъра.", [], ["bedroom","living","kitchen","bath"], 0, 50],
  [101, "whole", "Трошево", 580, 70, 2, "any", 12, 2, 2, 66, 3, ["furnished","wifi","washer","heating","kitchen","balcony","parking"], true,
    "Двустаен за двама студенти, Трошево", "Два отделни спални, хол с кухня. Подходящо за двама приятели. 0% комисиона за студенти.", [], ["living","bedroom","bedroom2","kitchen","bath"], 30, 20],
  [6, "room", "Аспарухово", 400, 50, 2, "m", 12, 2, 2, 90, 1, ["furnished","wifi","washer","kitchen","parking","pets"], true,
    "Стая в къща с двор, Аспарухово", "Етаж от къща с двор и барбекю. Имам куче — Рекс, много е добър. До ВВМУ се стига за 25 минути.", [], ["bedroom","yard","living","kitchen"], 0, 0],
  [7, "room", "Гръцка махала", 840, 100, 3, "f", 12, 2, 3, 95, 2, ["furnished","wifi","washer","heating","kitchen","bath","desk"], true,
    "Стая в тристаен до катедралата", "Старинна къща с високи тавани в Гръцката махала. Двете сме от МУ, търсим трета съквартирантка.", [17], ["living","bedroom","kitchen","bath"], 10, 10],
  [8, "room", "Левски", 500, 60, 2, "m", 12, 0, 2, 55, 3, ["furnished","wifi","washer","kitchen","desk"], true,
    "Стая до ТУ, обзаведена", "На 6 минути пеша от ТУ. Стаята е с ново легло и бюро. Често гледаме мачове с приятели.", [], ["bedroom","living","kitchen","bath"], -40, -30],
  [9, "room", "Окръжна болница", 540, 70, 2, "f", 10, 9, 2, 62, 4, ["furnished","wifi","washer","ac","kitchen","balcony"], true,
    "Уютна стая до ИУ и МУ", "Между двата университета — 10 минути пеша до всеки. Климатик в стаята, голям балкон.", [], ["bedroom","balcony","living","kitchen","bath"], 30, 30],
  [10, "room", "Цветен квартал", 520, 60, 2, "f", 12, 2, 2, 58, 2, ["furnished","wifi","washer","heating","kitchen","pets","balcony"], true,
    "Стая в Цветен квартал, може с любимец", "Имам котка и нямам нищо против и твоят любимец да дойде. Тих квартал, много зеленина.", [], ["bedroom","living","kitchen","balcony"], 0, 0],
  [102, "whole", "Левски", 650, 80, 3, "any", 12, 16, 3, 85, 5, ["furnished","wifi","washer","heating","kitchen","balcony","elevator"], true,
    "Тристаен за трима студенти до ТУ", "Три отделни спални, две бани. Идеален за група приятели. Наемодателят поддържа уредите.", [], ["living","bedroom","bedroom2","kitchen","bath"], 0, 60],
  [12, "room", "Чайка", 620, 70, 2, "m", 12, 2, 2, 68, 8, ["furnished","wifi","washer","ac","kitchen","elevator","balcony"], true,
    "Стая с гледка, 8-ми етаж в Чайка", "Гледка към морето и Морската градина. Асансьор, климатик. До ВСУ има директен автобус.", [], ["bedroom","balcony","living","kitchen","bath"], 0, -50],
  [13, "room", "Център", 640, 80, 2, "any", 6, 0, 2, 60, 3, ["furnished","wifi","washer","ac","kitchen"], true,
    "Стая в самия център, 6 месеца", "Търся съквартирант(ка) за зимния семестър. Работя сезонно, затова предпочитам по-кратък договор.", [], ["bedroom","living","kitchen","bath"], 50, 20],
  [14, "room", "Окръжна болница", 600, 70, 2, "m", 12, 2, 2, 64, 5, ["furnished","wifi","washer","ac","heating","kitchen","desk","dishwasher"], true,
    "Стая до МУ, тих блок", "Две минути пеша до МУ. Добре оборудвана кухня, съдомиялна. Търся сериозен съквартирант.", [], ["bedroom","kitchen","living","bath"], -20, 40],
  [15, "room", "Левски", 540, 60, 2, "f", 12, 16, 2, 56, 6, ["furnished","wifi","washer","heating","kitchen","desk"], true,
    "Стая в Левски, до Базар Левски", "Тиха стая към двора. Търся организирана съквартирантка, която не пуши.", [], ["bedroom","living","kitchen","bath"], 70, -20],
  [16, "room", "Младост", 480, 60, 2, "m", 12, 2, 2, 60, 2, ["furnished","wifi","washer","kitchen","desk","parking"], true,
    "Стая до Мол Варна", "На 3 минути от Мол Варна. Работя от вкъщи, търся тих съквартирант. Автобуси 409 и 18.", [], ["bedroom","living","kitchen","bath"], 20, 60],
  [103, "whole", "Окръжна болница", 520, 70, 2, "any", 10, 2, 2, 58, 4, ["furnished","wifi","washer","heating","kitchen","desk"], true,
    "Двустаен до ИУ, договор за учебната година", "Договор за 10 месеца, от октомври до юли. Отделни спални, нови матраци.", [], ["living","bedroom","bedroom2","kitchen","bath"], -20, -30],
  [18, "room", "Чайка", 700, 90, 3, "m", 12, 2, 3, 78, 3, ["furnished","wifi","washer","heating","kitchen","desk"], true,
    "Стая в тристаен до ВВМУ", "Живеем двама курсанти, търсим трети. Ред, чистота, тишина в делнични вечери.", [28], ["bedroom","living","kitchen","bath"], 40, 40],
  [19, "room", "Бриз", 560, 60, 2, "f", 12, 23, 2, 62, 2, ["furnished","wifi","washer","kitchen","balcony","pets"], true,
    "Стая в Бриз с голям балкон", "Обичам настолни игри и чай вечер. Имам морско свинче.", [], ["bedroom","balcony","living","kitchen"], 0, 30],
  [21, "room", "Победа", 460, 60, 2, "any", 6, 0, 2, 52, 6, ["furnished","wifi","washer","kitchen"], true,
    "Стая до автогарата, от веднага", "Изгодна стая, до автогарата и Мол Варна. Пуша само навън.", [], ["bedroom","kitchen","living","bath"], 0, 0],
  [104, "whole", "Лятно кино Тракия", 450, 60, 1, "any", 12, 9, 1, 38, 2, ["furnished","wifi","washer","heating","kitchen","desk","pets"], true,
    "Гарсониера с двор, Лятно кино Тракия", "Самостоятелна гарсониера на партера на къща. Може с котка. Живея на горния етаж.", [], ["studio","kitchen","bath","yard"], 0, 0],
  [101, "whole", "Бриз", 750, 90, 3, "any", 12, 16, 3, 88, 4, ["furnished","wifi","washer","ac","kitchen","balcony","elevator","parking","dishwasher"], true,
    "Нов тристаен в Бриз, 3 спални", "Ново строителство, 3 спални, климатици навсякъде. Паркомясто в двора. Подходящ за трима.", [], ["living","bedroom","bedroom2","kitchen","bath","balcony"], -60, -40],
  [103, "whole", "Левски", 400, 50, 1, "any", 12, 2, 1, 30, 7, ["furnished","wifi","washer","heating","kitchen","desk"], true,
    "Гарсониера до ТУ", "10 минути пеша до ТУ. Ремонтирана, с ново бюро и стол.", [], ["studio","kitchen","bath"], -70, 50],
  [25, "room", "Гръцка махала", 700, 80, 2, "m", 12, 2, 2, 70, 3, ["furnished","wifi","washer","kitchen","balcony","ac"], true,
    "Стая в Гръцката, 5 мин от плажа", "Готвя често и деля. Приятели идват в петък. Пуша на терасата.", [], ["bedroom","living","kitchen","balcony"], 30, -40],
  [26, "room", "Център", 680, 80, 2, "f", 12, 2, 2, 66, 4, ["furnished","wifi","washer","heating","kitchen","desk","bath"], true,
    "Стая в центъра, до Операта", "Пиша теза и съм много вкъщи. Търся съквартирантка за спокоен дом.", [], ["bedroom","living","kitchen","bath"], -40, 30],
  [27, "room", "Възраждане", 440, 50, 2, "m", 12, 2, 2, 60, 5, ["furnished","wifi","washer","kitchen","heating"], true,
    "Стая във Възраждане, изгодна", "Карам колело до МУ за 20 минути. Търся съквартирант, който не пуши.", [], ["bedroom","living","kitchen","bath"], 40, 0],
  [102, "whole", "Виница", 500, 70, 2, "any", 12, 2, 2, 75, 1, ["furnished","wifi","washer","kitchen","parking","pets","heating"], true,
    "Къща във Виница за двама", "Самостоятелен етаж от къща с двор. 10 минути с кола до ВСУ, автобус 31 до центъра.", [], ["living","bedroom","kitchen","yard"], 0, 0],
  [100, "whole", "Младост", 480, 60, 2, "any", 12, 2, 2, 62, 3, ["furnished","wifi","washer","heating","kitchen"], true,
    "Двустаен в Младост за двама", "Обзаведен двустаен, две отделни спални. Хазяйката живее наблизо.", [], ["living","bedroom","kitchen","bath"], 70, 0],
  [2, "room", "Кайсиева градина", 380, 50, 2, "m", 6, 0, 2, 55, 3, ["furnished","wifi","washer","kitchen","parking"], false,
    "Стая в Кайсиева градина, евтино", "Далече е от центъра, но е най-евтиното, което ще намериш. Имам кола и понякога возя до ТУ.", [], ["bedroom","kitchen","living"], 0, 0],
  [103, "whole", "Чайка", 560, 70, 2, "any", 10, 9, 2, 60, 6, ["furnished","wifi","washer","ac","kitchen","balcony","elevator"], true,
    "Двустаен в Чайка, учебна година", "Договор за 10 месеца. Близо до Морската градина, ВВМУ и ИУ.", [], ["living","bedroom","kitchen","bath","balcony"], 20, 20],
  [104, "whole", "Владиславово", 360, 50, 2, "any", 12, 2, 2, 60, 2, ["furnished","wifi","washer","kitchen","parking"], true,
    "Двустаен във Владиславово", "Най-ниска цена за двама. Автобуси до центъра на 10 минути.", [], ["living","bedroom","kitchen"], 0, 0],
  [11, "room", "Левски", 520, 60, 2, "m", 12, 2, 2, 60, 2, ["furnished","wifi","washer","kitchen","desk"], true,
    "Стая до ИУ, от 1-ви курс за 1-ви курс", "И аз съм първа година. Търся връстник, с когото да се учим и да си делим пазаруването.", [], ["bedroom","living","kitchen","bath"], -60, 30],
  [20, "room", "Чайка", 560, 60, 2, "m", 12, 23, 2, 62, 4, ["furnished","wifi","washer","ac","kitchen","balcony"], true,
    "Стая в Чайка, 10 мин до ИУ", "Двустаен с климатик и балкон. Търся съквартирант, който също уча/работи и не пуши.", [], ["bedroom","balcony","living","kitchen","bath"], -50, 70],
  [24, "room", "Окръжна болница", 480, 60, 2, "f", 12, 2, 2, 55, 3, ["furnished","wifi","washer","heating","kitchen"], true,
    "Стая до МУ за студентка по медицина", "Плувам сутрин, уча вечер. Търся тиха съквартирантка от МУ.", [], ["bedroom","living","kitchen","bath"], 50, -50],
];

// Review snippets: [stars, text] — listing reviews by former flatmates.
const LISTING_REVIEWS = [
  [5, "Живях тук година и половина. Всичко е точно както е описано, сметките се делят честно и прозрачно."],
  [5, "Страхотен съквартирант и много спокойно жилище. Препоръчвам, ако учиш сериозно."],
  [5, "Близо до университета, автобусите идват често. Хазяинът реагира бързо при повреда."],
  [4, "Добро място за цената. Малко шумно от улицата вечер, но с затворен прозорец е ОК."],
  [5, "Чисто, топло през зимата, интернетът е бърз. Разбирахме се перфектно."],
  [4, "Стаята е по-малка, отколкото изглежда на снимките, но всичко друго е супер."],
  [5, "Най-добрата квартира, в която съм живял във Варна. Съквартирантът е точен с плащанията."],
  [3, "Мястото е добро, но кухнята е малка за двама, които готвят. Иначе без проблеми."],
  [5, "Тихо, чисто, пеша до лекции. Ако можех, щях да остана още година."],
  [4, "Добра комуникация, разбрахме се за почистването от първия ден. Парното е слабо в най-студените дни."],
  [5, "Точно като на снимките. Плажът е на 10 минути, лятото е мечта."],
  [4, "Разумна цена, спокоен квартал. Липсва бюро в стаята, но си купих."],
];

const DAY = 864e5;
const iso = d => new Date(d).toISOString().slice(0, 10);

// Bump when the demo content changes, so returning visitors get the new demo data.
export const SEED_VERSION = 2;

export function buildSeed(now = new Date("2026-09-29T12:00:00Z")) {
  const r = rng(20260929);
  const pick = a => a[Math.floor(r() * a.length)];
  const t0 = now.getTime();
  const users = [];

  STUDENTS.forEach(([first, last, gender, uni, year, smoke, sleep, clean, guests, bio, languages, verified], i) => {
    const faculty = FACULTY_OF[first + " " + last] || pick(FACULTIES[uni]);
    const dom = UNIVERSITIES.find(u => u.id === uni).domains[0];
    users.push({
      id: "u" + (i + 1), role: "student", name: `${first} ${last}`, gender, birthYear: 2007 - year - Math.floor(r() * 2),
      university: uni, faculty, year, bio, languages, smoke, sleep, clean, guests,
      email: verified ? `s${String(100000 + Math.floor(r() * 899999))}@${dom}` : "", emailVerified: verified,
      phone: "+359 8" + (7 + Math.floor(r() * 3)) + " " + String(Math.floor(r() * 900 + 100)) + " " + String(Math.floor(r() * 9000 + 1000)),
      avatar: null, hue: Math.floor(r() * 360),
      joined: iso(t0 - (60 + Math.floor(r() * 900)) * DAY),
      seeking: false, budget: 0, favorites: [],
    });
  });
  LANDLORDS.forEach(([name, kind, bio], i) => {
    users.push({
      id: "h" + (i + 1), role: kind, name, gender: "", birthYear: 0, university: "", faculty: "", year: 0, bio,
      languages: ["Български", ...(kind === "agency" ? ["Английски"] : [])], smoke: 0, sleep: "early", clean: 3, guests: 1,
      email: "", emailVerified: false, phone: "+359 88" + Math.floor(r() * 10) + " " + String(Math.floor(r() * 900 + 100)) + " " + String(Math.floor(r() * 900 + 100)),
      avatar: null, hue: Math.floor(r() * 360), joined: iso(t0 - (400 + Math.floor(r() * 1400)) * DAY),
      seeking: false, budget: 0, favorites: [], idVerified: true,
    });
  });
  const hostId = idx => idx >= 100 ? "h" + (idx - 99) : "u" + (idx + 1);

  // Students who have a listing are hosts; some of the rest are seeking a room.
  const listings = LISTINGS.map((row, i) => {
    const [hi, type, district, rent, util, occupants, genderPref, minMonths, fromDays, rooms, area, floor, amenities, consent,
      title, description, extra, kinds, dx, dy] = row;
    const d = DISTRICTS.find(x => x.name === district);
    const exact = offsetM(d, dy * 3 + (r() - 0.5) * 120, dx * 3 + (r() - 0.5) * 120);
    exact.lat = +exact.lat.toFixed(6); exact.lng = +exact.lng.toFixed(6);
    const id = "l" + (i + 1);
    const hid = hostId(hi);
    return {
      id, type, hostId: hid, residents: type === "room" ? [hid, ...extra.map(hostId)] : [],
      title, description, district,
      address: `${district}, ул. „${pick(["Мир", "Дунав", "Цар Симеон I", "Чайка", "Студентска", "Опълченска", "Преслав", "Шипка", "Македония", "Карамфил"])}“ ${1 + Math.floor(r() * 80)}`,
      exact, approx: approximate(exact, r),
      rent, util, occupants, genderPref, minMonths, deposit: Math.round(rent / occupants / 10) * 10,
      availableFrom: iso(t0 + fromDays * DAY), rooms, area, floor,
      amenities, landlordConsent: type === "whole" ? true : consent,
      photos: kinds.map((k, j) => `gen:${k}:${i * 10 + j}`),
      status: "active", createdAt: new Date(t0 - Math.floor(r() * 50 + (i === 0 ? 0 : 1)) * DAY).toISOString(), views: Math.floor(r() * 400 + 20),
    };
  });
  listings[0].createdAt = new Date(t0 - 2 * DAY).toISOString(); // canonical case is new

  const hostIds = new Set(listings.flatMap(l => [l.hostId, ...l.residents]));
  for (const u of users) if (u.role === "student" && !hostIds.has(u.id)) { u.seeking = true; u.budget = 250 + Math.floor(r() * 5) * 30; }

  // Reviews. Listings get 0–14; the canonical listing gets a handful from the previous flatmate and friends.
  const reviews = [];
  const students = users.filter(u => u.role === "student");
  listings.forEach((l, i) => {
    const n = i === 0 ? 6 : Math.floor(r() * r() * 15);
    for (let k = 0; k < n; k++) {
      const [stars0, text] = pick(LISTING_REVIEWS);
      const stars = Math.min(5, Math.max(3, stars0 + (r() < 0.15 ? -1 : 0) + (r() < 0.2 && stars0 < 5 ? 1 : 0)));
      const author = pick(students.filter(s => s.id !== l.hostId && !l.residents.includes(s.id)));
      const c = () => Math.min(5, Math.max(3, stars + (r() < 0.25 ? -1 : 0)));
      reviews.push({ id: `r${i}_${k}`, listingId: l.id, targetUserId: l.hostId, authorId: author.id, stars, text,
        cats: { clean: c(), comm: c(), accuracy: c(), location: c(), value: c() },
        stayMonths: pick([5, 10, 10, 12, 12, 18, 24]), date: iso(t0 - Math.floor(30 + r() * 700) * DAY) });
    }
  });

  // Direct flatmate reviews on seeking students, so their profiles have ratings too.
  const FLATMATE = [[5, "Перфектен съквартирант — плаща навреме, чисти след себе си."], [5, "Много приятен човек, разбирахме се чудесно."],
    [4, "Добър съквартирант, понякога малко разхвърлян, но винаги готов да помогне."], [5, "Спокоен, коректен, препоръчвам."]];
  users.filter(u => u.seeking).forEach((u, i) => {
    const n = Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const [stars, text] = pick(FLATMATE);
      const author = pick(students.filter(s => s.id !== u.id));
      reviews.push({ id: `f${i}_${k}`, listingId: null, targetUserId: u.id, authorId: author.id, stars, text, cats: null,
        stayMonths: pick([6, 10, 12]), date: iso(t0 - Math.floor(60 + r() * 600) * DAY) });
    }
  });

  const me = users.find(u => u.name === "Александър Петров");
  const threads = [{
    id: "t1", listingId: "l14", participants: [me.id, listings[13].hostId], phoneShare: {}, autoReplied: true,
    messages: [
      { from: me.id, text: "Здравей! Стаята още ли е свободна? Аз съм от ИУ, не пуша и лягам късно.", ts: new Date(t0 - 3 * DAY).toISOString() },
      { from: listings[13].hostId, text: "Здрасти! Да, свободна е. Кога можеш да дойдеш да я видиш?", ts: new Date(t0 - 3 * DAY + 3 * 3600e3).toISOString() },
    ],
  }];

  me.budget = 350;
  const byName = n => users.find(u => u.name === n);
  const savedSearches = [{ id: "s1", userId: me.id, name: "Стаи до €350 до ИУ", uniId: "IU", createdAt: new Date(t0 - 5 * DAY).toISOString(),
    filters: { q: "", category: "all", type: "room", minPrice: 0, maxPrice: 350, maxCommute: 0, stay: 0, moveIn: "", amenities: [],
      verifiedOnly: false, consentOnly: false, minRating: 0, showAllGenders: false, sort: "recommended" } }];
  const notifications = [{ id: "n1", userId: me.id, kind: "match", listingId: "l1", searchId: "s1", params: { search: savedSearches[0].name },
    ts: listings[0].createdAt, read: false }];
  const trio = ["Мирослав Ганчев", "Живко Райков", "Полина Добрева"].map(byName);
  const groups = [{ id: "g1", name: "Тримата от ТУ", ownerId: trio[0].id, createdAt: new Date(t0 - 4 * DAY).toISOString(),
    members: trio.map(u => ({ userId: u.id, status: "accepted" })) }];

  return { version: 2, seedVersion: SEED_VERSION, currentUserId: me.id, users, listings, reviews, threads, savedSearches, notifications, groups };
}
