import os
import tempfile
import unittest

# Use a throwaway database and a dummy API key for the tests.
_fd, _path = tempfile.mkstemp(suffix='.db')
os.close(_fd)
os.environ['POLICIES_DB'] = _path
os.environ['GOOGLE_API_KEY'] = 'test'

from app import app, init_db, seed_users, failed_logins, DB_PATH  # noqa: E402


class PolicyAppTests(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        failed_logins.clear()
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        init_db()
        seed_users()  # accounts only, no sample policies

    def login(self, username, password):
        return self.client.post('/api/login', json={'username': username, 'password': password})

    def add_policy(self, title='Test policy', rego='package x'):
        return self.client.post('/api/policies', json={'title': title, 'rego_code': rego})

    # auth
    def test_login_ok(self):
        r = self.login('user123', 'password123')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['role'], 'user')

    def test_login_wrong_password(self):
        self.assertEqual(self.login('user123', 'nope').status_code, 401)

    def test_admin_login(self):
        self.assertEqual(self.login('admin123', 'qwerty123').json['role'], 'admin')

    def test_me_requires_login(self):
        self.assertEqual(self.client.get('/api/me').status_code, 401)

    def test_login_rate_limited(self):
        for _ in range(5):
            self.login('user123', 'wrong')
        # the 6th attempt is blocked even with the right password
        self.assertEqual(self.login('user123', 'password123').status_code, 429)

    # validation
    def test_generate_requires_login(self):
        self.assertEqual(self.client.post('/api/generate', json={'text': 'x'}).status_code, 401)

    def test_title_too_short(self):
        self.login('user123', 'password123')
        r = self.client.post('/api/policies', json={'title': 'ab', 'rego_code': 'package x'})
        self.assertEqual(r.status_code, 400)

    def test_empty_rego_rejected(self):
        self.login('user123', 'password123')
        r = self.client.post('/api/policies', json={'title': 'Valid title', 'rego_code': ''})
        self.assertEqual(r.status_code, 400)

    # crud
    def test_save_and_list(self):
        self.login('user123', 'password123')
        self.assertEqual(self.add_policy().status_code, 201)
        policies = self.client.get('/api/policies').json
        self.assertEqual(len(policies), 1)
        self.assertEqual(policies[0]['created_by'], 'user123')

    def test_update(self):
        self.login('user123', 'password123')
        pid = self.add_policy().json['id']
        r = self.client.put(f'/api/policies/{pid}', json={'title': 'Renamed'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['title'], 'Renamed')

    def test_delete_own(self):
        self.login('user123', 'password123')
        pid = self.add_policy().json['id']
        self.assertEqual(self.client.delete(f'/api/policies/{pid}').status_code, 200)

    def test_delete_missing(self):
        self.login('admin123', 'qwerty123')
        self.assertEqual(self.client.delete('/api/policies/999').status_code, 404)

    # access control
    def test_user_sees_only_own_policies(self):
        self.login('user123', 'password123')
        self.add_policy(title='Mine')
        self.client.post('/api/logout')
        self.login('sarah', 'password123')
        self.assertEqual(len(self.client.get('/api/policies').json), 0)

    def test_user_cannot_edit_others(self):
        self.login('user123', 'password123')
        pid = self.add_policy().json['id']
        self.client.post('/api/logout')
        self.login('sarah', 'password123')
        r = self.client.put(f'/api/policies/{pid}', json={'title': 'Hijacked'})
        self.assertEqual(r.status_code, 403)

    def test_admin_sees_all_policies(self):
        self.login('user123', 'password123')
        self.add_policy()
        self.client.post('/api/logout')
        self.login('admin123', 'qwerty123')
        self.assertEqual(len(self.client.get('/api/policies').json), 1)

    def test_stats_admin_only(self):
        self.login('user123', 'password123')
        self.assertEqual(self.client.get('/api/admin/stats').status_code, 403)

    def test_stats_for_admin(self):
        self.login('admin123', 'qwerty123')
        stats = self.client.get('/api/admin/stats').json
        self.assertEqual(stats['total_users'], 3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
