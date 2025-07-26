document.addEventListener('DOMContentLoaded', () => {
    // ## Globale Zustandsvariablen ##
    let audioFiles = [];
    let currentIndex = 0;
    let categorization = {};
    let folderIdentifier = '';
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

    // ====================================================================
    // ## NEU: Helferfunktionen für die Mel-Skala ##
    // ====================================================================

    /** Wandelt eine Frequenz von Hertz in Mel um. */
    function hzToMel(hz) {
        return 2595 * Math.log10(1 + hz / 700);
    }

    /** Wandelt einen Mel-Wert zurück in Hertz um. */
    function melToHz(mel) {
        return 700 * (Math.pow(10, mel / 2595) - 1);
    }

    /** Erstellt eine Mel-Filterbank. */
    function createMelFilterbank(fftSize, sampleRate, numBands, minHz, maxHz) {
        const minMel = hzToMel(minHz);
        const maxMel = hzToMel(maxHz);
        const melPoints = new Float32Array(numBands + 2);
        const hzPoints = new Float32Array(numBands + 2);
        const fftBinIndices = new Uint32Array(numBands + 2);
        const filterbank = [];

        // 1. Erzeuge linear verteilte Punkte auf der Mel-Skala
        for (let i = 0; i < melPoints.length; i++) {
            melPoints[i] = minMel + i * (maxMel - minMel) / (numBands + 1);
            hzPoints[i] = melToHz(melPoints[i]);
            fftBinIndices[i] = Math.floor((fftSize + 1) * hzPoints[i] / sampleRate);
        }

        // 2. Erzeuge die dreieckigen Filter
        for (let i = 0; i < numBands; i++) {
            const filter = new Float32Array(fftSize / 2);
            const startIdx = fftBinIndices[i];
            const centerIdx = fftBinIndices[i + 1];
            const endIdx = fftBinIndices[i + 2];

            for (let j = startIdx; j < centerIdx; j++) {
                filter[j] = (j - startIdx) / (centerIdx - startIdx);
            }
            for (let j = centerIdx; j < endIdx; j++) {
                filter[j] = (endIdx - j) / (endIdx - centerIdx);
            }
            filterbank.push(filter);
        }
        return filterbank;
    }

    // ## Kernfunktionen (größtenteils unverändert) ##
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
    
    // ... weitere unveränderte Funktionen (categorize, showFinishScreen, saveProgress, etc.) ...
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
    function saveProgress() {
        const categories = [...categoryButtonsContainer.children].map(btn => btn.textContent);
        const progress = { currentIndex, categorization, categories };
        localStorage.setItem(`progress-${folderIdentifier}`, JSON.stringify(progress));
    }
    function createCategoryButton(categoryName) {
        if ([...categoryButtonsContainer.children].some(btn => btn.textContent === categoryName)) return;
        const button = document.createElement('button');
        button.textContent = categoryName;
        button.addEventListener('click', () => categorize(categoryName));
        categoryButtonsContainer.appendChild(button);
    }
    startButton.addEventListener('click', () => {
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Bitte wähle zuerst einen Ordner aus."); return;
        }
        const allFiles = [...fileInput.files];
        audioFiles = allFiles.filter(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            return ALLOWED_EXTENSIONS.includes(extension);
        }).sort((a, b) => a.name.localeCompare(b.name));
        if (audioFiles.length === 0) {
            alert("Der ausgewählte Ordner enthält keine unterstützten Audiodateien."); return;
        }
        folderIdentifier = audioFiles[0].webkitRelativePath.split('/')[0];
        mainTitle.textContent = `Kategorisiere: ${folderIdentifier}`;
        initializeCategorization();
    });
    addClassButton.addEventListener('click', () => {
        const newClassName = newClassEntry.value.trim();
        if (newClassName) { createCategoryButton(newClassName); newClassEntry.value = ''; saveProgress(); }
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
    // ## Überarbeitete Funktion zur Mel-Spektrogramm-Erstellung ##
    // ====================================================================
    async function drawSpectrogram(file) {
        if (!audioContext) audioContext = new AudioContext();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.font = "16px Arial";
        canvasCtx.fillStyle = "black";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText("Mel-Spektrogramm wird generiert...", canvas.width/2, canvas.height/2);

        const arrayBuffer = await file.arrayBuffer();
        try {
            const audioBuffer = await audioContext.decodeData(arrayBuffer);
            const fftSize = 2048;
            const sampleRate = audioBuffer.sampleRate;
            
            // ** NEU: Parameter für Mel-Filterbank **
            const numMelBands = 128; // Vertikale Auflösung des Mel-Spektrogramms
            const minHz = 100;       // Minimale Frequenz laut Anforderung
            const maxHz = 5000;      // Maximale Frequenz laut Anforderung

            // ** NEU: Filterbank erstellen **
            const melFilterbank = createMelFilterbank(fftSize, sampleRate, numMelBands, minHz, maxHz);

            const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            const analyser = offlineCtx.createAnalyser();
            analyser.fftSize = fftSize;
            const processor = offlineCtx.createScriptProcessor(fftSize, 1, 1);
            
            const linearSpectrogram = [];
            processor.onaudioprocess = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                linearSpectrogram.push([...data]);
            };
            
            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(offlineCtx.destination);
            source.start(0);
            await offlineCtx.startRendering();

            // ** NEU: Lineares Spektrogramm in Mel-Spektrogramm umwandeln **
            const melSpectrogram = [];
            let maxMelEnergy = 0;
            for (const linearFrame of linearSpectrogram) {
                const melFrame = new Float32Array(numMelBands);
                for (let i = 0; i < numMelBands; i++) {
                    let melEnergy = 0;
                    for (let j = 0; j < linearFrame.length; j++) {
                        melEnergy += linearFrame[j] * melFilterbank[i][j];
                    }
                    melFrame[i] = melEnergy;
                    if (melEnergy > maxMelEnergy) maxMelEnergy = melEnergy;
                }
                melSpectrogram.push(melFrame);
            }

            // -- Das eigentliche Zeichnen des Mel-Spektrogramms --
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const numSlices = melSpectrogram.length;
            
            for (let i = 0; i < numSlices; i++) {
                for (let j = 0; j < numMelBands; j++) {
                    // Energie auf einen Wert zwischen 0 und 1 normalisieren (logarithmisch)
                    const value = Math.log10(1 + melSpectrogram[i][j]) / Math.log10(1 + maxMelEnergy);
                    
                    const hue = 260 * (1 - value);
                    const saturation = '100%';
                    const lightness = `${50 * value}%`;
                    canvasCtx.fillStyle = `hsl(${hue}, ${saturation}, ${lightness})`;

                    const x = (i / numSlices) * canvas.width;
                    const y = canvas.height - (j / numMelBands) * canvas.height;
                    const barWidth = (canvas.width / numSlices) + 1;
                    const barHeight = (canvas.height / numMelBands) + 1;

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