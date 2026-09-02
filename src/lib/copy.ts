/**
 * Every user-facing string, in one place.
 *
 * The interface is Hebrew and the layout is RTL, so this file is also the
 * switch: swapping it (or keying it by locale) is all a second language needs.
 * Code, comments and identifiers stay English.
 */

export const copy = {
  nav: {
    today: "היום",
    schedule: "לוח זמנים",
    tasks: "כל המשימות",
    projects: "פרויקטים",
  },

  sections: {
    big: "גדולות",
    medium: "בינוניות",
    routines: "שגרות",
    small: "קטנות",
    notes: "פתקים",
  },

  sizes: {
    big: "גדולה",
    medium: "בינונית",
    small: "קטנה",
  },

  compose: {
    big: "כתוב משימה גדולה…",
    medium: "הוסף משימה בינונית…",
    small: "הוסף משימה קטנה…",
    routine: "הוסף שגרה…",
    hint: "Enter להוספה · Esc לסגירה",
    detail: "הוסף שורה…",
  },

  routines: {
    /** Sunday first, matching weekday index 0…6. */
    weekdayInitials: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
    newTitle: "שגרה חדשה",
    editTitle: "עריכת שגרה",
    titlePlaceholder: "שם השגרה",
    recurrence: "חזרתיות",
    daily: "כל יום",
    weekdays: "ימים נבחרים",
    weekly: "שבועי",
    fixedTime: "שעה קבועה",
    fixedTimeHint: "אופציונלי. אם תגדיר שעה, השגרה תופיע בלוח מדי יום רלוונטי.",
    clearTime: "ללא שעה",
    save: "שמור",
    cancel: "ביטול",
    archive: "העבר לארכיון",
    restore: "החזר מהארכיון",
    archived: "בארכיון",
    showArchived: (n: number) => `הצג שגרות בארכיון (${n})`,
    hideArchived: "הסתר ארכיון",
    /** Shown next to a routine that is on the rail only for this date. */
    overrideToday: "שונה להיום בלבד",
    everyDay: "כל יום",
    onDays: (days: string) => `בימים ${days}`,
    onDay: (day: string) => `כל יום ${day}`,
  },

  actions: {
    size: "גודל",
    project: "פרויקט",
    noProject: "ללא פרויקט",
    plannedDate: "תאריך מתוכנן",
    dueDate: "דדליין",
    moveToToday: "העבר להיום",
    moveToTomorrow: "העבר למחר",
    pickDate: "בחר תאריך",
    clearPlannedDate: "הסר תאריך",
    clearDueDate: "הסר דדליין",
    archive: "העבר לארכיון",
    delete: "מחק",
    undo: "בטל",
  },

  buckets: {
    overdue: "באיחור",
    today: "היום",
    tomorrow: "מחר",
    upcoming: "בהמשך",
    none: "ללא תאריך",
  },

  allTasks: {
    title: "כל המשימות",
    subtitle: (n: number) => `${n} משימות פתוחות`,
    empty: "אין משימות פתוחות.",
    emptyFiltered: "אין משימות שמתאימות לסינון.",
    clearFilters: "נקה סינון",
    filterSize: "גודל",
    filterProject: "פרויקט",
    filterDate: "תאריך",
    due: (date: string) => `דדליין ${date}`,
    addTo: {
      overdue: "הוסף משימה באיחור…",
      today: "הוסף משימה להיום…",
      tomorrow: "הוסף משימה למחר…",
      upcoming: "הוסף משימה לתאריך…",
      none: "הוסף משימה ללא תאריך…",
    },
  },

  motto: {
    placeholder: "כתוב כאן כוונה ליום…",
    label: "הכוונה שלי",
  },

  settings: {
    title: "הגדרות",
    backupTitle: "גיבוי ושחזור",
    backupIntro:
      "הנתונים נשמרים אוטומטית בדפדפן הזה בלבד. הורד עותק כדי שיהיה לך גיבוי גם מחוץ לדפדפן.",
    download: "הורד גיבוי",
    restore: "שחזר מגיבוי",
    chooseFile: "בחר קובץ גיבוי",
    contains: (t: number, p: number, n: number) =>
      `${t} משימות · ${p} פרויקטים · ${n} פתקים`,
    currentData: "הנתונים כרגע",
    confirmTitle: "לשחזר מהגיבוי?",
    confirmBody: "כל הנתונים הקיימים בדפדפן הזה יוחלפו בתוכן הגיבוי. אי אפשר לבטל את הפעולה.",
    confirmFrom: (date: string) => `הגיבוי נוצר ב־${date}`,
    confirmRestore: "שחזר והחלף",
    cancel: "ביטול",
    restored: "השחזור הושלם.",
    errors: {
      "invalid-json": "הקובץ אינו JSON תקין. לא בוצע שום שינוי.",
      "not-a-backup": "הקובץ אינו קובץ גיבוי של האפליקציה. לא בוצע שום שינוי.",
      "too-new": "הגיבוי נוצר בגרסה חדשה יותר של האפליקציה. לא בוצע שום שינוי.",
      "malformed-data": "מבנה הגיבוי פגום. לא בוצע שום שינוי.",
    },
  },

  header: {
    empty: "עדיין ריק",
    progress: (done: number, total: number) => `${done} מתוך ${total} הושלמו`,
  },

  footer: {
    status: (done: number, open: number) => `${done} הושלמו · ${open} פתוחות`,
    closedAt: (time: string) => `היום נסגר ב-${time}`,
    wrapUp: "סיים את היום",
    reopen: "פתח מחדש את היום",
    reset: "אפס נתוני דמו",
  },

  wrapUp: {
    title: (weekday: string) => `סיכום ${weekday}`,
    finished: (n: number) => `סיימת ${n} דברים.`,
    remaining: (n: number) => `${n} עדיין פתוחות — החלט מה קורה עם כל אחת.`,
    nothingOpen: "אין שום דבר פתוח.",
    allDone: "זה הכול. אפשר לסגור את היום.",
    tomorrow: "מחר",
    toBacklog: "ללא תאריך",
    archive: "ארכיון",
    leave: "השאר",
    notNow: "לא עכשיו",
    close: "סגור את היום",
  },

  schedule: {
    title: "לוח זמנים",
    today: "היום",
    prevDay: "יום קודם",
    nextDay: "יום הבא",
    sidebarTitle: "משימות היום",
    unscheduledCount: (n: number) => (n === 0 ? "הכול שובץ" : `${n} עדיין לא שובצו`),
    noTasks: "אין משימות מתוכננות ליום הזה.",
    /** Shown when the day has items, but every one of them is already done. */
    allDone: "הכול הושלם להיום.",
    completedToday: (n: number) => `הושלמו היום (${n})`,
    routines: "שגרות",
    summary: (scheduled: number, total: number, hours: string) =>
      `${scheduled} מתוך ${total} משימות שובצו · ${hours} שעות מתוכננות`,
    unscheduled: "לא שובץ",

    workHours: "שעות עבודה",
    workHoursEmpty: "לא הוגדרו שעות עבודה ליום הזה",
    addWindow: "הוסף חלון",
    removeWindow: "הסר חלון",
    setDefaultHours: "הגדר 09:00–17:00",

    blocks: "זמן חסום",
    addBlock: "הוסף זמן חסום",
    blockTitlePlaceholder: "פגישה, נסיעה, הפסקה…",
    removeBlock: "הסר",

    outsideWork: "מחוץ לשעות העבודה",
    insideBlocked: "מתנגש עם זמן חסום",

    capacity: {
      work: "שעות עבודה",
      blocked: "חסום",
      scheduled: "משובץ",
      remaining: "נותר",
    },
  },

  projects: {
    title: "פרויקטים",
    subtitle: (n: number) => `${n} פרויקטים פעילים`,
    empty: "עדיין אין פרויקטים.",
    add: "פרויקט חדש…",
    namePlaceholder: "שם הפרויקט",
    descriptionPlaceholder: "תיאור קצר…",
    notesLabel: "פרטים",
    notesPlaceholder: "החלטות, לינקים, הקשר — כל מה שצריך להיות מתחת ליד.",
    color: "צבע",
    archive: "העבר לארכיון",
    restore: "החזר מהארכיון",
    showArchived: (n: number) => `הצג פרויקטים בארכיון (${n})`,
    hideArchived: "הסתר ארכיון",
    archivedLabel: "בארכיון",
    taskCount: (n: number) => (n === 1 ? "משימה אחת פתוחה" : `${n} משימות פתוחות`),
    noTasks: "אין עדיין משימות בפרויקט.",
    notFound: "הפרויקט לא נמצא.",
    open: "פתח",
    backToProjects: "חזרה לפרויקטים",
    addTask: "הוסף משימה לפרויקט…",
    /** Tomorrow and later share one group on a project page. */
    groupLater: "מחר ובהמשך",
  },

  notes: {
    empty: "לחץ בכל מקום כאן כדי להוסיף פתק",
    placeholder: "…",
    removed: "הפתק הוסר",
  },

  undo: {
    movedToToday: (title: string) => `״${title}״ הועברה להיום`,
    movedToTomorrow: (title: string) => `״${title}״ הועברה למחר`,
    movedToDate: (title: string, date: string) => `״${title}״ נקבעה ל־${date}`,
    plannedCleared: (title: string) => `התאריך של ״${title}״ הוסר`,
    archived: (title: string) => `״${title}״ הועברה לארכיון`,
    deleted: (title: string) => `״${title}״ נמחקה`,
    projectArchived: (name: string) => `הפרויקט ״${name}״ הועבר לארכיון`,
    routineArchived: (title: string) => `השגרה ״${title}״ הועברה לארכיון`,
    blockRemoved: (title: string) => `״${title}״ הוסר מהלוח`,
  },

  a11y: {
    toggleTask: (title: string, done: boolean) => `סמן את ״${title}״ כ${done ? "לא בוצעה" : "בוצעה"}`,
    toggleImportant: (title: string, important: boolean) =>
      important ? `בטל סימון חשיבות עבור ״${title}״` : `סמן את ״${title}״ כחשובה`,
    /** The rail's heart is an indicator, not a control — labelled, not focusable. */
    importantMark: "משימה חשובה",
    toggleRoutine: (title: string, done: boolean) => `סמן את השגרה ״${title}״ כ${done ? "לא בוצעה" : "בוצעה"}`,
    routineActions: (title: string) => `פעולות עבור השגרה ${title}`,
    routineTitle: "שם השגרה",
    toggleWeekday: (day: string) => `יום ${day}`,
    routineStart: "שעת התחלה קבועה",
    routineEnd: "שעת סיום קבועה",
    taskActions: (title: string) => `פעולות עבור ${title}`,
    reorder: (title: string) => `שנה סדר של ${title}`,
    taskTitle: "כותרת משימה",
    taskDetail: "פרטי משימה",
    plannedDateInput: "בחירת תאריך מתוכנן",
    dueDateInput: "בחירת דדליין",
    newTaskDate: "תאריך למשימה החדשה",
    newTaskSize: "גודל המשימה החדשה",
    projectName: "שם הפרויקט",
    projectDescription: "תיאור הפרויקט",
    projectNotes: "פרטי הפרויקט",
    projectActions: (name: string) => `פעולות עבור ${name}`,
    pickColor: (color: string) => `בחר צבע ${color}`,
    timeline: "ציר היום",
    dragTask: (title: string) => `גרור את ${title} ללוח`,
    resizeBlock: (title: string) => `שנה את משך ${title}`,
    blockStart: "שעת התחלה",
    blockEnd: "שעת סיום",
    blockTitle: "כותרת",
    currentTime: "השעה הנוכחית",
    note: "פתק",
    moveNote: "הזז פתק",
    removeNote: "הסר פתק",
  },
} as const;
