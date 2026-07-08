import os
import time
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone

from flask import Flask, request, jsonify, session, g, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import google.generativeai as genai


FRONTEND_BUILD = os.environ.get(
    'FRONTEND_BUILD',
    os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build'),
)


app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

CORS(app, supports_credentials=True, origins=['http://localhost:3000'])
genai.configure(api_key=os.environ.get('GOOGLE_API_KEY', ''))

DB_PATH = os.environ.get('POLICIES_DB', os.path.join(os.path.dirname(__file__), 'policies.db'))



def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db


def get_db():
    if 'db' not in g:
        g.db = connect()
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = connect()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL DEFAULT 'user'
        );

        CREATE TABLE IF NOT EXISTS policies (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            title            TEXT    NOT NULL,
            natural_language TEXT    NOT NULL DEFAULT '',
            rego_code        TEXT    NOT NULL,
            active           INTEGER NOT NULL DEFAULT 1,
            created_at       TEXT    NOT NULL,
            updated_at       TEXT    NOT NULL,
            user_id          INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    db.commit()
    db.close()


def seed_users():
    """Create the demo accounts once."""
    db = connect()
    if db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
        accounts = [
            ('user123',  'password123', 'user'),
            ('sarah',    'password123', 'user'),
            ('admin123', 'qwerty123',   'admin'),
        ]
        for username, password, role in accounts:
            db.execute(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                (username, generate_password_hash(password), role),
            )
        db.commit()
    db.close()


def seed_sample_policies():
    """Add a few example policies so the app has data to browse."""
    db = connect()
    if db.execute('SELECT COUNT(*) FROM policies').fetchone()[0] == 0:
        ids = {r['username']: r['id'] for r in db.execute('SELECT id, username FROM users')}
        now = now_iso()
        samples = [
            ('user123', 'Public Read Access',
             'Allow anyone to read documents in the public folder without logging in.',
             'package authz\n\ndefault allow = false\n\nallow {\n    input.method == "GET"\n    startswith(input.path, "/public/")\n}'),
            ('user123', 'Admin Delete Guard',
             'Only administrators are allowed to delete resources.',
             'package authz\n\ndefault allow = false\n\nallow {\n    input.action == "delete"\n    input.user.role == "admin"\n}'),
            ('sarah', 'EU Region Only',
             'Deny any request that comes from outside the EU region.',
             'package authz\n\ndefault allow = true\n\ndeny {\n    input.region != "EU"\n}'),
            ('admin123', 'Profile Self-Service',
             "Users can update their own profile but not other users' profiles.",
             'package authz\n\ndefault allow = false\n\nallow {\n    input.action == "update"\n    input.resource.owner == input.user.id\n}'),
            ('admin123', 'Working Hours Access',
             'Only allow access between 9am and 5pm.',
             'package authz\n\ndefault allow = false\n\nallow {\n    input.hour >= 9\n    input.hour < 17\n}'),
        ]
        for username, title, nl, rego in samples:
            db.execute(
                """INSERT INTO policies (title, natural_language, rego_code, active, created_at, updated_at, user_id)
                   VALUES (?, ?, ?, 1, ?, ?, ?)""",
                (title, nl, rego, now, now, ids[username]),
            )
        db.commit()
    db.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


POLICY_SELECT = """
    SELECT p.id, p.title, p.natural_language, p.rego_code, p.active,
           p.created_at, p.updated_at, u.username AS created_by
    FROM policies p
    JOIN users u ON u.id = p.user_id
"""


def policy_to_dict(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'natural_language': row['natural_language'],
        'rego_code': row['rego_code'],
        'active': bool(row['active']),
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
        'created_by': row['created_by'],
    }


LOGIN_WINDOW = 300
LOGIN_MAX_ATTEMPTS = 5
failed_logins = defaultdict(list)


def too_many_attempts(username):
    now = time.time()
    recent = [t for t in failed_logins[username] if now - t < LOGIN_WINDOW]
    failed_logins[username] = recent
    return len(recent) >= LOGIN_MAX_ATTEMPTS


def require_login():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    return None


def is_admin():
    return session.get('role') == 'admin'


@app.after_request
def security_headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'DENY'
    return resp


@app.route('/api/login', methods=['POST'])
def login():
    d = request.json or {}
    username = d.get('username', '').strip()
    password = d.get('password', '')

    if too_many_attempts(username):
        return jsonify({'error': 'Too many attempts. Try again in a few minutes.'}), 429

    user = get_db().execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user or not check_password_hash(user['password_hash'], password):
        failed_logins[username].append(time.time())
        return jsonify({'error': 'Invalid credentials'}), 401

    failed_logins.pop(username, None)
    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['role'] = user['role']
    return jsonify({'username': user['username'], 'role': user['role']})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})


@app.route('/api/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    return jsonify({'username': session['username'], 'role': session['role']})


@app.route('/api/generate', methods=['POST'])
def generate():
    guard = require_login()
    if guard:
        return guard

    body = request.json or {}
    text = (body.get('natural_language') or body.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'No input provided'}), 400
    if len(text) > 2000:
        return jsonify({'error': 'Description is too long (max 2000 characters)'}), 400

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            "You are an OPA (Open Policy Agent) expert. Convert the following plain "
            "English policy into valid Rego code. Return ONLY the Rego code, no "
            "explanation, no markdown, no backticks.\n\nPolicy: " + text
        )
        rego = response.text.strip()
        return jsonify({'rego': rego, 'rego_code': rego})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



def validate_policy(d):
    """Return an error message, or None if the data is valid."""
    title = (d.get('title') or '').strip()
    rego = (d.get('rego_code') or '').strip()
    nl = (d.get('natural_language') or '').strip()

    if len(title) < 3 or len(title) > 100:
        return 'Title must be between 3 and 100 characters'
    if not rego:
        return 'Rego code cannot be empty'
    if len(rego) > 10000:
        return 'Rego code is too long'
    if len(nl) > 2000:
        return 'Description is too long (max 2000 characters)'
    return None


@app.route('/api/policies', methods=['GET'])
def list_policies():
    guard = require_login()
    if guard:
        return guard

    db = get_db()
    if is_admin():
        rows = db.execute(POLICY_SELECT + ' ORDER BY datetime(p.created_at) DESC').fetchall()
    else:
        rows = db.execute(
            POLICY_SELECT + ' WHERE p.user_id = ? ORDER BY datetime(p.created_at) DESC',
            (session['user_id'],),
        ).fetchall()
    return jsonify([policy_to_dict(r) for r in rows])


@app.route('/api/policies', methods=['POST'])
def create_policy():
    guard = require_login()
    if guard:
        return guard

    d = request.json or {}
    error = validate_policy(d)
    if error:
        return jsonify({'error': error}), 400

    ts = now_iso()
    db = get_db()
    cur = db.execute(
        """INSERT INTO policies (title, natural_language, rego_code, active, created_at, updated_at, user_id)
           VALUES (?, ?, ?, 1, ?, ?, ?)""",
        (d['title'].strip(), (d.get('natural_language') or '').strip(),
         d['rego_code'].strip(), ts, ts, session['user_id']),
    )
    db.commit()
    row = db.execute(POLICY_SELECT + ' WHERE p.id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(policy_to_dict(row)), 201


def get_owned_policy(pid):
    """Fetch a policy if the current user is allowed to change it."""
    db = get_db()
    row = db.execute('SELECT * FROM policies WHERE id = ?', (pid,)).fetchone()
    if not row:
        return None, (jsonify({'error': 'Policy not found'}), 404)
    if not is_admin() and row['user_id'] != session['user_id']:
        return None, (jsonify({'error': 'You can only change your own policies'}), 403)
    return row, None


@app.route('/api/policies/<int:pid>', methods=['PUT'])
def update_policy(pid):
    guard = require_login()
    if guard:
        return guard

    row, error = get_owned_policy(pid)
    if error:
        return error

    d = request.json or {}
    merged = {
        'title': d.get('title', row['title']),
        'rego_code': d.get('rego_code', row['rego_code']),
        'natural_language': d.get('natural_language', row['natural_language']),
    }
    msg = validate_policy(merged)
    if msg:
        return jsonify({'error': msg}), 400

    db = get_db()
    db.execute(
        'UPDATE policies SET title = ?, natural_language = ?, rego_code = ?, updated_at = ? WHERE id = ?',
        (merged['title'].strip(), merged['natural_language'].strip(),
         merged['rego_code'].strip(), now_iso(), pid),
    )
    db.commit()
    updated = db.execute(POLICY_SELECT + ' WHERE p.id = ?', (pid,)).fetchone()
    return jsonify(policy_to_dict(updated))


@app.route('/api/policies/<int:pid>', methods=['DELETE'])
def delete_policy(pid):
    guard = require_login()
    if guard:
        return guard

    row, error = get_owned_policy(pid)
    if error:
        return error

    db = get_db()
    db.execute('DELETE FROM policies WHERE id = ?', (pid,))
    db.commit()
    return jsonify({'ok': True})


@app.route('/api/admin/stats')
def admin_stats():
    guard = require_login()
    if guard:
        return guard
    if not is_admin():
        return jsonify({'error': 'Admins only'}), 403

    db = get_db()
    total = db.execute('SELECT COUNT(*) AS c FROM policies').fetchone()['c']
    active = db.execute('SELECT COUNT(*) AS c FROM policies WHERE active = 1').fetchone()['c']
    users = db.execute('SELECT COUNT(*) AS c FROM users').fetchone()['c']
    by_user = db.execute(
        """SELECT u.username AS created_by, COUNT(p.id) AS count
           FROM policies p JOIN users u ON u.id = p.user_id
           GROUP BY u.username ORDER BY count DESC"""
    ).fetchall()
    return jsonify({
        'total_policies': total,
        'active_policies': active,
        'total_users': users,
        'policies_by_user': [dict(r) for r in by_user],
    })


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    file_path = os.path.join(FRONTEND_BUILD, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, path)
    if os.path.isfile(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({'error': 'Frontend not built'}), 404


init_db()
seed_users()
seed_sample_policies()

if __name__ == '__main__':
    app.run(port=5000, debug=os.environ.get('FLASK_DEBUG') == '1')
