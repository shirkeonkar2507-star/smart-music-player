# Smart Music Player 🎵

A Smart Music Player built using Python Flask, HTML, CSS, and JavaScript.
Features:
- Play, pause, next, previous
- Playlist management (stack & linked list)
- Trending songs (hashmap)
- Liked songs
- Progress/seek bar
- Web-based interface

## How to run locally
1. Install libraries:
   pip install -r requirements.txt

2. Run the app:
   python app.py

3. Open in browser:
   http://127.0.0.1:5000

## Project Structure
smart-music-player/
│ app.py
│ requirements.txt
│ README.md
│
├── templates/
│   └── index.html
│
└── static/
    ├── style.css
    ├── script.js
    └── music/
         └── *.mp3 files
