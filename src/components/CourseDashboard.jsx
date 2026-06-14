import MeetingsCard from './MeetingsCard'
import TopicsCard from './TopicsCard'
import ResourcesCard from './ResourcesCard'
import RecordingsCard from './RecordingsCard'
import ScheduleCard from './ScheduleCard'
import { courseInfo } from '../data'

export default function CourseDashboard() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-indigo-600/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute top-20 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/[0.05] blur-[100px]" />

      <header className="relative border-b border-white/[0.06] px-6 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-medium text-indigo-300">סמסטר ב׳ 2026 — פעיל</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl bg-gradient-to-l from-white via-white to-zinc-400 bg-clip-text text-transparent">
            {courseInfo.name}
          </h1>
          <p className="mt-3 text-base text-zinc-500">{courseInfo.subtitle}</p>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MeetingsCard />
          <TopicsCard />
          <ResourcesCard />
          <RecordingsCard />
          <ScheduleCard />
        </div>
      </main>
    </div>
  )
}
