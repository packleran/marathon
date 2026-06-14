import { useState, useEffect } from 'react'
import { courseInfo } from '../data'

function getTimeLeft(targetDate) {
  const diff = new Date(targetDate) - new Date()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)
  return { days, hours, minutes, seconds }
}

export default function Header() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(courseInfo.nextSession))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(courseInfo.nextSession))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="bg-gradient-to-l from-indigo-600 to-purple-700 text-white py-12 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
          {courseInfo.name}
        </h1>
        <p className="text-indigo-100 text-lg mb-8">{courseInfo.subtitle}</p>

        {timeLeft && (
          <div className="mt-6">
            <p className="text-indigo-200 text-sm mb-3">המפגש הבא מתחיל בעוד</p>
            <div className="flex justify-center gap-4">
              {[
                { value: timeLeft.days, label: 'ימים' },
                { value: timeLeft.hours, label: 'שעות' },
                { value: timeLeft.minutes, label: 'דקות' },
                { value: timeLeft.seconds, label: 'שניות' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[72px]"
                >
                  <div className="text-3xl font-bold font-mono tabular-nums">
                    {String(item.value).padStart(2, '0')}
                  </div>
                  <div className="text-indigo-200 text-xs mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
