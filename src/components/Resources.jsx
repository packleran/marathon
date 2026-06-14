import { useState } from 'react'
import { resources } from '../data'

const tabs = [
  { key: 'pdfs', label: 'סיכומים', icon: '📄' },
  { key: 'exams', label: 'בחינות', icon: '📝' },
  { key: 'links', label: 'קישורים', icon: '🔗' },
]

function PdfItem({ item }) {
  return (
    <a
      href={item.url}
      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500 group-hover:bg-red-100 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="font-medium text-gray-700">{item.title}</span>
      </div>
      <span className="text-xs text-gray-400">{item.size}</span>
    </a>
  )
}

function ExamItem({ item }) {
  return (
    <a
      href={item.url}
      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="font-medium text-gray-700">{item.title}</span>
      </div>
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{item.year}</span>
    </a>
  )
}

function LinkItem({ item }) {
  return (
    <a
      href={item.url}
      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-500 group-hover:bg-green-100 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <div className="font-medium text-gray-700">{item.title}</div>
          <div className="text-xs text-gray-400">{item.description}</div>
        </div>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

export default function Resources() {
  const [activeTab, setActiveTab] = useState('pdfs')

  const renderContent = () => {
    switch (activeTab) {
      case 'pdfs':
        return resources.pdfs.map((item) => <PdfItem key={item.id} item={item} />)
      case 'exams':
        return resources.exams.map((item) => <ExamItem key={item.id} item={item} />)
      case 'links':
        return resources.links.map((item) => <LinkItem key={item.id} item={item} />)
    }
  }

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">חומרי לימוד</h2>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'
              }`}
            >
              <span className="ml-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">{renderContent()}</div>
      </div>
    </section>
  )
}
