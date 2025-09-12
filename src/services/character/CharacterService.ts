import { CharacterManager } from '../../domains/character/aggregates';
import { Character } from '../../domains/character/entities';
import { DatabaseService } from '../../services/database/DatabaseService';
import { LLMService } from '../../services/llm/LLMService';
import { Logger } from '../../services/Logger';

export interface CharacterData {
  id: string;
  name: string;
  personality?: any;
  background?: string;
  currentLocation?: string;
  emotionalState?: any;
}

export interface CharacterArchetype {
  id: string;
  name: string;
  description: string;
  commonTraits: string[];
  occupations: string[];
  motivations: string[];
  speechPatterns: {
    formality: [number, number]; // min, max range
    emotiveness: [number, number];
    verbosity: [number, number];
    commonPhrases: string[];
  };
  backgroundTemplates?: string[];
  secretTypes?: string[];
  relationshipTendencies: string[];
}

export interface LocationCharacterNeeds {
  location: string;
  suggestedArchetypes: string[];
  maxCharacters: number;
  requiredRoles?: string[];
  atmosphereKeywords: string[];
}

export class CharacterService {
  private archetypes: Map<string, CharacterArchetype> = new Map();
  private locationNeeds: Map<string, LocationCharacterNeeds> = new Map();
  private characterManager: CharacterManager;

  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private databaseService?: DatabaseService
  ) {
    this.characterManager = new CharacterManager(llmService, logger);
    this.initializeArchetypes();
    this.initializeLocationNeeds();
  }

  createCharacter(id: string, name?: string): Character {
    const profile = {
      id,
      name: name || `Character_${id}`,
      appearance: 'A character in the game world',
      personality: {
        traits: { friendly: 0.7, helpful: 0.8 },
        values: { honesty: 0.8, loyalty: 0.7 },
        goals: ['assist player'],
        fears: ['failure'],
        motivations: ['helpfulness']
      },
      background: `A character with ID ${id}`
    };
    return this.characterManager.createCharacter(profile);
  }

  createCharacterWithData(data: CharacterData): Character {
    const profile = {
      id: data.id,
      name: data.name,
      appearance: 'A character from saved data',
      personality: data.personality ? {
        traits: data.personality.traits || { neutral: 0.5 },
        values: data.personality.values || {},
        goals: data.personality.goals || [],
        fears: data.personality.fears || [],
        motivations: data.personality.motivations || []
      } : {
        traits: { neutral: 0.5 },
        values: {},
        goals: [],
        fears: [],
        motivations: []
      },
      background: data.background || ''
    };
    return this.characterManager.createCharacter(profile);
  }

  getCharacter(id: string): Character | undefined {
    // Since CharacterManager doesn't have getCharacter method, 
    // we'll need to track characters differently or implement a simpler approach
    // For now, return undefined as this would need CharacterManager extension
    return undefined;
  }

  async generateCharacterResponse(id: string, input: string, context: any): Promise<string> {
    // Create a temporary character for response generation
    const character = this.createCharacter(id);
    return await this.characterManager.generateCharacterResponse(character, context);
  }

  updateCharacterState(id: string, stateUpdate: any): void {
    // Since CharacterManager doesn't have updateCharacterState method,
    // this would need to be implemented differently or the method extended
    this.logger.info(`Character ${id} state update requested`);
  }

  getArchetype(id: string): CharacterArchetype | undefined {
    return this.archetypes.get(id);
  }

  getAllArchetypes(): CharacterArchetype[] {
    return Array.from(this.archetypes.values());
  }

  getArchetypesByTraits(traits: string[]): CharacterArchetype[] {
    return Array.from(this.archetypes.values()).filter(archetype =>
      traits.some(trait => archetype.commonTraits.includes(trait))
    );
  }

  getArchetypesByOccupation(occupation: string): CharacterArchetype[] {
    return Array.from(this.archetypes.values()).filter(archetype =>
      archetype.occupations.some(occ => 
        occ.toLowerCase().includes(occupation.toLowerCase()) ||
        occupation.toLowerCase().includes(occ.toLowerCase())
      )
    );
  }

  getLocationNeeds(location: string): LocationCharacterNeeds | undefined {
    return this.locationNeeds.get(location);
  }

  recommendArchetypesForLocation(location: string): CharacterArchetype[] {
    const needs = this.getLocationNeeds(location);
    if (!needs) {
      return this.getDefaultArchetypes();
    }

    return needs.suggestedArchetypes
      .map(id => this.getArchetype(id))
      .filter(archetype => archetype !== undefined) as CharacterArchetype[];
  }

  generateRandomCharacterConcept(): {
    archetype: CharacterArchetype;
    occupation: string;
    primaryTrait: string;
    motivation: string;
  } {
    const archetypes = Array.from(this.archetypes.values());
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    
    const occupation = archetype.occupations[Math.floor(Math.random() * archetype.occupations.length)];
    const primaryTrait = archetype.commonTraits[Math.floor(Math.random() * archetype.commonTraits.length)];
    const motivation = archetype.motivations[Math.floor(Math.random() * archetype.motivations.length)];

    return { archetype, occupation, primaryTrait, motivation };
  }

  private initializeArchetypes(): void {
    // Library keeper archetype
    this.archetypes.set('wise_elder', {
      id: 'wise_elder',
      name: 'Wise Elder',
      description: 'An older, wise character who serves as a keeper of knowledge',
      commonTraits: ['wise', 'patient', 'knowledgeable'],
      occupations: ['librarian', 'scholar', 'teacher'],
      motivations: ['preserve_knowledge', 'guide_others'],
      speechPatterns: { 
        formality: [70, 90], 
        emotiveness: [40, 60], 
        verbosity: [60, 80], 
        commonPhrases: ['as I recall', 'in my experience', 'knowledge is power'] 
      },
      backgroundTemplates: ['ancient_library_guardian', 'former_adventurer'],
      secretTypes: ['forgotten_knowledge', 'family_secret'],
      relationshipTendencies: ['mentor', 'advisor']
    });

    // Town protector archetype
    this.archetypes.set('brave_warrior', {
      id: 'brave_warrior',
      name: 'Brave Warrior',
      description: 'A bold warrior who protects the town and its people',
      commonTraits: ['brave', 'loyal', 'strong'],
      occupations: ['guard', 'soldier', 'blacksmith'],
      motivations: ['protect_town', 'uphold_justice'],
      speechPatterns: { 
        formality: [30, 60], 
        emotiveness: [60, 80], 
        verbosity: [40, 60], 
        commonPhrases: ['no problem', 'leave it to me', 'for the town'] 
      },
      backgroundTemplates: ['former_mercenary', 'local_hero'],
      secretTypes: ['battle_scars', 'lost_comrade'],
      relationshipTendencies: ['protector', 'ally']
    });

    // Merchant archetype
    this.archetypes.set('clever_merchant', {
      id: 'clever_merchant',
      name: 'Clever Merchant',
      description: 'A charismatic merchant who travels the world',
      commonTraits: ['clever', 'charismatic', 'adaptable'],
      occupations: ['merchant', 'trader', 'innkeeper'],
      motivations: ['profit', 'connections', 'adventure'],
      speechPatterns: { 
        formality: [40, 70], 
        emotiveness: [50, 70], 
        verbosity: [50, 80], 
        commonPhrases: ['good deal', 'what do you need', 'I know a thing or two'] 
      },
      backgroundTemplates: ['world_traveler', 'family_business'],
      secretTypes: ['hidden_cache', 'rival_business'],
      relationshipTendencies: ['business_partner', 'friend']
    });

    // Town leader archetype
    this.archetypes.set('responsible_leader', {
      id: 'responsible_leader',
      name: 'Responsible Leader',
      description: 'A kind leader who keeps the town secrets',
      commonTraits: ['kind', 'responsible', 'diplomatic'],
      occupations: ['mayor', 'council_member', 'community_leader'],
      motivations: ['maintain_order', 'keep_secrets', 'help_people'],
      speechPatterns: { 
        formality: [60, 80], 
        emotiveness: [30, 50], 
        verbosity: [50, 70], 
        commonPhrases: ['for the good of the town', 'we must consider', 'it is my duty'] 
      },
      backgroundTemplates: ['former_adventurer', 'family_line'],
      secretTypes: ['town_secret', 'personal_guilt'],
      relationshipTendencies: ['leader', 'confidant']
    });
  }

  private initializeLocationNeeds(): void {
    this.locationNeeds.set('library', {
      location: 'library',
      suggestedArchetypes: ['wise_elder'],
      maxCharacters: 2,
      requiredRoles: ['librarian'],
      atmosphereKeywords: ['quiet', 'knowledge', 'mystery']
    });

    this.locationNeeds.set('blacksmith', {
      location: 'blacksmith',
      suggestedArchetypes: ['brave_warrior'],
      maxCharacters: 2,
      requiredRoles: ['blacksmith'],
      atmosphereKeywords: ['fire', 'metal', 'strength']
    });

    this.locationNeeds.set('market', {
      location: 'market',
      suggestedArchetypes: ['clever_merchant'],
      maxCharacters: 5,
      requiredRoles: ['merchant'],
      atmosphereKeywords: ['commerce', 'noise', 'diversity']
    });

    this.locationNeeds.set('town_hall', {
      location: 'town_hall',
      suggestedArchetypes: ['responsible_leader'],
      maxCharacters: 3,
      requiredRoles: ['mayor'],
      atmosphereKeywords: ['authority', 'secrecy', 'governance']
    });
  }

  private getDefaultArchetypes(): CharacterArchetype[] {
    return [
      this.archetypes.get('wise_elder')!,
      this.archetypes.get('brave_warrior')!,
      this.archetypes.get('clever_merchant')!,
      this.archetypes.get('responsible_leader')!
    ].filter(a => a !== undefined);
  }
}