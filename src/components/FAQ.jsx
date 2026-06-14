import { useState } from 'react'
import { faqItems } from '../data'

function FAQItem({ item }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-right hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span className="font-medium text-gray-800">{item.question}</span>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 mr-4 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">
            {item.answer}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FAQ() {
  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">שאלות נפוצות</h2>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <FAQItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
