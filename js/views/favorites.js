import * as store from "../store.js";
import { icon } from "../icons.js";
import { $ } from "../ui.js";
import { cardHTML, bindCards, rowFor } from "./card.js";

export function favoritesPage(main) {
  main.innerHTML = `<div class="wrap-wide" style="padding-bottom:80px"><div class="page-head"><h1>Любими</h1><p id="favSub"></p></div><div class="grid" id="fg"></div></div>`;
  const grid = $("#fg");
  bindCards(grid);
  const draw = () => {
    const ls = store.me().favorites.map(store.listing).filter(Boolean);
    $("#favSub").textContent = ls.length ? "Натисни сърцето отново, за да махнеш обява." : "";
    grid.innerHTML = ls.length ? ls.map(l => cardHTML(rowFor(l))).join("") :
      `<div class="empty" style="grid-column:1/-1">${icon("heart", 40)}<h2 style="margin-top:12px">Още нямаш любими</h2><p>Докато разглеждаш, натисни сърцето на обявите, които ти харесват.</p><a class="btn dark" href="#/">Разгледай обявите</a></div>`;
  };
  draw();
  return { refresh: draw };
}
