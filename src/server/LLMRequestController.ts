/**
 * LLM Request Controller
 * 管理 LLM 请求队列，确保同一会话的请求按顺序处理
 */

import { Logger } from '../services/Logger';

export interface LLMRequest {
    id: string;
    sessionId: string;
    input: string;
    timestamp: Date;
    priority?: number;
}

export interface RequestStatus {
    isProcessing: boolean;
    currentRequest?: LLMRequest;
    queueLength: number;
    lastCompletedAt?: Date;
}

export class LLMRequestController {
    private logger: Logger;
    private processingRequests: Map<string, boolean> = new Map(); // sessionId -> isProcessing
    private requestQueues: Map<string, LLMRequest[]> = new Map(); // sessionId -> queue
    private currentRequests: Map<string, LLMRequest> = new Map(); // sessionId -> current request

    constructor(logger?: Logger) {
        this.logger = logger || new Logger();
    }

    /**
     * 检查会话是否正在处理请求
     */
    isProcessing(sessionId: string): boolean {
        return this.processingRequests.get(sessionId) || false;
    }

    /**
     * 获取会话的请求状态
     */
    getStatus(sessionId: string): RequestStatus {
        return {
            isProcessing: this.isProcessing(sessionId),
            currentRequest: this.currentRequests.get(sessionId),
            queueLength: this.requestQueues.get(sessionId)?.length || 0,
            lastCompletedAt: undefined // 可以扩展记录完成时间
        };
    }

    /**
     * 添加请求到队列
     */
    enqueue(request: LLMRequest): boolean {
        const { sessionId } = request;

        // 如果正在处理，添加到队列
        if (this.isProcessing(sessionId)) {
            const queue = this.requestQueues.get(sessionId) || [];
            queue.push(request);
            this.requestQueues.set(sessionId, queue);

            this.logger.debug(`Request queued for session ${sessionId}. Queue length: ${queue.length}`);
            return false; // 表示请求已排队，未立即处理
        }

        // 否则标记为正在处理
        this.processingRequests.set(sessionId, true);
        this.currentRequests.set(sessionId, request);
        this.logger.debug(`Request started for session ${sessionId}`);
        return true; // 表示可以立即处理
    }

    /**
     * 标记请求完成，处理队列中的下一个请求
     */
    complete(sessionId: string): LLMRequest | null {
        // 清除当前请求
        this.currentRequests.delete(sessionId);

        // 检查队列中是否有待处理的请求
        const queue = this.requestQueues.get(sessionId) || [];

        if (queue.length > 0) {
            const nextRequest = queue.shift()!;
            this.requestQueues.set(sessionId, queue);
            this.currentRequests.set(sessionId, nextRequest);

            this.logger.debug(`Processing next request for session ${sessionId}. Remaining in queue: ${queue.length}`);
            return nextRequest;
        }

        // 没有更多请求，标记为空闲
        this.processingRequests.set(sessionId, false);
        this.logger.debug(`All requests completed for session ${sessionId}`);
        return null;
    }

    /**
     * 取消会话的所有待处理请求
     */
    cancelAll(sessionId: string): number {
        const queue = this.requestQueues.get(sessionId) || [];
        const cancelledCount = queue.length;

        this.requestQueues.delete(sessionId);
        this.processingRequests.set(sessionId, false);
        this.currentRequests.delete(sessionId);

        this.logger.info(`Cancelled ${cancelledCount} requests for session ${sessionId}`);
        return cancelledCount;
    }

    /**
     * 获取所有会话的状态
     */
    getAllStatuses(): Map<string, RequestStatus> {
        const statuses = new Map<string, RequestStatus>();

        for (const sessionId of this.processingRequests.keys()) {
            statuses.set(sessionId, this.getStatus(sessionId));
        }

        return statuses;
    }

    /**
     * 清理空闲会话（可选，用于内存管理）
     */
    cleanup(): void {
        const toDelete: string[] = [];

        for (const [sessionId, isProcessing] of this.processingRequests.entries()) {
            if (!isProcessing && !this.requestQueues.has(sessionId)) {
                toDelete.push(sessionId);
            }
        }

        for (const sessionId of toDelete) {
            this.processingRequests.delete(sessionId);
            this.currentRequests.delete(sessionId);
        }

        if (toDelete.length > 0) {
            this.logger.debug(`Cleaned up ${toDelete.length} idle sessions`);
        }
    }
}
