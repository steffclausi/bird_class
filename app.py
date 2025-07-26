import os
import json
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename

# Initialisiert die Flask-Anwendung
app = Flask(__name__, static_folder='static', template_folder='templates')

# Definiert den Ordner, in dem die JSON-Dateien gespeichert werden
SAVED_PROGRESS_DIR = 'progress_files'
os.makedirs(SAVED_PROGRESS_DIR, exist_ok=True)

# Route zum Anzeigen der Hauptseite (index.html)
@app.route('/')
def index():
    # Sucht nach einer index.html in einem 'templates' Ordner
    return render_template('index.html')

# Route, um die JSON-Daten zu empfangen und zu speichern
@app.route('/save_json', methods=['POST'])
def save_json():
    """Empfängt JSON-Daten und speichert sie serverseitig."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    folder_name = data.get('folder_identifier')
    progress_data = data.get('progress')

    if not folder_name or not progress_data:
        return jsonify({"error": "Missing folder_name or progress_data"}), 400

    # Bereinigt den Dateinamen, um Sicherheitslücken zu vermeiden
    filename = secure_filename(folder_name) + '.json'
    filepath = os.path.join(SAVED_PROGRESS_DIR, filename)

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(progress_data, f, ensure_ascii=False, indent=4)
        print(f"Fortschritt gespeichert unter: {filepath}")
        return jsonify({"message": f"Fortschritt wurde als '{filename}' auf dem Server gespeichert."}), 200
    except Exception as e:
        print(f"Fehler beim Speichern der Datei: {e}")
        return jsonify({"error": "Datei konnte nicht gespeichert werden."}), 500

if __name__ == '__main__':
    # Startet den Server, erreichbar unter http://127.0.0.1:5000
    app.run(debug=True, port=5000)