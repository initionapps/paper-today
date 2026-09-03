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

  /**
   * The bottom bar on phones. Labels are shorter than the desktop nav's on
   * purpose — five of them share 360px, and "כל המשימות" does not fit under an
   * icon without wrapping or truncating.
   */
  mobileNav: {
    today: "היום",
    schedule: "לוח",
    tasks: "משימות",
    projects: "פרויקטים",
    more: "עוד",
    moreTitle: "עוד",
    close: "סגור",
  },

  auth: {
    signInTitle: "כניסה",
    signInSubtitle: "יום אחד, עמוד אחד.",
    signUpTitle: "יצירת חשבון",
    signUpSubtitle: "החשבון שלך פרטי לגמרי.",
    forgotTitle: "איפוס סיסמה",
    forgotSubtitle: "נשלח קישור לאיפוס הסיסמה לכתובת שלך.",
    resetTitle: "סיסמה חדשה",
    resetSubtitle: "בחר סיסמה חדשה לחשבון.",

    email: "אימייל",
    password: "סיסמה",
    newPassword: "סיסמה חדשה",

    signInAction: "היכנס",
    signUpAction: "צור חשבון",
    forgotAction: "שלח קישור",
    resetAction: "עדכן סיסמה",
    signOut: "יציאה",

    toSignUp: "אין לך חשבון? הרשמה",
    toSignIn: "כבר יש לך חשבון? כניסה",
    toForgot: "שכחת סיסמה?",
    backToSignIn: "חזרה לכניסה",

    working: "רגע…",

    /** Deliberately identical whether or not the address exists. */
    resetSent:
      "אם קיים חשבון עם הכתובת הזו, נשלח אליה קישור לאיפוס הסיסמה. בדוק גם בתיקיית הספאם.",
    confirmSent:
      "שלחנו קישור אישור לכתובת שלך. פתח אותו כדי להפעיל את החשבון.",

    /** Kept vague on purpose — never reveal whether the address is registered. */
    invalidCredentials: "האימייל או הסיסמה אינם נכונים.",
    emailNotConfirmed: "החשבון עדיין לא אושר. פתח את קישור האישור שנשלח אליך.",
    passwordTooShort: (min: number) => `הסיסמה חייבת להכיל לפחות ${min} תווים.`,
    emailRequired: "יש להזין כתובת אימייל.",
    passwordRequired: "יש להזין סיסמה.",
    linkExpired:
      "הקישור פג תוקף או כבר נוצל. אפשר לבקש קישור חדש ולנסות שוב.",
    genericError: "משהו השתבש. נסה שוב.",

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
    /** Mobile only: the three filter rows collapse behind one control. */
    search: "חיפוש משימות",
    searchClear: "נקה חיפוש",
    filterAction: "סינון",
    filterSheetTitle: "סינון",
    filterApply: "הצג תוצאות",
    activeFilters: "סינון פעיל",
    noSearchResults: "אין משימות שתואמות לחיפוש.",
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
      "הנתונים נשמרים בחשבון שלך ומסונכרנים לכל מכשיר שבו תתחבר. הורד עותק כדי שיהיה לך גיבוי גם מחוץ לחשבון.",
    download: "הורד גיבוי",
    restore: "שחזר מגיבוי",
    chooseFile: "בחר קובץ גיבוי",
    contains: (t: number, p: number, n: number) =>
      `${t} משימות · ${p} פרויקטים · ${n} פתקים`,
    currentData: "הנתונים כרגע",
    confirmTitle: "לשחזר מהגיבוי?",
    // Not "in this browser" any more — the data lives in the account, so a
    // restore replaces it everywhere the account is signed in, not just here.
    confirmBody: "כל הנתונים בחשבון שלך יימחקו ויוחלפו בתוכן הגיבוי. אי אפשר לבטל את הפעולה.",
    restoring: "משחזר…",
    restoreBlocked: "השחזור נעצר — יש רשומות שלא ניתן לשמור:",
    // The restore runs as one transaction, so a failure changed nothing. Say so
    // — the worry after a failed restore is "what state am I in now?".
    restoreFailed: "השחזור נכשל. שום דבר לא שונה — הנתונים שלך נשארו כפי שהיו.",
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

  /**
   * The one-time import of a browser's local data into the account. Every string
   * here has to be plain about what is about to happen to data the user cannot
   * afford to lose, so it names counts and never says "just" or "simply".
   */
  importPanel: {
    title: "נתונים מהדפדפן הזה",
    intro:
      "נמצאו נתונים ששמורים בדפדפן הזה מלפני המעבר לחשבון. אפשר לייבא אותם לחשבון שלך — פעם אחת.",
    found: "מה נמצא בדפדפן",
    motto: "כוונה",
    noMotto: "(ריקה)",
    projects: "פרויקטים",
    tasks: "משימות",
    routines: "שגרות",
    routineLogs: "רשומות שגרה",
    timeBlocks: "אירועים",
    workWindows: "חלונות עבודה",
    notes: "פתקים",
    dayLogs: "סיכומי יום",

    downloadFirst: "הורד גיבוי לפני הייבוא",
    downloaded: "הגיבוי הורד.",
    runImport: "ייבא לחשבון",
    importing: "מייבא…",

    blockedTitle: "הייבוא נעצר — יש רשומות שלא ניתן לשמור:",
    blockedHint: "לא נכתב שום דבר. תקן את הרשומות האלה באפליקציה ונסה שוב.",

    failedTitle: "הייבוא לא הושלם.",
    failedHint:
      "הנתונים בדפדפן לא שונו. אפשר ללחוץ שוב — הייבוא ממשיך מהנקודה שבה נעצר ולא ייצור כפילויות.",
    retry: "נסה שוב",

    reconcileTitle: "השוואה בין הדפדפן לחשבון",
    reconcileTable: "טבלה",
    reconcileLocal: "בדפדפן",
    reconcileRemote: "בחשבון",
    reconcileMissing: "חסר",

    doneTitle: "הייבוא הושלם.",
    doneBody:
      "כל הרשומות אומתו אחת-אחת בחשבון. העותק הישן נשמר בדפדפן תחת מפתח גיבוי ואינו בשימוש עוד.",

    archiveTitle: "העותק שלפני המעבר",
    archiveBody: "עותק הנתונים מלפני הייבוא עדיין שמור בדפדפן הזה.",
    downloadArchive: "הורד את העותק הישן",
    discardArchive: "מחק את העותק הישן",
    discardConfirm: "למחוק את העותק הישן מהדפדפן? אי אפשר לבטל.",
    discardConfirmAction: "מחק לצמיתות",
    cancel: "ביטול",
    discarded: "העותק הישן נמחק.",

    unreadable: "לא ניתן לקרוא את הנתונים בדפדפן:",
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
  },

  /**
   * Shown when a write did not reach the server. It says what is true — the
   * screen and the saved data disagree — rather than reassuring. The two cases
   * are worded differently on purpose: a failed write might work on a retry, a
   * cancelled one never will, because the account it belonged to is gone.
   */
  sync: {
    failed: (n: number) =>
      n === 1 ? "שינוי אחד לא נשמר" : `${n} שינויים לא נשמרו`,
    cancelled: "שינויים שלא נשמרו בוטלו כי החשבון המחובר השתנה",
    explain: "מה שמופיע כאן עדכני יותר ממה ששמור. טען מחדש כדי לראות את הנתונים השמורים.",
    reload: "טען מחדש מהשרת",
    dismiss: "התעלם",
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
