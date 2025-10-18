import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import PdfReader from './components/PdfReader'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="flex justify-center gap-8 mb-8">
          <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
            <img 
              src={viteLogo} 
              className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#646cffaa]" 
              alt="Vite logo" 
            />
          </a>
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
            <img 
              src={reactLogo} 
              className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] animate-[spin_20s_linear_infinite]" 
              alt="React logo" 
            />
          </a>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-8">
          Vite + React + TypeScript
        </h1>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 mb-8 border border-gray-700">
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => setCount((count) => count + 1)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              count is {count}
            </button>
            <p className="text-gray-300">這是示範按鈕</p>
          </div>
        </div>

        <div className="mt-10">
          <PdfReader />
        </div>
      </div>
    </div>
  )
}

export default App
