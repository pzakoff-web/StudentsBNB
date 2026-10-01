// Choose which universities travel times are measured to: all of them or any subset.
import { icon } from "../icons.js";
import { $, $$, esc, modal } from "../ui.js";
import { UNIVERSITIES, uniShort, uniName, isAllUnis, unisByIds } from "../data/places.js";
import { currentUnis, setUnis } from "../state.js";
import { t } from "../i18n.js";

export const uniLabel = (ids = currentUnis()) => isAllUnis(ids) ? t("всички университети") : unisByIds(ids).map(uniShort).join(", ");

export function uniPickerDialog(onDone) {
  const cur = currentUnis();
  const all = isAllUnis(cur);
  const m = modal(`<h2>${t("Време за път до")}</h2>
    <p class="muted" style="margin-top:-6px">${t("Избери университетите, които те интересуват. Показваме времето до най-близкия от тях.")}</p>
    <label class="check uni-all"><input type="checkbox" id="upAll" ${all ? "checked" : ""}><span><b>${t("Всички университети")}</b></span></label>
    <div class="uni-list">${UNIVERSITIES.map(u => `<label class="check"><input type="checkbox" data-uni="${u.id}" ${all || cur.includes(u.id) ? "checked" : ""}>
      <span><b>${uniShort(u)}</b> <span class="muted">${esc(uniName(u))}</span></span></label>`).join("")}</div>
    <div class="modal-foot"><button class="btn link" data-close>${t("Отказ")}</button><button class="btn dark" id="upGo">${icon("check", 16)} ${t("Готово")}</button></div>`,
  { cls: "small", label: t("Време за път до") });
  const boxes = () => $$("[data-uni]", m.el);
  $("#upAll", m.el).onchange = e => boxes().forEach(b => { b.checked = e.target.checked; });
  m.el.addEventListener("change", e => { if (e.target.dataset.uni) $("#upAll", m.el).checked = boxes().every(b => b.checked); });
  $("#upGo", m.el).onclick = () => {
    const ids = boxes().filter(b => b.checked).map(b => b.dataset.uni);
    setUnis(ids.length === UNIVERSITIES.length || !ids.length ? [] : ids);
    m.close(); onDone?.();
  };
}
