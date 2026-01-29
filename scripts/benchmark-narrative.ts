
import { Logger, LogLevel } from '../src/services/Logger';
import {
    LLMService,
    LLMCharacterResponse,
    DirectorDecision,
    LLMProvider,
    RateLimitStatus,
    CostEstimate,
    LLMRequest,
    LLMResponse,
    BatchRequestOptions
} from '../src/services/llm/LLMService';
import { GameModeManager } from '../src/domains/gameMode/aggregates';
import {
    GameModeType,
    StoryGenre,
    ModeConfig,
    ScriptModeConfig
} from '../src/domains/gameMode/valueObjects';
import { MockDatabaseService } from '../src/services/database/DatabaseService';

/**
 * Mock LLM Service for Benchmarking
 */
class PerformanceMockLLMService implements LLMService {
    private requestCount = 0;
    private totalSimulatedDelay = 0;

    async generateText(prompt: string, options?: any): Promise<string> {
        this.requestCount++;
        const isDirector = prompt.includes('DIRECTOR_DECISION') || prompt.includes('干预') || prompt.includes('导演');

        // Simulate LLM latency
        const delay = isDirector ? 800 : 1500;
        await new Promise(resolve => setTimeout(resolve, delay));
        this.totalSimulatedDelay += delay;

        if (isDirector) {
            return `
=== DIRECTOR_DECISION ===
ACTION: NO_INTERVENTION
REASONING: Player is on track.
CONFIDENCE: 0.9
PARAMETERS: type=none
=== END_DECISION ===`;
        }

        return "This is a simulated high-quality narrative response for benchmarking purposes.";
    }

    async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
        return {
            dialogue: "Mock dialogue",
            emotionalState: { mood: 'neutral' },
            confidence: 0.9
        };
    }

    async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
        return {
            action: 'CONTINUE',
            reasoning: 'Mock decision',
            confidence: 0.9,
            parameters: {}
        };
    }

    async generateStructuredResponse(prompt: string, schema: any, options?: any): Promise<any> {
        return { mock: 'structured' };
    }

    async processBatchRequests(requests: LLMRequest[], options?: BatchRequestOptions): Promise<LLMResponse[]> {
        return [];
    }

    getRateLimitStatus(provider?: LLMProvider): RateLimitStatus {
        return { requestsRemaining: 100, resetTime: new Date(), currentUsage: 0, provider: LLMProvider.OPENAI };
    }

    estimateCost(request: LLMRequest): CostEstimate {
        return { inputTokens: 0, outputTokens: 0, totalCost: 0, currency: 'USD' };
    }

    updateConfig(config: any): void { }
    getAvailableProviders(): LLMProvider[] { return [LLMProvider.OPENAI]; }
    switchProvider(provider: LLMProvider): void { }
    getDefaultProvider(): LLMProvider { return LLMProvider.OPENAI; }
    async healthCheck(): Promise<any> { return { [LLMProvider.OPENAI]: true }; }

    getMetrics() {
        return {
            requests: this.requestCount,
            simulatedDelay: this.totalSimulatedDelay
        };
    }
}

async function runBenchmark() {
    const logger = new Logger(LogLevel.WARN); // Silence most logs
    const mockLLM = new PerformanceMockLLMService();
    const mockDB = new MockDatabaseService();

    // Silence mock DB logs
    (mockDB as any).storeStoryEvent = async () => { };
    (mockDB as any).createSession = async () => { };
    (mockDB as any).storeConversation = async () => { };
    (mockDB as any).query = async () => [];

    const manager = new GameModeManager(mockLLM, logger, mockDB as any);

    console.log('\n=============================================');
    console.log('      CORE ENGINE PERFORMANCE BENCHMARK      ');
    console.log('=============================================\n');

    const startTime = Date.now();

    const config: ModeConfig = {
        mode: GameModeType.SCRIPT,
        sessionId: `benchmark-${Date.now()}`,
        worldSeed: 'bench-seed-123',
        playerPreferences: {
            preferredGenre: StoryGenre.FANTASY,
            difficultyLevel: 50,
            narrativeStyle: 'descriptive',
            interactionFrequency: 'medium',
            allowMatureContent: false,
            languagePreference: 'en-US'
        },
        modeSpecificConfig: {
            storyOutlineId: 'bench-story',
            directorInterventionLevel: 50,
            storyDeviationTolerance: 50,
            targetStoryLength: 60,
            keyPlotPoints: [],
            allowPlayerDeviations: true
        } as ScriptModeConfig
    };

    await manager.initializeGameMode(config, 'bench-player');

    const turns = [
        'I examine the artifact carefully',
        'I walk towards the light',
        'I talk to the mysterious figure',
        'I examine the artifact carefully', // CACHE TEST
        'I explore the chamber'
    ];

    for (let i = 0; i < turns.length; i++) {
        const turnStart = Date.now();
        await manager.processPlayerAction('bench-player', turns[i], { location: 'chamber' });
        const turnEnd = Date.now();
        console.log(` > Action ${i + 1}: ${turnEnd - turnStart}ms | "${turns[i].substring(0, 30)}..."`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const metrics = mockLLM.getMetrics();

    console.log('\n---------------------------------------------');
    console.log('              FINAL STATISTICS               ');
    console.log('---------------------------------------------');
    console.log(`Total Wall Clock Time:          ${totalTime}ms`);
    console.log(`Total Simulated LLM Requests:   ${metrics.requests}`);
    console.log(`Theoretical Sequential Time:    ${metrics.simulatedDelay}ms`);
    console.log(`Estimated Savings:              ${metrics.simulatedDelay - (totalTime - (turns.length * 10))}ms`);
    console.log(`Efficiency Ratio:               ${Math.round((metrics.simulatedDelay / totalTime) * 100) / 100}x faster`);
    console.log('---------------------------------------------\n');
}

runBenchmark().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
