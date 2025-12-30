
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateLore(entityName: string, context: string) {
  try {
    // Fix: Added thinkingBudget to config as required when maxOutputTokens is set
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a grimdark narrator. Write a 1-sentence atmospheric description for a turn-based combat encounter involving ${entityName}. Context: ${context}. Keep it dark, gothic, and brief.`,
      config: {
        maxOutputTokens: 50,
        temperature: 0.9,
        thinkingConfig: { thinkingBudget: 25 }
      }
    });
    return response.text?.trim() || "A cold wind whispers through the shattered ribs of the abyss.";
  } catch (err) {
    return "A cold wind whispers through the shattered ribs of the abyss.";
  }
}

export async function generateRoomDescription() {
  try {
    // Fix: Added thinkingBudget to config as required when maxOutputTokens is set
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a Gothic Dungeon Master. Describe the current room the player has entered. Mention damp stones, flickering shadows, and the smell of ancient decay. Keep it to 2 evocative sentences.`,
      config: { 
        maxOutputTokens: 100,
        thinkingConfig: { thinkingBudget: 50 }
      }
    });
    return response.text?.trim() || "The air here is thick with the scent of wet copper and rot. Shadows dance like dying ghosts upon the weeping stone walls.";
  } catch (err) {
    return "Darkness clings to every corner of this damp, forgotten chamber.";
  }
}

export async function getCombatFlavor(attacker: string, target: string, action: string, damage: number) {
  try {
    // Fix: Added thinkingBudget to config as required when maxOutputTokens is set
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Grimdark combat log: ${attacker} used ${action} on ${target} for ${damage} damage. Write a short, visceral 1-sentence D&D description.`,
      config: {
        maxOutputTokens: 60,
        thinkingConfig: { thinkingBudget: 30 }
      }
    });
    return response.text?.trim() || `${attacker} strikes ${target} with malice.`;
  } catch (err) {
    return `${attacker} strikes ${target} with malice.`;
  }
}