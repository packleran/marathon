import Header from './components/Header'
import Schedule from './components/Schedule'
import Resources from './components/Resources'
import FAQ from './components/FAQ'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Schedule />
      <Resources />
      <FAQ />
      <footer className="py-8 text-center text-sm text-gray-400 border-t border-gray-100">
        <p>מרתון הכנה לבחינה &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
