// 简单的Node.js服务器，用于管理抽奖序号的唯一性
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'lottery_data.json');

// 中间件
app.use(cors());
app.use(express.json());

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// 初始化数据文件
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            usedNumbers: [],
            topicDrawers: {},
            topicNumbers: {}
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

// 读取数据
function readData() {
    initDataFile();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取数据文件失败:', error);
        return {
            usedNumbers: [],
            topicDrawers: {},
            topicNumbers: {}
        };
    }
}

// 写入数据并广播更新
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        // 广播数据更新给所有客户端
        io.emit('data-update', {
            usedNumbers: data.usedNumbers,
            topicDrawers: data.topicDrawers,
            topicNumbers: data.topicNumbers
        });
        return true;
    } catch (error) {
        console.error('写入数据文件失败:', error);
        return false;
    }
}

// 重置所有数据
function resetData() {
    const resetData = {
        usedNumbers: [],
        topicDrawers: {},
        topicNumbers: {}
    };
    return writeData(resetData);
}

// API端点：获取已使用的序号
app.get('/api/used-numbers', (req, res) => {
    const data = readData();
    res.json({ usedNumbers: data.usedNumbers });
});

// API端点：验证并标记序号为已使用
app.post('/api/claim-number', (req, res) => {
    const { number, userName, topicId } = req.body;
    
    if (!number || typeof number !== 'number') {
        return res.status(400).json({ success: false, message: '无效的序号' });
    }
    
    const data = readData();
    
    // 检查序号是否已被使用
    if (data.usedNumbers.includes(number)) {
        return res.json({ success: false, message: '序号已被使用' });
    }
    
    // 标记序号为已使用
    data.usedNumbers.push(number);
    
    // 记录抽取者信息
    if (topicId && userName) {
        if (!data.topicDrawers[topicId]) {
            data.topicDrawers[topicId] = [];
        }
        if (!data.topicDrawers[topicId].includes(userName)) {
            data.topicDrawers[topicId].push(userName);
        }
        
        // 记录序号信息
        if (!data.topicNumbers[topicId]) {
            data.topicNumbers[topicId] = {};
        }
        data.topicNumbers[topicId][userName] = number;
    }
    
    writeData(data);
    res.json({ success: true, message: '序号领取成功' });
});

// API端点：获取所有抽取记录
app.get('/api/draw-records', (req, res) => {
    const data = readData();
    res.json({
        topicDrawers: data.topicDrawers,
        topicNumbers: data.topicNumbers
    });
});

// WebSocket连接处理
io.on('connection', (socket) => {
    console.log('新客户端连接:', socket.id);
    
    // 发送当前数据给新连接的客户端
    const data = readData();
    socket.emit('initial-data', {
        usedNumbers: data.usedNumbers,
        topicDrawers: data.topicDrawers,
        topicNumbers: data.topicNumbers
    });
    
    // 断开连接处理
    socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);
    });
});

// API端点：重置所有数据（仅管理员使用）
app.post('/api/reset', (req, res) => {
    const { isAdmin } = req.body;
    
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: '只有管理员可以重置' });
    }
    
    const success = resetData();
    if (success) {
        res.json({ success: true, message: '重置成功' });
    } else {
        res.status(500).json({ success: false, message: '重置失败' });
    }
});

// 提供静态文件
app.use(express.static(__dirname));

// 启动服务器
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket服务器已启动`);
});

console.log('抽奖序号管理服务器已启动');
console.log(`API地址：http://localhost:${PORT}/api/used-numbers`);
console.log(`WebSocket地址：ws://localhost:${PORT}`);
console.log(`请在前端代码中修改为使用此API和WebSocket代替localStorage`);