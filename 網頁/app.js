const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

const dbPath = path.join(__dirname, 'test_user.db');
const db = new sqlite3.Database(dbPath);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/notebook-list', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'views', 'notebook-list.html'));
  } else {
    req.session.redirectTo = req.originalUrl;  // 將當前URL儲存在會話中
    res.redirect('/login');
  }
});

app.get('/change-password', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'views', 'change-password.html'));
  } else {
    req.session.redirectTo = req.originalUrl;
    res.redirect('/login');
  }
});

app.post('/change-password', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: '未授權的操作' });
  }
  
  const { oldPassword, newPassword } = req.body;
  const query = 'SELECT * FROM users WHERE id = ?';
  
  db.get(query, [req.session.user.id], (err, user) => {
    if (err) {
      console.error('Error querying SQLite:', err);
      return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: '舊密碼不正確' });
    }

    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
    db.run(updateQuery, [newPassword, req.session.user.id], function(err) {
      if (err) {
        console.error('Error updating password in SQLite:', err);
        return res.status(500).json({ success: false, message: '內部伺服器錯誤' });
      }
      res.json({ success: true, message: '密碼更新成功' });
    });
  });
});

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.run(query, [username, email, password], function(err) {
    if (err) {
      console.error('Error adding user to SQLite:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    } else {
      res.json({ success: true, message: 'User registered successfully.', id: this.lastID });
    }
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ?';
  db.get(query, [email], (err, user) => {
    if (err) {
      console.error('Error querying SQLite:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    } else if (!user || user.password !== password) {
      res.status(400).json({ success: false, message: 'Invalid email or password.' });
    } else {
      req.session.user = user;
      const redirectTo = req.session.redirectTo || '/';
      delete req.session.redirectTo;
      res.json({ success: true, message: 'Login successful.', redirectTo });
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/notebooks', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const query = 'SELECT * FROM notebooks WHERE user_id = ?';
  db.all(query, [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Error querying SQLite:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json({ notebooks: rows });
    }
  });
});

app.post('/api/notebooks', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const { title, description } = req.body;
  const query = 'INSERT INTO notebooks (title, description, user_id) VALUES (?, ?, ?)';
  db.run(query, [title, description, req.session.user.id], function(err) {
    if (err) {
      console.error('Error adding notebook to SQLite:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    } else {
      res.json({ success: true, message: 'Notebook added successfully.', id: this.lastID });
    }
  });
});

app.put('/api/notebooks/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const notebookId = req.params.id;
  const { title, description, content } = req.body;
  const query = 'UPDATE notebooks SET title = ?, description = ?, content = ? WHERE id = ? AND user_id = ?';
  db.run(query, [title, description, content, notebookId, req.session.user.id], function(err) {
    if (err) {
      console.error('Error updating notebook in SQLite:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    } else {
      res.json({ success: true, message: 'Notebook updated successfully.' });
    }
  });
});

app.delete('/api/notebooks/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const notebookId = req.params.id;
  const query = 'DELETE FROM notebooks WHERE id = ? AND user_id = ?';
  db.run(query, [notebookId, req.session.user.id], function(err) {
    if (err) {
      console.error('Error deleting notebook from SQLite:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    } else {
      res.json({ success: true, message: 'Notebook deleted successfully.' });
    }
  });
});

// 新的頁面路由
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/note-detail/:id', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'views', 'note-detail.html'));
  } else {
    req.session.redirectTo = req.originalUrl;
    res.redirect('/login');
  }
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'faq.html'));
});

process.on('exit', () => {
  db.close();
  console.log('SQLite connection closed');
});

app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
