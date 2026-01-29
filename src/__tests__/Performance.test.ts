
import { DomainCoordinator } from '../domains/DomainCoordinator';
import { LLMService, LLMProvider } from '../services/llm/LLMService';
import { Logger } from '../services/Logger';
import { MockLLMService } from '../services/llm/LLMService';
import { GameContext } from '../domains/DomainCoordinator';

// Simple Mock Logger to avoid cluttering output
class BenchmarkLogger extends Logger {
    info(message: string, ...args: any[]): void { }
    warn(message: string, ...args: any[]): void { }
    error(message: string, ...args: any[]): void { }
    debug(message: string, ...args: any[]): void { }
    logInputProcessing(sessionId: string, playerId: string, input: string, classification: any): void { }
    logLocationChange(sessionId: string, playerId: string, from: string, to: string, success: boolean): void { }
}

describe('Performance Benchmark', () => {
    // Increase timeout for benchmark
    jest.setTimeout(60000);

    test('Benchmark Execution Loop', async () => {
        console.log('Starting Benchmark via Jest...');

        const mockLLM = new MockLLMService();
        const logger = new BenchmarkLogger();
        const coordinator = new DomainCoordinator(mockLLM, logger, undefined, undefined, undefined);

        await coordinator.initializeGame();

        const sessionId = 'benchmark-session';
        const playerId = 'benchmark-player';

        const gameContext: GameContext = {
            sessionId,
            playerId,
            currentLocation: 'town_square',
            activeCharacters: ['guard'],
            gameState: {},
            timestamp: new Date()
        };

        const iterations = 10;
        const inputs = [
            "look around",
            "talk to the guard",
            "inventory",
            "go north",
            "examine the fountain",
            "hello there",
            "what is your name",
            "go south",
            "check map",
            "wait here"
        ];

        const startTime = Date.now();
        let totalDuration = 0;

        for (let i = 0; i < iterations; i++) {
            const input = inputs[i % inputs.length];
            const stepStart = Date.now();

            await coordinator.processPlayerInput(sessionId, playerId, input, gameContext);

            const stepDuration = Date.now() - stepStart;
            totalDuration += stepDuration;
        }

        const totalTime = Date.now() - startTime;
        const avgTime = totalDuration / iterations;

        console.log('--------------------------------------------------');
        console.log(`Benchmark Completed: ${iterations} iterations`);
        console.log(`Total Time: ${totalTime}ms`);
        console.log(`Average Response Time: ${avgTime.toFixed(2)}ms`);
        console.log('--------------------------------------------------');

        expect(true).toBe(true);
    });
});
