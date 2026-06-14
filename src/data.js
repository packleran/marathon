export const courseInfo = {
  name: 'מרתון מתמטיקה מתקדמת',
  subtitle: 'שיעורי תגבור לקראת מבחן סוף סמסטר | סמסטר ב׳ 2026',
  nextSession: '2026-06-18T18:00:00',
}

export const meetings = [
  {
    id: 1,
    date: '2026-06-18',
    dateDisplay: '18 ביוני',
    day: 'יום חמישי',
    time: '18:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
    title: 'חזרה על פרקים 1-3',
    description: 'סקירה מקיפה של יסודות הקורס — מרחבים וקטוריים, מטריצות, ודטרמיננטות. נפתור תרגילים מרכזיים מכל פרק.',
    status: 'upcoming',
    topics: ['מרחבים וקטוריים', 'מטריצות והעתקות', 'דטרמיננטות'],
    materials: {
      presentations: [
        { title: 'מצגת חזרה — פרקים 1-3', url: '#' },
        { title: 'דף נוסחאות מרוכז', url: '#' },
      ],
      exercises: [
        { title: 'דף תרגול #1 — מרחבים וקטוריים', url: '#' },
        { title: 'דף תרגול #2 — מטריצות', url: '#' },
        { title: 'דף תרגול #3 — דטרמיננטות', url: '#' },
      ],
      questions: [
        { question: 'מה ההבדל בין בסיס לקבוצה פורשת?', answer: 'בסיס הוא קבוצה פורשת שהיא גם בלתי תלויה לינארית — כלומר אין בה וקטורים מיותרים.' },
        { question: 'איך מוצאים ערכים עצמיים?', answer: 'פותרים את המשוואה det(A - λI) = 0, כלומר מוצאים את שורשי הפולינום האופייני.' },
      ],
    },
  },
  {
    id: 2,
    date: '2026-06-21',
    dateDisplay: '21 ביוני',
    day: 'יום ראשון',
    time: '18:00–21:00',
    location: 'זום — קישור בקבוצה',
    type: 'zoom',
    title: 'פרקים 4-6 + תרגול',
    description: 'נושאים מתקדמים — אינטגרלים כפולים ומשולשים, משפט גרין, ומשוואות דיפרנציאליות מסדר ראשון.',
    status: 'upcoming',
    topics: ['אינטגרלים כפולים', 'משפט גרין', 'מד"ר מסדר ראשון'],
    materials: {
      presentations: [
        { title: 'מצגת — אינטגרלים כפולים ומשולשים', url: '#' },
      ],
      exercises: [
        { title: 'דף תרגול #4 — אינטגרלים כפולים', url: '#' },
        { title: 'דף תרגול #5 — מד"ר', url: '#' },
      ],
      questions: [
        { question: 'מתי משתמשים בקואורדינטות פולריות?', answer: 'כשהתחום הוא מעגלי או חלק ממעגל, או כשהפונקציה מכילה x²+y².' },
      ],
    },
  },
  {
    id: 3,
    date: '2026-06-25',
    dateDisplay: '25 ביוני',
    day: 'יום חמישי',
    time: '18:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
    title: 'פתרון בחינות קודמות',
    description: 'פתרון מלא ומפורט של בחינת 2025א ו-2025ב. נעבור שאלה-שאלה עם טיפים לניהול זמן במבחן.',
    status: 'upcoming',
    topics: ['בחינה 2025א', 'בחינה 2025ב', 'טיפים למבחן'],
    materials: {
      presentations: [],
      exercises: [
        { title: 'בחינה 2025א — שאלון', url: '#' },
        { title: 'בחינה 2025א — פתרון', url: '#' },
        { title: 'בחינה 2025ב — שאלון', url: '#' },
        { title: 'בחינה 2025ב — פתרון', url: '#' },
      ],
      questions: [],
    },
  },
  {
    id: 4,
    date: '2026-06-28',
    dateDisplay: '28 ביוני',
    day: 'יום ראשון',
    time: '17:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
    title: 'מרתון סיכום כללי',
    description: 'מפגש אחרון — חזרה סופית על כל הנושאים, שאלות פתוחות, טיפים אחרונים, ותרגול אינטנסיבי.',
    status: 'upcoming',
    topics: ['חזרה כללית', 'שאלות פתוחות', 'טיפים למבחן'],
    materials: {
      presentations: [
        { title: 'סיכום כללי — כל הנושאים', url: '#' },
        { title: 'נוסחאון סופי', url: '#' },
      ],
      exercises: [
        { title: 'תרגיל סיכום מקיף', url: '#' },
      ],
      questions: [],
    },
  },
]

export const recordings = [
  {
    id: 1,
    title: 'חזרה על אלגברה לינארית — לכסון ומרחבים',
    date: '11 ביוני',
    duration: '2:34:00',
    meetingId: 1,
  },
  {
    id: 2,
    title: 'אינטגרלים כפולים — תרגול מודרך',
    date: '8 ביוני',
    duration: '1:52:00',
    meetingId: 2,
  },
  {
    id: 3,
    title: 'פתרון בחינה 2025א — חלק א׳',
    date: '4 ביוני',
    duration: '2:10:00',
    meetingId: 3,
  },
  {
    id: 4,
    title: 'מד"ר מסדר שני — שיטות פתרון',
    date: '1 ביוני',
    duration: '1:45:00',
    meetingId: 2,
  },
]

export const deadlines = [
  { id: 1, label: 'מועד א׳', date: '2026-07-08', display: '8 ביולי' },
  { id: 2, label: 'מועד ב׳', date: '2026-08-05', display: '5 באוגוסט' },
  { id: 3, label: 'הגשת תרגיל אחרון', date: '2026-06-22', display: '22 ביוני' },
]

export const resources = [
  {
    id: 1,
    title: 'תיקיית חומרים — Google Drive',
    description: 'סיכומים, דפי נוסחאות ותרגולים',
    icon: 'folder',
    url: '#',
  },
  {
    id: 2,
    title: 'אינדקס פתרונות בחינות',
    description: 'פתרונות מלאים 2020–2025',
    icon: 'pdf',
    url: '#',
  },
  {
    id: 3,
    title: 'פורום שאלות — דיסקורד',
    description: 'שאלו כל דבר, ענו אחד לשני',
    icon: 'link',
    url: '#',
  },
  {
    id: 4,
    title: 'דף נוסחאות מותר בבחינה',
    description: 'הגרסה המעודכנת — PDF',
    icon: 'pdf',
    url: '#',
  },
]
