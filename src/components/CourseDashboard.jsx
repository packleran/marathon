import { useState } from 'react'
import Header from './Header'
import MeetingsSection from './MeetingsSection'
import RecordingsSection from './RecordingsSection'
import Sidebar from './Sidebar'

const tabs = [
  { key: 'meetings', label: 'מפגשים' },
  { key: 'recordings', label: 'הקלטות' },
]

export default function CourseDashboard() {
  const [activeTab, setActiveTab] = useState('meetings')

  return (
    <div className="min-h-screen bg-[#fafbfd]">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-8 flex items-center gap-1 rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 min-w-0">
            {activeTab === 'meetings' && <MeetingsSection />}
            {activeTab === 'recordings' && <RecordingsSection />}
          </div>
          <Sidebar />
        </div>
      </main>
    </div>
  )
}
