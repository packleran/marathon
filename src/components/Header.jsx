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

export default function Header({ course }) {
  const gradient = gradients[course.color]

  return (
    <header className={`relative overflow-hidden bg-gradient-to-l ${gradient}`}>
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDcpIi8+PC9zdmc+')] opacity-60" />
      <div className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-l from-transparent to-white/[0.04]" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3.5 py-1.5 mb-4 border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className={`text-xs font-medium ${badgeColors[course.color]}`}>
            המרתון פעיל — {course.meetings.length} מפגשים
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-5xl">
          {course.name}
        </h1>
        <p className={`mt-2.5 text-base ${subtitleColors[course.color]} max-w-xl`}>{course.subtitle}</p>
      </div>
    </header>
  )
}
