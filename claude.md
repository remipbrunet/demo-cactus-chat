# MCP Integration Lessons Learned

## Overview
This document captures critical lessons learned from implementing MCP (Model Context Protocol) integration with LLM models, specifically focusing on challenges encountered with static tool-calling models like Hammer 2.1.

## Key Challenges and Solutions

### 1. Static vs Dynamic Tool Calling
**Challenge**: Smaller models (1.5B parameters) like Hammer 2.1 only support static tool calling - they cannot dynamically select tools based on descriptions.

**Solution**: Implement a dual architecture:
- **Dynamic Models**: Use generic tool discovery and let the model select based on descriptions
- **Static Models**: Use keyword-based routing to pre-select tools before prompting the model

### 2. Nested Response Structures
**Challenge**: MCP servers may return deeply nested JSON structures that need parsing to extract clean content.

**Example Problem**:
```javascript
// What you get from MCP server:
{
  result: {
    content: [{
      type: "text",
      text: "[{\"title\":\"Some Title\",\"content\":\"Actual content here\"}]"
    }]
  }
}
```

**Solution**: Parse nested structures recursively:
```typescript
// Check if result.content exists and is an array
if (result.content && Array.isArray(result.content)) {
  for (const item of result.content) {
    if (item.type === 'text' && item.text) {
      // The text field might contain JSON string
      if (item.text.startsWith('[{') || item.text.startsWith('{')) {
        const parsed = JSON.parse(item.text);
        // Extract just the content, skip titles and metadata
        text = parsed[0].content;
      }
    }
  }
}
```

### 3. Streaming JSON Artifacts
**Challenge**: Streaming responses can create repeated JSON fragments that accumulate and corrupt the output.

**Solution**: 
- Clean streaming artifacts before processing
- Remove duplicate JSON structures
- Track what's already been processed

### 4. Message Field Inconsistencies
**Challenge**: Different parts of the system may use different field names (e.g., `content` vs `text` for messages).

**Solution**: Check multiple field names and handle gracefully:
```typescript
const messageText = message.text || message.content || '';
```

### 5. Tool Name vs Server Name Confusion
**Challenge**: Models may output server names instead of actual tool names.

**Solution**: 
- Emphasize exact tool names in prompts
- Provide clear examples with actual tool names
- Validate tool names before execution

## Best Practices for MCP Integration

### 1. Flexible Response Parsing
Always be prepared for multiple response formats:
- Direct text responses
- JSON strings within text fields
- Nested content arrays
- Mixed content types

### 2. Keyword Detection for Static Models
When implementing keyword-based routing:
- Strip prefixes (like `/no_think`) before detection
- Use comprehensive keyword lists
- Test with real user queries
- Document keywords clearly for maintenance

### 3. Error Handling
- Log full response structures during development
- Provide fallbacks for parsing failures
- Never show raw JSON to users
- Clean up formatting artifacts

### 4. Testing Strategy
Test with multiple scenarios:
- Different MCP servers
- Various response formats
- Edge cases (empty responses, malformed JSON)
- Both streaming and non-streaming modes

## Architecture Recommendations

### For New MCP Integrations

1. **Start with Generic Approach**: Build for dynamic tool selection first
2. **Add Static Support Later**: Layer keyword-based routing only if needed
3. **Abstract Response Parsing**: Create a unified response parser that handles various formats
4. **Maintain Clean Separation**: Keep MCP logic separate from UI/chat logic
5. **Document Server Quirks**: Each MCP server may have unique response formats

### Response Parser Pattern
```typescript
class MCPResponseParser {
  static parse(response: any): string {
    // Try multiple parsing strategies
    // 1. Direct text
    if (typeof response === 'string') return response;
    
    // 2. Content array with text items
    if (response.content && Array.isArray(response.content)) {
      return this.parseContentArray(response.content);
    }
    
    // 3. Result with nested content
    if (response.result && response.result.content) {
      return this.parse(response.result);
    }
    
    // 4. Fallback
    return JSON.stringify(response);
  }
  
  static parseContentArray(content: any[]): string {
    // Handle various content types
    // Extract clean text without artifacts
  }
}
```

## Common Pitfalls to Avoid

1. **Don't Assume Response Format**: Always validate structure before accessing nested fields
2. **Don't Show Raw JSON**: Always parse and format for user consumption
3. **Don't Hardcode Tool Names**: Keep tool selection flexible and configurable
4. **Don't Ignore Streaming**: Handle streaming artifacts early in the pipeline
5. **Don't Trust Model Output**: Validate tool calls before execution

## Debugging Tips

When things go wrong:
1. Log the complete raw response from MCP server
2. Check if the model is actually calling tools (look for `<tool_call>` tags)
3. Verify keyword detection is working (log detected keywords)
4. Ensure the correct tool name is being used (not server name)
5. Test with a simple direct question to isolate issues

## Conclusion

MCP integration requires careful handling of various response formats and model capabilities. The key is building a flexible system that can adapt to different servers and models while maintaining a clean user experience. Always prioritize showing clean, natural language to users, regardless of the underlying complexity.