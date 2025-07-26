document.addEventListener('DOMContentLoaded', () => {
    // ## Globale Zustandsvariablen ##
    let audioFiles = [];
    let currentIndex = 0;
    let categorization = {};
    let folderIdentifier = ''; // Eindeutiger Name für den Ordner
    let audioContext;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ALLOWED_EXTENSIONS = ["wav", "mp3", "flac", "ogg", "m4a", "opus"];

    // ## HTML-Elemente ##
    const mainTitle = document.getElementById('main-title');
    const uploadSection = document.getElementById('upload-section');
    const mainApp = document.getElementById('main-app');
    const finishSection = document.getElementById('finish-section');
    
    const startButton = document.getElementById('start-button');
    const fileInput = document.getElementById('file-input');
    const audioPlayer = document.getElementById('audio-player');
    const fileInfo = document.getElementById('file-info');
    const categoryButtonsContainer = document.getElementById('category-buttons');
    const newClassEntry = document.getElementById('new-class-entry');
    const addClassButton = document.getElementById('add-class-button');
    const downloadButton = document.getElementById('download-button');
    const restartButton = document.getElementById('restart-button');

    const canvas = document.getElementById('spectrogram-canvas');
    const canvasCtx = canvas.getContext('2d');

    // ## Kernfunktionen ##

    function resetApp() {
        uploadSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
        finishSection.classList.add('hidden');
        
        audioFiles = [];
        currentIndex = 0;
        categorization = {};
        folderIdentifier = '';
        fileInput.value = '';
        mainTitle.textContent = 'Lokaler Audio Kategorisierer';
        categoryButtonsContainer.innerHTML = '';
    }
    
    function initializeCategorization() {
        const savedProgress = JSON.parse(localStorage.getItem(`progress-${folderIdentifier}`));
        if (savedProgress) {
            const continue_ = confirm('Gespeicherter Fortschritt für diesen Ordner gefunden. Möchten Sie weitermachen?');
            if (continue_) {
                currentIndex = savedProgress.currentIndex;
                categorization = savedProgress.categorization;
                savedProgress.categories.forEach(createCategoryButton);
            } else {
                localStorage.removeItem(`progress-${folderIdentifier}`);
            }
        }
        uploadSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadNextAudio();
    }

    async function loadNextAudio() {
        if (currentIndex >= audioFiles.length) {
            showFinishScreen();
            return;
        }
        const file = audioFiles[currentIndex];
        fileInfo.textContent = `Datei: ${file.name} (${currentIndex + 1}/${audioFiles.length})`;
        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        audioPlayer.onended = () => URL.revokeObjectURL(objectURL);
        audioPlayer.play().catch(e => console.error("Abspielfehler:", e));
        await drawSpectrogram(file);
    }

    function categorize(category) {
        const filename = audioFiles[currentIndex].name;
        categorization[filename] = category;
        currentIndex++;
        saveProgress();
        loadNextAudio();
    }
    
    function showFinishScreen() {
        mainApp.classList.add('hidden');
        finishSection.classList.remove('hidden');
        const categoryCount = new Set(Object.values(categorization)).size;
        document.getElementById('finish-summary').textContent = 
            `Du hast ${Object.keys(categorization).length} Dateien in ${categoryCount} Kategorien sortiert.`;
        localStorage.removeItem(`progress-${folderIdentifier}`);
    }

    // ## Fortschritt Speichern & Laden ##
    function saveProgress() {
        const categories = [...categoryButtonsContainer.children].map(btn => btn.textContent);
        const progress = { currentIndex, categorization, categories };
        localStorage.setItem(`progress-${folderIdentifier}`, JSON.stringify(progress));
    }
    
    // ## Hilfsfunktionen & Event Listeners ##
    function createCategoryButton(categoryName) {
        if ([...categoryButtonsContainer.children].some(btn => btn.textContent === categoryName)) return;
        const button = document.createElement('button');
        button.textContent = categoryName;
        button.addEventListener('click', () => categorize(categoryName));
        categoryButtonsContainer.appendChild(button);
    }
    
    startButton.addEventListener('click', () => {
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Bitte wähle zuerst einen Ordner aus.");
            return;
        }
        const allFiles = [...fileInput.files];
        audioFiles = allFiles.filter(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            return ALLOWED_EXTENSIONS.includes(extension);
        }).sort((a, b) => a.name.localeCompare(b.name));
        if (audioFiles.length === 0) {
            alert("Der ausgewählte Ordner enthält keine unterstützten Audiodateien.");
            return;
        }
        folderIdentifier = audioFiles[0].webkitRelativePath.split('/')[0];
        mainTitle.textContent = `Kategorisiere: ${folderIdentifier}`;
        initializeCategorization();
    });

    addClassButton.addEventListener('click', () => {
        const newClassName = newClassEntry.value.trim();
        if (newClassName) {
            createCategoryButton(newClassName);
            newClassEntry.value = '';
            saveProgress();
        }
    });

    downloadButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(categorization, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sortierung-${folderIdentifier}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    restartButton.addEventListener('click', resetApp);
    document.getElementById('replay-button').addEventListener('click', () => audioPlayer.play());
    newClassEntry.addEventListener('keypress', (e) => { if (e.key === 'Enter') addClassButton.click(); });

    // ====================================================================
    // ## NEU: Überarbeitete Funktion zur Spektrogramm-Erstellung ##
    // ====================================================================
    async function drawSpectrogram(file) {
        if (!audioContext) audioContext = new AudioContext();

        // Canvas leeren und Lade-Status anzeigen
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.font = "16px Arial";
        canvasCtx.fillStyle = "black";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText("Spektrogramm wird generiert...", canvas.width/2, canvas.height/2);

        const arrayBuffer = await file.arrayBuffer();
        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Die FFT-Größe bestimmt die vertikale Auflösung (Frequenz)
            const fftSize = 2048; 

            // Ein OfflineAudioContext analysiert die Datei so schnell wie möglich im Hintergrund
            const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 44100, 44100);
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;

            // Der Analyser-Knoten führt die FFT durch
            const analyser = offlineCtx.createAnalyser();
            analyser.fftSize = fftSize;
            const frequencyBinCount = analyser.frequencyBinCount; // = fftSize / 2

            // Ein ScriptProcessorNode zerlegt das Signal in Blöcke
            // HINWEIS: Dies ist eine ältere API, aber für diesen Zweck am einfachsten
            const processor = offlineCtx.createScriptProcessor(fftSize, 1, 1);
            
            const spectrogramData = []; // Hier speichern wir alle FFT-Ergebnisse (Spalten)

            // Dieser Event-Handler wird für jeden Audio-Block aufgerufen
            processor.onaudioprocess = () => {
                const data = new Uint8Array(frequencyBinCount);
                analyser.getByteFrequencyData(data);
                spectrogramData.push([...data]); // Kopie des Ergebnisses speichern
            };
            
            // Die Knoten verbinden: Quelle -> Analyser -> Prozessor -> Ziel
            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(offlineCtx.destination);
            
            source.start(0);
            await offlineCtx.startRendering(); // Analyse im Hintergrund starten

            // -- Das eigentliche Zeichnen auf das Canvas --
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const numSlices = spectrogramData.length; // Anzahl der vertikalen Spalten
            const numFreqs = spectrogramData[0].length; // Anzahl der Frequenzbänder (vertikal)
            
            for (let i = 0; i < numSlices; i++) { // Jede Spalte (Zeit) durchgehen
                for (let j = 0; j < numFreqs; j++) { // Jedes Frequenzband (Pixel in der Spalte) durchgehen
                    const value = spectrogramData[i][j]; // Amplitude (0-255)
                    const percent = value / 255;
                    
                    // Farbwert berechnen (z.B. Graustufen oder ein Farbverlauf)
                    // Hier ein klassischer "Wärme"-Farbverlauf: schwarz -> blau -> rot -> gelb
                    const hue = 260 * (1 - percent); // 260 (blau) -> 0 (rot)
                    const saturation = '100%';
                    const lightness = `${50 * percent}%`; // Helligkeit von Intensität abhängig machen

                    canvasCtx.fillStyle = `hsl(${hue}, ${saturation}, ${lightness})`;

                    // Position berechnen und Pixel zeichnen
                    const x = (i / numSlices) * canvas.width;
                    const y = canvas.height - (j / numFreqs) * canvas.height;
                    const barWidth = (canvas.width / numSlices) + 1; // +1, um Lücken zu vermeiden
                    const barHeight = (canvas.height / numFreqs) + 1;

                    canvasCtx.fillRect(x, y, barWidth, barHeight);
                }
            }

        } catch (e) {
            console.error('Fehler bei der Audio-Analyse:', e);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.font = "16px Arial";
            canvasCtx.fillStyle = "red";
            canvasCtx.textAlign = "center";
            canvasCtx.fillText("Audio konnte nicht analysiert werden.", canvas.width/2, canvas.height/2);
        }
    }
});