import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: "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",
});

const stream = await client.chat.completions.create({
  model: "z-ai/glm-5.1",
  messages: [{ role: "user", content: "Hello, what can you do?" }],
  temperature: 1,
  top_p: 1,
  max_tokens: 16384,
  stream: true,
});

for await (const chunk of stream) {
  if (!chunk.choices?.length) continue;
  const delta = chunk.choices[0]?.delta;
  if (delta?.content) process.stdout.write(delta.content);
}
