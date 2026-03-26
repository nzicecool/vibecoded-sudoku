import { GoogleGenAI, Type } from "@google/genai";
import { boardToString } from "./sudokuUtils";
import { BoardState, HintResponse } from "../types";

export const getHint = async (board: BoardState): Promise<HintResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const boardStr = boardToString(board);

  const prompt = `
    You are a Sudoku expert. 
    Analyze the following Sudoku board state where '.' represents an empty cell.
    
    ${boardStr}

    Identify the best next logical move for the user. 
    Look for techniques like Naked Singles, Hidden Singles, Naked Pairs, or pointing pairs.
    Return the row index (0-8), column index (0-8), the correct value (1-9), and a concise explanation of the logic used.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            row: { type: Type.INTEGER, description: "Row index 0-8" },
            col: { type: Type.INTEGER, description: "Column index 0-8" },
            value: { type: Type.INTEGER, description: "The correct value for the cell" },
            explanation: { type: Type.STRING, description: "Brief explanation of why this is the correct move" },
          },
          required: ["row", "col", "value", "explanation"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result as HintResponse;
  } catch (error) {
    console.error("Error fetching hint:", error);
    throw new Error("Failed to generate hint");
  }
};
