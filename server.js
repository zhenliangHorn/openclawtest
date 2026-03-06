const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 配置文件管理根目录（默认为 workspace 目录）
const ROOT_DIR = process.env.FILE_MANAGER_ROOT || '/root/.openclaw/workspace';

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.query.path || ROOT_DIR;
    const safePath = path.resolve(ROOT_DIR, uploadPath.replace(/^\.\//, ''));
    
    // 确保上传目录在 ROOT_DIR 内
    if (!safePath.startsWith(ROOT_DIR)) {
      return cb(new Error('Invalid upload path'));
    }
    
    fs.mkdirSync(safePath, { recursive: true });
    cb(null, safePath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// 获取文件列表
app.get('/api/files', (req, res) => {
  const requestPath = req.query.path || '';
  const safePath = path.resolve(ROOT_DIR, requestPath.replace(/^\.\//, ''));
  
  // 安全检查：确保路径在 ROOT_DIR 内
  if (!safePath.startsWith(ROOT_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  fs.readdir(safePath, { withFileTypes: true }, (err, files) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const fileList = files.map(file => ({
      name: file.name,
      path: path.join(requestPath, file.name).replace(/\\/g, '/'),
      isDirectory: file.isDirectory(),
      size: file.isDirectory() ? 0 : fs.statSync(path.join(safePath, file.name)).size,
      modified: fs.statSync(path.join(safePath, file.name)).mtime
    }));
    
    res.json({
      currentPath: requestPath || '/',
      parentPath: requestPath ? path.dirname(requestPath).replace(/\\/g, '/') : null,
      files: fileList
    });
  });
});

// 下载文件
app.get('/api/download', (req, res) => {
  const filePath = req.query.path;
  const safePath = path.resolve(ROOT_DIR, filePath.replace(/^\.\//, ''));
  
  if (!safePath.startsWith(ROOT_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const stat = fs.statSync(safePath);
  if (stat.isDirectory()) {
    return res.status(400).json({ error: 'Cannot download directory' });
  }
  
  res.download(safePath, path.basename(safePath));
});

// 上传文件
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    success: true,
    filename: req.file.originalname,
    path: req.file.path
  });
});

// 创建目录
app.post('/api/mkdir', (req, res) => {
  const dirPath = req.query.path;
  const safePath = path.resolve(ROOT_DIR, dirPath.replace(/^\.\//, ''));
  
  if (!safePath.startsWith(ROOT_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  fs.mkdir(safePath, { recursive: true }, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, path: dirPath });
  });
});

// 删除文件/目录
app.delete('/api/delete', (req, res) => {
  const filePath = req.query.path;
  const safePath = path.resolve(ROOT_DIR, filePath.replace(/^\.\//, ''));
  
  if (!safePath.startsWith(ROOT_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // 不允许删除 ROOT_DIR 本身
  if (safePath === ROOT_DIR) {
    return res.status(403).json({ error: 'Cannot delete root directory' });
  }
  
  fs.rm(safePath, { recursive: true, force: true }, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// 静态文件服务（前端页面）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'file-manager.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📁 File Manager running at http://localhost:${PORT}`);
  console.log(`📂 Root directory: ${ROOT_DIR}`);
});
