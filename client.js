/**
 * Eisenhower to-do — the browser half of the bundle.
 *
 * Registers one sidebar entry (`sidebar.panellist`) and the main panel it opens
 * (`main` keyed slot). The panel has two views: a 2×2 Eisenhower matrix
 * (important × urgent) and a one-click completed list. The matrix fills the
 * panel, and every quadrant takes an inline quick-add. Layout preferences
 * (urgent column side, frame style, corner radius) live in the Host store next
 * to the todos and are edited from the gear panel.
 *
 * Styling only uses `--dsw-alias-*` theme tokens, so light and dark appearance
 * (and any palette layer another plugin stacks) apply without extra work.
 */
window.__ModuleLoader__.load({
  id: 'dsh-matrix-todo',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useMemo = React.useMemo;
    const useCallback = React.useCallback;
    const useRef = React.useRef;
    const useSyncExternalStore = React.useSyncExternalStore;

    /** Dictionary namespace owned by this plugin. */
    const NS = 'matrixTodo';
    /** Shared by the sidebar row and the main panel it selects. */
    const PANEL_ID = 'matrix-todo';
    /** Host API route prefix. */
    const API_PREFIX = 'matrix-todo/api/';
    /** Sidebar order: right after the shipped "todo" entry (order 20). */
    const ORDER = 21;

    /** Layout preferences, mirrored from the Host defaults. */
    const DEFAULT_SETTINGS = {
      urgentSide: 'right',
      frame: 'cross',
      radius: 10,
      tint: 'plain',
      fontSize: 14,
      dueFormat: 'countdown',
      titleStyle: 'wrap',
      colRatio: 0.5,
      rowRatio: 0.5,
      navLabel: '',
    };

    /** Author links shown at the foot of the settings panel (external, new tab). */
    const AUTHOR_NAME = 'Zhang-Eli';
    const AUTHOR_URL = 'https://github.com/' + AUTHOR_NAME;
    const REPO_URL = 'https://github.com/Zhang-Eli/dsh-matrix-todo';
    const ISSUES_URL = REPO_URL + '/issues';

    /** Keep a split ratio inside the range the Host accepts. */
    function clampRatio(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
      return Math.min(0.8, Math.max(0.2, Math.round(value * 1000) / 1000));
    }

    /** English dictionary. */
    const EN = {
      'nav.label': 'Todo matrix',
      'page.title': 'To-do',
      'page.subtitle': 'Important × Urgent',
      'view.matrix': 'Matrix',
      'view.completed': 'Done',
      'flag.important': 'Important',
      'flag.urgent': 'Urgent',
      'quadrant.q1': 'Do now',
      'quadrant.q1.hint': 'Important · Urgent',
      'quadrant.q2': 'Schedule',
      'quadrant.q2.hint': 'Important · Not urgent',
      'quadrant.q3': 'Delegate',
      'quadrant.q3.hint': 'Not important · Urgent',
      'quadrant.q4': 'Eliminate',
      'quadrant.q4.hint': 'Not important · Not urgent',
      'item.complete': 'Mark as done',
      'item.restore': 'Restore',
      'item.delete': 'Delete',
      'item.due.set': 'Set due date',
      'item.due.today': 'Due today',
      'item.due.overdue': 'Overdue',
      'item.drag': 'Drag to reorder or move to another quadrant',
      'item.edit': 'Double-click to edit',
      'quickAdd.due': 'Due date',
      'toast.praise.1': 'Well done! Right on time.',
      'toast.praise.2': 'Nice — done before the deadline.',
      'toast.praise.3': 'On schedule. Great rhythm.',
      'toast.praise.4': 'Delivered on time.',
      'toast.praise.5': 'Well done! Plan kept.',
      'toast.praise.6': 'Right on time — nice work.',
      'toast.praise.7': 'On track and done. Keep it up.',
      'toast.praise.8': 'Great job hitting the date.',
      'toast.cheer.1': 'Done is done — next time a little earlier.',
      'toast.cheer.2': 'Late, but finished. Keep going.',
      'toast.cheer.3': 'You closed it out. No guilt needed.',
      'toast.cheer.4': 'Better late than never. On to the next.',
      'toast.cheer.5': 'One off the list — reset the pace.',
      'toast.cheer.6': 'Finished, and that still counts.',
      'toast.cheer.7': 'Overdue but done. That matters.',
      'toast.cheer.8': 'Cheer up — try one day earlier next time.',
      'empty.completed': 'No completed to-dos yet.',
      'completed.heading': 'Completed',
      'completed.clear': 'Clear completed',
      'completed.confirm': 'Confirm clear',
      'quickAdd': 'Add',
      'quickAdd.placeholder': 'Press Enter to add here',
      'picker.prev': 'Previous month',
      'picker.next': 'Next month',
      'picker.clear': 'Clear',
      'picker.today': 'Today',
      'picker.due': 'Due date',
      'picker.hint': 'Click to preview the day, double-click to set it and add the to-do',
      'settings.toggle': 'Settings',
      'settings.axis': 'Urgent column',
      'settings.axis.left': 'Left',
      'settings.axis.right': 'Right',
      'settings.frame': 'Frame',
      'settings.frame.cards': 'Cards',
      'settings.frame.grid': 'Grid',
      'settings.frame.cross': 'Cross',
      'settings.tint': 'Cell fill',
      'settings.tint.plain': 'Plain',
      'settings.tint.soft': 'Soft',
      'settings.dueFormat': 'Due date as',
      'settings.dueFormat.date': 'Date',
      'settings.dueFormat.countdown': 'Countdown',
      'settings.titleStyle': 'Text',
      'settings.titleStyle.wrap': 'Wrap',
      'settings.titleStyle.truncate': 'Truncate',
      'settings.quadSize': 'Drag the centre handle to resize the quadrants',
      'settings.navLabel': 'Sidebar label',
      'settings.navLabel.placeholder': 'Eisenhower to-do',
      'settings.radius': 'Corner radius',
      'settings.fontSize': 'Font size',
      'settings.reset': 'Reset',
      'settings.about.issues': 'Feedback',
      'settings.about.developed': 'Developed by',
      'loading': 'Loading…',
      'error.request': 'Request failed.',
      'error.retry': 'Retry',
    };

    /** Chinese dictionary. */
    const ZH = {
      'nav.label': '四象限待办',
      'page.title': '待办',
      'page.subtitle': '重要 × 紧急',
      'view.matrix': '四象限',
      'view.completed': '已完成',
      'flag.important': '重要',
      'flag.urgent': '紧急',
      'quadrant.q1': '立即做',
      'quadrant.q1.hint': '重要 · 紧急',
      'quadrant.q2': '计划做',
      'quadrant.q2.hint': '重要 · 不紧急',
      'quadrant.q3': '委托做',
      'quadrant.q3.hint': '不重要 · 紧急',
      'quadrant.q4': '别做',
      'quadrant.q4.hint': '不重要 · 不紧急',
      'item.complete': '标记完成',
      'item.restore': '恢复',
      'item.delete': '删除',
      'item.due.set': '设置截止日期',
      'item.due.today': '今天到期',
      'item.due.overdue': '已逾期',
      'item.drag': '拖动可排序，或移到其他象限',
      'item.edit': '双击编辑',
      'quickAdd.due': '截止日期',
      'toast.praise.1': 'Well done! 按期完成',
      'toast.praise.2': '漂亮，正好赶上',
      'toast.praise.3': '按时搞定，节奏很好',
      'toast.praise.4': '如期完成，稳稳的',
      'toast.praise.5': 'Well done! 计划达成',
      'toast.praise.6': '准时完成，很棒',
      'toast.praise.7': '按计划完成，继续保持',
      'toast.praise.8': '干得漂亮，说到做到',
      'toast.cheer.1': '完成了就好，下次早点开始',
      'toast.cheer.2': '虽然晚了点，但没放弃，加油',
      'toast.cheer.3': '补上了，别自责，继续前进',
      'toast.cheer.4': '迟到总比不到好，下一件会更好',
      'toast.cheer.5': '搞定一件，调整节奏再来',
      'toast.cheer.6': '完成了，给自己一点宽容',
      'toast.cheer.7': '逾期也完成了，值得肯定',
      'toast.cheer.8': '加油，下一次试着提前一天',
      'empty.completed': '还没有已完成的事项。',
      'completed.heading': '已完成',
      'completed.clear': '清空已完成',
      'completed.confirm': '确认清空',
      'quickAdd': '添加',
      'quickAdd.placeholder': '回车添加到本象限',
      'picker.prev': '上个月',
      'picker.next': '下个月',
      'picker.clear': '清除',
      'picker.today': '今天',
      'picker.due': '截止日期',
      'picker.hint': '单击预览日期，双击确定并添加该待办',
      'settings.toggle': '设置',
      'settings.axis': '紧急方向',
      'settings.axis.left': '在左',
      'settings.axis.right': '在右',
      'settings.frame': '边框风格',
      'settings.frame.cards': '卡片',
      'settings.frame.grid': '田字格',
      'settings.frame.cross': '十字线',
      'settings.tint': '象限底色',
      'settings.tint.plain': '纯色',
      'settings.tint.soft': '淡彩',
      'settings.dueFormat': '日期显示',
      'settings.dueFormat.date': '日期',
      'settings.dueFormat.countdown': '倒计时',
      'settings.titleStyle': '文字显示',
      'settings.titleStyle.wrap': '完整换行',
      'settings.titleStyle.truncate': '单行截断',
      'settings.quadSize': '拖动象限中心的圆点可调整四象限大小',
      'settings.navLabel': '侧边栏名称',
      'settings.navLabel.placeholder': '四象限待办',
      'settings.radius': '圆角幅度',
      'settings.fontSize': '字号',
      'settings.reset': '恢复默认',
      'settings.about.issues': '反馈问题',
      'settings.about.developed': 'Developed by',
      'loading': '加载中…',
      'error.request': '请求失败。',
      'error.retry': '重试',
    };

    /**
     * The four cells, in reading order for the default layout.
     * `important`/`urgent` are the two data flags; labels are locale keys.
     */
    const QUADRANTS = [
      { id: 'q1', important: true, urgent: true },
      { id: 'q2', important: true, urgent: false },
      { id: 'q3', important: false, urgent: true },
      { id: 'q4', important: false, urgent: false },
    ];

    /** Reading order when the urgent column moves to the right edge. */
    const URGENT_RIGHT_ORDER = ['q2', 'q1', 'q4', 'q3'];

    /** Defensive read of a settings payload from the Host. */
    function sanitizeSettings(value) {
      const source = value !== null && typeof value === 'object' ? value : {};
      return {
        urgentSide: source.urgentSide === 'right' ? 'right' : 'left',
        frame: source.frame === 'grid' || source.frame === 'cross' ? source.frame : 'cards',
        radius:
          Number.isInteger(source.radius) && source.radius >= 0 && source.radius <= 24
            ? source.radius
            : DEFAULT_SETTINGS.radius,
        tint: source.tint === 'soft' ? 'soft' : 'plain',
        fontSize:
          Number.isInteger(source.fontSize) && source.fontSize >= 11 && source.fontSize <= 17
            ? source.fontSize
            : DEFAULT_SETTINGS.fontSize,
        dueFormat: source.dueFormat === 'countdown' ? 'countdown' : 'date',
        titleStyle: source.titleStyle === 'truncate' ? 'truncate' : 'wrap',
        colRatio: clampRatio(source.colRatio),
        rowRatio: clampRatio(source.rowRatio),
        navLabel: typeof source.navLabel === 'string' ? source.navLabel.trim().slice(0, 24) : '',
      };
    }

    /** Build the endpoint URL, respecting a document `<base>` like the host does. */
    function apiUrl(method) {
      return new URL(API_PREFIX + method, document.baseURI).href;
    }

    /**
     * One API round trip. Resolves to the server's `result`; throws a readable
     * Error whose message is already user-facing (the Host writes them).
     */
    async function fetchApi(method, payload) {
      const res = await fetch(apiUrl(method), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const body = await res.json().catch(() => null);
      if (body === null || typeof body !== 'object') {
        throw new Error('Unexpected response from the to-do store.');
      }
      if (!body.ok) {
        const message = body.error && body.error.message;
        throw new Error(typeof message === 'string' && message !== '' ? message : 'The to-do store refused the request.');
      }
      return body.result ?? {};
    }

    /** `MM-DD`, with the year added only when it is not the current one. */
    function formatDay(iso) {
      if (typeof iso !== 'string' || iso === '') return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return year === new Date().getFullYear() ? month + '-' + day : year + '-' + month + '-' + day;
    }

    /** Local calendar day key (YYYY-MM-DD), used for due-date comparison. */
    function dayKeyOf(date) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return date.getFullYear() + '-' + month + '-' + day;
    }

    /** Today as a local day key; re-read on every render so a stale page still compares correctly. */
    function todayKey() {
      return dayKeyOf(new Date());
    }

    /** Format a stored YYYY-MM-DD key without timezone shifts. */
    function formatDayKey(key) {
      const parts = String(key).split('-');
      if (parts.length !== 3) return key;
      const year = Number(parts[0]);
      return year === new Date().getFullYear() ? parts[1] + '-' + parts[2] : key;
    }

    /** `overdue` / `today` / `future` for an open todo's due date. */
    function dueStateOf(dueDate) {
      if (typeof dueDate !== 'string' || dueDate === '') return null;
      const today = todayKey();
      if (dueDate < today) return 'overdue';
      return dueDate === today ? 'today' : 'future';
    }

    /** Whole days between two `YYYY-MM-DD` keys (positive = `a` is later). UTC math avoids DST drift. */
    function daysBetween(a, b) {
      const left = String(a).split('-').map(Number);
      const right = String(b).split('-').map(Number);
      if (left.length !== 3 || right.length !== 3) return 0;
      const ms = Date.UTC(left[0], left[1] - 1, left[2]) - Date.UTC(right[0], right[1] - 1, right[2]);
      return Math.round(ms / 86400000);
    }

    /** `7d` in the future, `0d` today, `-3d` when overdue. */
    function formatCountdown(dueDate) {
      const diff = daysBetween(dueDate, todayKey());
      return (diff > 0 ? String(diff) : diff === 0 ? '0' : String(diff)) + 'd';
    }

    /** Local Date from a `YYYY-MM-DD` key. */
    function dateOfKey(key) {
      const parts = String(key).split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    /** `YYYY-MM-DD` from a full year, a 0-based month, and a day of month. */
    function keyOfDate(year, monthIndex, day) {
      return year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }

    /** Day cells of one month, Monday first; nulls pad the leading week. */
    function monthCells(year, monthIndex) {
      const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
      const total = new Date(year, monthIndex + 1, 0).getDate();
      const cells = [];
      for (let index = 0; index < offset; index += 1) cells.push(null);
      for (let day = 1; day <= total; day += 1) cells.push(day);
      return cells;
    }

    /** Narrow weekday labels in the user's locale, Monday first (2024-01-01 was a Monday). */
    const WEEKDAY_LABELS = (() => {
      const format = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
      return Array.from({ length: 7 }, (_, index) => format.format(new Date(2024, 0, 1 + index)));
    })();

    /**
     * Fixed-position coordinates for the calendar panel anchored to a control,
     * flipped above it when there is not enough room below.
     */
    function panelPositionFor(rect) {
      const width = 252;
      const height = 330;
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const top =
        rect.bottom + 6 + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
      return { left, top };
    }

    /**
     * A small month calendar. A single click previews a day without closing;
     * a double-click confirms it, closes, and lets the caller add the to-do.
     */
    function DatePickerPanel(props) {
      const t = props.t;
      const value = props.value;
      const anchor = props.anchor;
      const panelRef = useRef(null);
      const [view, setView] = useState(() => {
        const base = value !== '' ? dateOfKey(value) : new Date();
        return { year: base.getFullYear(), month: base.getMonth() };
      });

      const dismiss = props.onDismiss;

      useEffect(() => {
        const onPointerDown = (event) => {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return;
          const target = event.target;
          if (target instanceof Element) {
            const anchorElement = target.closest('[data-ez-date-anchor]');
            // Its own anchor toggles the panel closed via click, so leave it alone;
            // any other anchor dismisses this panel and opens its own.
            if (anchorElement !== null && anchorElement.getAttribute('data-ez-date-anchor') === anchor) return;
          }
          dismiss();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') dismiss();
        };
        document.addEventListener('mousedown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [dismiss, anchor]);

      const shift = (delta) => {
        setView((current) => {
          const base = new Date(current.year, current.month + delta, 1);
          return { year: base.getFullYear(), month: base.getMonth() };
        });
      };

      const today = todayKey();
      const cells = monthCells(view.year, view.month);
      const monthLabel = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(
        new Date(view.year, view.month, 1),
      );

      return h(
        'div',
        { className: 'ez-picker', ref: panelRef, style: props.style, role: 'dialog', 'aria-label': t('picker.due') },
        h(
          'div',
          { className: 'ez-picker-head' },
          h(
            'button',
            {
              type: 'button',
              className: 'ez-picker-nav',
              title: t('picker.prev'),
              'aria-label': t('picker.prev'),
              onClick: () => shift(-1),
            },
            '‹',
          ),
          h('span', { className: 'ez-picker-title' }, monthLabel),
          h(
            'button',
            {
              type: 'button',
              className: 'ez-picker-nav',
              title: t('picker.next'),
              'aria-label': t('picker.next'),
              onClick: () => shift(1),
            },
            '›',
          ),
        ),
        h(
          'div',
          { className: 'ez-picker-grid ez-picker-grid--wd' },
          WEEKDAY_LABELS.map((label, index) => h('span', { key: 'wd-' + index, className: 'ez-picker-wd' }, label)),
        ),
        h(
          'div',
          { className: 'ez-picker-grid' },
          cells.map((day, index) => {
            if (day === null) return h('span', { key: 'pad-' + index, className: 'ez-picker-cell' });
            const key = keyOfDate(view.year, view.month, day);
            const selected = key === value;
            return h(
              'button',
              {
                key,
                type: 'button',
                className:
                  'ez-picker-day' + (selected ? ' is-selected' : '') + (key === today ? ' is-today' : ''),
                title: t('picker.hint'),
                'aria-label': key,
                'aria-pressed': selected,
                onClick: () => props.onPick(key),
                onDoubleClick: () => props.onCommit(key),
              },
              String(day),
            );
          }),
        ),
        h(
          'div',
          { className: 'ez-picker-foot' },
          h(
            'button',
            { type: 'button', className: 'ez-picker-link', disabled: value === '', onClick: props.onClear },
            t('picker.clear'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'ez-picker-link',
              onClick: () => {
                const now = new Date();
                setView({ year: now.getFullYear(), month: now.getMonth() });
                props.onPick(today);
              },
            },
            t('picker.today'),
          ),
        ),
      );
    }

    /** Sidebar glyph: a 2×2 matrix with one filled cell. */
    function PanelIcon(props) {
      const edge = typeof props.size === 'number' ? props.size : 16;
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('rect', { x: 2.1, y: 2.1, width: 5, height: 5, rx: 1.2, fill: 'currentColor' }),
        h('rect', { x: 8.9, y: 2.1, width: 5, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.1 }),
        h('rect', { x: 2.1, y: 8.9, width: 5, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.1 }),
        h('rect', { x: 8.9, y: 8.9, width: 5, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.1 }),
      );
    }

    /** Small inline glyph factory: stroked `paths` in `currentColor`. */
    function glyph(paths, size) {
      const edge = size ?? 14;
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        paths.map((d, index) => h('path', { key: String(index), d: d })),
      );
    }

    const FlagGlyph = () =>
      h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('path', { d: 'M4.4 13.6V2.6' }),
        h('path', { d: 'M4.4 3.2h6.1l-1.2 2.2 1.2 2.2H4.4' }),
      );

    const BoltGlyph = () =>
      h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('path', { d: 'M8.9 1.8 3.6 9h3.6l-1 5.2L11.4 7H7.8Z' }),
      );

    const CloseGlyph = () => glyph(['M4.2 4.2l7.6 7.6', 'M11.8 4.2l-7.6 7.6'], 13);

    const RestoreGlyph = () => glyph(['M3.2 6.2h4V2.6', 'M3.4 10.6a5.2 5.2 0 1 0 .6-6.2'], 13);

    const CalendarGlyph = ({ size = 13 } = {}) =>
      h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('rect', { x: 2.4, y: 3.4, width: 11.2, height: 10.2, rx: 1.8 }),
        h('path', { d: 'M2.4 6.6h11.2M5.6 1.9v3M10.4 1.9v3' }),
      );

    const GearGlyph = () =>
      h(
        'svg',
        {
          width: 15,
          height: 15,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('circle', { cx: 8, cy: 8, r: 2.1 }),
        h('path', { d: 'M8 1.9v1.5M8 12.6v1.5M1.9 8h1.5M12.6 8h1.5M3.7 3.7l1.1 1.1M11.2 11.2l1.1 1.1M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1' }),
      );

    /** Feedback glyph for the settings footer. */
    const ChatGlyph = () =>
      glyph(['M13.2 8c0 2.5-2.3 4.5-5.2 4.5-.7 0-1.3-.1-1.9-.3l-2.9 1 .9-2.4c-.7-.7-1.2-1.7-1.2-2.8 0-2.5 2.3-4.5 5.1-4.5s5.2 2 5.2 4.5Z'], 13);

    /** A small icon button used for per-row and header actions. */
    function MiniButton(props) {
      const attrs = {
        type: 'button',
        className: props.active ? 'ez-mini is-on' : 'ez-mini',
        title: props.label,
        'aria-label': props.label,
        onClick: props.onClick,
      };
      // Opening the shared calendar reports itself so the panel can tell a click
      // on its own anchor from a click elsewhere.
      if (props.anchor !== undefined) {
        attrs['data-ez-date-anchor'] = props.anchor;
        attrs['aria-haspopup'] = 'dialog';
        attrs['aria-expanded'] = props.expanded === true;
      }
      return h('button', attrs, props.children);
    }

    /** The settings panel: axis side, frame style, cell fill, radius, font size. */
    function SettingsPanel(props) {
      const t = props.t;
      const settings = props.settings;

      const row = (label, control, trailing) =>
        h(
          'div',
          { className: 'ez-set-row' },
          h('span', { className: 'ez-set-label' }, label),
          control,
          trailing === undefined ? null : trailing,
        );

      const seg = (options, current, onPick) =>
        h(
          'div',
          { className: 'ez-seg ez-seg--sm', role: 'group' },
          options.map((option) =>
            h(
              'button',
              {
                key: option[0],
                type: 'button',
                className: option[0] === current ? 'ez-seg-btn is-active' : 'ez-seg-btn',
                'aria-pressed': option[0] === current,
                onClick: () => onPick(option[0]),
              },
              option[1],
            ),
          ),
        );

      const slider = (label, value, min, max, step, onInput) =>
        h(
          'div',
          { className: 'ez-set-slider' },
          h('input', {
            className: 'ez-range',
            type: 'range',
            min,
            max,
            step,
            value,
            'aria-label': label,
            onChange: (event) => onInput(Number(event.target.value)),
          }),
          h('span', { className: 'ez-set-value' }, value + ' px'),
        );

      /**
       * An external link with a glyph. The desktop shell turns a target="_blank"
       * https link into a browser open, so the page itself never navigates away.
       */
      const aboutLink = (href, Glyph, label, extraClass) =>
        h(
          'a',
          {
            className: extraClass ? 'ez-about-link ' + extraClass : 'ez-about-link',
            href,
            target: '_blank',
            rel: 'noreferrer noopener',
            title: label + ' · ' + href,
            'aria-label': label + ' · ' + href,
          },
          h(Glyph),
          label,
        );

      return h(
        'div',
        { className: 'ez-settings', id: 'ez-settings-panel' },
        row(
          t('settings.axis'),
          seg(
            [
              ['left', t('settings.axis.left')],
              ['right', t('settings.axis.right')],
            ],
            settings.urgentSide,
            (value) => props.onPatch({ urgentSide: value }),
          ),
        ),
        row(
          t('settings.frame'),
          seg(
            [
              ['cards', t('settings.frame.cards')],
              ['grid', t('settings.frame.grid')],
              ['cross', t('settings.frame.cross')],
            ],
            settings.frame,
            (value) => props.onPatch({ frame: value }),
          ),
        ),
        row(
          t('settings.tint'),
          seg(
            [
              ['plain', t('settings.tint.plain')],
              ['soft', t('settings.tint.soft')],
            ],
            settings.tint,
            (value) => props.onPatch({ tint: value }),
          ),
        ),
        row(
          t('settings.dueFormat'),
          seg(
            [
              ['date', t('settings.dueFormat.date')],
              ['countdown', t('settings.dueFormat.countdown')],
            ],
            settings.dueFormat,
            (value) => props.onPatch({ dueFormat: value }),
          ),
        ),
        row(
          t('settings.titleStyle'),
          seg(
            [
              ['wrap', t('settings.titleStyle.wrap')],
              ['truncate', t('settings.titleStyle.truncate')],
            ],
            settings.titleStyle,
            (value) => props.onPatch({ titleStyle: value }),
          ),
        ),
        row(
          t('settings.navLabel'),
          h('input', {
            className: 'ez-text-field',
            type: 'text',
            value: settings.navLabel,
            maxLength: 24,
            placeholder: t('settings.navLabel.placeholder'),
            'aria-label': t('settings.navLabel'),
            onChange: (event) => props.onPatch({ navLabel: event.target.value }),
          }),
        ),
        row(
          t('settings.radius'),
          slider(t('settings.radius'), settings.radius, 0, 24, 2, (value) => props.onPatch({ radius: value })),
        ),
        row(
          t('settings.fontSize'),
          slider(t('settings.fontSize'), settings.fontSize, 11, 17, 1, (value) => props.onPatch({ fontSize: value })),
          h(
            'button',
            { type: 'button', className: 'ez-reset ez-reset--inline', onClick: props.onReset },
            t('settings.reset'),
          ),
        ),
        h(
          'footer',
          { className: 'ez-set-about' },
          aboutLink(ISSUES_URL, ChatGlyph, t('settings.about.issues')),
          h(
            'span',
            { className: 'ez-about-dev' },
            h('span', { className: 'ez-about-dev-label' }, t('settings.about.developed')),
            h('img', {
              className: 'ez-about-avatar',
              src: 'https://github.com/' + AUTHOR_NAME + '.png?size=32',
              alt: '',
              width: 16,
              height: 16,
              loading: 'lazy',
              draggable: false,
              onError: (event) => {
                event.currentTarget.style.display = 'none';
              },
            }),
            h(
              'a',
              {
                className: 'ez-about-link ez-about-dev-name',
                href: AUTHOR_URL,
                target: '_blank',
                rel: 'noreferrer noopener',
                title: AUTHOR_NAME + ' · ' + AUTHOR_URL,
                'aria-label': AUTHOR_NAME + ' · ' + AUTHOR_URL,
              },
              AUTHOR_NAME,
            ),
          ),
        ),
      );
    }

    /** One open todo row: checkbox, title, due-date mark, hover actions, drag handle. */
    function TodoRow(props) {
      const todo = props.todo;
      const t = props.t;
      const [pickerOpen, setPickerOpen] = useState(false);
      const [pickerPos, setPickerPos] = useState(null);
      const [draftDue, setDraftDue] = useState('');
      const [editing, setEditing] = useState(false);
      const [draftTitle, setDraftTitle] = useState(todo.title);
      const editInputRef = useRef(null);
      // Enter, Escape and blur can all fire for one gesture; settle only once.
      const editSettledRef = useRef(false);
      const dueState = dueStateOf(todo.dueDate);

      useEffect(() => {
        const input = editInputRef.current;
        if (!editing || input === null) return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }, [editing]);

      const startEdit = () => {
        editSettledRef.current = false;
        setDraftTitle(todo.title);
        setEditing(true);
      };

      /** Leave edit mode; `save` false means the gesture was cancelled. */
      const settleEdit = (save) => {
        if (editSettledRef.current) return;
        editSettledRef.current = true;
        setEditing(false);
        const value = draftTitle.trim();
        if (!save || value === '' || value === todo.title) return;
        props.onPatch(todo.id, { title: value });
      };
      // Tooltip lead: the date state when it is meaningful, otherwise the date
      // itself. Falling back to "set due date" here duplicated the action text.
      const dueLabel =
        dueState === 'overdue'
          ? t('item.due.overdue')
          : dueState === 'today'
            ? t('item.due.today')
            : formatDayKey(todo.dueDate);
      const anchor = 'row-' + todo.id;
      const hasDue = todo.dueDate !== null && todo.dueDate !== undefined;

      const dismissPicker = useCallback(() => setPickerOpen(false), []);

      /** Open the shared calendar under the clicked control; a second click closes it. */
      const togglePicker = (event) => {
        if (pickerOpen) {
          setPickerOpen(false);
          return;
        }
        setDraftDue(hasDue ? todo.dueDate : '');
        setPickerPos(panelPositionFor(event.currentTarget.getBoundingClientRect()));
        setPickerOpen(true);
      };

      const className =
        'ez-row' +
        (props.dragging ? ' is-dragging' : '') +
        (props.dropBefore ? ' is-drop-before' : '') +
        (dueState === 'overdue' ? ' is-overdue' : '');

      return h(
        'li',
        {
          className,
          draggable: !editing,
          'data-todo-id': todo.id,
          title: t('item.drag'),
          onDragStart: (event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', todo.id);
            props.onDragStart(todo.id);
          },
          onDragEnd: () => props.onDragEnd(),
        },
        h('input', {
          className: 'ez-check',
          type: 'checkbox',
          checked: false,
          title: t('item.complete'),
          'aria-label': t('item.complete'),
          onChange: () => props.onToggle(todo.id),
        }),
        editing
          ? h('input', {
              className: 'ez-title-input',
              ref: editInputRef,
              type: 'text',
              value: draftTitle,
              maxLength: 200,
              title: t('item.edit'),
              'aria-label': t('item.edit'),
              onChange: (event) => setDraftTitle(event.target.value),
              onKeyDown: (event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  event.preventDefault();
                  settleEdit(true);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  settleEdit(false);
                }
              },
              onBlur: () => settleEdit(true),
              onDragStart: (event) => event.preventDefault(),
            })
          : h(
              'span',
              { className: 'ez-title', title: todo.title + ' · ' + t('item.edit'), onDoubleClick: startEdit },
              todo.title,
            ),
        h(
          'div',
          { className: 'ez-actions' },
          // A due date that exists is edited through its own mark, so the
          // calendar button only appears as the entry point when there is none.
          hasDue
            ? null
            : h(
                MiniButton,
                {
                  label: t('item.due.set'),
                  anchor,
                  expanded: pickerOpen,
                  onClick: togglePicker,
                },
                h(CalendarGlyph),
              ),
          h(
            MiniButton,
            {
              active: todo.important === true,
              label: t('flag.important'),
              onClick: () => props.onPatch(todo.id, { important: !todo.important }),
            },
            h(FlagGlyph),
          ),
          h(
            MiniButton,
            {
              active: todo.urgent === true,
              label: t('flag.urgent'),
              onClick: () => props.onPatch(todo.id, { urgent: !todo.urgent }),
            },
            h(BoltGlyph),
          ),
          h(MiniButton, { label: t('item.delete'), onClick: () => props.onRemove(todo.id) }, h(CloseGlyph)),
        ),
        // The due mark is the last child so it always sits flush with the row's
        // right edge, whether or not the hover actions are occupying space.
        hasDue
          ? h(
              'button',
              {
                type: 'button',
                className: 'ez-due ez-due--' + dueState,
                title: dueLabel + ' · ' + t('item.due.set'),
                'aria-label': dueLabel + ' · ' + t('item.due.set'),
                'data-ez-date-anchor': anchor,
                'aria-haspopup': 'dialog',
                'aria-expanded': pickerOpen,
                onClick: togglePicker,
                onDoubleClick: () => setPickerOpen(false),
              },
              props.dueFormat === 'countdown' ? formatCountdown(todo.dueDate) : formatDayKey(todo.dueDate),
            )
          : null,
        pickerOpen && pickerPos !== null
          ? h(DatePickerPanel, {
              t,
              value: draftDue,
              anchor,
              style: { left: pickerPos.left + 'px', top: pickerPos.top + 'px' },
              onPick: setDraftDue,
              onCommit: (key) => {
                setPickerOpen(false);
                props.onDue(todo.id, key);
              },
              onClear: () => {
                setPickerOpen(false);
                props.onDue(todo.id, null);
              },
              onDismiss: dismissPicker,
            })
          : null,
      );
    }

    /** One completed todo row: checked box, struck title, completion day, restore/delete. */
    function CompletedRow(props) {
      const todo = props.todo;
      const t = props.t;
      return h(
        'li',
        { className: 'ez-row ez-row--done' },
        h('input', {
          className: 'ez-check',
          type: 'checkbox',
          checked: true,
          title: t('item.restore'),
          'aria-label': t('item.restore'),
          onChange: () => props.onToggle(todo.id),
        }),
        h('span', { className: 'ez-title ez-title--done', title: todo.title }, todo.title),
        h('span', { className: 'ez-date' }, formatDay(todo.completedAt ?? todo.updatedAt)),
        h(
          'div',
          { className: 'ez-actions' },
          h(MiniButton, { label: t('item.restore'), onClick: () => props.onToggle(todo.id) }, h(RestoreGlyph)),
          h(MiniButton, { label: t('item.delete'), onClick: () => props.onRemove(todo.id) }, h(CloseGlyph)),
        ),
      );
    }

    /** One matrix cell: header, scrollable item list with drop support, and inline add. */
    function QuadrantCard(props) {
      const quadrant = props.quadrant;
      const t = props.t;
      const items = props.items;
      const [adding, setAdding] = useState(false);
      const [draft, setDraft] = useState('');
      const [draftDue, setDraftDue] = useState('');
      const [pickerOpen, setPickerOpen] = useState(false);
      const [pickerPos, setPickerPos] = useState(null);
      const inputRef = useRef(null);
      const dateButtonRef = useRef(null);
      const pendingRef = useRef(false);
      const pickerOpenRef = useRef(false);

      const name = t('quadrant.' + quadrant.id);

      useEffect(() => {
        pickerOpenRef.current = pickerOpen;
      }, [pickerOpen]);

      useEffect(() => {
        if (adding && inputRef.current !== null) inputRef.current.focus();
      }, [adding]);

      const start = () => {
        setDraft('');
        setDraftDue('');
        setPickerOpen(false);
        setAdding(true);
      };

      const stop = () => {
        setAdding(false);
        setDraft('');
        setDraftDue('');
        setPickerOpen(false);
      };

      /**
       * Create the to-do with an explicit due date (empty string means none).
       * Guarded by a ref so a fast double Enter or a double-click cannot create
       * two rows from one draft.
       */
      const submitWithDate = async (dueValue) => {
        const value = draft.trim();
        if (value === '' || pendingRef.current) return false;
        pendingRef.current = true;
        const ok = await props.onAdd(quadrant, value, dueValue === '' ? null : dueValue);
        pendingRef.current = false;
        if (ok) {
          setDraft('');
          setDraftDue('');
          setPickerOpen(false);
          if (inputRef.current !== null) inputRef.current.focus();
        }
        return ok;
      };

      const submit = (event) => {
        if (event !== undefined) event.preventDefault();
        void submitWithDate(draftDue);
      };

      /** Toggle the calendar: anchored to the button, flipped up when space runs out. */
      const togglePicker = (event) => {
        if (pickerOpen) {
          setPickerOpen(false);
          return;
        }
        setPickerPos(panelPositionFor(event.currentTarget.getBoundingClientRect()));
        setPickerOpen(true);
      };

      /** Single click previews; double-click confirms, closes, and adds the to-do. */
      const commitDate = (key) => {
        setDraftDue(key);
        if (draft.trim() === '') {
          setPickerOpen(false);
          return;
        }
        void submitWithDate(key);
      };

      /** Stable dismiss so the panel's document listeners are not rebound each render. */
      const dismissPicker = useCallback(() => setPickerOpen(false), []);

      /** Clicking empty space in the cell opens (or refocuses) the inline input. */
      const onListClick = (event) => {
        if (event.target !== event.currentTarget) return;
        if (adding) {
          if (inputRef.current !== null) inputRef.current.focus();
          return;
        }
        start();
      };

      /**
       * The row the dragged item should be inserted above, decided by comparing
       * the pointer against each row's vertical midpoint. Null means "at the end".
       */
      const beforeIdAt = (list, clientY) => {
        const rows = list.querySelectorAll('[data-todo-id]');
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) return row.dataset.todoId;
        }
        return null;
      };

      const dropActive = props.dropTarget !== null && props.dropTarget.quadrantId === quadrant.id;

      return h(
        'section',
        { className: dropActive ? 'ez-quad ez-quad--' + quadrant.id + ' is-drop-target' : 'ez-quad ez-quad--' + quadrant.id, 'aria-label': name },
        h(
          'header',
          { className: 'ez-quad-head' },
          h('span', { className: 'ez-dot', 'aria-hidden': 'true' }),
          h('h2', { className: 'ez-quad-name' }, name),
          h('span', { className: 'ez-quad-hint' }, t('quadrant.' + quadrant.id + '.hint')),
          h('span', { className: 'ez-quad-count' }, String(items.length)),
        ),
        h(
          'ul',
          {
            className:
              'ez-list' + (dropActive && props.dropTarget.beforeId === null && items.length > 0 ? ' is-drop-end' : ''),
            onClick: onListClick,
            onDragOver: (event) => {
              if (props.dragId === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              props.onDragOver(quadrant.id, beforeIdAt(event.currentTarget, event.clientY));
            },
            onDrop: (event) => {
              if (props.dragId === null) return;
              event.preventDefault();
              props.onMove(quadrant, beforeIdAt(event.currentTarget, event.clientY));
            },
          },
          items.map((todo) =>
            h(TodoRow, {
              key: todo.id,
              todo,
              t,
              onToggle: props.onToggle,
              onPatch: props.onPatch,
              onRemove: props.onRemove,
              onDue: props.onDue,
              dueFormat: props.dueFormat,
              dragging: props.dragId === todo.id,
              dropBefore: dropActive && props.dropTarget.beforeId === todo.id,
              onDragStart: props.onDragStart,
              onDragEnd: props.onDragEnd,
            }),
          ),
        ),
        h(
          'form',
          { className: 'ez-add-area', onSubmit: submit },
          adding
            ? [
                h('input', {
                  key: 'title',
                  ref: inputRef,
                  className: 'ez-add-input',
                  type: 'text',
                  value: draft,
                  maxLength: 200,
                  placeholder: t('quickAdd.placeholder'),
                  'aria-label': t('quickAdd.placeholder'),
                  onChange: (event) => setDraft(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') stop();
                  },
                  onBlur: (event) => {
                    if (pickerOpenRef.current) return;
                    const next = event.relatedTarget;
                    if (next !== null && dateButtonRef.current !== null && dateButtonRef.current.contains(next)) {
                      return;
                    }
                    if (draft.trim() === '' && draftDue === '') stop();
                  },
                }),
                h(
                  'button',
                  {
                    key: 'due',
                    ref: dateButtonRef,
                    type: 'button',
                    className:
                      draftDue === '' ? 'ez-date-field ez-date-field--empty' : 'ez-date-field ez-date-field--set',
                    title: draftDue === '' ? t('quickAdd.due') : formatDayKey(draftDue),
                    'aria-label': t('quickAdd.due'),
                    'aria-expanded': pickerOpen,
                    'aria-haspopup': 'dialog',
                    'data-ez-date-anchor': 'add-' + quadrant.id,
                    onClick: togglePicker,
                  },
                  h(CalendarGlyph, { size: draftDue === '' ? 18 : 14 }),
                  draftDue === '' ? null : h('span', { className: 'ez-date-field-text' }, formatDayKey(draftDue)),
                ),
              ]
            : h(
                'button',
                {
                  type: 'button',
                  className: 'ez-quick-add',
                  title: t('quickAdd'),
                  onClick: start,
                },
                h('span', { className: 'ez-quick-plus', 'aria-hidden': 'true' }, '+'),
                t('quickAdd'),
              ),
        ),
        pickerOpen && pickerPos !== null
          ? h(DatePickerPanel, {
              t,
              value: draftDue,
              anchor: 'add-' + quadrant.id,
              style: { left: pickerPos.left + 'px', top: pickerPos.top + 'px' },
              onPick: setDraftDue,
              onCommit: commitDate,
              onClear: () => setDraftDue(''),
              onDismiss: dismissPicker,
            })
          : null,
      );
    }

    /** The completed list plus its guarded "clear" control. */
    function CompletedList(props) {
      const t = props.t;
      const items = props.items;
      const [confirming, setConfirming] = useState(false);

      useEffect(() => {
        if (!confirming) return undefined;
        const timer = window.setTimeout(() => setConfirming(false), 3200);
        return () => window.clearTimeout(timer);
      }, [confirming]);

      const clear = () => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        props.onClear();
      };

      return h(
        'section',
        { className: 'ez-completed', 'aria-label': t('completed.heading') },
        h(
          'header',
          { className: 'ez-completed-head' },
          h('h2', { className: 'ez-completed-title' }, t('completed.heading')),
          h('span', { className: 'ez-completed-count' }, String(items.length)),
          items.length > 0
            ? h(
                'button',
                { type: 'button', className: confirming ? 'ez-clear is-confirming' : 'ez-clear', onClick: clear },
                t(confirming ? 'completed.confirm' : 'completed.clear'),
              )
            : null,
        ),
        items.length === 0
          ? h(
              'div',
              { className: 'ez-completed-body' },
              h('p', { className: 'ez-blank' }, t('empty.completed')),
            )
          : h(
              'ul',
              { className: 'ez-list' },
              items.map((todo) =>
                h(CompletedRow, { key: todo.id, todo, t, onToggle: props.onToggle, onRemove: props.onRemove }),
              ),
            ),
      );
    }

    /** The main panel: header, settings, and the selected view. */
    function TodoPage(props) {
      const t = props.t;
      const localeSource = props.localeSource;
      const [todos, setTodos] = useState(null);
      const [settings, setSettings] = useState(DEFAULT_SETTINGS);
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [error, setError] = useState(null);
      const [view, setView] = useState('matrix');
      const [dragId, setDragId] = useState(null);
      const [dropTarget, setDropTarget] = useState(null);
      const [toast, setToast] = useState(null);
      const [splitDragging, setSplitDragging] = useState(false);
      const [splitHot, setSplitHot] = useState(false);
      const matrixRef = useRef(null);
      const pageRef = useRef(null);
      const dropTargetRef = useRef(null);
      const toastTimer = useRef(null);
      const lastPraise = useRef({ praise: -1, cheer: -1 });

      useSyncExternalStore(localeSource.subscribe, localeSource.getSnapshot);

      /** Read a user-facing message off a thrown error, localizing transport failures. */
      const messageOf = useCallback(
        (err) => {
          const text = err && typeof err.message === 'string' ? err.message : '';
          if (text === '' || (err && err.name === 'TypeError')) return t('error.request');
          return text;
        },
        [t],
      );

      // Layout preferences: local state updates immediately and the Host write is
      // debounced. `settingsDirty` guards against a concurrent todo response
      // (which also carries settings) overwriting an unsaved local change.
      const latestSettings = useRef(DEFAULT_SETTINGS);
      latestSettings.current = settings;
      const settingsDirty = useRef(false);
      const saveTimer = useRef(null);

      const applyResult = useCallback((result) => {
        setTodos(Array.isArray(result.todos) ? result.todos : []);
        if (result.settings !== undefined && settingsDirty.current !== true) {
          const next = sanitizeSettings(result.settings);
          setSettings(next);
          if (typeof props.setNavLabel === 'function') props.setNavLabel(next.navLabel);
        }
        setError(null);
      }, [props.setNavLabel]);

      const load = useCallback(async () => {
        try {
          applyResult(await fetchApi('list'));
        } catch (err) {
          setError(messageOf(err));
          setTodos((current) => (current === null ? [] : current));
        } finally {
          setLoaded(true);
        }
      }, [applyResult, messageOf]);

      useEffect(() => {
        void load();
      }, [load]);

      const mutate = useCallback(
        async (method, payload) => {
          try {
            applyResult(await fetchApi(method, payload));
            return true;
          } catch (err) {
            setError(messageOf(err));
            return false;
          }
        },
        [applyResult, messageOf],
      );

      // Settings save: local state updates immediately, the Host is written once
      // after a short pause; a pending write is flushed when the panel closes.
      const commitSettings = useCallback(
        (patch) => {
          settingsDirty.current = true;
          setSettings((current) => ({ ...current, ...patch }));
          // The sidebar label is page chrome, so apply it without waiting for the
          // debounced save round trip.
          if (patch.navLabel !== undefined && typeof props.setNavLabel === 'function') {
            props.setNavLabel(patch.navLabel);
          }
        },
        [props.setNavLabel],
      );

      useEffect(() => {
        if (!loaded || !settingsDirty.current) return undefined;
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          saveTimer.current = null;
          settingsDirty.current = false;
          void mutate('saveSettings', latestSettings.current);
        }, 350);
        return () => {
          if (saveTimer.current !== null) {
            window.clearTimeout(saveTimer.current);
            saveTimer.current = null;
          }
        };
      }, [settings, loaded, mutate]);

      useEffect(
        () => () => {
          if (saveTimer.current !== null && settingsDirty.current) {
            window.clearTimeout(saveTimer.current);
            saveTimer.current = null;
            settingsDirty.current = false;
            void mutate('saveSettings', latestSettings.current);
          }
        },
        [mutate],
      );

      const onAddToQuadrant = useCallback(
        (quadrant, title, dueDate) =>
          mutate('create', { title, important: quadrant.important, urgent: quadrant.urgent, dueDate }),
        [mutate],
      );
      const onDue = useCallback((id, dueDate) => mutate('update', { id, dueDate }), [mutate]);
      const onRemove = useCallback((id) => mutate('remove', { id }), [mutate]);
      const onPatch = useCallback((id, patch) => mutate('update', { id, ...patch }), [mutate]);
      const onClear = useCallback(() => mutate('clearCompleted', {}), [mutate]);
      const onResetSettings = useCallback(() => commitSettings({ ...DEFAULT_SETTINGS }), [commitSettings]);

      /**
       * Short feedback after an item is completed. `mood` is `praise` when the due
       * date was met (or there was none) and `cheer` when the item was overdue, so
       * the two cases never share wording.
       */
      const showFeedback = useCallback((mood) => {
        const group = mood === 'cheer' ? 'cheer' : 'praise';
        const count = 8;
        const previous = lastPraise.current[group];
        let index = Math.floor(Math.random() * count);
        // Avoid repeating the same line twice in a row inside one group.
        if (index === previous) index = (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
        lastPraise.current[group] = index;
        // Centre on the plugin panel, not on the whole window: the panel sits to
        // the right of the app sidebar, so a viewport centre reads as up-left.
        const rect = pageRef.current === null ? null : pageRef.current.getBoundingClientRect();
        const left = rect === null ? window.innerWidth / 2 : rect.left + rect.width / 2;
        const top = rect === null ? window.innerHeight / 2 : rect.top + rect.height / 2;
        setToast({ id: Date.now(), mood: group, text: t('toast.' + group + '.' + (index + 1)), left, top });
        if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => {
          toastTimer.current = null;
          setToast(null);
        }, 2600);
      }, [t]);

      useEffect(
        () => () => {
          if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
        },
        [],
      );

      const onToggle = useCallback(
        async (id) => {
          const target = todos === null ? undefined : todos.find((todo) => todo.id === id);
          const completing = target !== undefined && target.done !== true;
          const ok = await mutate('toggle', { id });
          if (ok && completing) {
            // Completed today: the deadline is met while it is today or later.
            const deadlineMissed =
              typeof target.dueDate === 'string' && target.dueDate !== '' && target.dueDate < todayKey();
            showFeedback(deadlineMissed ? 'cheer' : 'praise');
          }
        },
        [todos, mutate, showFeedback],
      );

      /** Remember the drop line, re-rendering only when the target actually changes. */
      const reportDropTarget = useCallback((quadrantId, beforeId) => {
        const previous = dropTargetRef.current;
        if (previous !== null && previous.quadrantId === quadrantId && previous.beforeId === beforeId) return;
        dropTargetRef.current = { quadrantId, beforeId };
        setDropTarget(dropTargetRef.current);
      }, []);

      const endDrag = useCallback(() => {
        dropTargetRef.current = null;
        setDragId(null);
        setDropTarget(null);
      }, []);

      const onMove = useCallback(
        async (quadrant, beforeId) => {
          if (dragId === null) return;
          const id = dragId;
          endDrag();
          // Dropping onto itself is a no-op; the Host would otherwise report a
          // missing insertion anchor (the row is detached before the lookup).
          if (beforeId === id) return;
          await mutate('reorder', {
            id,
            important: quadrant.important,
            urgent: quadrant.urgent,
            beforeId,
          });
        },
        [dragId, endDrag, mutate],
      );

      const open = useMemo(() => (todos === null ? [] : todos.filter((todo) => todo.done !== true)), [todos]);
      const completed = useMemo(
        () =>
          todos === null
            ? []
            : todos
                .filter((todo) => todo.done === true)
                .slice()
                .sort((a, b) => String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? ''))),
        [todos],
      );

      const cellOrder = useMemo(() => {
        const byId = new Map(QUADRANTS.map((quadrant) => [quadrant.id, quadrant]));
        const order =
          settings.urgentSide === 'right' ? URGENT_RIGHT_ORDER : QUADRANTS.map((quadrant) => quadrant.id);
        return order.map((id) => byId.get(id));
      }, [settings.urgentSide]);

      const cells = useMemo(
        () =>
          cellOrder.map((quadrant) => ({
            quadrant,
            items: open.filter(
                (todo) =>
                  (todo.important === true) === quadrant.important &&
                  (todo.urgent === true) === quadrant.urgent,
              ),
          })),
        [cellOrder, open],
      );

      const errorText = error === null ? null : error;

      // Frame classes: `cards` | `grid` (田字格) | `cross` (no outer border),
      // plus the optional soft cell fill.
      const matrixClass =
        'ez-matrix ez-matrix--' +
        settings.frame +
        (settings.tint === 'soft' ? ' ez-matrix--tint' : '') +
        (settings.titleStyle === 'truncate' ? ' ez-matrix--truncate' : ' ez-matrix--wrap');

      /** Live grid template from the draggable split ratios. */
      const matrixStyle = {
        '--ez-radius': String(settings.radius) + 'px',
        '--ez-col-ratio': String(settings.colRatio),
        '--ez-row-ratio': String(settings.rowRatio),
        gridTemplateColumns: settings.colRatio + 'fr ' + String(1 - settings.colRatio) + 'fr',
        gridTemplateRows: settings.rowRatio + 'fr ' + String(1 - settings.rowRatio) + 'fr',
      };

      /** True while the drag sits inside the snap zone around the even split. */
      const snapActive =
        Math.abs(settings.colRatio - 0.5) <= 0.025 && Math.abs(settings.rowRatio - 0.5) <= 0.025;

      /** Resize the quadrants by dragging the handle at the cross centre. */
      const onSplitPointerDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSplitDragging(true);
      };

      /** Reveal the handle only while the pointer is near the current centre. */
      const onMatrixPointerMove = (event) => {
        if (splitDragging) return;
        const rect = matrixRef.current === null ? null : matrixRef.current.getBoundingClientRect();
        if (rect === null || rect.width === 0 || rect.height === 0) return;
        const centerX = rect.left + rect.width * settings.colRatio;
        const centerY = rect.top + rect.height * settings.rowRatio;
        const near = Math.hypot(event.clientX - centerX, event.clientY - centerY) <= 56;
        setSplitHot(near);
      };

      const onMatrixPointerLeave = () => {
        if (!splitDragging) setSplitHot(false);
      };

      /** Gentle snap so the default even split is easy to hit again. */
      const snapRatio = (value) => (Math.abs(value - 0.5) <= 0.025 ? 0.5 : clampRatio(value));

      const onSplitPointerMove = (event) => {
        if (!splitDragging) return;
        const rect = matrixRef.current === null ? null : matrixRef.current.getBoundingClientRect();
        if (rect === null || rect.width === 0 || rect.height === 0) return;
        event.preventDefault();
        commitSettings({
          colRatio: snapRatio((event.clientX - rect.left) / rect.width),
          rowRatio: snapRatio((event.clientY - rect.top) / rect.height),
        });
      };

      const onSplitPointerUp = (event) => {
        if (!splitDragging) return;
        setSplitDragging(false);
        if (typeof event.currentTarget.releasePointerCapture === 'function') {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      };

      const tab = (id, label, count) =>
        h(
          'button',
          {
            type: 'button',
            className: view === id ? 'ez-seg-btn is-active' : 'ez-seg-btn',
            'aria-pressed': view === id,
            onClick: () => setView(id),
          },
          label,
          count > 0 ? h('span', { className: 'ez-count' }, String(count)) : null,
        );

      return h(
        'div',
        { className: 'ez-page', ref: pageRef, style: { '--ez-font-size': String(settings.fontSize) + 'px' } },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'div',
          { className: 'ez-inner' },
          h(
            'header',
            { className: 'ez-head' },
            h(
              'div',
              { className: 'ez-heading' },
              h('h1', { className: 'ez-page-title' }, t('page.title')),
              h('p', { className: 'ez-sub' }, t('page.subtitle')),
            ),
            h(
              'div',
              { className: 'ez-head-actions' },
              h(
                'div',
                { className: 'ez-seg', role: 'group', 'aria-label': t('page.subtitle') },
                tab('matrix', t('view.matrix'), open.length),
                tab('completed', t('view.completed'), completed.length),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: settingsOpen ? 'ez-icon-btn is-on' : 'ez-icon-btn',
                  title: t('settings.toggle'),
                  'aria-label': t('settings.toggle'),
                  'aria-expanded': settingsOpen,
                  'aria-controls': 'ez-settings-panel',
                  onClick: () => setSettingsOpen((value) => !value),
                },
                h(GearGlyph),
              ),
            ),
          ),
          settingsOpen
            ? h(SettingsPanel, {
                t,
                settings,
                onPatch: commitSettings,
                onReset: onResetSettings,
              })
            : null,
          errorText === null
            ? null
            : h(
                'div',
                { className: 'ez-error', role: 'alert' },
                h('span', null, errorText),
                h('button', { type: 'button', className: 'ez-retry', onClick: () => void load() }, t('error.retry')),
              ),
          !loaded
            ? h('div', { className: 'ez-body' }, h('p', { className: 'ez-blank' }, t('loading')))
            : view === 'matrix'
              ? h(
                  'div',
                  {
                    className: matrixClass,
                    ref: matrixRef,
                    style: matrixStyle,
                    onPointerMove: onMatrixPointerMove,
                    onPointerLeave: onMatrixPointerLeave,
                  },
                  cells.map((cell) =>
                    h(QuadrantCard, {
                      key: cell.quadrant.id,
                      quadrant: cell.quadrant,
                      items: cell.items,
                      t,
                      onAdd: onAddToQuadrant,
                      onToggle,
                      onPatch,
                      onRemove,
                      onDue,
                      dueFormat: settings.dueFormat,
                      dragId,
                      dropTarget,
                      onDragStart: setDragId,
                      onDragEnd: endDrag,
                      onDragOver: reportDropTarget,
                      onMove,
                    }),
                  ),
                h(
                    'button',
                    {
                      type: 'button',
                      className:
                        'ez-split' +
                        (splitHot || splitDragging ? ' is-visible' : '') +
                        (splitDragging ? ' is-dragging' : '') +
                        (splitDragging && snapActive ? ' is-snap' : ''),
                      title: t('settings.quadSize'),
                      'aria-label': t('settings.quadSize'),
                      onPointerDown: onSplitPointerDown,
                      onPointerMove: onSplitPointerMove,
                      onPointerUp: onSplitPointerUp,
                      onPointerCancel: onSplitPointerUp,
                      onDoubleClick: () => commitSettings({ colRatio: 0.5, rowRatio: 0.5 }),
                    },
                    h('span', { className: 'ez-split-dot', 'aria-hidden': 'true' }),
                  ),
                  splitDragging
                    ? h(
                        'div',
                        {
                          className: snapActive ? 'ez-split-center is-active' : 'ez-split-center',
                          'aria-hidden': 'true',
                        },
                        h('span', { className: 'ez-split-center-h' }),
                        h('span', { className: 'ez-split-center-v' }),
                        h('span', { className: 'ez-split-center-dot' }),
                      )
                    : null,
                )
              : h(CompletedList, { t, items: completed, onToggle, onRemove, onClear }),
          toast === null
            ? null
            : h(
                'div',
                {
                  className: toast.mood === 'cheer' ? 'ez-toast ez-toast--cheer' : 'ez-toast ez-toast--praise',
                  key: toast.id,
                  style: { left: toast.left + 'px', top: toast.top + 'px' },
                  role: 'status',
                  'aria-live': 'polite',
                },
                h(
                  'span',
                  { className: 'ez-toast-mark', 'aria-hidden': 'true' },
                  toast.mood === 'cheer' ? '↗' : '✓',
                ),
                h('span', null, toast.text),
              ),
        ),
      );
    }

    /** Page-scoped stylesheet; every color is a theme token. */
    const CSS = [
      '.ez-page{box-sizing:border-box;display:flex;flex-direction:column;flex:1 1 auto;height:100%;min-height:0;overflow-y:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
      '.ez-inner{box-sizing:border-box;display:flex;flex-direction:column;flex:1 1 auto;width:100%;max-width:1100px;min-height:0;margin:0 auto;padding:22px 24px 20px}',
      'html[data-platform=darwin] .ez-inner{padding-top:calc(22px + var(--dsh-frame-top-clearance,48px))}',
      '.ez-head{display:flex;flex:none;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.ez-heading{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.ez-head-actions{display:flex;flex:none;align-items:center;gap:10px}',
      '.ez-page-title{margin:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-.01em}',
      '.ez-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}',
      '.ez-seg{display:inline-flex;flex:none;gap:2px;padding:2px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}',
      '.ez-seg-btn{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:26px;margin:0;padding:0 11px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-seg-btn:hover{color:var(--dsw-alias-label-primary)}',
      '.ez-seg-btn.is-active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-seg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-seg--sm .ez-seg-btn{height:24px;padding:0 9px;font-size:11.5px}',
      '.ez-count{font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.ez-icon-btn{box-sizing:border-box;display:grid;place-items:center;width:28px;height:28px;margin:0;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-icon-btn.is-on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-settings{display:flex;flex:none;flex-direction:column;gap:10px;margin-top:14px;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.ez-set-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.ez-set-about{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin-top:4px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.ez-about-dev{display:inline-flex;align-items:center;gap:5px;margin-left:auto;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary)}',
      '.ez-about-dev-label{font-style:italic}',
      '.ez-about-avatar{width:16px;height:16px;flex:0 0 auto;border-radius:50%;object-fit:cover;background:var(--dsw-alias-bg-layer-2)}',
      '.ez-about-link{display:inline-flex;align-items:center;gap:5px;padding:1px 0;border-radius:5px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1;text-decoration:none;cursor:pointer;transition:color .16s ease}',
      '.ez-about-link:hover,.ez-about-link:focus-visible{color:var(--dsw-alias-brand-primary);text-decoration:underline;text-underline-offset:3px;outline:none}',
      '.ez-set-label{flex:none;width:68px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary)}',
      '.ez-set-slider{display:flex;flex:1 1 auto;align-items:center;gap:10px;min-width:0}',
      '.ez-range{flex:1 1 120px;max-width:240px;height:18px;margin:0;accent-color:var(--dsw-alias-brand-primary);background:transparent}',
      '.ez-set-value{flex:none;width:44px;text-align:right;font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.ez-text-field{box-sizing:border-box;flex:0 1 260px;min-width:0;height:28px;margin:0;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}',
      '.ez-text-field::placeholder{color:var(--dsw-alias-state-idle-primary)}',
      '.ez-text-field:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.ez-reset--inline{margin-left:auto}',
      '.ez-reset{box-sizing:border-box;margin:0;padding:4px 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-reset:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-error{display:flex;flex:none;align-items:center;gap:10px;margin-top:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}',
      '.ez-retry{box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:2px;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-retry:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.ez-body{display:flex;flex:1 1 auto;min-height:0}',
      '.ez-matrix{position:relative;display:grid;flex:1 1 auto;min-height:340px;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;margin-top:16px}',
      '.ez-matrix--cards{gap:14px}',
      '.ez-matrix--grid{gap:1px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--ez-radius,10px);background:var(--dsw-alias-border-l1);overflow:hidden}',
      '.ez-matrix--cross{gap:0;border:0;border-radius:var(--ez-radius,10px);overflow:hidden}',
      '.ez-matrix--cross::before{content:"";position:absolute;top:0;bottom:0;left:calc(var(--ez-col-ratio,.5) * 100%);width:1px;margin-left:-.5px;background:var(--dsw-alias-border-l1);z-index:1;pointer-events:none}',
      '.ez-matrix--cross::after{content:"";position:absolute;left:0;right:0;top:calc(var(--ez-row-ratio,.5) * 100%);height:1px;margin-top:-.5px;background:var(--dsw-alias-border-l1);z-index:1;pointer-events:none}',
      '.ez-split{position:absolute;left:calc(var(--ez-col-ratio,.5) * 100%);top:calc(var(--ez-row-ratio,.5) * 100%);z-index:6;box-sizing:border-box;display:grid;place-items:center;width:20px;height:20px;margin:-10px 0 0 -10px;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:50%;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);cursor:move;opacity:0;transition:opacity .12s ease,border-color .12s ease,color .12s ease;appearance:none;-webkit-appearance:none}',
      '.ez-split.is-visible,.ez-split:focus-visible{opacity:1}',
      '.ez-split-dot{display:block;width:6px;height:6px;border-radius:50%;background:currentColor}',
      '.ez-split:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.ez-split:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-split.is-dragging{opacity:1;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.ez-split.is-snap{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent)}',
      '.ez-split-center{position:absolute;left:50%;top:50%;z-index:5;width:0;height:0;pointer-events:none;color:var(--dsw-alias-brand-primary);opacity:.85;transition:opacity .12s ease}',
      '.ez-split-center-h{position:absolute;left:-28px;top:-.5px;width:56px;height:1px;background:linear-gradient(to right,transparent,currentColor 22%,currentColor 78%,transparent);opacity:.55;transition:opacity .12s ease}',
      '.ez-split-center-v{position:absolute;top:-28px;left:-.5px;height:56px;width:1px;background:linear-gradient(to bottom,transparent,currentColor 22%,currentColor 78%,transparent);opacity:.55;transition:opacity .12s ease}',
      '.ez-split-center-dot{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.9;transition:transform .12s ease,box-shadow .12s ease,opacity .12s ease}',
      '.ez-split-center.is-active{opacity:1}',
      '.ez-split-center.is-active .ez-split-center-h,.ez-split-center.is-active .ez-split-center-v{opacity:.95}',
      '.ez-split-center.is-active .ez-split-center-dot{opacity:1;transform:scale(1.35);box-shadow:0 0 0 4px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}',
      '@media (hover:none){.ez-split{opacity:1}}',
      '.ez-matrix--truncate .ez-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-break:normal}',
      '.ez-quad{box-sizing:border-box;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}',
      '.ez-matrix--cards .ez-quad{padding:12px 13px 9px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--ez-radius,10px);background:var(--dsw-alias-bg-layer-1)}',
      '.ez-matrix--grid .ez-quad{padding:12px 13px 9px;border:0;border-radius:0;background:var(--dsw-alias-bg-layer-1)}',
      '.ez-matrix--cross .ez-quad{padding:12px 13px 9px;border:0;border-radius:0;background:transparent}',
      '.ez-matrix--tint .ez-quad--q1{background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,var(--dsw-alias-bg-layer-1))}',
      '.ez-matrix--tint .ez-quad--q2{background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1))}',
      '.ez-matrix--tint .ez-quad--q3{background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,var(--dsw-alias-bg-layer-1))}',
      '.ez-matrix--tint .ez-quad--q4{background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-state-idle-primary) 9%,var(--dsw-alias-bg-layer-1))}',
      '.ez-quad-head{display:flex;flex:none;align-items:center;gap:7px;height:24px}',
      '.ez-dot{flex:none;width:6px;height:6px;border-radius:50%}',
      '.ez-quad--q1 .ez-dot{background:var(--dsw-alias-state-error-primary)}',
      '.ez-quad--q2 .ez-dot{background:var(--dsw-alias-brand-primary)}',
      '.ez-quad--q3 .ez-dot{background:var(--dsw-alias-state-warn-primary)}',
      '.ez-quad--q4 .ez-dot{background:var(--dsw-alias-state-idle-primary)}',
      '.ez-quad-name{margin:0;font-size:13px;line-height:1;font-weight:600;letter-spacing:.01em;white-space:nowrap}',
      '.ez-quad-hint{min-width:0;font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ez-quad-count{margin-left:auto;font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.ez-list{display:flex;flex:1 1 auto;flex-direction:column;gap:1px;min-height:0;margin:6px 0 0;padding:0;list-style:none;overflow-y:auto}',
      '.ez-row{display:flex;flex:none;align-items:flex-start;gap:8px;min-height:30px;padding:4px 2px 4px 3px;border-radius:7px}',
      '.ez-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.ez-check{box-sizing:border-box;flex:none;width:15px;height:15px;margin:calc((var(--ez-font-size,13px) * 1.55 - 15px) / 2) 0 0 0;padding:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
      '.ez-check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.ez-title{flex:1 1 auto;min-width:0;font-size:var(--ez-font-size,13px);line-height:1.55;white-space:normal;overflow-wrap:anywhere;word-break:break-word;cursor:text}',
      '.ez-title-input{flex:1 1 auto;min-width:0;margin:0;padding:0 0 1px;border:0;border-bottom:1px solid var(--dsw-alias-brand-primary,currentColor);border-radius:0;background:transparent;color:inherit;font:inherit;font-size:var(--ez-font-size,13px);line-height:1.55;outline:none;white-space:normal;overflow-wrap:anywhere;word-break:break-word}',
      '.ez-title--done{color:var(--dsw-alias-label-secondary);text-decoration:line-through;text-decoration-thickness:.5px}',
      '.ez-date{flex:none;margin-top:calc((var(--ez-font-size,13px) * 1.55 - 22px) / 2);font-size:calc(var(--ez-font-size,13px) * .82);line-height:22px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.ez-actions{display:flex;flex:none;align-items:center;justify-content:flex-end;gap:2px;width:0;overflow:hidden;margin-top:calc((var(--ez-font-size,13px) * 1.55 - 22px) / 2);opacity:0;transition:width .13s ease,opacity .13s ease}',
      '.ez-row:hover .ez-actions,.ez-row:focus-within .ez-actions{width:96px;opacity:1}',
      '@media (hover:none){.ez-actions{width:96px;opacity:1}}',
      '.ez-mini{box-sizing:border-box;display:grid;place-items:center;width:22px;height:22px;margin:0;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-mini:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.ez-mini.is-on{color:var(--dsw-alias-brand-primary)}',
      '.ez-mini:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-add-area{display:flex;flex:none;align-items:center;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.ez-date-field{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;margin:0;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-date-field--empty{flex:0 0 40px;width:40px;padding:0}',
      '.ez-date-field--set{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.ez-date-field:hover{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}',
      '.ez-date-field:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-picker{position:fixed;z-index:70;box-sizing:border-box;width:252px;padding:10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 16px 44px color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent);user-select:none}',
      '.ez-picker-head{display:flex;align-items:center;justify-content:space-between;gap:4px;height:28px;margin-bottom:6px}',
      '.ez-picker-title{font-size:12.5px;line-height:1;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.ez-picker-nav{box-sizing:border-box;display:grid;place-items:center;width:24px;height:24px;margin:0;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-picker-nav:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-picker-nav:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-picker-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}',
      '.ez-picker-grid--wd{margin-bottom:2px}',
      '.ez-picker-wd{display:grid;place-items:center;height:22px;font-size:10.5px;line-height:1;color:var(--dsw-alias-label-secondary)}',
      '.ez-picker-cell{display:block;height:28px}',
      '.ez-picker-day{box-sizing:border-box;display:grid;place-items:center;width:100%;height:28px;margin:0;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none;font-variant-numeric:tabular-nums}',
      '.ez-picker-day:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.ez-picker-day:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}',
      '.ez-picker-day.is-today{color:var(--dsw-alias-brand-primary);font-weight:600}',
      '.ez-picker-day.is-selected{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}',
      '.ez-picker-day.is-selected:hover{opacity:.9}',
      '.ez-picker-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.ez-picker-link{box-sizing:border-box;margin:0;padding:3px 5px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-picker-link:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
      '.ez-picker-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-picker-link:disabled{color:var(--dsw-alias-state-idle-primary);cursor:default}',
      '.ez-due{box-sizing:border-box;flex:none;display:inline-flex;align-items:center;height:22px;line-height:22px;margin:calc((var(--ez-font-size,13px) * 1.55 - 22px) / 2) 0 0 6px;padding:0 1px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:calc(var(--ez-font-size,13px) * .82);cursor:pointer;appearance:none;-webkit-appearance:none;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.ez-due:hover{color:var(--dsw-alias-label-primary)}',
      '.ez-due:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-radius:4px}',
      '.ez-due--today{color:var(--dsw-alias-state-warn-primary);font-weight:600}',
      '.ez-due--overdue{color:var(--dsw-alias-state-error-primary);font-weight:600}',
      '.ez-row[draggable=true]{cursor:grab}',
      '.ez-row[draggable=true]:active{cursor:grabbing}',
      '.ez-row.is-overdue .ez-title{color:var(--dsw-alias-state-error-primary)}',
      '.ez-row.is-dragging{opacity:.35}',
      '.ez-row.is-drop-before{box-shadow:inset 0 2px 0 var(--dsw-alias-brand-primary)}',
      '.ez-list.is-drop-end::after{content:"";display:block;flex:none;height:2px;margin:1px 2px 0;border-radius:2px;background:var(--dsw-alias-brand-primary)}',
      '.ez-quad.is-drop-target{outline:1px dashed var(--dsw-alias-brand-primary);outline-offset:-3px}',
      '.ez-toast{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;pointer-events:none;display:flex;align-items:center;gap:10px;max-width:min(360px,calc(100vw - 64px));padding:16px 24px;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:14.5px;line-height:1.5;box-shadow:0 16px 44px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);animation:ez-toast-in .24s ease-out}',
      '.ez-toast-mark{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-bg-overlay);font-size:12px;font-weight:700;line-height:1}',
      '.ez-toast--cheer{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,var(--dsw-alias-border-l2))}',
      '.ez-toast--cheer .ez-toast-mark{background:var(--dsw-alias-brand-primary);font-size:13px}',
      '@keyframes ez-toast-in{from{opacity:0;transform:translate(-50%,-50%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
      '.ez-add-input::placeholder{color:var(--dsw-alias-state-idle-primary)}',
      '.ez-quick-add{box-sizing:border-box;display:flex;align-items:center;gap:6px;height:26px;margin:0;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;cursor:pointer;opacity:.78;appearance:none;-webkit-appearance:none}',
      '.ez-quick-add:hover{opacity:1;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-quick-add:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-quick-plus{font-size:14px;line-height:1}',
      '.ez-add-input{box-sizing:border-box;flex:1 1 auto;min-width:0;width:auto;height:30px;margin:0;padding:0 9px;border:.5px solid var(--dsw-alias-brand-primary);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:var(--ez-font-size,13px);outline:none}',
      '.ez-add-input::placeholder{color:var(--dsw-alias-state-idle-primary)}',
      '.ez-completed{box-sizing:border-box;display:flex;flex:1 1 auto;flex-direction:column;min-height:0;margin-top:16px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
      '.ez-completed-head{display:flex;flex:none;align-items:center;gap:8px;padding:12px 13px 6px}',
      '.ez-completed-title{margin:0;font-size:13px;line-height:1;font-weight:600}',
      '.ez-completed-count{font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.ez-clear{box-sizing:border-box;margin:0 0 0 auto;padding:4px 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;appearance:none;-webkit-appearance:none}',
      '.ez-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.ez-clear.is-confirming{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}',
      '.ez-clear:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.ez-completed .ez-list{padding:0 11px 9px}',
      '.ez-completed-body{display:flex;flex:1 1 auto;min-height:0}',
      '.ez-blank{margin:0;padding:20px;font-size:12.5px;line-height:20px;text-align:center;color:var(--dsw-alias-label-secondary)}',
      '.ez-completed-body .ez-blank{margin:auto}',
      '@media (max-width:640px){.ez-inner{padding:16px 14px}.ez-matrix{min-height:420px;margin-top:12px}.ez-matrix--cards{gap:9px}.ez-matrix--cards .ez-quad,.ez-matrix--grid .ez-quad,.ez-matrix--cross .ez-quad{padding:10px 10px 7px}.ez-quad-hint{display:none}.ez-head-actions{width:100%;justify-content:space-between}.ez-set-label{width:100%}}',
      '@media (prefers-reduced-motion:reduce){.ez-actions{transition:none}}',
    ].join('\n');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'matrix-todo: dictionaries');
        const t = ctx.locale.bind(NS);
        // Detached service methods lose their receiver, so the page binds
        // through stable wrappers instead of passing `locale.subscribe` directly.
        const localeSource = Object.freeze({
          subscribe: (listener) => ctx.locale.subscribe(listener),
          getSnapshot: () => ctx.locale.getSnapshot(),
        });

        // The sidebar row text can be renamed from the settings panel. The slot
        // label is a thunk read on projection, so renaming re-registers the row
        // to make the sidebar show the new text immediately.
        let navOverride = '';
        let sidebarDisposer = null;

        const mountSidebarRow = () => {
          if (sidebarDisposer !== null) {
            sidebarDisposer();
            sidebarDisposer = null;
          }
          const disposer = ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: ORDER,
              label: () => (navOverride !== '' ? navOverride : t('nav.label')),
              locale: NS,
            },
            PanelIcon,
          );
          sidebarDisposer = typeof disposer === 'function' ? disposer : null;
        };

        const setNavLabel = (value) => {
          const next = typeof value === 'string' ? value.trim() : '';
          if (next === navOverride) return;
          navOverride = next;
          mountSidebarRow();
        };

        ctx.slots.inject('sidebar.panellist', () => {
          mountSidebarRow();
          return () => {
            if (sidebarDisposer !== null) {
              sidebarDisposer();
              sidebarDisposer = null;
            }
          };
        });

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ t, localeSource, setNavLabel }),
            },
            TodoPage,
          ),
        );
      },
    };
  },
});
