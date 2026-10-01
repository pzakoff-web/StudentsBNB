import * as store from "../store.js";
import { icon } from "../icons.js";
import { $ } from "../ui.js";
import { t } from "../i18n.js";
import { cardHTML, bindCards, rowFor } from "./card.js";

export function favoritesPage(main) {
  main.innerHTML = `<div class="wrap-wide" style="padding-bottom:80px"><div class="page-head"><h1>${t("Запазени")}</h1><p id="favSub"></p></div><div class="grid" id="fg"></div></div>`;
  const grid = $("#fg");
  bindCards(grid);
  const draw = () => {
    const ls = store.me().favorites.map(store.listing).filter(Boolean);
    $("#favSub").textContent = ls.length ? t("Натисни отметката отново, за да махнеш обява.") : "";
    grid.innerHTML = ls.length ? ls.map(l => cardHTML(rowFor(l))).join("") :
      `<div class="empty" style="grid-column:1/-1">${icon("bookmark", 40)}<h2 style="margin-top:12px">${t("Още нищо не си запазил")}</h2><p>${t("Докато разглеждаш, натисни отметката на обявите, които ти харесват.")}</p><a class="btn dark" href="#/">${t("Разгледай обявите")}</a></div>`;
  };
  draw();
  return { refresh: draw, restoreScroll: true };
}
