import { courseInfo } from '../data'

export default function Header() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-l from-sky-600 via-blue-600 to-indigo-700">
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDcpIi8+PC9zdmc+')] opacity-60" />
      <div className="pointer-events-none absolute top-0 left-0 h-full w-1/2 bg-gradient-to-l from-transparent to-white/[0.04]" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3.5 py-1.5 mb-4 border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-medium text-sky-100">המרתון פעיל — 4 מפגשים</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-5xl">
          {courseInfo.name}
        </h1>
        <p className="mt-2.5 text-base text-sky-200/80 max-w-xl">{courseInfo.subtitle}</p>
      </div>
    </header>
  )
}
