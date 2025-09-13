import { WorldManager } from '../domains/world/aggregates';
import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';

// Mock LLMService
const mockLLMService = {
  generateText: jest.fn().mockResolvedValue('A beautiful garden with colorful flowers.'),
} as unknown as LLMService;

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

describe('WorldManager', () => {
  let worldManager: WorldManager;

  beforeEach(async () => {
    worldManager = new WorldManager(mockLLMService, mockLogger);
    await worldManager.initializeWorld();
  });

  describe('processLocationMovement', () => {
    it('should successfully move to an existing location', async () => {
      const result = await worldManager.processLocationMovement('town_square', 'tavern', 'player1');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Arrived at The Golden Goblet Tavern');
      expect(result.newLocation?.id).toBe('tavern');
    });

    it('should dynamically create a new location and establish connections', async () => {
      const result = await worldManager.processLocationMovement('town_square', 'garden', 'player1');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Arrived at garden');
      
      // 验证新位置已创建（通过遍历所有位置查找）
      const allLocations = worldManager.getWorld().getAllLocations();
      const newLocation = allLocations.find(loc => loc.name === 'garden');
      expect(newLocation).toBeDefined();
      
      // 验证连接已建立
      const townSquare = worldManager.getWorld().getLocation('town_square');
      expect(townSquare?.getConnection(newLocation!.id)).toBeDefined();
      expect(newLocation?.getConnection('town_square')).toBeDefined();
    });

    it('should fail when current location does not exist', async () => {
      const result = await worldManager.processLocationMovement('nonexistent', 'tavern', 'player1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid current location specified');
    });
  });
});