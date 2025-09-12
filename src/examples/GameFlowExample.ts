import { Orchestrator } from '../Orchestrator';

async function runGameFlowExample() {
  console.log('=== AI Character-Driven Open World Game Flow Example ===\n');
  
  const orchestrator = new Orchestrator();
  
  // Example 1: Simple greeting
  console.log('Example 1: Simple greeting');
  let result = await orchestrator.runOnce('你好，我是新来的。');
  if (result.success && result.coordinationResult?.responses.narrative) {
    console.log('游戏响应:', result.coordinationResult.responses.narrative);
  }
  console.log();
  
  // Example 2: Asking a question
  console.log('Example 2: Asking a question');
  result = await orchestrator.runOnce('你能告诉我这个镇子的历史吗？');
  if (result.success && result.coordinationResult?.responses.narrative) {
    console.log('游戏响应:', result.coordinationResult.responses.narrative);
  }
  console.log();
  
  // Example 3: Expressing interest
  console.log('Example 3: Expressing interest');
  result = await orchestrator.runOnce('听起来很有趣，我想了解更多。');
  if (result.success && result.coordinationResult?.responses.narrative) {
    console.log('游戏响应:', result.coordinationResult.responses.narrative);
  }
  console.log();
  
  console.log('=== Game Flow Example Completed ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  runGameFlowExample().catch(console.error);
}

export { runGameFlowExample };