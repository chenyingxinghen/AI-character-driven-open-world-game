import * as React from 'react';
import { createRoot } from 'react-dom/client';
import GameInterface from './GameInterface';

// 获取根DOM元素
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// 创建React根并渲染应用
const root = createRoot(container);
root.render(<GameInterface />);