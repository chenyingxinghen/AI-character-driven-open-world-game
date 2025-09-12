import { WorldManager } from '../domains/world/aggregates';
import { LLMService } from '../services/llm/LLMService';
import { Logger } from '../services/Logger';
import { GameLocation } from '../domains/world/entities';
import { EnvironmentalFactors } from '../domains/world/valueObjects';

export interface WorldState {
  currentTime: string;
  weather: string;
  location: string;
  atmosphere: string;
}

export interface LocationInfo {
  id: string;
  name: string;
  description: string;
  connectedLocations: string[];
}

export class GameWorldEngine {
  private worldManager: WorldManager;
  private worldState: WorldState;

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.worldManager = new WorldManager(llmService, logger);
    this.worldState = {
      currentTime: 'noon',
      weather: 'sunny',
      location: 'town_square',
      atmosphere: 'peaceful'
    };
  }

  async initializeWorld(): Promise<void> {
    await this.worldManager.initializeWorld();
  }

  getCurrentWorldState(): WorldState {
    return { ...this.worldState };
  }

  updateWorldState(newState: Partial<WorldState>): void {
    this.worldState = { ...this.worldState, ...newState };
    
    // Update world manager with new state
    // Note: The actual WorldManager implementation may need these methods
    this.logger.info('World state updated');
  }

  getLocation(id: string): GameLocation | undefined {
    // In a simplified implementation, create a basic location
    // The actual WorldManager would handle this
    return new GameLocation(
      id,
      `Location_${id}`,
      `A location with ID ${id}`,
      { x: 0, y: 0 },
      'default_region'
    );
  }

  getAllLocations(): GameLocation[] {
    // Return some default locations for now
    return [
      this.getLocation('town_square')!,
      this.getLocation('library')!,
      this.getLocation('blacksmith')!,
      this.getLocation('market')!
    ];
  }

  async generateLocationDescription(locationId: string): Promise<string> {
    try {
      const location = this.getLocation(locationId);
      if (!location) {
        return 'Unknown location';
      }
      
      // Generate rich description using basic logic for now
      // In a full implementation, this would use the WorldManager's methods
      const baseDescription = `You are at ${location.name}. ${location.description}.`;
      const weatherEffect = this.getWeatherDescription();
      const timeEffect = this.getTimeDescription();
      
      return `${baseDescription} ${weatherEffect} ${timeEffect}`;
    } catch (error) {
      this.logger.error(`Error generating location description for ${locationId}:`, error as Error);
      return 'You find yourself in an undefined place.';
    }
  }

  async generateWorldEvent(): Promise<string> {
    try {
      // Generate a simple world event based on current state
      const events = [
        `The ${this.worldState.weather} weather creates a ${this.worldState.atmosphere} atmosphere.`,
        `At ${this.worldState.currentTime}, the world feels alive with activity.`,
        'A gentle breeze carries the sounds of the nearby settlement.',
        'The ambient sounds of the world create a peaceful backdrop.'
      ];
      
      return events[Math.floor(Math.random() * events.length)];
    } catch (error) {
      this.logger.error('Error generating world event:', error as Error);
      return 'The world is quiet for now.';
    }
  }

  async moveToLocation(locationId: string): Promise<boolean> {
    const targetLocation = this.getLocation(locationId);
    if (!targetLocation) {
      return false;
    }
    
    // Simple movement logic - in a full implementation, 
    // this would check connections and validate movement
    this.worldState.location = locationId;
    this.logger.info(`Moved to location: ${locationId}`);
    return true;
  }

  private getCurrentEnvironmentalFactors(): EnvironmentalFactors {
    return {
      weather: this.worldState.weather,
      lighting: this.getTimeBasedLighting(),
      temperature: 20,
      humidity: 60,
      noiseLevel: 'medium',
      visibility: 100
    };
  }

  private getWeatherDescription(): string {
    const weather = this.worldState.weather;
    switch (weather) {
      case 'sunny': return 'The sun shines brightly overhead.';
      case 'cloudy': return 'Clouds drift lazily across the sky.';
      case 'rainy': return 'A gentle rain falls from the grey sky.';
      default: return 'The weather is pleasant.';
    }
  }

  private getTimeDescription(): string {
    const time = this.worldState.currentTime;
    switch (time) {
      case 'morning': return 'The morning air is fresh and invigorating.';
      case 'noon': return 'The midday sun is at its peak.';
      case 'evening': return 'The evening light casts long shadows.';
      case 'night': return 'The night is calm and peaceful.';
      default: return 'Time seems to flow gently here.';
    }
  }

  async updateTimeAndWeather(): Promise<void> {
    // Simple time progression logic
    const times = ['morning', 'noon', 'evening', 'night'];
    const weathers = ['sunny', 'cloudy', 'rainy'];
    
    const currentTimeIndex = times.indexOf(this.worldState.currentTime);
    const nextTimeIndex = (currentTimeIndex + 1) % times.length;
    
    this.worldState.currentTime = times[nextTimeIndex];
    
    // Occasionally change weather
    if (Math.random() < 0.3) {
      this.worldState.weather = weathers[Math.floor(Math.random() * weathers.length)];
    }
    
    this.logger.info(`Time progressed to ${this.worldState.currentTime}, weather: ${this.worldState.weather}`);
  }

  private getTimeBasedLighting(): string {
    const time = this.worldState.currentTime;
    switch (time) {
      case 'morning': return 'bright';
      case 'noon': return 'very_bright';
      case 'evening': return 'dim';
      case 'night': return 'dark';
      default: return 'normal';
    }
  }
}