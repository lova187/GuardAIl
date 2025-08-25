import { sendMetric } from './base44.js';

// Берём классы MediaPipe из window (после vision_bundle.js)
const { FilesetResolver, PoseLandmarker } = window;

let landmarker = null;

/**
 * Инициализация MediaPipe Pose Landmarker
 * @returns {Promise<PoseLandmarker>} Экземпляр landmarker
 * @throws {Error} Если MediaPipe не загружен или произошла ошибка инициализации
 */
export async function initPose() {
    if (!window.FilesetResolver || !window.PoseLandmarker) {
        const error = '[GuardAI] MediaPipe vision_bundle.js not loaded or blocked.';
        console.error(error);
        throw new Error(error);
    }

    try {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        
        landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        
        console.log('[GuardAI] Pose detection initialized successfully');
        return landmarker;
    } catch (e) {
        console.error('[GuardAI] initPose failed:', e);
        throw e;
    }
}

/**
 * Оценка правильности стойки на основе landmarks
 * @param {Array} lm - Массив landmarks от MediaPipe
 * @returns {Object} Объект с советами и хорошими аспектами стойки
 */
export function evaluateRules(lm) {
    if (!lm || lm.length === 0) {
        return { tips: ['לא זוהה אדם במצלמה'], good: [] };
    }

    const IDX = {
        NOSE: 0,
        LS: 11,    // Left Shoulder
        RS: 12,    // Right Shoulder
        LE: 13,    // Left Elbow
        RE: 14,    // Right Elbow
        LH: 23,    // Left Hip
        RH: 24     // Right Hip
    };
    
    const L = (i) => lm[i];
    const tips = [];
    const good = [];
    
    const nose = L(IDX.NOSE);
    const ls = L(IDX.LS), rs = L(IDX.RS);
    const le = L(IDX.LE), re = L(IDX.RE);
    const lh = L(IDX.LH), rh = L(IDX.RH);

    // Проверка положения головы относительно плеч
    if (nose && ls && rs) {
        const shoulderY = (ls.y + rs.y) / 2;
        const headOffset = nose.y - shoulderY;
        
        if (headOffset > 0.10) {
            tips.push("להוריד סנטר");
        } else if (headOffset < -0.03) {
            tips.push("להרים מעט את הסנטר");
        } else {
            good.push("ראש: תקין");
        }
    }

    // Проверка положения локтей
    if (le && re && lh && rh) {
        const torsoX = (lh.x + rh.x) / 2;
        const leftElbowSpread = Math.abs(le.x - torsoX);
        const rightElbowSpread = Math.abs(re.x - torsoX);
        const maxSpread = Math.max(leftElbowSpread, rightElbowSpread);
        
        if (maxSpread > 0.15) {
            tips.push("לקרב מרפקים לגוף");
        } else {
            good.push("מרפקים: תקין");
        }
    }

    return { tips, good };
}

/**
 * Рисование скелета на canvas
 * @param {CanvasRenderingContext2D} ctx - Контекст canvas
 * @param {HTMLCanvasElement} canvas - Canvas элемент
 * @param {Array} lm - Массив landmarks
 */
export function drawSkeleton(ctx, canvas, lm) {
    if (!ctx || !canvas || !lm) {
        console.warn('[GuardAI] drawSkeleton: Invalid parameters');
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#14b8a6';
    ctx.fillStyle = '#14b8a6';

    // Соединения между точками (плечи, локти, бедра и т.д.)
    const pairs = [
        [11, 13], // Left shoulder to left elbow
        [13, 15], // Left elbow to left wrist
        [12, 14], // Right shoulder to right elbow
        [14, 16], // Right elbow to right wrist
        [11, 12], // Left shoulder to right shoulder
        [23, 24], // Left hip to right hip
        [11, 23], // Left shoulder to left hip
        [12, 24]  // Right shoulder to right hip
    ];

    // Рисуем точки landmarks
    for (const point of lm) {
        if (!point || point.visibility < 0.5) continue;
        
        ctx.beginPath();
        ctx.arc(
            point.x * canvas.width, 
            point.y * canvas.height, 
            5, 0, Math.PI * 2
        );
        ctx.fill();
    }

    // Рисуем соединения
    for (const [a, b] of pairs) {
        const pointA = lm[a];
        const pointB = lm[b];
        
        if (!pointA || !pointB || 
            pointA.visibility < 0.5 || pointB.visibility < 0.5) continue;

        ctx.beginPath();
        ctx.moveTo(pointA.x * canvas.width, pointA.y * canvas.height);
        ctx.lineTo(pointB.x * canvas.width, pointB.y * canvas.height);
        ctx.stroke();
    }
}

/**
 * Запуск тренировочной сессии с анализом позы
 * @param {HTMLElement} $wrap - Контейнер с video и canvas элементами
 * @param {Function} onFeedback - Callback для получения обратной связи
 * @returns {Function} Функция для остановки сессии
 */
export async function startTraining($wrap, onFeedback) {
    const video = $wrap.querySelector('video');
    const canvas = $wrap.querySelector('canvas');
    
    if (!video || !canvas) {
        console.error('[GuardAI] Video or canvas element not found');
        return () => {};
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('[GuardAI] Cannot get canvas context');
        return () => {};
    }

    // Запрос доступа к камере
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });
        
        video.srcObject = stream;
        await video.play();
        console.log('[GuardAI] Camera access granted');
    } catch (e) {
        console.error('[GuardAI] Camera error:', e);
        alert('נראה שיש בעיה בהרשאת מצלמה. אפשר לאפשר מצלמה לדפדפן ולרענן?');
        return () => {};
    }

    // Функция для изменения размера canvas
    function resizeCanvas() {
        const rect = $wrap.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Устанавливаем CSS размеры для правильного отображения
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Инициализация landmarker если еще не инициализирован
    if (!landmarker) {
        try {
            await initPose();
        } catch (e) {
            console.error('[GuardAI] Failed to initialize pose detection:', e);
            return () => {};
        }
    }

    let running = true;
    let lastTime = performance.now();
    let correctStanceMs = 0;
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    function detectionLoop(currentTime) {
        if (!running) return;

        requestAnimationFrame(detectionLoop);

        // Проверяем готовность видео
        if (!video.videoWidth || !video.videoHeight) return;

        const deltaTime = currentTime - lastTime;
        if (deltaTime < FRAME_INTERVAL) return;

        lastTime = currentTime;

        try {
            const results = landmarker.detectForVideo(video, currentTime);
            
            if (results && results.landmarks && results.landmarks[0]) {
                const landmarks = results.landmarks[0];
                
                // Рисуем скелет
                drawSkeleton(ctx, canvas, landmarks);
                
                // Оцениваем стойку
                const feedback = evaluateRules(landmarks);
                onFeedback(feedback);
                
                // Подсчитываем время правильной стойки
                if (feedback.tips.length === 0) {
                    correctStanceMs += deltaTime;
                }
            } else {
                // Если поза не обнаружена
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                onFeedback({ tips: ['לא זוהה אדם במצלמה'], good: [] });
            }
        } catch (e) {
            console.error('[GuardAI] Detection error:', e);
        }
    }

    requestAnimationFrame(detectionLoop);

    // Функция остановки сессии
    return () => {
        running = false;
        window.removeEventListener('resize', resizeCanvas);
        
        try {
            const tracks = video.srcObject?.getTracks() || [];
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        } catch (e) {
            console.error('[GuardAI] Error stopping camera:', e);
        }

        sendMetric('session_end', { correctStanceMs });
        console.log(`[GuardAI] Training session ended. Correct stance time: ${Math.round(correctStanceMs)}ms`);
    };
}
