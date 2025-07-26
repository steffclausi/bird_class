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

    /**
	 * Sendet den aktuellen Fortschritt an den Python-Server zum Speichern.
	 */
	/**
	 * Sendet den aktuellen Fortschritt an den externen Python-Server zum Speichern.
	 */
	async function saveProgressToServer() {
		// ! WICHTIG: Ersetze diese URL durch die deines externen Servers!
		const serverUrl = 'https://deine-app.onrender.com'; // Beispiel-URL von Render

		const progress = {
			categorization,
			categories: [...categoryButtonsContainer.children].map(btn => btn.textContent)
		};
		
		const payload = {
			folder_identifier: folderIdentifier,
			progress: progress
		};

		try {
			const response = await fetch(`${serverUrl}/save_json`, { // Die URL wird hier zusammengesetzt
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload)
			});

			// Der Rest der Funktion bleibt gleich...
			const result = await response.json();

			if (response.ok) {
				console.log('Server-Antwort:', result.message);
				const originalText = saveJsonButton.textContent;
				saveJsonButton.textContent = 'Gespeichert!';
				setTimeout(() => { saveJsonButton.textContent = originalText; }, 2000);
			} else {
				throw new Error(result.error || 'Unbekannter Fehler');
			}
		} catch (error) {
			console.error('Fehler beim Senden der Daten an den Server:', error);
			alert('Fehler: Fortschritt konnte nicht auf dem Server gespeichert werden.');
		}
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
    
    saveJsonButton.addEventListener('click', saveProgressToServer);
	downloadButton.addEventListener('click', saveProgressToServer); // End-Button macht nun das Gleiche
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

		/**
	 * Erstellt eine Mel-Filterbank zur Gewichtung der FFT-Ergebnisse.
	 * @param {number} fftSize - Die Größe des FFT-Fensters.
	 * @param {number} sampleRate - Die Abtastrate der Audiodatei.
	 * @param {number} numBands - Die gewünschte Anzahl der Mel-Bänder (vertikale Auflösung).
	 * @param {number} minHz - Die untere Frequenzgrenze.
	 * @param {number} maxHz - Die obere Frequenzgrenze.
	 * @returns {Array<Float32Array>} Die berechnete Filterbank.
	 */
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

		/**
	 * Zeichnet das Mel-Spektrogramm einer Audiodatei auf das Canvas.
	 * @param {File} file - Die zu analysierende Audiodatei.
	 */
	async function drawSpectrogram(file) {
		if (!audioContext) audioContext = new AudioContext();
		const canvas = document.getElementById('spectrogram-canvas');
		const canvasCtx = canvas.getContext('2d');

		canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
		canvasCtx.font = "16px Arial";
		canvasCtx.fillStyle = "black";
		canvasCtx.textAlign = "center";
		canvasCtx.fillText("Mel-Spektrogramm wird generiert...", canvas.width / 2, canvas.height / 2);

		const arrayBuffer = await file.arrayBuffer();
		try {
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			const fftSize = 2048;
			const hopLength = 512; // Kleinere Hop-Länge für mehr zeitliche Auflösung (Überlappung)
			const sampleRate = audioBuffer.sampleRate;
			
			const numMelBands = 128;
			const minHz = 100;
			const maxHz = 5000;

			const melFilterbank = createMelFilterbank(fftSize, sampleRate, numMelBands, minHz, maxHz);
			const pcmData = audioBuffer.getChannelData(0);
			const numFrames = Math.floor((pcmData.length - fftSize) / hopLength) + 1;
			const melSpectrogram = [];
			let maxMelEnergy = 0;
			
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = fftSize;
			
			for (let i = 0; i < numFrames; i++) {
				const start = i * hopLength;
				const end = start + fftSize;
				const pcmChunk = pcmData.subarray(start, end);

				// Um AnalyserNode zu nutzen, muss ein Buffer und Source erstellt werden.
				// Dies ist ein Workaround, um eine manuelle FFT-Bibliothek zu vermeiden.
				const frameBuffer = audioContext.createBuffer(1, fftSize, sampleRate);
				frameBuffer.copyToChannel(pcmChunk, 0);

				const source = audioContext.createBufferSource();
				source.buffer = frameBuffer;
				source.connect(analyser);
				source.start();

				// Die Frequenzdaten für den aktuellen Frame auslesen
				const linearFrame = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(linearFrame);
				
				// Auf Mel-Skala umrechnen
				const melFrame = new Float32Array(numMelBands);
				for (let j = 0; j < numMelBands; j++) {
					let melEnergy = 0;
					for (let k = 0; k < linearFrame.length; k++) {
						melEnergy += linearFrame[k] * melFilterbank[j][k];
					}
					melFrame[j] = melEnergy;
					if (melEnergy > maxMelEnergy) maxMelEnergy = melEnergy;
				}
				melSpectrogram.push(melFrame);
			}

			// Zeichnen des Spektrogramms
			canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
			for (let i = 0; i < melSpectrogram.length; i++) {
				for (let j = 0; j < numMelBands; j++) {
					const value = Math.log10(1 + melSpectrogram[i][j]) / Math.log10(1 + maxMelEnergy);
					const hue = 260 * (1 - value);
					const lightness = `${50 * value}%`;
					canvasCtx.fillStyle = `hsl(${hue}, 100%, ${lightness})`;
					const x = (i / melSpectrogram.length) * canvas.width;
					const y = canvas.height - (j / numMelBands) * canvas.height;
					canvasCtx.fillRect(x, y, (canvas.width / melSpectrogram.length) + 1, (canvas.height / numMelBands) + 1);
				}
			}

		} catch (e) {
			console.error('Fehler bei der Audio-Analyse:', e);
			canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
			canvasCtx.font = "16px Arial";
			canvasCtx.fillStyle = "red";
			canvasCtx.textAlign = "center";
			canvasCtx.fillText("Audio konnte nicht analysiert werden.", canvas.width / 2, canvas.height / 2);
		}
	}
});