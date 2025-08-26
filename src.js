import React from 'react'
import ReactDOM from 'react-dom/client'
import GuardAI from './GuardAI.jsx'
import './index.css'

// Проверяем загрузку MediaPipe
const checkMediaPipeLoaded = () => {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (window.FilesetResolver && window.PoseLandmarker) {
        clearInterval(checkInterval);
        console.log('✅ MediaPipe loaded successfully');
        resolve(true);
      }
    }, 100);
    
    // Timeout через 10 секунд
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('⚠️ MediaPipe loading timeout');
      resolve(false);
    }, 10000);
  });
};

// Инициализация приложения
const initApp = async () => {
  const mediaipeLoaded = await checkMediaPipeLoaded();
  
  if (!mediaipeLoaded) {
    console.error('❌ MediaPipe failed to load');
    // Все равно запускаем приложение, но без pose detection
  }
  
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <GuardAI />
    </React.StrictMode>,
  );
};

// Запускаем приложение
initApp();
