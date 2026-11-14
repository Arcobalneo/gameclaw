import { onLang, t } from '../i18n';
import { type BoardRow, onBoard, rowsFor } from '../runtime/leaderboard';
import { h } from './dom';

/** Compact ranked list. `gameId` is `total` or a catalog id. */
export function boardList(gameId: string | 'total', limit = 8): HTMLElement {
  const list = h('ol', { class: 'board-list' });
  const empty = h('p', { class: 'board-empty' });
  const root = h('div', { class: 'board-body' }, list, empty);
  const paint = () => {
    empty.textContent = t('board.empty');
    list.replaceChildren();
    const rows = rowsFor(gameId).slice(0, limit);
    empty.hidden = rows.length > 0;
    list.hidden = rows.length === 0;
    for (let i = 0; i < rows.length; i += 1) list.append(rowEl(rows[i]!, i));
  };
  paint();
  onBoard(paint);
  onLang(paint);
  return root;
}

function rowEl(row: BoardRow, index: number): HTMLElement {
  return h(
    'li',
    { class: 'board-row' },
    h('span', { class: 'board-rank' }, String(index + 1)),
    h('span', { class: 'board-name' }, row.name),
    h('span', { class: 'board-score' }, String(row.score)),
  );
}
