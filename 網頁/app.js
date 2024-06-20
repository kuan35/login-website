const express = require('express'); // 引入Express框架
const path = require('path'); // 引入Path模塊
const sqlite3 = require('sqlite3').verbose(); // 引入SQLite3數據庫模塊，並啟用詳細模式
const session = require('express-session'); // 引入express-session模塊
const app = express(); // 創建Express應用實例
const port = 3000; // 設置應用運行的端口號

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // 解析JSON格式的請求主體
app.use(express.urlencoded({ extended: true })); // 解析URL編碼的請求主體
app.use(express.static(path.join(__dirname, 'views'))); // 設置靜態文件目錄為views文件夾
app.use(express.static(path.join(__dirname))); // 設置靜態文件目錄為當前目錄
app.use(session({
  secret: 'your_secret_key', // 用於簽署會話ID的密鑰
  resave: false, // 不在每次請求後重新保存會話
  saveUninitialized: true // 保存未修改的會話
}));

const dbPath = path.join(__dirname, 'test_user.db'); // 設置SQLite數據庫文件的路徑
const db = new sqlite3.Database(dbPath); // 連接到SQLite數據庫

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html')); // 響應index.html文件
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html')); // 響應register.html文件
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html')); // 響應login.html文件
});

app.get('/notebook-list', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'views', 'notebook-list.html')); // 如果已登錄，響應notebook-list.html
  } else {
    req.session.redirectTo = req.originalUrl; // 將當前URL儲存在會話中
    res.redirect('/login'); // 未登錄則重定向到登錄頁面
  }
});

app.get('/change-password', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, 'views', 'change-password.html')); // 如果已登錄，響應change-password.html
  } else {
    req.session.redirectTo = req.originalUrl; // 將當前URL儲存在會話中
    res.redirect('/login'); // 未登錄則重定向到登錄頁面
  }
});

app.post('/change-password', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: '未授權的操作' }); // 未授權操作
  }
  
  const { oldPassword, newPassword } = req.body; // 獲取請求中的舊密碼和新密碼
  const query = 'SELECT * FROM users WHERE id = ?'; // 查詢用戶SQL語句
  
  db.get(query, [req.session.user.id], (err, user) => {
    if (err) {
      console.error('Error querying SQLite:', err); // 查詢錯誤
      return res.status(500).json({ success: false, message: '內部伺服器錯誤' }); // 內部伺服器錯誤
    }

    if (user.password !== oldPassword) {
      return res.status(400).json({ success: false, message: '舊密碼不正確' }); // 舊密碼不正確
    }

    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?'; // 更新密碼SQL語句
    db.run(updateQuery, [newPassword, req.session.user.id], function(err) {
      if (err) {
        console.error('Error updating password in SQLite:', err); // 更新密碼錯誤
        return res.status(500).json({ success: false, message: '內部伺服器錯誤' }); // 內部伺服器錯誤
      }
      res.json({ success: true, message: '密碼更新成功' }); // 密碼更新成功
    });
  });
});

app.post('/register', (req, res) => {
  const { username, email, password } = req.body; // 獲取請求中的用戶名、郵箱和密碼
  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'; // 插入用戶SQL語句
  db.run(query, [username, email, password], function(err) {
    if (err) {
      console.error('Error adding user to SQLite:', err); // 添加用戶錯誤
      res.status(500).json({ success: false, message: 'Internal server error.' }); // 內部伺服器錯誤
    } else {
      res.json({ success: true, message: 'User registered successfully.', id: this.lastID }); // 用戶註冊成功
    }
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body; // 獲取請求中的郵箱和密碼
  const query = 'SELECT * FROM users WHERE email = ?'; // 查詢用戶SQL語句
  db.get(query, [email], (err, user) => {
    if (err) {
      console.error('Error querying SQLite:', err); // 查詢錯誤
      res.status(500).json({ success: false, message: 'Internal server error.' }); // 內部伺服器錯誤
    } else if (!user || user.password !== password) {
      res.status(400).json({ success: false, message: 'Invalid email or password.' }); // 郵箱或密碼無效
    } else {
      req.session.user = user; // 設置會話用戶
      const redirectTo = req.session.redirectTo || '/'; // 獲取重定向URL
      delete req.session.redirectTo; // 刪除會話中的重定向URL
      res.json({ success: true, message: 'Login successful.', redirectTo }); // 登錄成功
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(); // 銷毀會話
  res.redirect('/'); // 重定向到根目錄
});

app.get('/api/notebooks', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' }); // 未授權操作
  }
  const query = 'SELECT * FROM notebooks WHERE user_id = ?'; // 查詢筆記本SQL語句
  db.all(query, [req.session.user.id], (err, rows) => {
    if (err) {
      console.error('Error querying SQLite:', err); // 查詢錯誤
      res.status(500).json({ error: 'Internal Server Error' }); // 內部伺服器錯誤
    } else {
      res.json({ notebooks: rows }); // 響應筆記本列表
    }
  });
});

app.post('/api/notebooks', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' }); // 未授權操作
  }
  const { title, description } = req.body; // 獲取請求中的標題和描述
  const query = 'INSERT INTO notebooks (title, description, user_id) VALUES (?, ?, ?)'; // 插入筆記本SQL語句
  db.run(query, [title, description, req.session.user.id], function(err) {
    if (err) {
      console.error('Error adding notebook to SQLite:', err); // 添加筆記本錯誤
      res.status(500).json({ success: false, message: 'Internal server error.' }); // 內部伺服器錯誤
    } else {
      res.json({ success: true, message: 'Notebook added successfully.', id: this.lastID }); // 筆記本添加成功
    }
  });
});

app.put('/api/notebooks/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' }); // 未授權操作
  }
  const notebookId = req.params.id; // 獲取請求參數中的筆記本ID
  const { title, description, content } = req.body; // 獲取請求中的標題、描述和內容
  const query = 'UPDATE notebooks SET title = ?, description = ?, content = ? WHERE id = ? AND user_id = ?'; // 更新筆記本SQL語句
  db.run(query, [title, description, content, notebookId, req.session.user.id], function(err) {
    if (err) {
      console.error('Error updating notebook in SQLite:', err); // 更新筆記本錯誤
      res.status(500).json({ success: false, message: 'Internal server error.' }); // 內部伺服器錯誤
    } else {
      res.json({ success: true, message: 'Notebook updated successfully.' }); // 筆記本更新成功
    }
  });
});

app.delete('/api/notebooks/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' }); // 未授權操作
  }
  const notebookId = req.params.id; // 獲取請求參數中的筆記本ID
  const query = 'DELETE FROM notebooks WHERE id = ? AND user_id = ?'; // 刪除筆記本SQL語句
  db.run(query, [notebookId, req.session.user.id], function(err) {
    if (err) {
      console.error('Error deleting notebook from SQLite:', err); // 刪除筆記本錯誤
      res.status(500).json({ success: false, message: 'Internal server error.' }); // 內部伺服器錯誤
    } else {
      res.json({ success: true, message: 'Notebook deleted successfully.' }); // 筆記本刪除成功
    }
  });
});

// 新的頁面路由
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'about.html')); // 響應about.html文件
});


app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'faq.html')); // 響應faq.html文件
});

process.on('exit', () => {
  db.close(); // 關閉SQLite連接
  console.log('SQLite connection closed'); // 輸出連接關閉信息
});

app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`); // 啟動應用，並在指定端口上進行監聽
});
