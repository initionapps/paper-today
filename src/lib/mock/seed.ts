/**
 * Mock day. Generated against whatever "today" is when the store first
 * initialises, so the day is never empty and never stale.
 *
 * Delete this file when Supabase lands; nothing but the store imports it.
 */
import { shiftDay, todayKey } from "@/lib/date";
import type {
  DayKey,
  Note,
  Project,
  Routine,
  RoutineLog,
  Task,
  TimeBlock,
  WorkWindow,
} from "@/lib/types";

let n = 0;
const id = (prefix: string) => `${prefix}_${(++n).toString(36)}`;

export interface Seed {
  projects: Project[];
  tasks: Task[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  timeBlocks: TimeBlock[];
  workWindows: WorkWindow[];
  notes: Note[];
}

export function buildSeed(day: DayKey = todayKey()): Seed {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 1000 * 60 * 90).toISOString();

  const projects: Project[] = [
    {
      id: "p_kite",
      name: "קייט",
      color: "blue",
      description: "המוצר עצמו — תמחור, אונבורדינג והשקה.",
      notes:
        "דנה מובילה את העיצוב, עמיר את הבקאנד.\nההשקה מתוכננת לסוף החודש — אבל התאריך עוד לא ננעל מול השיווק.\n\nהחלטה מ־3.8: לא נוגעים במבנה התמחור עד אחרי ההשקה.",
      order: 1,
      archivedAt: null,
    },
    {
      id: "p_writing",
      name: "כתיבה",
      color: "purple",
      description: "מיילים, הרצאות והספר.",
      notes: "לשמור על קול פשוט. בלי סימני קריאה, בלי סופרלטיבים.\nהפרק השני עדיין תקוע בהתחלה.",
      order: 2,
      archivedAt: null,
    },
    {
      id: "p_home",
      name: "בית",
      color: "teal",
      description: "כל מה שלא עבודה.",
      notes: "",
      order: 3,
      archivedAt: null,
    },
    {
      id: "p_old",
      name: "אתר ישן",
      color: "rose",
      description: "הועבר לארכיון אחרי המעבר לדומיין החדש.",
      notes: "",
      order: 4,
      archivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  ];

  const task = (t: Partial<Task> & Pick<Task, "title" | "size" | "order">): Task => ({
    id: id("t"),
    detail: null,
    projectId: null,
    status: "open",
    plannedDate: day,
    dueDate: null,
    isImportant: false,
    scheduledStartMin: null,
    scheduledEndMin: null,
    completedAt: null,
    createdAt: now,
    ...t,
  });

  const tasks: Task[] = [
    task({
      title: "לכתוב מחדש את רצף מיילי האונבורדינג",
      detail: "שלושה מיילים. שפה פשוטה, בלי סימני קריאה. טיוטה בלבד — לא ללטש.",
      size: "big",
      order: 1,
      projectId: "p_writing",
      scheduledStartMin: 9 * 60 + 30,
      scheduledEndMin: 11 * 60,
      dueDate: shiftDay(day, 2),
    }),
    task({
      title: "להעלות לאוויר את עמוד התמחור המחודש",
      detail: "להעביר לדנה לפני שהיא יוצאת בארבע.",
      size: "big",
      order: 2,
      projectId: "p_kite",
    }),

    task({
      title: "לעבור על ה-PR של עמיר — מקרי קצה בחיוב",
      size: "medium",
      order: 1,
      projectId: "p_kite",
      scheduledStartMin: 14 * 60,
      scheduledEndMin: 14 * 60 + 45,
    }),
    task({
      title: "להתקשר לרואה החשבון בנוגע לרבעון השלישי",
      size: "medium",
      order: 2,
      projectId: "p_home",
    }),
    task({
      title: "לבנות שלד להרצאה של יום שישי",
      size: "medium",
      order: 3,
      projectId: "p_writing",
      status: "done",
      completedAt: earlier,
    }),
    task({ title: "למצוא צלם להשקה", size: "medium", order: 4, projectId: "p_kite" }),

    task({ title: "לענות לנועה", size: "small", order: 1 }),
    task({ title: "להזמין פולי קפה", size: "small", order: 2, projectId: "p_home" }),
    task({ title: "לחדש את הדומיין", size: "small", order: 3, projectId: "p_kite" }),
    task({
      title: "להשקות את הצמחים",
      size: "small",
      order: 4,
      projectId: "p_home",
      status: "done",
      completedAt: earlier,
    }),
    task({ title: "להטעין את האוזניות", size: "small", order: 5 }),
    task({ title: "להעביר כסף לחיסכון", size: "small", order: 6, projectId: "p_home" }),

    // --- beyond today: what All Tasks exists to keep visible -----------------
    task({
      title: "להכין את סקירת הרבעון להנהלה",
      detail: "מספרים מהדשבורד, שלוש מסקנות, בלי נספחים.",
      size: "big",
      order: 1,
      projectId: "p_kite",
      plannedDate: shiftDay(day, 1),
      dueDate: shiftDay(day, 3),
    }),
    task({
      title: "לסגור מקום לאירוע ההשקה",
      size: "medium",
      order: 1,
      projectId: "p_kite",
      plannedDate: shiftDay(day, 1),
    }),
    task({
      title: "לחדש את הביטוח",
      size: "medium",
      order: 1,
      projectId: "p_home",
      plannedDate: shiftDay(day, 4),
      dueDate: shiftDay(day, 6),
    }),
    task({
      title: "לכתוב טיוטה לפרק השני",
      size: "big",
      order: 1,
      projectId: "p_writing",
      plannedDate: shiftDay(day, 6),
    }),

    // --- planned for a day that has passed, still open: the overdue group ----
    task({
      title: "לשלוח את החוזה החתום",
      size: "medium",
      order: 1,
      projectId: "p_kite",
      plannedDate: shiftDay(day, -2),
      dueDate: shiftDay(day, -1),
    }),

    // --- backlog: real tasks with no intended day ---------------------------
    task({
      title: "לחשוב על מבנה התמחור לשנה הבאה",
      size: "big",
      order: 1,
      projectId: "p_kite",
      plannedDate: null,
    }),
    task({
      title: "לארגן את הספרייה",
      size: "medium",
      order: 1,
      projectId: "p_home",
      plannedDate: null,
    }),
    task({ title: "למצוא קורס צילום", size: "small", order: 1, plannedDate: null }),
    task({ title: "לעדכן את קורות החיים", size: "small", order: 2, plannedDate: null }),
  ];

  const routine = (r: Omit<Routine, "fixedStartMin" | "fixedEndMin" | "archivedAt" | "createdAt"> &
    Partial<Pick<Routine, "fixedStartMin" | "fixedEndMin" | "archivedAt">>): Routine => ({
    fixedStartMin: null,
    fixedEndMin: null,
    archivedAt: null,
    createdAt: now,
    ...r,
  });

  const routines: Routine[] = [
    // a fixed time: drawn on the rail every weekday without dragging
    routine({
      id: "r_pages",
      title: "כתיבה חופשית בבוקר",
      weekdays: [0, 1, 2, 3, 4],
      order: 1,
      fixedStartMin: 8 * 60,
      fixedEndMin: 8 * 60 + 30,
    }),
    routine({ id: "r_walk", title: "הליכה לפני הצהריים", weekdays: [0, 1, 2, 3, 4, 5, 6], order: 2 }),
    routine({ id: "r_inbox", title: "לרוקן את תיבת המייל", weekdays: [0, 1, 2, 3, 4], order: 3 }),
    routine({ id: "r_read", title: "לקרוא עשרים עמודים", weekdays: [0, 1, 2, 3, 4, 5, 6], order: 4 }),
    // weekly: a single weekday
    routine({ id: "r_review", title: "סקירה שבועית", weekdays: [4], order: 5, fixedStartMin: 16 * 60, fixedEndMin: 17 * 60 }),
  ];

  const routineLogs: RoutineLog[] = [
    {
      id: id("rl"),
      routineId: "r_pages",
      day,
      completedAt: earlier,
      scheduledStartMin: null,
      scheduledEndMin: null,
    },
  ];

  // two windows with a gap in the middle, so the muted band is visible
  const workWindows: WorkWindow[] = [
    { id: id("w"), day, startMin: 9 * 60, endMin: 12 * 60 + 30 },
    { id: id("w"), day, startMin: 14 * 60, endMin: 17 * 60 + 30 },
  ];

  const timeBlocks: TimeBlock[] = [
    { id: id("b"), day, title: "סטנדאפ צוות", startMin: 9 * 60, endMin: 9 * 60 + 15 },
    { id: id("b"), day, title: "ארוחת צהריים", startMin: 12 * 60 + 30, endMin: 13 * 60 + 15 },
    { id: id("b"), day, title: "נסיעה למשרד הלקוח", startMin: 15 * 60 + 30, endMin: 16 * 60 + 15 },
  ];

  const notes: Note[] = [
    {
      id: id("n"),
      day,
      body: "לשאול את דנה אם אפשר פשוט למחוק את שורות התמחור הישנות, או שהמשפטית רוצה לשמור אותן לשנה.",
      color: "blue",
      x: 0.02,
      y: 0.05,
      rotation: 0,
      z: 1,
      createdAt: now,
    },
    {
      id: id("n"),
      day,
      body: "רעיון — מצב ״שבוע שקט״ שמסתיר הכול חוץ ממשימה אחת ליום.",
      color: "lavender",
      x: 0.33,
      y: 0.02,
      rotation: 0,
      z: 2,
      createdAt: now,
    },
    {
      id: id("n"),
      day,
      body: "רופא שיניים: שלישי או חמישי. לא בבוקר.",
      color: "mint",
      x: 0.64,
      y: 0.08,
      rotation: 0,
      z: 3,
      createdAt: now,
    },
  ];

  return { projects, tasks, routines, routineLogs, timeBlocks, workWindows, notes };
}
