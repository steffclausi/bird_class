document.addEventListener('DOMContentLoaded', () => {
    // Globale Zustandsvariablen
    let audioFiles = []; // Speichert die File-Objekte
    let currentIndex = 0;
    let categorization = {}; // Das Ergebnis: { 'file.wav': 'KategorieA' }
    
    // Web Audio API Initialisierung
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioContext;

    // HTML-Elemente
    const uploadSection = document.getElementById('upload-section');
    const mainApp = document.getElementById('main-app');
    const startButton = document.getElementById('start-button');
    const fileInput = document.getElementById('file-input');
    
    const fileInfo = document.getElementById('file-info');
    const audioPlayer = document.getElementById('audio-player');
    const replayButton = document.getElementById('replay-button');
    
    const canvas = document.getElementById('spectrogram-canvas');
    const canvasCtx = canvas.getContext('2d');
    
    const categoryButtonsContainer = document.getElementById('category-buttons');
    const newClassEntry = document.getElementById('new-class-entry');
    const addClassButton = document.getElementById('add-class-button');
    const finishButton = document.getElementById('finish-button');

    // -- Hauptfunktionen --

    async function loadNextAudio() {
        if (currentIndex >= audioFiles.length) {
            fileInfo.textContent = "Alle Dateien wurden kategorisiert!";
            mainApp.innerHTML = `<h2>Fertig!</h2><p>Alle ${audioFiles.length} Dateien wurden kategorisiert. Klicke jetzt auf 'Speichern & Beenden', um deine 'sortierung.json'-Datei herunterzuladen.</p>`;
            finishButton.style.display = 'block';
            return;
        }

        const file = audioFiles[currentIndex];
        fileInfo.textContent = `Datei: ${file.name} (${currentIndex + 1}/${audioFiles.length})`;
        
        // Audio-Player vorbereiten
        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        audioPlayer.onended = () => URL.revokeObjectURL(objectURL); // Speicher freigeben
        audioPlayer.play().catch(e => console.error("Fehler beim Abspielen:", e));
        
        // Spektrogramm zeichnen
        await drawSpectrogram(file);
    }
    
    // Zeichnet das Spektrogramm auf das Canvas
    async function drawSpectrogram(file) {
        if (!audioContext) {
            audioContext = new AudioContext();
        }
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async (event) => {
            const arrayBuffer = event.target.result;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // AnalyserNode für die Frequenzanalyse (FFT)
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser);
            
            // OfflineContext, um die gesamte Datei zu analysieren, ohne sie abzuspielen
            const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
            const offlineSource = offlineCtx.createBufferSource();
            offlineSource.buffer = audioBuffer;
            const offlineAnalyser = offlineCtx.createAnalyser();
            offlineAnalyser.fftSize = 2048;
            offlineSource.connect(offlineAnalyser);
            offlineAnalyser.connect(offlineCtx.destination);
            offlineSource.start();

            const renderedBuffer = await offlineCtx.startRendering();
            
            // Daten aus dem Analyser holen und zeichnen
            const frequencyBinCount = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(frequencyBinCount);

            // Canvas leeren
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = canvas.width / frequencyBinCount;
            
            // Wir simulieren das Spektrogramm, indem wir es über die Zeitachse "wischen"
            // Dies ist eine Vereinfachung. Eine echte Implementierung ist komplexer.
            for (let i = 0; i < canvas.width; i++) {
                // Hier würden wir eigentlich zeitlich versetzte FFTs nehmen.
                // Zur Vereinfachung nehmen wir einen Durchschnitt.
                offlineAnalyser.getByteFrequencyData(dataArray);

                for (let j = 0; j < frequencyBinCount; j++) {
                    const value = dataArray[j];
                    const percent = value / 255;
                    const height = canvas.height * percent;
                    const offset = canvas.height - height;

                    // Farbverlauf von blau (niedrig) zu rot (hoch)
                    const hue = 240 * (1 - percent);
                    canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                    canvasCtx.fillRect(i, offset, 1, height);
                }
            }
        };
    }
    
    function categorize(category) {
        const filename = audioFiles[currentIndex].name;
        categorization[filename] = category;
        
        currentIndex++;
        loadNextAudio();
    }
    
    function createCategoryButton(categoryName) {
        if ([...categoryButtonsContainer.children].some(btn => btn.textContent === categoryName)) {
            return;
        }
        const button = document.createElement('button');
        button.textContent = categoryName;
        button.addEventListener('click', () => categorize(categoryName));
        categoryButtonsContainer.appendChild(button);
    }

    // -- Event Listener --

    startButton.addEventListener('click', () => {
        if (fileInput.files.length === 0) {
            alert("Bitte wähle zuerst Dateien aus.");
            return;
        }
        audioFiles = [...fileInput.files].sort((a, b) => a.name.localeCompare(b.name));
        uploadSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadNextAudio();
    });

    replayButton.addEventListener('click', () => audioPlayer.play());
    
    addClassButton.addEventListener('click', () => {
        const newClassName = newClassEntry.value.trim();
        if (newClassName) {
            createCategoryButton(newClassName);
            newClassEntry.value = '';
        }
    });

    newClassEntry.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addClassButton.click();
    });
    
    finishButton.addEventListener('click', () => {
        const jsonString = JSON.stringify(categorization, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sortierung.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("'sortierung.json' wurde heruntergeladen!");
    });
});