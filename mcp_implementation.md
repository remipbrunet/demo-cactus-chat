# MCP Implementation in Cactus Chat

This document outlines recommendations, implementation notes, and design considerations for integrating Model Context Protocol (MCP) functionalities into the Cactus Chat application. It covers two primary aspects: connecting to external MCP servers and enabling tool-calling capabilities within the models used by Cactus Chat.

## 1. Integrating External MCP Servers

### 1.1. Overview and Rationale

Integrating external MCP servers allows Cactus Chat to leverage specialized models, custom logic, or local execution environments that are not directly embedded within the application. This approach is particularly useful for:

*   **Specialized Models:** Running models that require specific hardware or environments not suitable for direct mobile deployment.
*   **Local Execution & Privacy:** Keeping sensitive data processing on the user's local machine.
*   **Custom Logic:** Implementing unique conversational flows or data processing pipelines outside the core app.
*   **Development & Testing:** Rapid iteration on model logic without app redeployment.

A prime example is the `sequentialthinking` server from the `modelcontextprotocol/servers` repository, which provides a specific conversational flow.

### 1.2. Implementation Details

Integrating an external MCP server involves two main phases: setting up and running the server, and then modifying Cactus Chat to communicate with it.

#### 1.2.1. Running the External MCP Server

The external MCP server (e.g., `sequentialthinking`) is a standalone application that needs to be executed independently of Cactus Chat.

**Prerequisites:**
*   Node.js (LTS version recommended)
*   npm (Node Package Manager)

**Steps:**

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/modelcontextprotocol/servers.git
    cd servers
    ```
2.  **Navigate to the Specific Server:**
    For the `sequentialthinking` server:
    ```bash
    cd src/sequentialthinking
    ```
3.  **Install Dependencies:**
    ```bash
    npm install
    ```
4.  **Start the Server:**
    Check the `package.json` file within the `src/sequentialthinking` directory for the exact `start` script. Typically, it will be:
    ```bash
    npm start
    ```
    Upon successful startup, the server will usually log the address and port it's listening on (e.g., `Server listening on http://localhost:3000`). Note this address for configuring Cactus Chat.

**Considerations for Server Operation:**
*   **Server Uptime:** The external server must be running for Cactus Chat to connect to it.
*   **Port Conflicts:** Ensure the server's chosen port (e.g., 3000) is not already in use by another application on the user's machine.
*   **Background Processes:** For persistent use, users might need to run the server as a background process or service, depending on their operating system.

#### 1.2.2. Modifying Cactus Chat to Connect

This involves adding a new service layer within Cactus Chat to make HTTP requests to the running external MCP server.

**Steps:**

1.  **Create a New Service File:**
    Create a new TypeScript file, for example, `/home/assen/projects/demo-cactus-chat/services/chat/sequentialThinking.ts`.

    **Structure Example (`services/chat/sequentialThinking.ts`):**
    ```typescript
    import { Message } from '@/components/ui/chat/ChatMessage';
    import { ModelMetrics } from '@/utils/modelMetrics';
    import { ChatCompleteCallback, ChatProgressCallback } from './chat';
    import { Model } from '../models';

    const SEQUENTIAL_THINKING_SERVER_URL = 'http://localhost:3000'; // Or configurable via settings

    export async function streamSequentialThinkingCompletion(
      messages: Message[],
      model: Model,
      onProgress: ChatProgressCallback,
      onComplete: ChatCompleteCallback,
      streaming: boolean = true,
      maxTokens: number
    ) {
      try {
        const formattedMessages = messages.map(msg => ({
          content: msg.text,
          role: msg.isUser ? 'user' : 'assistant' // Adjust roles based on MCP server's expectation
        }));

        const payload = {
          messages: formattedMessages,
          // Add any other parameters required by the sequentialthinking server
          max_tokens: maxTokens,
          stream: streaming,
        };

        const response = await fetch(`${SEQUENTIAL_THINKING_SERVER_URL}/chat`, { // Assuming a /chat endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (streaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let responseText = '';
          let firstTokenTime: number | null = null;
          const startTime = performance.now();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // This part needs careful handling based on the server's streaming format (e.g., SSE, newline-delimited JSON)
            // For simplicity, assuming direct text chunks for now.
            responseText += chunk;

            if (!firstTokenTime && responseText.length > 0) {
              firstTokenTime = performance.now();
              // Update modelMetrics.timeToFirstToken
            }
            onProgress(responseText);
          }

          const endTime = performance.now();
          // Calculate completionTokens, tokensPerSecond, etc.
          const modelMetrics: ModelMetrics = {
            timeToFirstToken: firstTokenTime ? firstTokenTime - startTime : 0,
            completionTokens: responseText.length, // Placeholder, ideally from server
            tokensPerSecond: responseText.length / ((endTime - startTime) / 1000), // Placeholder
          };
          onComplete(modelMetrics, model, responseText);

        } else {
          const data = await response.json();
          const completeMessage = data.text || data.response; // Adjust based on server's non-streaming response
          const modelMetrics: ModelMetrics = { /* populate from data if available */ };
          onProgress(completeMessage);
          onComplete(modelMetrics, model, completeMessage);
        }

      } catch (error) {
        console.error('Error during Sequential Thinking completion:', error);
        throw error;
      }
    }
    ```

2.  **Define the New Model:**
    Add a new `Model` entry in `/home/assen/projects/demo-cactus-chat/services/models.ts` to represent the `SequentialThinking` server.

    **Example (`services/models.ts`):**
    ```typescript
    // ... existing imports and types
    export const models: Model[] = [
      // ... existing models
      {
        id: 'sequential-thinking',
        name: 'Sequential Thinking (Local)',
        value: 'sequential-thinking-local',
        provider: 'MCP', // Or a new 'Local' provider
        // ... other properties
      },
    ];
    ```

3.  **Integrate into UI and Chat Flow:**
    *   **Model Selection:** Update components like `app/conversationsScreen.tsx` or `components/ui/chat/ModelDisplay.tsx` to include the new `Sequential Thinking (Local)` model in the selection list.
    *   **Chat Service Mapping:** In the main chat service (e.g., `services/chat/_chat.ts`), add a case to route requests for the `sequential-thinking-local` model to your new `streamSequentialThinkingCompletion` function.
    *   **Settings (Optional but Recommended):** If the server's URL or port might change, consider adding a setting in `app/settingsScreen.tsx` to allow users to configure the `SEQUENTIAL_THINKING_SERVER_URL`.

### 1.3. Design Considerations

*   **Network Configuration:**
    *   **`localhost` on Emulator/Device:** When running Cactus Chat on an Android emulator, `localhost` typically refers to the emulator's own loopback interface. To connect to a server running on your *host machine*, you'll need to use `10.0.2.2` (for Android emulator) or your host machine's actual IP address (for physical devices).
    *   **Dynamic Configuration:** Make the server URL configurable in settings to adapt to different environments.
*   **Error Handling:** Implement robust error handling for network issues (server not running, connection refused, invalid response). Provide clear feedback to the user.
*   **Performance:** Local network calls are generally fast, but consider the processing time of the external server itself.
*   **Security:** Less of an issue for `localhost`, but consider if the server might be exposed.
*   **User Experience:** Clear instructions for users on how to run the external server.
*   **Lifecycle Management (Advanced):** Directly spawning and managing `npm`/`npx` processes from within a mobile application is generally **not feasible or recommended** due to platform security restrictions and the complexity of managing background processes on mobile OS. The expectation is that the external server is managed by the user.

### 1.4. Recommendations

*   **Start Simple:** Begin with a basic `fetch` request to confirm connectivity before implementing full streaming or complex logic.
*   **Clear User Guidance:** Provide explicit instructions for users on how to run the external server, including troubleshooting tips.
*   **Robust Error Handling:** Implement comprehensive `try-catch` blocks and user-friendly error messages for network failures or server-side issues.
*   **Configuration:** Make the external server's address configurable to support different deployment scenarios.

---

## 2. Implementing Tool Calling (Function Calling) within Cactus Chat

Tool calling (often referred to as function calling or plugin integration) enables Large Language Models (LLMs) to interact with external tools, APIs, or internal application functionalities. This significantly enhances the capabilities of a chatbot beyond simple text generation.

### 2.1. Overview and Rationale

**What is Tool Calling?**
It's the ability of an LLM to determine when to use an external tool, what arguments to pass to it, and then to process the tool's output. The model doesn't *execute* the tool; it *recommends* its execution in a structured format.

**Why is it valuable for Cactus Chat?**
*   **Enhanced Functionality:** Allows the chatbot to perform actions like fetching real-time data (weather, news), sending messages, setting reminders, or interacting with device features (e.g., location services).
*   **Dynamic Responses:** Responses can be tailored based on real-world data or user-specific actions.
*   **Integration:** Seamlessly connect the chatbot to existing APIs and services.
*   **MCP's Role:** MCP can provide a standardized protocol for defining and interacting with these tools, ensuring interoperability across different models and applications.

### 2.2. Implementation Details

Implementing tool calling involves preparing the model, defining the tools, and building the client-side logic within Cactus Chat to parse and execute tool calls.

#### 2.2.1. Model Selection and Preparation

The approach to model preparation depends on whether the chosen model has native function calling capabilities.

*   **Models with Native Function Calling:**
    *   **Examples:** Google Gemini, OpenAI's GPT models (e.g., `gpt-3.5-turbo-0613` and later).
    *   **Process:** These models are pre-trained to understand tool definitions (schemas) and generate structured tool calls (typically JSON) in their responses. You provide the model with a list of available tools and their schemas, and the model decides when to "call" one.
    *   **Integration:** Your client-side code sends the user's message along with the tool definitions to the model. The model's response will either be a text reply or a structured tool call.

*   **Fine-tuning Smaller Models for Tool Use (e.g., Qwen2.5 1.5B):**
    *   **Rationale:** If you want to use a smaller, more efficient model or a model without native function calling, you can fine-tune it to output tool calls in a specific format.
    *   **Process:**
        1.  **Dataset Creation:** This is the most critical step. You need to create a dataset of conversational turns where the model is expected to output a tool call.
            *   **Format:** Each data point would typically include a user prompt and the desired structured tool call output. The tool call should be embedded in the model's response in a way that's easy for Cactus Chat to parse (e.g., a specific JSON block, or a unique prefix/suffix).
            *   **Example (simplified):**
                ```json
                {
                  "prompt": "What's the weather like in London?",
                  "completion": "I need to check the weather. TOOL_CALL: {\"name\": \"get_weather\", \"args\": {\"location\": \"London\"}}"
                }
                ```
                Or, if following an MCP-like structure:
                ```json
                {
                  "prompt": "Set a timer for 5 minutes.",
                  "completion": "Okay, setting a timer. MCP_TOOL_CALL: {\"tool_id\": \"timer_tool\", \"action\": \"set_timer\", \"parameters\": {\"duration_minutes\": 5}}"
                }
                ```
            *   **MCP Specifics:** Ensure your tool call format adheres to any MCP specifications for tool definition and invocation.
        2.  **Training:** Use a fine-tuning framework (e.g., Hugging Face Transformers, LoRA) to train your chosen model (e.g., Qwen2.5 1.5B) on this custom dataset.
        3.  **Deployment:** Deploy the fine-tuned model. This could be locally (e.g., via `llama-local.ts` if it supports your model format) or on a cloud endpoint.

#### 2.2.2. Cactus Chat Client-Side Logic

This is where the application handles the interaction with the model and the execution of tools.

1.  **Tool Definition:**
    Define the tools that Cactus Chat can execute. This should include their `name`, a `description` (for the model to understand its purpose), and a `schema` for their `parameters`.

    **Example (`utils/tools.ts` or similar):**
    ```typescript
    export interface ToolParameter {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      description?: string;
      required?: boolean;
      enum?: string[];
      properties?: { [key: string]: ToolParameter };
      items?: ToolParameter;
    }

    export interface ToolDefinition {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: { [key: string]: ToolParameter };
        required?: string[];
      };
      execute: (args: any) => Promise<any>; // The actual function to run
    }

    export const availableTools: ToolDefinition[] = [
      {
        name: 'get_weather',
        description: 'Gets the current weather for a specified location.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'The city and state, e.g., San Francisco, CA' },
          },
          required: ['location'],
        },
        execute: async (args: { location: string }) => {
          console.log(`Executing get_weather for ${args.location}`);
          // In a real app, this would call a weather API
          return `The weather in ${args.location} is sunny with 25°C.`;
        },
      },
      // Add more tools here (e.g., send_message, set_timer, get_current_time)
    ];
    ```

2.  **Prompt Engineering (for fine-tuned models without native function calling):**
    When sending the prompt to a fine-tuned model, you might need to include instructions on how to format tool calls.

    **Example:**
    "You have access to the following tools: `get_weather(location: string)`. If you need to use a tool, respond with a JSON object like this: `{"tool_call": {"name": "tool_name", "args": {"arg1": "value1"}}}`. Otherwise, respond normally."

3.  **Response Parsing:**
    After receiving the model's response, Cactus Chat needs to inspect it to determine if a tool call is present.

    **Logic:**
    *   Check if the response contains a specific marker (e.g., "TOOL_CALL:", "MCP_TOOL_CALL:").
    *   Extract the JSON payload representing the tool call.
    *   Parse the JSON to get the `tool_name` and `args`.
    *   Validate the extracted tool call against the `availableTools` definitions (e.g., check if the tool exists, if required arguments are present).

    **Example (simplified):**
    ```typescript
    async function processModelResponse(modelResponse: string, model: Model) {
      const toolCallPrefix = 'TOOL_CALL: ';
      if (modelResponse.startsWith(toolCallPrefix)) {
        try {
          const jsonString = modelResponse.substring(toolCallPrefix.length);
          const toolCall = JSON.parse(jsonString);

          const toolDefinition = availableTools.find(t => t.name === toolCall.name);

          if (toolDefinition) {
            // Execute the tool
            const toolOutput = await toolDefinition.execute(toolCall.args);
            // Feed tool output back to the model
            await continueConversationWithToolOutput(toolOutput, model);
          } else {
            console.warn(`Unknown tool: ${toolCall.name}`);
            // Inform the user or model about the unknown tool
          }
        } catch (error) {
          console.error('Error parsing tool call:', error);
          // Inform the user or model about the parsing error
        }
      } else {
        // Regular text response, display to user
        onComplete(modelMetrics, model, modelResponse);
      }
    }
    ```

4.  **Tool Execution:**
    If a valid tool call is parsed, execute the corresponding function defined in `availableTools`.

    **Considerations:**
    *   **Asynchronous Operations:** Most tool executions (e.g., API calls) will be asynchronous.
    *   **Permissions:** For device-specific tools (e.g., location, camera), ensure the app has the necessary permissions.
    *   **User Confirmation:** For sensitive actions (e.g., sending a message, making a purchase), consider prompting the user for confirmation before executing the tool.

5.  **Tool Output Handling (Crucial for Multi-Turn Conversations):**
    The result of the tool execution must be fed back to the model as context for the next turn. This allows the model to "reason" about the tool's outcome and generate a relevant follow-up response.

    **Example (`continueConversationWithToolOutput`):**
    ```typescript
    async function continueConversationWithToolOutput(toolOutput: any, model: Model) {
      // Format the tool output as a new message/turn for the model
      const toolResultMessage: Message = {
        id: 'tool-result-' + Date.now(),
        text: `Tool output: ${JSON.stringify(toolOutput)}`, // Or a more user-friendly summary
        isUser: false, // This is context for the model, not a user message
        model: model,
        // You might want a special 'role' or 'type' for tool results
      };

      // Add this message to the conversation history and send it back to the model
      // This will trigger another completion request to the model
      // The model will then generate a user-facing response based on the tool output
      // e.g., streamGeminiCompletion([...currentMessages, toolResultMessage], model, ...)
    }
    ```

### 2.3. Design Considerations

*   **Tool Schema Management:** Maintain a clear and consistent way to define tool schemas. This is vital for both the model's understanding and the client's validation.
*   **Security and Permissions:** Carefully consider what actions tools can perform. Implement strict permission checks and user confirmations for any sensitive operations.
*   **Error Handling:** What happens if a tool execution fails (e.g., API error, network issue)? How is this communicated back to the model and the user?
*   **Asynchronous Flow:** Tool execution introduces asynchronous steps into the conversation flow. Manage promises and callbacks effectively.
*   **State Management:** How will the conversation state be managed across multiple turns involving tool calls? (e.g., storing tool outputs, pending actions).
*   **User Experience:** Provide clear visual cues when a tool is being called or executed. Inform the user about the outcome of tool calls.
*   **Model Latency:** Tool calls add an extra round-trip (model -> client -> tool -> client -> model -> client), which can increase perceived latency.
*   **MCP Standard Adherence:** If aiming for MCP compliance, ensure that tool definitions, invocation formats, and result handling align with the MCP specification.

### 2.4. Recommendations

*   **Start Small:** Begin by implementing one or two simple, non-sensitive tools (e.g., `get_current_time`) to establish the basic tool-calling pipeline.
*   **Clear Tool Definitions:** Invest time in writing clear and precise descriptions and parameter schemas for your tools. This directly impacts the model's ability to use them correctly.
*   **Prioritize Security:** For any tool that performs actions outside the app or accesses sensitive data, implement explicit user confirmation steps.
*   **Iterative Feedback Loop:** Ensure the tool's output is always fed back to the model. This is fundamental for the model to provide coherent and contextually relevant responses.
*   **Modular Design:** Keep tool definitions and execution logic separate from the core chat UI and model interaction logic for better maintainability.
*   **Consider Libraries:** Explore existing libraries or frameworks for function calling if they align with your chosen model and development stack, as they can simplify implementation.
