import MeetingsCard from './MeetingsCard'
import TopicsCard from './TopicsCard'
import ResourcesCard from './ResourcesCard'
import RecordingsCard from './RecordingsCard'
import ScheduleCard from './ScheduleCard'
import { courseInfo } from '../data'

export default function CourseDashboard() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {courseInfo.name}
          </h1>
          <p className="mt-2 text-base text-slate-500">{courseInfo.subtitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
