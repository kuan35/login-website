const sqlite3 = require('sqlite3').verbose(); // 載入 sqlite3 模組並啟用詳細模式
const path = require('path'); // 載入 path 模組，用來處理文件路徑

const dbPath = path.join(__dirname, 'test_user.db'); // 設定資料庫檔案的路徑
const db = new sqlite3.Database(dbPath); // 創建並打開資料庫

db.serialize(() => { // 使用 serialize 方法保證所有操作依序執行
  // 創建 users 表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, // 自動遞增的主鍵
      username TEXT NOT NULL, // 用戶名，不能為空
      email TEXT NOT NULL UNIQUE, // 電子郵件，不能為空且唯一
      password TEXT NOT NULL // 密碼，不能為空
    )
  `);

  // 創建 notebooks 表
  db.run(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, // 自動遞增的主鍵
      user_id INTEGER NOT NULL, // 參照 users 表的 user_id，不能為空
      title TEXT NOT NULL, // 標題，不能為空
      description TEXT, // 描述，可以為空
      FOREIGN KEY (user_id) REFERENCES users (id) // 外鍵約束，參照 users 表的 id 欄位
    )
  `);


});

db.close(); // 關閉資料庫連接
console.log('Database initialized'); // 打印初始化成功訊息
