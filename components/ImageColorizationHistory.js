import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Image, Button, Spinner, useToast } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

/**
 * 图像上色历史记录组件
 * 显示用户最近的图像上色历史记录
 */
const ImageColorizationHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const toast = useToast();

  // 获取历史记录
  const fetchHistory = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/image-colorization-history', {
        params: {
          limit: 3,
          last24Hours: true
        }
      });
      
      if (response.data.success) {
        setHistory(response.data.history);
      } else {
        throw new Error(response.data.message || '获取历史记录失败');
      }
    } catch (err) {
      console.error('获取图像上色历史记录失败:', err);
      setError('获取历史记录失败，请稍后再试');
      toast({
        title: '获取历史记录失败',
        description: err.message || '请稍后再试',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 清除所有历史记录
  const clearHistory = async () => {
    if (!currentUser) return;
    
    if (!window.confirm('确定要清除所有历史记录吗？此操作无法撤销。')) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.delete('/api/image-colorization-history');
      
      if (response.data.success) {
        setHistory([]);
        toast({
          title: '历史记录已清除',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.data.message || '清除历史记录失败');
      }
    } catch (err) {
      console.error('清除图像上色历史记录失败:', err);
      toast({
        title: '清除历史记录失败',
        description: err.message || '请稍后再试',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取历史记录
  useEffect(() => {
    if (currentUser) {
      fetchHistory();
    }
  }, [currentUser]);

  // 如果用户未登录，显示提示信息
  if (!currentUser) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg">
        <Text>请登录以查看您的图像上色历史记录</Text>
      </Box>
    );
  }

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg" bg="white" shadow="md">
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Text fontSize="xl" fontWeight="bold">最近的图像上色记录</Text>
        <Button
          size="sm"
          colorScheme="red"
          variant="outline"
          onClick={clearHistory}
          isDisabled={loading || history.length === 0}
        >
          清除记录
        </Button>
      </Flex>

      {loading ? (
        <Flex justify="center" align="center" height="200px">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : error ? (
        <Box p={4} bg="red.50" borderRadius="md">
          <Text color="red.500">{error}</Text>
        </Box>
      ) : history.length === 0 ? (
        <Box p={4} bg="gray.50" borderRadius="md">
          <Text color="gray.500" textAlign="center">暂无图像上色记录</Text>
        </Box>
      ) : (
        <Flex direction="column" gap={4}>
          {history.map((item) => (
            <Box key={item.id} p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
              <Text fontWeight="semibold" mb={2}>
                {item.prompt || '图像上色'}
              </Text>
              <Flex direction={{ base: 'column', md: 'row' }} gap={3}>
                {item.originalImage && (
                  <Box>
                    <Text fontSize="sm" mb={1}>原始图片</Text>
                    <Image 
                      src={item.originalImage} 
                      alt="原始图片" 
                      maxH="150px" 
                      borderRadius="md" 
                      fallbackSrc="https://via.placeholder.com/150?text=加载中"
                    />
                  </Box>
                )}
                <Box>
                  <Text fontSize="sm" mb={1}>上色后图片</Text>
                  <Image 
                    src={item.resultImage} 
                    alt="上色后图片" 
                    maxH="150px" 
                    borderRadius="md" 
                    fallbackSrc="https://via.placeholder.com/150?text=加载中"
                  />
                </Box>
              </Flex>
              <Text fontSize="xs" color="gray.500" mt={2}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </Box>
          ))}
          {history.length > 0 && (
            <Button size="sm" colorScheme="blue" onClick={fetchHistory} isLoading={loading}>
              刷新记录
            </Button>
          )}
        </Flex>
      )}
    </Box>
  );
};

export default ImageColorizationHistory;
