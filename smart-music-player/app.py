from flask import Flask, render_template, jsonify, request
from collections import deque
import heapq
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# --------------------------
# Data structures / classes
# --------------------------
class Song:
    def __init__(self, title, artist, file_path, cover_path):
        self.title = title
        self.artist = artist
        self.file_path = file_path
        self.cover_path = cover_path
        self.play_count = 0

    def play(self):
        self.play_count += 1

    def to_dict(self):
        return {
            "title": self.title,
            "artist": self.artist,
            "file": self.file_path,
            "cover": self.cover_path,
            "play_count": self.play_count
        }

class SongNode:
    def __init__(self, song):
        self.song = song
        self.next = None
        self.prev = None

class Playlist:
    def __init__(self):
        self.head = None
        self.tail = None
        self.current = None  # pointer to currently playing node

    def add_song(self, song):
        node = SongNode(song)
        if not self.head:
            self.head = self.tail = node
        else:
            self.tail.next = node
            node.prev = self.tail
            self.tail = node

    def get_all_songs(self):
        songs = []
        node = self.head
        while node:
            songs.append(node.song.to_dict())
            node = node.next
        return songs

    def find_node_by_title(self, title):
        node = self.head
        while node:
            if node.song.title == title:
                return node
            node = node.next
        return None

    def set_current_by_title(self, title):
        node = self.find_node_by_title(title)
        if node:
            self.current = node
            return node.song
        return None

    def play_first(self):
        if self.head:
            self.current = self.head
            return self.current.song
        return None

    def play_next(self):
        if self.current and self.current.next:
            self.current = self.current.next
            return self.current.song
        return None

    def play_prev(self):
        if self.current and self.current.prev:
            self.current = self.current.prev
            return self.current.song
        return None

# --------------------------
# Globals / Data containers
# --------------------------
playlist = Playlist()
song_map = {}        # title -> Song object for O(1) lookup
play_queue = deque() # Up-next queue (FIFO)
liked_stack = []     # Liked songs stack (LIFO) - store Song objects

# Preload songs (update these file paths to match your actual files)
# Using static paths so the front-end can access them directly
songs_data = [
    ("Believer", "Imagine Dragons", "/static/music/believer.mp3", "/static/images/believer.jpg"),
    ("Faded", "Alan Walker", "/static/music/faded.mp3", "/static/images/faded.jpg"),
    ("Alone", "Marshmello", "/static/music/alone.mp3", "/static/images/alone.jpg"),
    ("Soduni Gokulas", "Shantanu Ghule", "/static/music/krishna.mp3", "/static/images/krishna.jpg")
]

for title, artist, file_path, cover_path in songs_data:
    s = Song(title, artist, file_path, cover_path)
    playlist.add_song(s)
    song_map[title] = s

# --------------------------
# Helper: trending (top-k)
# --------------------------
def get_trending(k=3):
    if not playlist.head:
        return []
    # Use heapq.nlargest on list of Song objects
    all_songs = []
    node = playlist.head
    while node:
        all_songs.append(node.song)
        node = node.next
    top = heapq.nlargest(k, all_songs, key=lambda s: s.play_count)
    return [s.to_dict() for s in top]

# --------------------------
# Routes / API
# --------------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/playlist", methods=["GET"])
def api_playlist():
    return jsonify(playlist.get_all_songs())

@app.route("/play/<title>", methods=["POST"])
def api_play(title):
    if title not in song_map:
        return jsonify({"message": "Song not found"}), 404
    # set playlist current pointer to this song
    playlist.set_current_by_title(title)
    song = song_map[title]
    song.play()
    return jsonify({
        "message": f"Playing {song.title}",
        "file": song.file_path,
        "cover": song.cover_path,
        "artist": song.artist,
        "play_count": song.play_count
    })

# Queue endpoints
@app.route("/queue/<title>", methods=["POST"])
def api_queue_add(title):
    if title not in song_map:
        return jsonify({"message": "Song not found"}), 404
    play_queue.append(song_map[title])
    return jsonify({"message": f"'{title}' added to queue", "queue": [s.title for s in play_queue]})

@app.route("/queue", methods=["GET"])
def api_queue_get():
    return jsonify({"queue": [s.title for s in play_queue]})

@app.route("/next", methods=["GET"])
def api_next():
    # priority: if queue has songs, pop queue first (Spotify-like behavior can vary)
    if play_queue:
        next_song = play_queue.popleft()
        next_song.play()
        # set current in playlist if exists there
        playlist.set_current_by_title(next_song.title)
        return jsonify({
            "message": f"Now playing {next_song.title} (from queue)",
            "file": next_song.file_path,
            "cover": next_song.cover_path,
            "artist": next_song.artist,
            "play_count": next_song.play_count
        })
    next_song = playlist.play_next()
    if not next_song:
        return jsonify({"message": "End of playlist"}), 404
    next_song.play()
    return jsonify({
        "message": f"Now playing {next_song.title}",
        "file": next_song.file_path,
        "cover": next_song.cover_path,
        "artist": next_song.artist,
        "play_count": next_song.play_count
    })

@app.route("/prev", methods=["GET"])
def api_prev():
    prev_song = playlist.play_prev()
    if not prev_song:
        return jsonify({"message": "No previous song"}), 404
    prev_song.play()
    return jsonify({
        "message": f"Now playing {prev_song.title}",
        "file": prev_song.file_path,
        "cover": prev_song.cover_path,
        "artist": prev_song.artist,
        "play_count": prev_song.play_count
    })

# Trending
@app.route("/trending", methods=["GET"])
def api_trending():
    return jsonify(get_trending(3))

# Liked songs (stack)
@app.route("/like/<title>", methods=["POST"])
def api_like(title):
    if title not in song_map:
        return jsonify({"message": "Song not found"}), 404
    song = song_map[title]
    # Avoid duplicate likes: if already in liked_stack, move it to top
    found_index = None
    for i, s in enumerate(liked_stack):
        if s.title == title:
            found_index = i
            break
    if found_index is not None:
        liked_stack.pop(found_index)
    liked_stack.append(song)  # push to stack (newest at end -> top)
    return jsonify({"message": f"'{title}' liked", "liked_count": len(liked_stack)})

@app.route("/liked", methods=["GET"])
def api_liked():
    # return most recent likes first (LIFO)
    return jsonify([s.to_dict() for s in reversed(liked_stack)])

@app.route("/unlike/<title>", methods=["POST"])
def api_unlike(title):
    found_index = None
    for i, s in enumerate(liked_stack):
        if s.title == title:
            found_index = i
            break
    if found_index is None:
        return jsonify({"message": "Song not in liked list"}), 404
    liked_stack.pop(found_index)
    return jsonify({"message": f"'{title}' removed from liked songs"})

# Optional: reset plays endpoint (keeps it)
@app.route("/resetplays/<title>", methods=["POST"])
def api_resetplays(title):
    if title not in song_map:
        return jsonify({"message": "Song not found"}), 404
    song_map[title].play_count = 0
    return jsonify({"message": f"Play count for '{title}' reset to 0."})

# --------------------------
# Run
# --------------------------
if __name__ == "__main__":
    # Ensure host static folder is accessible and run
    app.run(debug=True)

   

