/**
 * 文件名处理工具类
 * 提供智能文件名优化和验证功能
 */

const path = require('path');

/**
 * 中文转拼音映射表（常用字符）
 */
const chineseToPinyinMap = {
    // 数字
    '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu', 
    '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
    '零': 'ling', '百': 'bai', '千': 'qian', '万': 'wan',
    
    // 常用词汇
    '视频': 'video', '电影': 'movie', '短片': 'clip', '录像': 'record',
    '测试': 'test', '样本': 'sample', '演示': 'demo', '教程': 'tutorial',
    '会议': 'meeting', '培训': 'training', '讲座': 'lecture', '课程': 'course',
    '广告': 'ad', '宣传': 'promo', '介绍': 'intro', '总结': 'summary',
    '新闻': 'news', '报告': 'report', '分析': 'analysis', '评论': 'review',
    '音乐': 'music', '歌曲': 'song', '舞蹈': 'dance', '表演': 'show',
    '游戏': 'game', '动画': 'animation', '卡通': 'cartoon', '漫画': 'comic',
    '风景': 'scenery', '旅游': 'travel', '美食': 'food', '生活': 'life',
    '工作': 'work', '学习': 'study', '娱乐': 'entertainment', '体育': 'sports',
    '科技': 'tech', '产品': 'product', '项目': 'project', '活动': 'event',
    
    // 时间相关
    '今天': 'today', '昨天': 'yesterday', '明天': 'tomorrow',
    '上午': 'morning', '下午': 'afternoon', '晚上': 'evening',
    '春天': 'spring', '夏天': 'summer', '秋天': 'autumn', '冬天': 'winter',
    '年': 'year', '月': 'month', '日': 'day', '时': 'hour',
    
    // 方位
    '东': 'east', '南': 'south', '西': 'west', '北': 'north',
    '上': 'up', '下': 'down', '左': 'left', '右': 'right',
    '前': 'front', '后': 'back', '中': 'middle', '内': 'inner', '外': 'outer',
    
    // 颜色
    '红': 'red', '橙': 'orange', '黄': 'yellow', '绿': 'green',
    '蓝': 'blue', '紫': 'purple', '黑': 'black', '白': 'white',
    '灰': 'gray', '粉': 'pink', '棕': 'brown',
    
    // 大小
    '大': 'big', '小': 'small', '长': 'long', '短': 'short',
    '高': 'high', '低': 'low', '宽': 'wide', '窄': 'narrow',
    
    // 常用形容词
    '好': 'good', '坏': 'bad', '新': 'new', '旧': 'old',
    '快': 'fast', '慢': 'slow', '热': 'hot', '冷': 'cold',
    '美': 'beautiful', '丑': 'ugly', '强': 'strong', '弱': 'weak'
};

/**
 * 智能文件名优化类
 */
class FileNameOptimizer {
    
    /**
     * 检测文件名中的问题字符
     * @param {string} fileName - 原始文件名
     * @returns {Object} 检测结果
     */
    static analyzeFileName(fileName) {
        const analysis = {
            hasChinese: /[\u4e00-\u9fa5]/.test(fileName),
            hasSpecialChars: /[^a-zA-Z0-9._-]/.test(fileName.replace(/[\u4e00-\u9fa5]/g, '')),
            hasSpaces: /\s/.test(fileName),
            hasUnsafeChars: /[<>:"/\\|?*]/.test(fileName),
            length: fileName.length,
            isValid: true,
            issues: []
        };
        
        if (analysis.hasChinese) {
            analysis.issues.push('包含中文字符');
            analysis.isValid = false;
        }
        
        if (analysis.hasSpecialChars) {
            analysis.issues.push('包含特殊字符');
            analysis.isValid = false;
        }
        
        if (analysis.hasSpaces) {
            analysis.issues.push('包含空格');
            analysis.isValid = false;
        }
        
        if (analysis.hasUnsafeChars) {
            analysis.issues.push('包含不安全字符');
            analysis.isValid = false;
        }
        
        if (analysis.length > 100) {
            analysis.issues.push('文件名过长');
            analysis.isValid = false;
        }
        
        return analysis;
    }
    
    /**
     * 智能转换中文字符为拼音或英文
     * @param {string} text - 包含中文的文本
     * @returns {string} 转换后的文本
     */
    static convertChineseToEnglish(text) {
        let result = text;
        
        // 使用映射表转换常用中文词汇
        for (const [chinese, english] of Object.entries(chineseToPinyinMap)) {
            const regex = new RegExp(chinese, 'g');
            result = result.replace(regex, english);
        }
        
        // 处理剩余的中文字符，转换为拼音占位符
        result = result.replace(/[\u4e00-\u9fa5]/g, (match) => {
            // 如果映射表中没有，使用通用占位符
            return 'cn';
        });
        
        return result;
    }
    
    /**
     * 优化文件名 - 智能处理各种问题
     * @param {string} fileName - 原始文件名
     * @param {Object} options - 优化选项
     * @returns {Object} 优化结果
     */
    static optimizeFileName(fileName, options = {}) {
        const {
            maxLength = 50,
            preserveOriginal = true,
            addTimestamp = false,
            strategy = 'smart' // 'smart', 'simple', 'strict'
        } = options;
        
        const ext = path.extname(fileName);
        let nameWithoutExt = path.basename(fileName, ext);
        const originalName = nameWithoutExt;
        
        // 分析原始文件名
        const analysis = this.analyzeFileName(fileName);
        
        let optimizedName = nameWithoutExt;
        const transformations = [];
        
        // 策略1: 智能转换
        if (strategy === 'smart') {
            // 转换中文字符
            if (analysis.hasChinese) {
                optimizedName = this.convertChineseToEnglish(optimizedName);
                transformations.push('中文转英文');
            }
            
            // 处理空格 - 转换为下划线
            if (analysis.hasSpaces) {
                optimizedName = optimizedName.replace(/\s+/g, '_');
                transformations.push('空格转下划线');
            }
            
            // 处理特殊字符 - 智能替换
            optimizedName = optimizedName
                .replace(/[（(]/g, '_')
                .replace(/[）)]/g, '_')
                .replace(/[【\[]/g, '_')
                .replace(/[】\]]/g, '_')
                .replace(/[，,]/g, '_')
                .replace(/[。.]/g, '_')
                .replace(/[！!]/g, '_')
                .replace(/[？?]/g, '_')
                .replace(/[：:]/g, '_')
                .replace(/[；;]/g, '_')
                .replace(/["|"]/g, '_')
                .replace(/['']/g, '_')
                .replace(/[～~]/g, '_')
                .replace(/[@#$%^&*+=<>]/g, '_');
            
            if (optimizedName !== nameWithoutExt) {
                transformations.push('特殊字符处理');
            }
        }
        
        // 策略2: 简单替换
        else if (strategy === 'simple') {
            optimizedName = nameWithoutExt
                .replace(/[\u4e00-\u9fa5]/g, '_')  // 中文转下划线
                .replace(/[^a-zA-Z0-9_-]/g, '_'); // 其他特殊字符转下划线
            transformations.push('简单字符替换');
        }
        
        // 策略3: 严格模式
        else if (strategy === 'strict') {
            optimizedName = nameWithoutExt
                .replace(/[^a-zA-Z0-9]/g, '_');   // 只保留字母数字
            transformations.push('严格字符过滤');
        }
        
        // 清理多余的下划线和连字符
        optimizedName = optimizedName
            .replace(/[_-]+/g, '_')              // 合并多个下划线/连字符
            .replace(/^[_-]+|[_-]+$/g, '');      // 移除开头和结尾的下划线/连字符
        
        // 处理空名称
        if (!optimizedName) {
            optimizedName = 'video';
            transformations.push('使用默认名称');
        }
        
        // 长度限制
        if (optimizedName.length > maxLength) {
            optimizedName = optimizedName.substring(0, maxLength);
            transformations.push('截断长度');
        }
        
        // 添加时间戳
        if (addTimestamp) {
            const timestamp = Date.now().toString().slice(-6); // 最后6位
            optimizedName = `${optimizedName}_${timestamp}`;
            transformations.push('添加时间戳');
        }
        
        const finalFileName = optimizedName + ext;
        
        return {
            original: fileName,
            optimized: finalFileName,
            originalAnalysis: analysis,
            transformations: transformations,
            isChanged: finalFileName !== fileName,
            suggestion: this.generateSuggestion(analysis, transformations)
        };
    }
    
    /**
     * 生成优化建议
     * @param {Object} analysis - 文件名分析结果
     * @param {Array} transformations - 已应用的转换
     * @returns {string} 建议文本
     */
    static generateSuggestion(analysis, transformations) {
        if (analysis.isValid) {
            return '文件名符合规范，无需修改';
        }
        
        const suggestions = [];
        
        if (analysis.hasChinese) {
            suggestions.push('建议使用英文或拼音命名');
        }
        
        if (analysis.hasSpaces) {
            suggestions.push('建议使用下划线(_)或连字符(-)替代空格');
        }
        
        if (analysis.hasSpecialChars) {
            suggestions.push('建议移除特殊字符，只使用字母、数字、下划线和连字符');
        }
        
        if (analysis.length > 50) {
            suggestions.push('建议缩短文件名长度');
        }
        
        return suggestions.join('；');
    }
    
    /**
     * 批量优化文件名
     * @param {Array} fileNames - 文件名数组
     * @param {Object} options - 优化选项
     * @returns {Array} 优化结果数组
     */
    static batchOptimize(fileNames, options = {}) {
        return fileNames.map(fileName => this.optimizeFileName(fileName, options));
    }
    
    /**
     * 验证文件名是否符合规范
     * @param {string} fileName - 文件名
     * @returns {Object} 验证结果
     */
    static validateFileName(fileName) {
        const analysis = this.analyzeFileName(fileName);
        
        return {
            isValid: analysis.isValid,
            issues: analysis.issues,
            recommendation: analysis.isValid ? 
                '文件名符合规范' : 
                `建议修改：${analysis.issues.join('、')}`
        };
    }
}

/**
 * 生成安全的OSS文件路径
 * @param {string} userId - 用户ID
 * @param {string} taskId - 任务ID
 * @param {string} originalFileName - 原始文件名
 * @param {string} suffix - 后缀
 * @returns {string} 安全的OSS路径
 */
function generateSafeOSSPath(userId, taskId, originalFileName, suffix = '') {
    const optimized = FileNameOptimizer.optimizeFileName(originalFileName, {
        strategy: 'smart',
        maxLength: 30,
        addTimestamp: false
    });
    
    const baseName = path.basename(optimized.optimized, path.extname(optimized.optimized));
    const ext = path.extname(optimized.optimized);
    
    return `video-logo-removal/${userId}/${taskId}_${baseName}${suffix}${ext}`;
}

/**
 * 传统的文件名清理函数（向后兼容）
 * @param {string} fileName - 原始文件名
 * @returns {string} 清理后的文件名
 */
function sanitizeFileName(fileName) {
    const optimized = FileNameOptimizer.optimizeFileName(fileName, {
        strategy: 'simple',
        maxLength: 50
    });
    
    return optimized.optimized;
}

module.exports = {
    FileNameOptimizer,
    generateSafeOSSPath,
    sanitizeFileName
};

