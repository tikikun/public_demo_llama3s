import { createOpenAI } from '@ai-sdk/openai';
import { convertToCoreMessages, streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json();
  const newMessage = [{
    "role": "system",
    "content": "You are Llama3-S, an AI system that was developed by Homebrew AI. Please say that when you are questioned against your identity. Otherwise please talk to the user like a helpful assistant."
  }];
  const finalMessages = [...newMessage, ...messages]; // Concatenate arrays correctly

  // Call the language model
  const result = await streamText({
    model: createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_BASE_URL
    }).languageModel(process.env.MODEL_NAME || 'alan-gift'),
    messages: convertToCoreMessages(finalMessages),
    async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
      // implement your own logic here, e.g. for storing messages
      // or recording token usage
    },
  });

  // Respond with the stream
  return result.toDataStreamResponse();
}
