const gradients = {
  sky: 'from-sky-600 via-blue-600 to-indigo-700',
  violet: 'from-violet-600 via-purple-600 to-indigo-700',
  emerald: 'from-emerald-600 via-teal-600 to-cyan-700',
}

const badgeColors = {
  sky: 'text-sky-100',
  violet: 'text-violet-100',
  emerald: 'text-emerald-100',
}

const subtitleColors = {
  sky: 'text-sky-200/80',
  violet: 'text-violet-200/80',
  emerald: 'text-emerald-200/80',
}

function BooksIllustration() {
  return (
    <div className="flex h-20 w-24 flex-shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-black/10 backdrop-blur-sm md:h-24 md:w-28">
      <svg aria-hidden="true" className="h-16 w-20 md:h-20 md:w-24" viewBox="0 0 96 78" fill="none">
        <path d="M18 59.5h58.5a5.5 5.5 0 0 1 0 11H18a5.5 5.5 0 0 1 0-11Z" fill="white" opacity=".18" />
        <rect x="15" y="22" width="16" height="42" rx="4" transform="rotate(-8 15 22)" fill="#F97316" />
        <rect x="17.5" y="27" width="10" height="3" rx="1.5" transform="rotate(-8 17.5 27)" fill="#FFEDD5" />
        <rect x="32" y="15" width="17" height="50" rx="4" fill="#38BDF8" />
        <rect x="35.5" y="21" width="10" height="3" rx="1.5" fill="#E0F2FE" />
        <rect x="51" y="24" width="16" height="42" rx="4" transform="rotate(7 51 24)" fill="#A78BFA" />
        <rect x="55" y="30" width="9" height="3" rx="1.5" transform="rotate(7 55 30)" fill="#F5F3FF" />
        <path d="M60.5 16.5c7.5-1.7 15 .8 19.5 6.5v36c-5.4-4.9-12.2-6.6-19.5-5.1v-37.4Z" fill="white" opacity=".92" />
        <path d="M60.5 16.5c-7.5-1.7-15 .8-19.5 6.5v36c5.4-4.9 12.2-6.6 19.5-5.1v-37.4Z" fill="#F8FAFC" opacity=".92" />
        <path d="M60.5 18v36" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
        <path d="M46.5 29.5c2.9-1.6 6-2.3 9.5-2.2M46.5 38c2.9-1.6 6-2.3 9.5-2.2M65 28c3.4-.6 6.4-.2 9 1.1M65 36.5c3.4-.6 6.4-.2 9 1.1" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default function Header({ course }) {
  const color = gradients[course.color] ? course.color : 'sky'
  const gradient = gradients[color]

  return (
    <header className={`relative overflow-hidden bg-gradient-to-l ${gradient}`}>
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDcpIi8+PC9zdmc+')] opacity-60" />
      <div className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-l from-transparent to-white/[0.04]" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <BooksIllustration />
            <h1 className="min-w-0 text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">
              מרתון עם רן פקלר
            </h1>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3.5 py-1.5 mb-4 border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className={`text-xs font-medium ${badgeColors[color]}`}>
            המרתון פעיל — {course.meetings.length} מפגשים
          </span>
        </div>

        <h2 className="text-2xl font-extrabold text-white md:text-3xl lg:text-4xl">
          {course.name}
        </h2>
        <p className={`mt-2.5 text-base ${subtitleColors[color]} max-w-xl`}>{course.subtitle}</p>
      </div>
    </header>
  )
}
