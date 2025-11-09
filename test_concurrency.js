// 并发测试脚本 - 模拟多个用户同时抽取序号
// 导入node-fetch并应用polyfill
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 确保安装了node-fetch: npm install node-fetch

const API_BASE_URL = 'http://localhost:3000/api';
const NUM_USERS = 10; // 模拟的用户数量
const DELAY_BETWEEN_REQUESTS = 10; // 请求间隔（毫秒）

// 模拟用户抽取
async function simulateUserDraw(userIndex) {
    const userName = `user_${userIndex}`;
    const topicId = Math.floor(Math.random() * 5) + 1;
    
    console.log(`用户 ${userName} 开始抽取...`);
    
    try {
        // 1. 首先获取已使用的序号
        const usedNumbersResponse = await fetch(`${API_BASE_URL}/used-numbers`);
        const usedNumbersData = await usedNumbersResponse.json();
        const usedNumbers = new Set(usedNumbersData.usedNumbers || []);
        
        // 2. 选择一个未使用的序号（模拟前端随机选择）
        let selectedNumber;
        for (let i = 1; i <= 50; i++) { // 假设序号范围是1-50
            if (!usedNumbers.has(i)) {
                selectedNumber = i;
                break;
            }
        }
        
        if (!selectedNumber) {
            console.log(`用户 ${userName}: 没有可用的序号`);
            return { success: false, userName, reason: '无可用序号' };
        }
        
        // 3. 验证并标记序号
        const validateResponse = await fetch(`${API_BASE_URL}/claim-number`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: selectedNumber,
                topicId: topicId,
                userName: userName
            })
        });
        
        const validateData = await validateResponse.json();
        
        if (validateData.success) {
            console.log(`用户 ${userName} 成功抽取序号: ${selectedNumber}`);
            return { success: true, userName, number: selectedNumber };
        } else {
            console.log(`用户 ${userName} 抽取失败，序号 ${selectedNumber} 已被占用: ${validateData.message}`);
            return { success: false, userName, number: selectedNumber, reason: validateData.message };
        }
    } catch (error) {
        console.error(`用户 ${userName} 抽取过程出错:`, error.message);
        return { success: false, userName, error: error.message };
    }
}

// 主测试函数
async function runConcurrencyTest() {
    console.log(`开始并发测试，模拟 ${NUM_USERS} 个用户同时抽取序号...`);
    
    // 先重置数据
    try {
        await fetch(`${API_BASE_URL}/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isAdmin: true })
        });
        console.log('数据已重置');
    } catch (error) {
        console.error('重置数据失败:', error.message);
        // 重置失败不影响继续测试
    }
    
    // 创建延迟的用户请求
    const promises = [];
    const results = [];
    
    for (let i = 0; i < NUM_USERS; i++) {
        // 稍微错开请求时间，模拟真实场景
        const delay = i * DELAY_BETWEEN_REQUESTS;
        
        const promise = new Promise((resolve) => {
            setTimeout(async () => {
                const result = await simulateUserDraw(i);
                results.push(result);
                resolve(result);
            }, delay);
        });
        
        promises.push(promise);
    }
    
    // 等待所有请求完成
    await Promise.all(promises);
    
    // 分析结果
    console.log('\n测试结果分析:');
    console.log(`总用户数: ${NUM_USERS}`);
    
    const successfulDraws = results.filter(r => r.success);
    console.log(`成功抽取: ${successfulDraws.length}`);
    
    const failedDraws = results.filter(r => !r.success);
    console.log(`抽取失败: ${failedDraws.length}`);
    
    // 检查序号唯一性
    const drawnNumbers = successfulDraws.map(r => r.number);
    const uniqueNumbers = new Set(drawnNumbers);
    
    console.log(`抽取的序号总数: ${drawnNumbers.length}`);
    console.log(`唯一序号数: ${uniqueNumbers.size}`);
    
    if (drawnNumbers.length === uniqueNumbers.size) {
        console.log('✅ 通过验证: 所有抽取的序号都是唯一的');
    } else {
        console.log('❌ 验证失败: 存在重复的序号');
        // 找出重复的序号
        const numberCounts = {};
        drawnNumbers.forEach(num => {
            numberCounts[num] = (numberCounts[num] || 0) + 1;
        });
        
        console.log('重复的序号:');
        for (const [num, count] of Object.entries(numberCounts)) {
            if (count > 1) {
                console.log(`序号 ${num} 出现了 ${count} 次`);
            }
        }
    }
    
    // 打印成功抽取的用户和序号
    console.log('\n成功抽取详情:');
    successfulDraws.forEach((r, index) => {
        console.log(`${index + 1}. ${r.userName}: 序号 ${r.number}`);
    });
}

// 运行测试
if (require.main === module) {
    // 使用IIFE来处理异步导入
    (async () => {
        try {
            await runConcurrencyTest();
        } catch (error) {
            console.error('测试执行出错:', error);
        }
    })();
}