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
        fileInput.value = ''; // Wichtig, damit derselbe Ordner erneut gewählt werden kann
        mainTitle.textContent = 'Lokaler Audio Kategorisierer';
        categoryButtonsContainer.innerHTML = '';
    }
    
    // Startet die App, nachdem die Dateien geladen sind
    function initializeCategorization() {
        // Prüfe auf gespeicherten Fortschritt
        const savedProgress = JSON.parse(localStorage.getItem(`progress-${folderIdentifier}`));

        if (savedProgress) {
            const continue_ = confirm('Gespeicherter Fortschritt für diesen Ordner gefunden. Möchten Sie weitermachen?');
            if (continue_) {
                // Lade den Fortschritt
                currentIndex = savedProgress.currentIndex;
                categorization = savedProgress.categorization;
                savedProgress.categories.forEach(createCategoryButton);
            } else {
                // Lösche alten Fortschritt, wenn Nutzer neu startet
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
        saveProgress(); // Fortschritt nach jeder Aktion speichern
        loadNextAudio();
    }
    
    function showFinishScreen() {
        mainApp.classList.add('hidden');
        finishSection.classList.remove('hidden');
        
        const categoryCount = new Set(Object.values(categorization)).size;
        document.getElementById('finish-summary').textContent = 
            `Du hast ${Object.keys(categorization).length} Dateien in ${categoryCount} Kategorien sortiert.`;
        
        // Lösche den gespeicherten Fortschritt, da die Aufgabe beendet ist
        localStorage.removeItem(`progress-${folderIdentifier}`);
    }

    // ## Fortschritt Speichern & Laden ##

    function saveProgress() {
        const categories = [...categoryButtonsContainer.children].map(btn => btn.textContent);
        const progress = {
            currentIndex,
            categorization,
            categories
        };
        localStorage.setItem(`progress-${folderIdentifier}`, JSON.stringify(progress));
    }
    
    // ## Hilfsfunktionen & Event Listeners ##

    function createCategoryButton(categoryName) {
        if ([...categoryButtonsContainer.children].some(btn => btn.textContent === categoryName)) {
            return;
        }
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

        // Die 'files' sind Referenzen auf die lokalen Dateien. An dieser Stelle
        // wird noch nichts gelesen, nur eine Liste der ausgewählten Dateien erstellt.
        const allFiles = [...fileInput.files];
        audioFiles = allFiles.filter(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            return ALLOWED_EXTENSIONS.includes(extension);
        }).sort((a, b) => a.name.localeCompare(b.name));

        if (audioFiles.length === 0) {
            alert("Der ausgewählte Ordner enthält keine unterstützten Audiodateien.");
            return;
        }
        
        // Eindeutigen Namen für den Ordner aus dem Pfad ableiten
        // file.webkitRelativePath ist z.B. "MeinMusikOrdner/song.mp3"
        folderIdentifier = audioFiles[0].webkitRelativePath.split('/')[0];
        mainTitle.textContent = `Kategorisiere: ${folderIdentifier}`;
        
        initializeCategorization();
    });

    addClassButton.addEventListener('click', () => {
        const newClassName = newClassEntry.value.trim();
        if (newClassName) {
            createCategoryButton(newClassName);
            newClassEntry.value = '';
            saveProgress(); // Auch neue Kategorien speichern
        }
    });

    downloadButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(categorization, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sortierung-${folderIdentifier}.json`; // Dateiname mit Ordnerbezug
        a.click();
        URL.revokeObjectURL(url);
    });
    
    restartButton.addEventListener('click', resetApp);
    
    document.getElementById('replay-button').addEventListener('click', () => audioPlayer.play());
    newClassEntry.addEventListener('keypress', (e) => { if (e.key === 'Enter') addClassButton.click(); });

    async function drawSpectrogram(file) {
        if (!audioContext) audioContext = new AudioContext();
        
        // Erst hier wird der Inhalt der einzelnen Datei als 'ArrayBuffer'
        // in den Arbeitsspeicher des Browsers gelesen.
        const arrayBuffer = await file.arrayBuffer();
        try {
            // Die Verarbeitung der Audiodaten geschieht vollständig lokal.
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            const analyser = offlineCtx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            analyser.connect(offlineCtx.destination);
            source.start();
            await offlineCtx.startRendering();

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.fillStyle = 'rgb(240, 240, 240)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / dataArray.length);
            let barHeight;
            let x = 0;
            for (let i = 0; i < dataArray.length; i++) {
                barHeight = dataArray[i] / 255 * canvas.height;
                const hue = (dataArray[i] / 255) * 240;
                canvasCtx.fillStyle = `hsl(${240 - hue}, 100%, 50%)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth;
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