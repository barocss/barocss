import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// BaroCSS가 로드된 후 React 앱 마운트
const appElement = document.getElementById('app')
if (appElement) {
  ReactDOM.createRoot(appElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
