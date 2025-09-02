// Hammer 2.1 Specific Prompt Builder
// Creates targeted prompts for static tool calling

export function buildHammerToolPrompt(userMessage: string, servers: any[]): string {
  const lowerMessage = userMessage.toLowerCase();
  
  // Direct keyword detection for Hammer 2.1
  // React/npm/frontend keywords -> Context7
  if (lowerMessage.includes('react') || 
      lowerMessage.includes('vue') || 
      lowerMessage.includes('angular') ||
      lowerMessage.includes('npm') ||
      lowerMessage.includes('hook') ||
      lowerMessage.includes('component') ||
      lowerMessage.includes('useState') ||
      lowerMessage.includes('useEffect')) {
    
    // Find Context7 server
    const context7 = servers.find(s => 
      s.name.toLowerCase().includes('context7') && s.tools?.length > 0
    );
    
    if (context7) {
      // Determine which Context7 tool to use
      const needsResolve = lowerMessage.includes('install') || 
                          lowerMessage.includes('package') || 
                          lowerMessage.includes('npm') ||
                          lowerMessage.includes('version');
      
      const tool = needsResolve ? 
        context7.tools.find((t: any) => t.name === 'resolve-library-id') :
        context7.tools.find((t: any) => t.name === 'get-library-docs');
      
      if (tool) {
        return buildDirectToolPrompt(tool, userMessage);
      }
    }
  }
  
  // Azure/Microsoft keywords -> Microsoft Docs
  if (lowerMessage.includes('azure') || 
      lowerMessage.includes('microsoft') ||
      lowerMessage.includes('.net') ||
      lowerMessage.includes('dotnet') ||
      lowerMessage.includes('cosmos') ||
      lowerMessage.includes('blob') ||
      lowerMessage.includes('entra') ||
      lowerMessage.includes('pim') ||  // Privileged Identity Management
      lowerMessage.includes('active directory') ||
      lowerMessage.includes('graph')) {
    
    const msDocsServer = servers.find(s => 
      s.name.toLowerCase().includes('microsoft') && s.tools?.length > 0
    );
    
    if (msDocsServer) {
      const tool = msDocsServer.tools.find((t: any) => t.name === 'microsoft_docs_search');
      if (tool) {
        return buildDirectToolPrompt(tool, userMessage);
      }
    }
  }
  
  // Fallback to listing all tools
  return buildGenericToolPrompt(servers);
}

function buildDirectToolPrompt(tool: any, userMessage: string): string {
  let prompt = '\n\n## TOOL INSTRUCTION\n\n';
  prompt += `You must use ONLY this tool to answer the question:\n\n`;
  prompt += `Tool: "${tool.name}"\n\n`;
  prompt += 'Output this EXACT format (replace parameter values):\n';
  prompt += '```json\n';
  
  const example: any = {
    name: tool.name,
    arguments: {}
  };
  
  // Smart parameter extraction
  if (tool.name === 'resolve-library-id') {
    // Extract library name from question
    if (userMessage.toLowerCase().includes('react')) {
      example.arguments.libraryName = 'react';
    } else if (userMessage.toLowerCase().includes('vue')) {
      example.arguments.libraryName = 'vue';
    } else {
      example.arguments.libraryName = 'LIBRARY_NAME_FROM_QUESTION';
    }
  } else if (tool.name === 'get-library-docs') {
    example.arguments.context7CompatibleLibraryID = '/facebook/react';
    if (userMessage.toLowerCase().includes('hook')) {
      example.arguments.topic = 'hooks';
    }
  } else if (tool.name === 'microsoft_docs_search') {
    example.arguments.query = userMessage;
  }
  
  prompt += JSON.stringify(example, null, 2);
  prompt += '\n```\n\n';
  prompt += 'IMPORTANT: Output ONLY the JSON above with the correct values. Nothing else.\n';
  
  return prompt;
}

function buildGenericToolPrompt(servers: any[]): string {
  let prompt = '\n\n## AVAILABLE TOOLS\n\n';
  prompt += 'Output tool calls in this format:\n';
  prompt += '```json\n{"name": "TOOL_NAME", "arguments": {...}}\n```\n\n';
  prompt += 'Tools with their required parameters:\n';
  
  for (const server of servers) {
    if (server.tools?.length > 0) {
      prompt += `\n${server.name}:\n`;
      for (const tool of server.tools) {
        prompt += `- "${tool.name}"`;
        
        // Add parameter info
        if (tool.inputSchema?.required?.length > 0) {
          const params = tool.inputSchema.required.join(', ');
          prompt += ` (requires: ${params})`;
        }
        prompt += '\n';
        
        // Add example for clarity
        if (tool.name === 'resolve-library-id') {
          prompt += '  Example: {"name": "resolve-library-id", "arguments": {"libraryName": "react"}}\n';
        } else if (tool.name === 'microsoft_docs_search') {
          prompt += '  Example: {"name": "microsoft_docs_search", "arguments": {"query": "your question"}}\n';
        }
      }
    }
  }
  
  return prompt;
}

export function cleanStreamingJson(text: string): string {
  // Remove streaming artifacts
  // The streaming creates patterns like:
  // {"name
  // {"name":
  // {"name": "tool
  // {"name": "tool"
  // We want just the final complete JSON
  
  // Find all complete JSON objects
  const jsonObjects: string[] = [];
  let currentJson = '';
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      currentJson += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      currentJson += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      currentJson += char;
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          currentJson = ''; // Start new JSON object
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          currentJson += char;
          jsonObjects.push(currentJson);
          currentJson = '';
          continue;
        }
      }
    }
    
    if (braceCount > 0) {
      currentJson += char;
    }
  }
  
  // Return the last complete JSON object
  return jsonObjects.length > 0 ? jsonObjects[jsonObjects.length - 1] : '';
}