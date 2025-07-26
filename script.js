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
    // (Die meisten sind gleich, hier die neuen)
    const startButton = document.getElementById('start-button');
    const loadJsonButton = document.getElementById('load-json-button');
    const jsonLoadInput = document.getElementById('json-load-input');
    const saveJsonButton = document.getElementById('save-json-button');
    // (... Rest der Elemente)
    const mainTitle = document.getElementById('main-title');
    const uploadSection = document.getElementById('upload-section');
    const mainApp = document.getElementById('main-app');
    const finishSection = document.getElementById('finish-section');
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
    // ## Kernfunktionen & Zustandsmanagement ##
    // ====================================================================

    function resetApp() {
        uploadSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
        finishSection.classList.add('hidden');
        audioFiles = [];
        currentIndex = 0;
        categorization = {};
        folderIdentifier = '';
        fileInput.value = '';
        jsonLoadInput.value = '';
        mainTitle.textContent = 'Lokaler Audio Kategorisierer';
        categoryButtonsContainer.innerHTML = '';
        loadJsonButton.disabled = true;
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
        saveProgressToLocalStorage();
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

    // ====================================================================
    // ## Fortschritt Speichern & Laden (localStorage & JSON) ##
    // ====================================================================

    function saveProgressToLocalStorage() {
        const progress = {
            categorization,
            categories: [...categoryButtonsContainer.children].map(btn => btn.textContent)
        };
        localStorage.setItem(`progress-${folderIdentifier}`, JSON.stringify(progress));
    }

    function downloadProgressJSON() {
        // Diese Funktion wird für den manuellen Speichern-Button und am Ende verwendet
        const progress = {
            categorization,
            categories: [...categoryButtonsContainer.children].map(btn => btn.textContent)
        };
        const jsonString = JSON.stringify(progress, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sortierung-${folderIdentifier || 'fortschritt'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    function restoreStateFromData(progressData) {
        // Setzt den App-Zustand basierend auf geladenen Daten (von JSON oder localStorage)
        categorization = progressData.categorization || {};
        
        categoryButtonsContainer.innerHTML = '';
        (progressData.categories || []).forEach(createCategoryButton);

        // Finde den nächsten zu bearbeitenden Index
        currentIndex = audioFiles.findIndex(file => !categorization.hasOwnProperty(file.name));
        if (currentIndex === -1) currentIndex = audioFiles.length; // Alle sind schon fertig

        uploadSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadNextAudio();
    }


    // ====================================================================
    // ## Event Listeners ##
    // ====================================================================

    fileInput.addEventListener('change', () => {
        if (!fileInput.files || fileInput.files.length === 0) return;

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
        mainTitle.textContent = `Bereit für: ${folderIdentifier}`;
        loadJsonButton.disabled = false; // JSON-Ladebutton aktivieren
    });

    startButton.addEventListener('click', () => {
        if (audioFiles.length === 0) {
            alert("Bitte zuerst einen Ordner auswählen.");
            return;
        }
        // Prüft, ob Fortschritt im localStorage vorhanden ist und startet die App
        const savedProgress = JSON.parse(localStorage.getItem(`progress-${folderIdentifier}`));
        if (savedProgress) {
            if (confirm('Gespeicherter Fortschritt für diesen Ordner gefunden. Weitermachen?')) {
                restoreStateFromData(savedProgress);
            } else {
                localStorage.removeItem(`progress-${folderIdentifier}`);
                restoreStateFromData({}); // Startet mit leerem Zustand
            }
        } else {
            restoreStateFromData({}); // Startet mit leerem Zustand
        }
    });

    loadJsonButton.addEventListener('click', () => jsonLoadInput.click());

    jsonLoadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const progressData = JSON.parse(e.target.result);
                mainTitle.textContent = `Kategorisiere: ${folderIdentifier}`;
                restoreStateFromData(progressData);
            } catch (err) {
                alert("Fehler: Die ausgewählte Datei ist keine gültige JSON-Datei.");
                console.error(err);
            }
        };
        reader.readAsText(file);
    });
    
    saveJsonButton.addEventListener('click', downloadProgressJSON);
    downloadButton.addEventListener('click', downloadProgressJSON); // End-Button nutzt dieselbe Funktion

    // Kleinere Event-Listener
    addClassButton.addEventListener('click', () => {
        const newClassName = newClassEntry.value.trim();
        if (newClassName) { createCategoryButton(newClassName); newClassEntry.value = ''; saveProgressToLocalStorage(); }
    });
    restartButton.addEventListener('click', resetApp);
    document.getElementById('replay-button').addEventListener('click', () => audioPlayer.play());
    newClassEntry.addEventListener('keypress', (e) => { if (e.key === 'Enter') addClassButton.click(); });
    function createCategoryButton(categoryName) {
        if ([...categoryButtonsContainer.children].some(btn => btn.textContent === categoryName)) return;
        const button = document.createElement('button');
        button.textContent = categoryName;
        button.addEventListener('click', () => categorize(categoryName));
        categoryButtonsContainer.appendChild(button);
    }
    
    // ====================================================================
    // ## Mel-Spektrogramm Erstellung (mit Fehlerbehebung) ##
    // ====================================================================

    function hzToMel(hz) { return 2595 * Math.log10(1 + hz / 700); }
    function melToHz(mel) { return 700 * (Math.pow(10, mel / 2595) - 1); }

    function createMelFilterbank(fftSize, sampleRate, numBands, minHz, maxHz) {
        const minMel = hzToMel(minHz);
        const maxMel = hzToMel(maxHz);
        const melPoints = new Float32Array(numBands + 2);
        const hzPoints = new Float32Array(numBands + 2);
        const fftBinIndices = new Uint32Array(numBands + 2);
        const filterbank = [];
        for (let i = 0; i < melPoints.length; i++) {
            melPoints[i] = minMel + i * (maxMel - minMel) / (numBands + 1);
            hzPoints[i] = melToHz(melPoints[i]);
            fftBinIndices[i] = Math.floor((fftSize + 1) * hzPoints[i] / sampleRate);
        }
        for (let i = 0; i < numBands; i++) {
            const filter = new Float32Array(fftSize / 2);
            const startIdx = fftBinIndices[i], centerIdx = fftBinIndices[i + 1], endIdx = fftBinIndices[i + 2];
            for (let j = startIdx; j < centerIdx; j++) filter[j] = (j - startIdx) / (centerIdx - startIdx);
            for (let j = centerIdx; j < endIdx; j++) filter[j] = (endIdx - j) / (endIdx - centerIdx);
            filterbank.push(filter);
        }
        return filterbank;
    }

    async function drawSpectrogram(file) {
        if (!audioContext) audioContext = new AudioContext();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.font = "16px Arial";
        canvasCtx.fillStyle = "black";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText("Mel-Spektrogramm wird generiert...", canvas.width/2, canvas.height/2);

        const arrayBuffer = await file.arrayBuffer();
        try {
            // ** KORREKTUR 1: `decodeAudioData` statt `decodeData` **
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const fftSize = 2048;
            const sampleRate = audioBuffer.sampleRate;
            const numMelBands = 128, minHz = 100, maxHz = 5000;
            const melFilterbank = createMelFilterbank(fftSize, sampleRate, numMelBands, minHz, maxHz);

            // ** KORREKTUR 2: `audioBuffer.length` und `sampleRate` direkt nutzen **
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

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const numSlices = melSpectrogram.length;
            
            for (let i = 0; i < numSlices; i++) {
                for (let j = 0; j < numMelBands; j++) {
                    const value = Math.log10(1 + melSpectrogram[i][j]) / Math.log10(1 + maxMelEnergy);
                    const hue = 260 * (1 - value);
                    const saturation = '100%', lightness = `${50 * value}%`;
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