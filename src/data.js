export const courseInfo = {
  name: 'מרתון מתמטיקה מתקדמת',
  subtitle: 'שיעורי תגבור לקראת מבחן סוף סמסטר | סמסטר ב׳ 2026',
  nextSession: '2026-06-18T18:00:00',
}

export const meetings = [
  {
    id: 1,
    date: '18 ביוני',
    day: 'יום חמישי',
    time: '18:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
  },
  {
    id: 2,
    date: '21 ביוני',
    day: 'יום ראשון',
    time: '18:00–21:00',
    location: 'זום — קישור בקבוצה',
    type: 'zoom',
  },
  {
    id: 3,
    date: '25 ביוני',
    day: 'יום חמישי',
    time: '18:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
  },
  {
    id: 4,
    date: '28 ביוני',
    day: 'יום ראשון',
    time: '17:00–21:00',
    location: 'חדר 205, בניין הנדסה',
    type: 'in-person',
  },
]

export const topics = [
  {
    id: 1,
    name: 'אלגברה לינארית',
    description: 'מרחבים וקטוריים, ערכים עצמיים, לכסון מטריצות',
    color: 'indigo',
  },
  {
    id: 2,
    name: 'חשבון אינפיניטסימלי 2',
    description: 'אינטגרלים כפולים ומשולשים, משפט גרין ושטוקס',
    color: 'violet',
  },
  {
    id: 3,
    name: 'משוואות דיפרנציאליות',
    description: 'מד"ר מסדר ראשון ושני, שיטת מקדמים לא ידועים',
    color: 'blue',
  },
  {
    id: 4,
    name: 'טורים ופונקציות',
    description: 'טורי חזקות, טורי פורייה, התכנסות',
    color: 'cyan',
  },
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

export const recordings = [
  {
    id: 1,
    title: 'חזרה על אלגברה לינארית — לכסון ומרחבים',
    date: '11 ביוני',
    duration: '2:34:00',
    thumbnail: 'linear-algebra',
  },
  {
    id: 2,
    title: 'אינטגרלים כפולים — תרגול מודרך',
    date: '8 ביוני',
    duration: '1:52:00',
    thumbnail: 'calculus',
  },
  {
    id: 3,
    title: 'פתרון בחינה 2025א — חלק א׳',
    date: '4 ביוני',
    duration: '2:10:00',
    thumbnail: 'exam-solve',
  },
  {
    id: 4,
    title: 'מד"ר מסדר שני — שיטות פתרון',
    date: '1 ביוני',
    duration: '1:45:00',
    thumbnail: 'ode',
  },
]

export const deadlines = [
  { id: 1, label: 'מועד א׳', date: '2026-07-08', display: '8 ביולי' },
  { id: 2, label: 'מועד ב׳', date: '2026-08-05', display: '5 באוגוסט' },
  { id: 3, label: 'הגשת תרגיל אחרון', date: '2026-06-22', display: '22 ביוני' },
]
